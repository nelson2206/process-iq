/* ============================================================
 * ProcessIQ — intermediario de la API de Anthropic (Cloudflare Worker)
 *
 * Por que existe: ProcessIQ es una web estatica y publica. Una API key
 * escrita en ella la podria copiar cualquiera y gastar sin limite. Aqui la
 * clave vive como SECRETO del Worker; el navegador nunca la ve. Los usuarios
 * entran con un codigo de equipo.
 *
 * Contrato con la app (callClaude en app.js, modo "equipo"):
 *   POST {intermediario}/v1/messages
 *   cabecera  x-processiq-code: <codigo de equipo>
 *   cuerpo    el mismo JSON que acepta la API de Anthropic
 *   respuesta la de Anthropic, tal cual (salvo errores del propio Worker)
 *   GET  {intermediario}/health  -> { ok, configurado, formatoClave }  (sin codigo; para probar)
 *
 * Configuracion en el panel de Cloudflare (Workers & Pages > processiq-api >
 * Settings > Variables and Secrets):
 *   ANTHROPIC_API_KEY  secreto  la clave de console.anthropic.com
 *   ACCESS_CODE        secreto  el codigo que se reparte al equipo
 *   ALLOWED_ORIGINS    texto    origenes que pueden llamar, separados por coma
 *                               (por defecto solo https://procesos.mbc-latam.com)
 *
 * Limites deliberados: solo los modelos de la app, max_tokens topado a 64000 y
 * cuerpo de hasta 2 MB. El streaming SSE se reenvia tal cual (la app lo usa
 * para respuestas largas). fallbacks solo admite "default" y el Worker anade su
 * cabecera beta. El techo de GASTO se fija en la consola de Anthropic (Limits):
 * es la red de seguridad real.
 *
 * Gasto en IA: cada respuesta exitosa se "teea" (r.body.tee()) — una copia
 * va al usuario sin tocar, la otra se lee en segundo plano (ctx.waitUntil,
 * no bloquea ni puede romper la respuesta) para sacar los tokens reales
 * (de message_start/message_delta si es streaming, o de "usage" si no) y
 * reportarlos a Pulse (registro central del ecosistema). Si el reporte
 * falla, se ignora en silencio: nunca debe afectar al usuario.
 * ============================================================ */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const PULSE_INGEST = 'https://pulse.mbc-latam.com/api/ai-usage';
// claude-opus-5 se conserva: otras herramientas del ecosistema siguen pidiendolo
// claude-sonnet-5-5: relevamiento de procesos (voz-relevamiento-api) para las tareas que no necesitan Opus
const MODELOS = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5', 'claude-sonnet-5', 'claude-haiku-4-5']);
const MAX_TOKENS = 128000;   // v3.9.1: lo que admiten Opus 5.5 y Sonnet 5; cada app pide lo que necesite por debajo
const MAX_BODY = 2 * 1024 * 1024;
// Las llamadas internas (otros Workers de la cuenta) pueden llevar un PDF en base64 (voz-relevamiento-api: hasta 10 MB de PDF).
const MAX_BODY_INTERNO = 16 * 1024 * 1024;

// Lee el stream (ya teeado, no es el que ve el usuario) y saca los tokens
// reales de la respuesta de Anthropic. Nunca lanza: sin dato, null.
async function extraerUso(stream, esStreaming) {
  try {
    const texto = await new Response(stream).text();
    if (!esStreaming) {
      const u = JSON.parse(texto).usage;
      return u ? { inputTokens: u.input_tokens || 0, outputTokens: u.output_tokens || 0 } : null;
    }
    // SSE: el input llega en message_start; el output final, en el ultimo
    // message_delta (su "usage.output_tokens" es acumulado, no incremental).
    let inputTokens = 0, outputTokens = 0, visto = false;
    for (const linea of texto.split('\n')) {
      if (!linea.startsWith('data:')) continue;
      let ev;
      try { ev = JSON.parse(linea.slice(5).trim()); } catch { continue; }
      if (ev.type === 'message_start' && ev.message && ev.message.usage) {
        inputTokens = ev.message.usage.input_tokens || 0; visto = true;
      } else if (ev.type === 'message_delta' && ev.usage) {
        outputTokens = ev.usage.output_tokens || 0; visto = true;
      }
    }
    return visto ? { inputTokens, outputTokens } : null;
  } catch (e) { return null; }
}

