# ProcessIQ — Documento de traspaso

> Contexto completo para retomar el proyecto en una sesión nueva sin perder nada.
> **Última actualización:** v2.4.0 · commit `65010e6`

---

## 1. Qué es y dónde vive

**ProcessIQ** — herramienta web de diagramación, diagnóstico y reingeniería de procesos con notación **BPMN 2.0**, para Minsait Business Consulting Perú.

| | |
|---|---|
| **App en vivo** | https://nelson2206.github.io/process-iq/ |
| **Repositorio** | https://github.com/nelson2206/process-iq (público) |
| **Carpeta local** | `C:\Users\nebernal\OneDrive - Indra\Documentos\Propuestas\Transformación\ProcessIQ` |
| **Stack** | HTML + CSS + JS vanilla. **Sin backend, sin build, sin npm.** |
| **Hosting** | GitHub Pages (build *legacy*, rama `main`, raíz `/`) |

### Archivos

| Archivo | Rol |
|---|---|
| `index.html` | Raíz servida por Pages. Nadie la importa. |
| `app.js` | ~7.700 líneas. **Todo** el código, dentro de un IIFE. |
| `styles.css` | Tema NEXUS + componentes. |
| `kpi-library.js` | Catálogo de KPIs por industria. |
| `favicon.svg` · `og-image.svg` · `README.md` · `HANDOFF.md` | Soporte |

> ⚠️ `app.js` es un **IIFE**: `state` es privado. Para pruebas se expone `window.ProcessIQ`.

---

## 2. Estado actual — qué YA funciona

### Diagramación
- BPMN 2.0 completo: tareas (user/manual/service/send/script), gateways **XOR/AND/OR**, eventos (mensaje/timer/error/señal/terminación, catch+throw), **eventos de borde**, marcadores (subproceso/loop/multi-instancia), **swimlanes** por rol.
- Auto-layout: detección de back-edges (DFS) + longest-path (Kahn), **anti-cruces por baricentro**, columnas compactas y **modo envolvente** (bandas) para procesos largos.
- Ruteo de flechas por bordes, codos redondeados, corredores inferiores para reprocesos.
- **Autoajustar**: mide flechas-sobre-cajas y cruces, prueba 3 disposiciones y aplica la mejor.
- Undo/redo, zoom, modo presentación, 13 ejemplos.

### Ingesta
- **Multi-formato:** Word (mammoth), PDF (pdf.js), PowerPoint (JSZip), texto, **BPMN 2.0** (importador nativo, round-trip sin pérdida).
- **Multi-fuente:** acumula documento + transcripción + diagrama antiguo y los **fusiona en un solo AS-IS** (ante contradicción prevalece lo más reciente).
- **Participantes:** detecta nombres en transcripciones Teams/Zoom, pide el **rol** de cada persona y lo usa como carril.
- Progreso página a página, botón **Cancelar** real, guardia de 40 MB, timeout de 3 min.
- Event log CSV → process mining (alpha-miner).

### IA (API de Anthropic, modo BYOK)
- Ingesta de documentos → reconstrucción del flujo BPMN.
- **9 acciones analíticas** con Claude: `suggest-kpis`, `propose-tobe`, `raci`, `impact-effort`, `automation`, `backlog`, `exec-summary`, `sipoc`, `bottleneck`.
- **Análisis profundo de dolores**, separado en (a) evidenciados en el flujo y (b) hipótesis del sector.
- Regla reforzada de **paralelismo** (fork/join en vez de secuencia).

### Entregables
- **Ficha de Proceso** corporativa de 12 bloques (formato PR-DU-COM-*).
- Export: **SVG · PNG · BPMN 2.0 · PPTX · Word · Ficha · JSON**.

---

## 3. PENDIENTES — por prioridad

### Alta

**1. Validar visualmente el PPTX** *(bloqueante para uso con cliente)*
Nunca se pudo renderizar PowerPoint en el entorno de trabajo. El usuario reportó *"se cruzan líneas y figuras"*; se corrigieron 3 defectos (ruteo con obstáculos, nodos apilados, pie duplicado) **pero el resultado no se verificó**.
→ *Siguiente paso:* exportar el ejemplo *Venta de Lotes*, abrir el slide 2/4 y comparar contra `Ejemplo de flujos.pptx`.

