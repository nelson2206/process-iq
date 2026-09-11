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
 *   GET  {intermediario}/health  -> { ok, configurado }  (sin codigo; para probar)
 *
 * Configuracion en el panel de Cloudflare (Workers & Pages > processiq-api >
 * Settings > Variables and Secrets):
 *   ANTHROPIC_API_KEY  secreto  la clave de console.anthropic.com
 *   ACCESS_CODE        secreto  el codigo que se reparte al equipo
 *   ALLOWED_ORIGINS    texto    origenes que pueden llamar, separados por coma
 *                               (por defecto solo https://procesos.mbc-latam.com)
 *
 * Limites deliberados: solo los modelos de la app, max_tokens topado, cuerpo
 * de hasta 2 MB y sin streaming. El techo de GASTO se fija en la consola de
 * Anthropic (Limits): es la red de seguridad real.
 * ============================================================ */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODELOS = new Set(['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5']);
const MAX_TOKENS = 16000;
const MAX_BODY = 2 * 1024 * 1024;

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
  async fetch(req, env) {
    const url = new URL(req.url);
    const origen = origenPermitido(req, env);
    const cors = cabecerasCors(origen);

    if (url.pathname === '/health') {
      return responderJson({
        ok: true, servicio: 'processiq-api',
        configurado: !!(env.ANTHROPIC_API_KEY && env.ACCESS_CODE)
      }, 200, cors);
    }
    if (req.method === 'OPTIONS') return new Response(null, { status: origen ? 204 : 403, headers: cors });
    if (url.pathname !== '/v1/messages' || req.method !== 'POST') return error('Ruta no encontrada', 404, cors);
    if (!origen) return error('Origen no permitido', 403, cors);
    if (!env.ANTHROPIC_API_KEY || !env.ACCESS_CODE) {
      return error('El intermediario no tiene configurados sus secretos', 500, cors);
    }
    if (!igualSeguro(req.headers.get('x-processiq-code') || '', env.ACCESS_CODE)) {
      return error('Codigo de acceso incorrecto', 401, cors);
    }
    if (+(req.headers.get('content-length') || 0) > MAX_BODY) {
      return error('El documento es demasiado grande para una sola llamada', 413, cors);
    }

    let body;
    try { body = await req.json(); } catch (e) { return error('Cuerpo JSON invalido', 400, cors); }
    if (!body || !MODELOS.has(body.model)) return error('Modelo no permitido: ' + (body && body.model), 400, cors);
    body.max_tokens = Math.min(Math.max(1, +body.max_tokens || 1024), MAX_TOKENS);
    delete body.stream;

    let r;
    try {
      r = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(body)
      });
    } catch (e) {
      return error('No se pudo contactar con Anthropic desde el intermediario', 502, cors);
    }
    // Un 401 de Anthropic significa que la CLAVE CENTRAL falla, no el codigo
    // del usuario: se traduce para que la app no culpe al usuario.
    if (r.status === 401) return error('Anthropic rechazo la clave central del intermediario', 502, cors);

    const salida = new Headers(cors);
    salida.set('content-type', r.headers.get('content-type') || 'application/json');
    return new Response(r.body, { status: r.status, headers: salida });
  }
};