async function registrarGasto(model, uso) {
  if (!uso) return;
  try {
    await fetch(PULSE_INGEST, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tool: 'processiq', provider: 'anthropic', model, inputTokens: uso.inputTokens, outputTokens: uso.outputTokens })
    });
  } catch (e) { /* el registro de gasto nunca debe afectar la respuesta al usuario */ }
}

// ============================================================
// REPOSITORIO CENTRAL DE PROCESOS (v3.12.0) — Cloudflare D1 (binding DB)
//   GET    /v1/procesos?q=texto&industria=X   lista (sin el JSON pesado)
//   GET    /v1/procesos/:id                   proceso completo
//   GET    /v1/procesos/:id/versiones         historial (sin datos)
//   GET    /v1/procesos/:id/versiones/:n      una version concreta
//   POST   /v1/procesos                       crea   { autor, datos }
//   PUT    /v1/procesos/:id                   guarda { autor, datos, version } (version = la que se abrio)
//   DELETE /v1/procesos/:id                   borrado logico
// Acceso: mismo codigo de equipo que la IA, y solo desde el origen de
// ProcessIQ (REPO_ORIGINS): las otras apps que comparten este Worker NO leen
// procesos de clientes. Otros Workers de la cuenta pueden LEER con
// x-internal-code (para alimentar otras herramientas), nunca escribir.
// Concurrencia: PUT con una version vieja devuelve 409 con la vigente, para
// que nadie pise sin saberlo el trabajo de otro consultor.
// ============================================================
const MAX_PROCESO = 1500000;   // caracteres de JSON por proceso (D1 admite ~2 MB por fila)

function metricasProceso(d) {
  const nodes = Array.isArray(d && d.nodes) ? d.nodes : [];
  let subprocesos = 0;
  const contarSubs = (ns) => ns.forEach(n => { if (n && n.sub && Array.isArray(n.sub.nodes) && n.sub.nodes.length) { subprocesos++; contarSubs(n.sub.nodes); } });
  contarSubs(nodes);
  const carriles = new Set(nodes.map(n => (n && n.owner) || '').filter(Boolean)).size;
  return {
    nodos: nodes.length,
    actividades: nodes.filter(n => n && (n.type === 'task' || n.type === 'system')).length,
    decisiones: nodes.filter(n => n && n.type === 'decision').length,
    carriles, subprocesos
  };
}
const txt = (v, max) => String(v == null ? '' : v).trim().slice(0, max || 300);

