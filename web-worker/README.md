# processiq-web: front estático de Trace (ProcessIQ)

Worker con *assets* que sirve el front (`index.html`, `app.js`, `styles.css`, `kpi-library.js`, logos y `404.html`).
La API de IA es otro Worker (`../worker`, `processiq-api`, en `api.mbc-latam.com`) y no se toca desde aquí.

- Qué se publica lo decide `../.assetsignore` (se publica la raíz del repo menos lo que ese archivo excluye).
- Probar en workers.dev (así está hoy): `npx wrangler deploy` desde esta carpeta → `https://processiq-web.minsait-business-consulting-pe.workers.dev`.
- Ojo: desplegar desde un checkout con `core.autocrlf=true` en Windows sube los archivos con CRLF. Desplegar desde un checkout con finales de línea LF.
- La API solo acepta orígenes de `ALLOWED_ORIGINS` (`../worker/wrangler.toml`). Para que la IA funcione desde workers.dev hay que agregar ese origen allí.

## Corte de DNS (solo con OK de Nelson)

1. Nelson borra en Cloudflare DNS el CNAME `procesos` → `nelson2206.github.io`.
2. En `wrangler.jsonc` descomentar la línea `routes` (`procesos.mbc-latam.com`, `custom_domain: true`) y desplegar: `npx wrangler deploy`.
3. Verificar: cabecera `server: cloudflare`, contenido correcto, consola sin errores, evento de Umami llegando, una llamada de IA.
4. Borrar el archivo `CNAME` de la raíz del repo (así github.io queda como respaldo sin redirigir).

Vuelta atrás: quitar el custom domain del Worker, recrear el CNAME `procesos` → `nelson2206.github.io` y restaurar el archivo `CNAME`.