**2. Prueba real con API key**
Todo el camino de IA se validó con `fetch` interceptado. **Nunca se hizo una llamada facturada real.**
→ *Siguiente paso:* configurar la key en el botón de ajustes → *Probar conexión* → ingerir un documento real y revisar la calidad del flujo generado.

**3. Ruteo A-star con evasión de obstáculos**
El autoajuste dejó **3 flechas sobre cajas y 10 cruces** en Venta de Lotes (33 nodos). Causa: tres decisiones distintas apuntan al mismo nodo *Fin* y comparten la misma "autopista".
→ *Siguiente paso:* ruteo ortogonal sobre grilla con A-star y canales reservados por arista.

### Media

**4. Proxy seguro para la API key**
Hoy es **BYOK**: la key vive en el navegador del usuario. Sirve para uso interno y demos, **no para un link público compartido**.
→ *Siguiente paso:* función serverless (Vercel) con la key en variable de entorno; ~1 día.

**5. Acciones aún heurísticas** (no usan el API)
`detect-pains` (existe `ai-pains` aparte), `whatif`, `variants`, `value-map`, `merge-gateways`, `generate`.

**6. Web Worker para extracción de PDF**
Se mitigó cediendo el hilo cada 3 páginas, pero la extracción **sigue en el hilo principal**.

### Baja

**7. PPTX desde plantilla real** — hoy el formato se replica por código; se podría partir del `.pptx` real como template.

**8. OCR para PDF escaneado** — hoy solo avisa de que hace falta OCR.

**9. Textos largos en cajas de 0,53 pulgadas** — verificar que no se corten; si pasa, subir la altura a 0,62.

---

## 4. API de Anthropic — integración

Endpoint y cabeceras:

    POST https://api.anthropic.com/v1/messages

    content-type: application/json
    x-api-key: <la key del usuario>
    anthropic-version: 2023-06-01
    anthropic-dangerous-direct-browser-access: true    <-- imprescindible para CORS

- **Modelos:** `claude-opus-5` (por defecto), `claude-sonnet-5`, `claude-haiku-4-5`
- **Parámetros usados:** `max_tokens`, `system`, `output_config: { effort: 'high' }`
- **Timeout propio:** 3 min + `AbortController` conectado al botón Cancelar
- **Errores manejados:** 401 (key inválida), 429 (límite), timeout, sin conexión
- **Docs:** https://platform.claude.com/docs · **Consola:** https://console.anthropic.com

**Funciones clave en `app.js`:** `callClaude()` · `aiBuildProcess()` · `runAiTask()` · `aiAnalyzePains()` · `processDigestForAi()` · `parseJsonLoose()`

---

## 5. Librerías (todas por CDN, carga bajo demanda)

| Librería | Versión | Para qué |
|---|---|---|
| pptxgenjs | 3.12.0 | Export PPTX |
| mammoth | 1.8.0 | Leer `.docx` |
| pdfjs-dist | 4.7.76 | Leer PDF (módulo ESM + worker) |
| jszip | 3.10.1 | Leer `.pptx` |

**Analítica:** Umami — `https://umami-mbc.vercel.app/script.js`, website-id `0f3aaa08-7bb8-4aec-b09b-d9c4abf3868c`

---

## 6. localStorage

| Clave | Contenido |
|---|---|
| `processiq.v1` | Proceso completo (meta, ficha, nodes, edges, views, lanes, KPIs) |
| `processiq.ui` | Estado de paneles colapsados |
| `processiq.ai` | `{ key, model }` — **la API key, solo en el navegador** |

---

## 7. Formato PPTX — referencias y medidas exactas

**Archivos de referencia:**
- `C:\Users\nebernal\Downloads\Ejemplo de flujos.pptx` — **plantilla actual**
- `C:\Users\nebernal\OneDrive - Indra\Grp_T_Telered_IA - General\02. Gobierno IA\03. Gobierno robusto\202606_Documento_Trabajo_Gobierno_IA_Telered.pptx` (slides 40-41)

