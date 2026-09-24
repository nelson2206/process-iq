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
const MODELOS = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5']);
const MAX_TOKENS = 64000;
const MAX_BODY = 2 * 1024 * 1024;

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
    h['Access-Control-Allow-Methods'] = 'POST, GET, OPTIONS';
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
    if (url.pathname !== '/v1/messages' || req.method !== 'POST') return error('Ruta no encontrada', 404, cors);
    if (!origen) return error('Origen no permitido', 403, cors);
    if (!CLAVE || !CODIGO) {
      return error('El intermediario no tiene configurados sus secretos', 500, cors);
    }
    if (!igualSeguro(req.headers.get('x-processiq-code') || '', CODIGO)) {
      return error('Codigo de acceso incorrecto', 401, cors);
    }
    if (+(req.headers.get('content-length') || 0) > MAX_BODY) {
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
      ctx.waitUntil(extraerUso(aRegistro, esStreaming).then(uso => registrarGasto(body.model, uso)));
      return new Response(aCliente, { status: r.status, headers: salida });
    }
    return new Response(r.body, { status: r.status, headers: salida });
  }
};