async function rutaRepositorio(req, env, url, cors, interno) {
  if (!env.DB) return error('El repositorio no esta configurado en el intermediario', 500, cors);
  const partes = url.pathname.split('/').filter(Boolean);   // ['v1','procesos',id?,'versiones'?,n?]
  const id = partes[2] || null;
  const m = req.method;
  if (interno && m !== 'GET') return error('Las llamadas internas solo pueden leer', 403, cors);
  const ahora = new Date().toISOString();

  if (m === 'GET' && !id) {
    const q = txt(url.searchParams.get('q'), 100), ind = txt(url.searchParams.get('industria'), 100);
    let sql = 'SELECT id, nombre, industria, macroproceso, cliente, autor, version, nodos, actividades, decisiones, carriles, subprocesos, creado, actualizado FROM procesos WHERE borrado = 0';
    const args = [];
    if (q) { sql += ' AND (nombre LIKE ?1 OR macroproceso LIKE ?1 OR cliente LIKE ?1 OR industria LIKE ?1 OR autor LIKE ?1)'; args.push('%' + q + '%'); }
    if (ind) { sql += ' AND industria = ?' + (args.length + 1); args.push(ind); }
    sql += ' ORDER BY actualizado DESC LIMIT 500';
    const r = await env.DB.prepare(sql).bind(...args).all();
    return responderJson({ procesos: r.results || [] }, 200, cors);
  }
  if (m === 'GET' && id && partes[3] === 'versiones') {
    if (partes[4]) {
      const v = await env.DB.prepare('SELECT version, autor, fecha, datos FROM versiones WHERE proceso_id = ?1 AND version = ?2').bind(id, +partes[4]).first();
      if (!v) return error('Version no encontrada', 404, cors);
      return responderJson({ version: v.version, autor: v.autor, fecha: v.fecha, datos: JSON.parse(v.datos) }, 200, cors);
    }
    const r = await env.DB.prepare('SELECT version, autor, fecha, length(datos) AS tamano FROM versiones WHERE proceso_id = ?1 ORDER BY version DESC').bind(id).all();
    return responderJson({ versiones: r.results || [] }, 200, cors);
  }
  if (m === 'GET' && id) {
    const p = await env.DB.prepare('SELECT * FROM procesos WHERE id = ?1 AND borrado = 0').bind(id).first();
    if (!p) return error('Proceso no encontrado', 404, cors);
    p.datos = JSON.parse(p.datos);
    return responderJson(p, 200, cors);
  }
  if (m === 'DELETE' && id) {
    const r = await env.DB.prepare('UPDATE procesos SET borrado = 1, actualizado = ?2 WHERE id = ?1 AND borrado = 0').bind(id, ahora).run();
    if (!r.meta || !r.meta.changes) return error('Proceso no encontrado', 404, cors);
    return responderJson({ ok: true }, 200, cors);
  }
  if (m === 'POST' || m === 'PUT') {
    if (+(req.headers.get('content-length') || 0) > MAX_PROCESO + 20000) return error('El proceso es demasiado grande para el repositorio', 413, cors);
    let b;
    try { b = await req.json(); } catch (e) { return error('Cuerpo JSON invalido', 400, cors); }
    const d = b && b.datos;
    if (!d || !Array.isArray(d.nodes)) return error('Falta el proceso (datos.nodes)', 400, cors);
    const datos = JSON.stringify(d);
    if (datos.length > MAX_PROCESO) return error('El proceso es demasiado grande para el repositorio', 413, cors);
    const meta = d.meta || {};
    const mt = metricasProceso(d);
    const autor = txt(b.autor, 80);
    const campos = [txt(meta.name, 200) || 'Proceso sin nombre', txt(meta.industry, 100), txt(meta.macroprocess, 150), txt(meta.client, 150), autor,
      mt.nodos, mt.actividades, mt.decisiones, mt.carriles, mt.subprocesos, datos, ahora];
    if (m === 'POST' && !id) {
      const nuevo = crypto.randomUUID();
      await env.DB.batch([
        env.DB.prepare('INSERT INTO procesos (nombre, industria, macroproceso, cliente, autor, nodos, actividades, decisiones, carriles, subprocesos, datos, actualizado, id, version, creado) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,1,?12)').bind(...campos, nuevo),
        env.DB.prepare('INSERT INTO versiones (proceso_id, version, autor, fecha, datos) VALUES (?1, 1, ?2, ?3, ?4)').bind(nuevo, autor, ahora, datos)
      ]);
      return responderJson({ id: nuevo, version: 1, actualizado: ahora }, 201, cors);
    }
    if (m === 'PUT' && id) {
      const actual = await env.DB.prepare('SELECT version, autor, actualizado FROM procesos WHERE id = ?1 AND borrado = 0').bind(id).first();
      if (!actual) return error('Proceso no encontrado (quiza lo borraron): guardalo como nuevo', 404, cors);
      const esperada = +b.version || 0;
      if (!b.forzar && esperada !== actual.version) {
        return responderJson({ type: 'error', conflicto: true, error: { type: 'processiq_conflicto',
          message: 'Otra persona guardo una version mas reciente' }, vigente: actual }, 409, cors);
      }
      const nueva = actual.version + 1;
      // La condicion "version = ?" evita que dos guardados simultaneos se pisen
      const r = await env.DB.prepare('UPDATE procesos SET nombre=?1, industria=?2, macroproceso=?3, cliente=?4, autor=?5, nodos=?6, actividades=?7, decisiones=?8, carriles=?9, subprocesos=?10, datos=?11, actualizado=?12, version=?14 WHERE id=?13 AND version=?15')
        .bind(...campos, id, nueva, actual.version).run();
      if (!r.meta || !r.meta.changes) return error('Otra persona guardo al mismo tiempo: vuelve a intentarlo', 409, cors);
      await env.DB.prepare('INSERT INTO versiones (proceso_id, version, autor, fecha, datos) VALUES (?1, ?2, ?3, ?4, ?5)').bind(id, nueva, autor, ahora, datos).run();
      return responderJson({ id, version: nueva, actualizado: ahora }, 200, cors);
    }
  }
  return error('Ruta no encontrada', 404, cors);
}