**Medidas en pulgadas, extraídas del XML de la plantilla:**

| Elemento | Medida | Color |
|---|---|---|
| Caja actividad | 1,13 x 0,53 | `E4E3DD` |
| Diamante (gateway) | 0,31 x 0,31 | `4F062A` (vino) |
| Círculo inicio | 0,30 x 0,30 | `44B757` (verde) |
| Círculo fin | 0,30 x 0,30 | `F05C95` / `EF659D` (rosa) |
| Chip de rol (rotado 270 grados) | 0,47 ancho x 1,3 alto | `E56813` (naranja) |
| Conectores | 0,5 pt | `FF0054` (magenta) |
| Separador de carril | 1 pt | `E3E2DA` |
| Tipografía | 8 pt cajas / 9 pt etiquetas | **Lato** |

**Tema del deck:** dk1 `4F062A` · lt2 `E3E2DA` · accent1 `FF0054` · accent2 `44B757` · accent4 `E56813` · accent6 `EF659D`

**Ficha de proceso — referencia:** `PR-DU-COM-02 Venta de Lotes Urbanos` (Grupo Centenario), 12 bloques. Está codificada como demo: `ProcessIQ.loadFichaVentaLotes()`.

---

## 8. Quirks operativos — LEER ANTES DE TRABAJAR

### Deploy

Secuencia completa (los cuatro pasos importan):

1. **Bumpear siempre** la versión de cache-busting en `index.html`
   `sed -i 's/?v=2\.4\.0/?v=2.5.0/g' index.html`
2. **Commit, push y verificar sincronía** — los push en background fallan callados
   `git add -A && git commit -m "..." && git push origin main`
   `git fetch -q origin` y comparar `git rev-parse HEAD` contra `git rev-parse origin/main`
3. **Forzar el build de Pages** cuando falle o quede en cola
   `gh api -X POST repos/nelson2206/process-iq/pages/builds`
4. **Verificar en vivo** que la versión servida es la nueva
   `curl -s --ssl-no-revoke "https://nelson2206.github.io/process-iq/index.html?cb=123"`

### Edición de código

- **NO pasar scripts Python por stdin en Windows**: se decodifican como cp1252 y **corrompen los acentos**, rompiendo los anchors de búsqueda. Escribir el script a un `.py` y ejecutarlo.
- **Los heredocs con backticks** (template literals de JS, code fences de Markdown) **rompen bash**. Escribir ese contenido con la herramienta de escritura o a un archivo aparte.
- Los anchors de búsqueda deben ser **ASCII puro** (evitar "quedó", "según").
- Validar siempre tras editar: `node -e "new Function(require('fs').readFileSync('app.js','utf8'))"`

### Pruebas en navegador

- `window.ProcessIQ` es el hook de pruebas: `loadFichaVentaLotes()`, `snapshot()`, `quality()`, `autoFit()`, `runAiTask(k)`, `sources()`, `detectParticipants(t)`, `aiAnalyzePains()`, `importBpmnXml()`, `generateBpmnXml()`.
- **Los screenshots del preview hacen timeout** con diagramas pesados: validar con `javascript_tool`.
- **Los timers están estrangulados** en pestaña de fondo (`setTimeout` y `requestAnimationFrame` no son fiables para medir responsividad).
- Sacar archivos del navegador por POST a un servidor local funciona, pero **ojo con el envío chunked** (el receptor puede recibir 0 bytes si lee `content-length`).

---

## 9. Cómo arrancar la sesión nueva

Pega esto como primer mensaje:

> Trabajo en **ProcessIQ** (`C:\Users\nebernal\OneDrive - Indra\Documentos\Propuestas\Transformación\ProcessIQ`, repo `nelson2206/process-iq`, live en `nelson2206.github.io/process-iq`).
> Lee **`HANDOFF.md`** en la raíz del repo: tiene el estado completo, los pendientes y los quirks operativos.
> Hoy quiero atacar: **[pendiente número N]**.

**Orden recomendado:** #2 (probar con key real) → #1 (validar PPTX) → #3 (ruteo A-star) → #4 (proxy seguro).