function origenPermitido(req, env) {
  const origen = req.headers.get('Origin') || '';
  const lista = (env.ALLOWED_ORIGINS || 'https://procesos.mbc-latam.com')
    .split(',').map(s => s.trim()).filter(Boolean);
  return lista.includes(origen) ? origen : null;
}

function cabecerasCors(origen) {
  const h = { 'Vary': 'Origin' };
  if (origen) {
    h['Access-Control-Allow-Origin'] = origen;
    h['Access-Control-Allow-Methods'] = 'POST, GET, PUT, DELETE, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'content-type, x-processiq-code';
    h['Access-Control-Max-Age'] = '86400';
  }
  return h;
}

function responderJson(obj, status, extra) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: Object.assign({ 'content-type': 'application/json; charset=utf-8' }, extra || {})
  });
}

function error(msg, status, cors) {
  return responderJson({ type: 'error', error: { type: 'processiq_proxy', message: msg } }, status, cors);
}

// Comparacion en tiempo constante: que el tiempo de respuesta no delate
// cuantos caracteres del codigo son correctos.
function igualSeguro(a, b) {
  const te = new TextEncoder();
  const x = te.encode(a || ''), y = te.encode(b || '');
  let dif = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) dif |= (x[i] || 0) ^ (y[i] || 0);
  return dif === 0;
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const origen = origenPermitido(req, env);
    // Secretos recortados: un espacio o salto de linea pegado por error al
    // cargarlos invalidaria la clave o el codigo sin que se viera en el panel.
    const CLAVE = (env.ANTHROPIC_API_KEY || '').trim();
    const CODIGO = (env.ACCESS_CODE || '').trim();
    const cors = cabecerasCors(origen);

    if (url.pathname === '/health') {
      return responderJson({
        ok: true, servicio: 'processiq-api',
        configurado: !!(CLAVE && CODIGO),
        // Diagnostico que no revela nada: solo si el valor TIENE FORMATO de
        // clave de Anthropic. Delata un pegado fallido (vacio, "^V", recortado).
        formatoClave: !CLAVE ? 'vacia' : (/^sk-ant-[A-Za-z0-9_-]{80,}$/.test(CLAVE) ? 'ok' : 'sospechoso')
      }, 200, cors);
    }
    if (req.method === 'OPTIONS') return new Response(null, { status: origen ? 204 : 403, headers: cors });
    // Repositorio de procesos (v3.12.0): mismo codigo de equipo; solo el origen de ProcessIQ
    if (url.pathname === '/v1/procesos' || url.pathname.startsWith('/v1/procesos/')) {
      const INT = (env.INTERNAL_CODE || '').trim();
      const esInterno = !!INT && igualSeguro(req.headers.get('x-internal-code') || '', INT);
      if (!esInterno) {
        const repoOrigenes = (env.REPO_ORIGINS || 'https://procesos.mbc-latam.com').split(',').map(s => s.trim()).filter(Boolean);
        if (!origen || !repoOrigenes.includes(origen)) return error('Origen no permitido para el repositorio', 403, cors);
        if (!CODIGO) return error('El intermediario no tiene configurados sus secretos', 500, cors);
        if (!igualSeguro(req.headers.get('x-processiq-code') || '', CODIGO)) return error('Codigo de acceso incorrecto', 401, cors);
      }
      try { return await rutaRepositorio(req, env, url, cors, esInterno); }
      catch (e) { return error('Error del repositorio: ' + (e && e.message || e), 500, cors); }
    }
    if (url.pathname !== '/v1/messages' || req.method !== 'POST') return error('Ruta no encontrada', 404, cors);
    // Llamada interna de otro Worker de la cuenta (service binding, p. ej. voz-relevamiento-api):
    // no viene de un navegador, asi que no trae Origin; se autentica con INTERNAL_CODE.
    // Ese Worker registra su propio gasto en Pulse, por eso aqui no se registra de nuevo.
    const INTERNO = (env.INTERNAL_CODE || '').trim();
    const interno = !!INTERNO && igualSeguro(req.headers.get('x-internal-code') || '', INTERNO);
    if (!interno) {
      if (!origen) return error('Origen no permitido', 403, cors);
      if (!CLAVE || !CODIGO) {
        return error('El intermediario no tiene configurados sus secretos', 500, cors);
      }
      if (!igualSeguro(req.headers.get('x-processiq-code') || '', CODIGO)) {
        return error('Codigo de acceso incorrecto', 401, cors);
      }
    } else if (!CLAVE) {
      return error('El intermediario no tiene configurada la clave', 500, cors);
    }
    if (+(req.headers.get('content-length') || 0) > (interno ? MAX_BODY_INTERNO : MAX_BODY)) {
      return error('El documento es demasiado grande para una sola llamada', 413, cors);
    }

    let body;
    try { body = await req.json(); } catch (e) { return error('Cuerpo JSON invalido', 400, cors); }
    if (!body || !MODELOS.has(body.model)) return error('Modelo no permitido: ' + (body && body.model), 400, cors);
    body.max_tokens = Math.min(Math.max(1, +body.max_tokens || 1024), MAX_TOKENS);
    if (body.fallbacks !== undefined && body.fallbacks !== 'default') delete body.fallbacks;

    let r;
    try {
      r = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: Object.assign({
          'content-type': 'application/json',
          'x-api-key': CLAVE,
          'anthropic-version': '2023-06-01'
        }, body.fallbacks ? { 'anthropic-beta': 'server-side-fallback-2026-07-01' } : {}),
        body: JSON.stringify(body)
      });
    } catch (e) {
      return error('No se pudo contactar con Anthropic desde el intermediario', 502, cors);
    }
    // Un 401 de Anthropic significa que la CLAVE CENTRAL falla, no el codigo
    // del usuario: se traduce para que la app no culpe al usuario.
    if (r.status === 401) return error('Anthropic rechazo la clave central del intermediario', 502, cors);

    const salida = new Headers(cors);
    const contentType = r.headers.get('content-type') || 'application/json';
    salida.set('content-type', contentType);

    if (r.ok && r.body) {
      const [aCliente, aRegistro] = r.body.tee();
      const esStreaming = contentType.includes('event-stream');
      if (!interno) ctx.waitUntil(extraerUso(aRegistro, esStreaming).then(uso => registrarGasto(body.model, uso)));
      else aRegistro.cancel();
      return new Response(aCliente, { status: r.status, headers: salida });
    }
    return new Response(r.body, { status: r.status, headers: salida });
  }
};
