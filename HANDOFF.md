# ProcessIQ — Documento de traspaso

> Contexto completo para retomar el proyecto en una sesión nueva sin perder nada.
> **Última actualización:** v3.1.0 — la vista Ejecutiva pasa a ser etapas de punta a punta: 5-10 cajas, sin carriles

---

## 1. Qué es y dónde vive

**ProcessIQ** — herramienta web de diagramación, diagnóstico y reingeniería de procesos con notación **BPMN 2.0**, para Minsait Business Consulting Perú.

| | |
|---|---|
| **App en vivo** | https://procesos.mbc-latam.com/ (dominio propio via CNAME desde el 3-sep-2026; nelson2206.github.io/process-iq redirige 301 alli) |
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

### Nivel de granularidad
- El proceso se genera UNA vez al maximo detalle y se colapsa localmente en tres
  vistas: Ejecutivo, Actividad y Detalle. Cambiar de vista es instantaneo y no
  vuelve a llamar a la IA.
- Si la IA etiqueta los nodos con nivel y padre, manda esa jerarquia. Si no
  (proceso importado o dibujado a mano) se deduce: lo que un mismo actor hace de
  corrido entre dos decisiones es UNA actividad de negocio.
- Es ademas el remedio a la densidad. Venta de Lotes pasa de 3 flechas sobre
  cajas y 10 cruces a CERO en vista ejecutiva; un BPMN importado de 119 nodos,
  de 247/115 a 4/0.
- La IA etiqueta cada nodo con nivel (1|2|3) y padre; los hitos (start/end/
  decision) se fuerzan a nivel 1 al construir. Si faltan los campos, actua la
  heuristica por cadenas, ya probada.
- Antes de generar se pregunta la PROFUNDIDAD (modal askProfundidad). No decide
  que se genera --siempre el proceso completo-- sino con cuanto detalle mira la
  IA y en que vista se abre.
- v3.1.0: el nivel EJECUTIVO ya NO es "el BPMN con menos cajas". Es el proceso
  de punta a punta en ETAPAS: no mira carriles (una etapa cruza varios actores),
  absorbe los gateways (el "como se decide" es detalle) y conserva inicio y
  fines, incluidas las salidas tempranas. Techo EJEC_MAX_CAJAS = 10; las etapas
  se reparten por rank en tramos contiguos, con minimo 3 etapas. La proyeccion
  pone owner = macroproceso en todos los nodos: un solo carril.
  Medido en 9 procesos (ficha + 8 demos): todos entre 8 y 10 cajas, todos
  restauran el detalle exacto. Venta de Lotes: 33 -> 28 (actividad) -> 9
  (ejecutivo), y el PPTX ejecutivo cabe en UNA lamina con 0 conectores de letra
  (antes 4 laminas y 15 conectores).
  Camino recorrido, para no repetirlo: v3.0.4 agrupaba por carril + segmento
  entre hitos y se quedaba en 20 cajas; antes de eso, por cadena lineal estricta
  (1 entrada / 1 salida) y solo bajaba de 33 a 28. Con gateways de por medio
  ninguna de las dos llega a una lamina de comite.
  PENDIENTE: la etiqueta de etapa es la del primer paso + "(+N pasos)". Es
  honesta pero floja; el nombre de etapa es trabajo para la IA cuando haya clave.
- Nivel 2 (Actividad) usa cadenas de 2+ (antes 3+, casi nunca disparaba).
- v3.0.4: si al colapsar todas las ramas de un gateway exclusivo acaban en el
  mismo paso, el gateway se elimina y sus entradas van directas al destino. Sin
  esto quedaba con una sola salida y ensureDecisionBranches le inventaba una
  rama "Caso no procede" inexistente. Sigue como red de seguridad aunque en
  v3.1.0 el nivel 1 ya absorbe los gateways.
- v3.1.0 (export): sin rombos y con 1-2 carriles caben 9 columnas por banda en
  vez de 6. Con 6, un flujo ejecutivo de 8 rangos se partia en dos bandas y
  salian conectores con letra en un diagrama de 6 cajas.
- v3.0.4 REGRESION corregida: _modeloVigente ahora ignora los nodos _autoGen.
  Nacen sin sello, asi que tras colapsar el modelo se daba por ajeno y se
  recapturaba la vista colapsada como si fuera el completo: volver a Detalle ya
  no restauraba los 33 nodos.
- API de pruebas: ProcessIQ.nivel(1|2|3), ProcessIQ.niveles(), ProcessIQ.askProfundidad().

> Sin probar con llamada real de IA: el etiquetado se valido con un spec
> sintetico via buildProcessFromAiSpec. Ver pendiente #2.

### PPTX editable (v3.0)
- Cada tarea es UN objeto: la forma lleva el texto dentro (antes forma + texto
  suelto encima; al mover la caja en PowerPoint el texto se quedaba atras).
- Nombres descriptivos en el panel de seleccion: Tarea USR-01 · Registrar y
  derivar lead, Decision 07 · Conforme?, Flujo A → B.
- Posiciones en grilla de 0,05 pulgadas (un cuarto de la cuadricula de PowerPoint).
- Conectores REALES anclados a las formas (cxnSp con stCxn/endCxn): al mover una
  caja, la flecha la sigue y PowerPoint la re-rutea. pptxgenjs no sabe hacerlos:
  se emite una linea con nombre Flujo|origen|destino|lado|lado y un post-proceso
  del XML (JSZip) la convierte. Decision tomada: PowerPoint decide el nuevo camino
  al mover (se pierden nuestros codos), porque corregir importa mas que la
  fidelidad al abrir.
- Medido sobre Venta de Lotes, lamina 2: 43 formas con texto dentro (antes 0),
  8 conectores anclados por ambos extremos, 14 lineas sueltas (antes 26; las que
  quedan son conectores de pagina y saltos de banda, a proposito).
- v3.0.2: los conectores de pagina y de salto de banda tambien son UN cxnSp
  anclado nodo <-> circulo (antes 3 lineas sueltas). Cada rama que sale de un
  mismo nodo lleva un codo distinto (adj1 del bentConnector3, 20-80 %): antes
  cuatro salidas de un rombo compartian el tronco y se veian como una sola.
  El paso de apilado vertical usa el alto REAL de la etiqueta (altoEtiqueta),
  no 0,52 fijo. Medido: 52/52 conectores anclados, lamina 3 con 2 lineas
  sueltas (antes 14).
- REGRESION corregida en v3.0.2: la cache de rutas del lienzo (v2.8) solo se
  invalidaba en autoLayout(); al arrastrar una caja las flechas quedaban en el
  aire. Ahora render() firma la geometria de los nodos y, si cambia, invalida.
  Probado: arrastre de +70/+110 px, 0 de 18 flechas en el aire.
- v3.0.3: dentro de cada celda del PPTX (fila x columna) las cajas se apilan
  por AFINIDAD DE FILA: la que conecta con un actor de mas abajo va abajo, y su
  flecha ya no cruza a las hermanas (antes: orden de insercion del modelo, la
  tarea que iba al Cliente quedaba en medio). Media de la fila de los vecinos,
  3 barridos, empate por y del lienzo. Pedido con captura por el usuario sobre
  Venta de Lotes 3/4: MAN-11 / USR-05 / RCV-01 ahora salen en ese orden.
- v3.0.3: el chip de tipo (USR/MAN/RCV...) es UN solo objeto: addText con
  shape roundRect, margin 0 y nombre "Tipo XXX · <tarea>". Antes eran forma +
  cuadro de texto y al moverlo en PowerPoint se separaban. El codigo [XXX-nn]
  sigue aparte pero con nombre "Codigo XXX-nn · <tarea>".
- v3.0.4: FINES ADELANTADOS. Una flecha a un fin sin salidas que cruza de banda
  ya no gasta un conector con letra para llegar al circulo de fin en la lamina
  siguiente: el fin se pinta en el pasillo de salida de la banda de ORIGEN, con
  su etiqueta, y se repite en cada banda que lo alcance (BPMN lo permite). Si un
  fin solo se alcanza asi, no se dibuja en su propia banda y su fila desaparece
  si queda vacia. Medido sobre Venta de Lotes: circulos con letra de 13 a 8.
- v3.0.5: el codigo de actividad ([USR-02]) YA NO se dibuja en la lamina. Era
  un cuadro de texto suelto de 7 pt que se montaba sobre el titulo de la tarea
  (visto por el usuario en Venta de Lotes 2/4). Decidido por el usuario: quitar,
  no fundir en el chip. Sigue en el modelo, en el panel de propiedades y como
  primera columna de la tabla de actividades del informe Word. OJO: la Ficha de
  Proceso (deriveFicha) nunca lo llevo; si hiciera falta cruzar lamina y ficha
  habria que anadirlo alli.
- El banco bench/ mide el modelo ANTES de serializar: no ve el post-proceso.
  Verificar el post-proceso con el replay en worker descrito en Quirks.
- Pendiente (Tier 3): inyectar tema y patron oficial para que titulo y pie sean
  placeholders. Esperar a la plantilla MBC oficial para no hacerlo dos veces.

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

**3. Ruteo A-star** — *IMPLEMENTADO Y APAGADO. No volver a intentarlo sin leer esto.*

Se construyó en v2.8: ruteo ortogonal sobre grilla de Hanan, coste por longitud,
giros y reutilización de canal, con cacheo por layout. Funciona. **No se paga.**

Medido sobre 3 procesos reales (flechas sobre cajas / cruces / tiempo de autoajuste):

| Proceso | Apagado | Encendido |
|---|---|---|
| 59 nodos | 6 / 2 · 0,3 s | 6 / 2 · 1,3 s |
| 97 nodos | 320 / 36 · 0,7 s | 317 / 39 · 9,5 s |
| 119 nodos | 200 / 65 · 0,7 s | **142 / 50** · 7,2 s |

Un caso mejora un 29 %, dos no mejoran, y todo va de 6 a 13 veces más lento.

**Por qué falla, que es lo importante:** cuando 97 nodos van apretados en el área
disponible **no existe canal libre por donde rutear**. Ningún algoritmo encuentra
un camino limpio que no está ahí. El problema no es el ruteo: es la densidad del
layout. Se probó primero aplicando A* por tipo de arista y luego sólo cuando la
heurística pisaba una caja; la segunda variante fue más lenta *y* peor.

→ *Siguiente paso real:* **bajar la densidad, no mejorar el ruteo.** Las vistas por
nivel de granularidad (macroproceso / actividad / tarea) reducen los nodos por
lámina; con 20 nodos en vista ejecutiva el problema desaparece solo. Volver a
medir el A* **después** de eso, cuando sí haya canales libres que aprovechar.

Activar para experimentar: `ProcessIQ.astar(true)`.

> Ojo con la prioridad: hasta v2.5.1 se creía que el ruteo era el problema principal
> del PPTX. Al medirlo resultó ser el 26 % de los defectos; el 74 % era texto que se
> pisaba. Eso se corrigió en v2.6.0 sin tocar el ruteo. Medir antes de invertir.

### Media

**4. Proxy seguro para la API key**
Hoy es **BYOK**: la key vive en el navegador del usuario. Sirve para uso interno y demos, **no para un link público compartido**.
→ *Siguiente paso:* función serverless (Vercel) con la key en variable de entorno; ~1 día.

**5. Acciones aún heurísticas** (no usan el API)
`detect-pains` (existe `ai-pains` aparte), `whatif`, `variants`, `value-map`, `merge-gateways`, `generate`.

**6. Web Worker para extracción de PDF**
Se mitigó cediendo el hilo cada 3 páginas, pero la extracción **sigue en el hilo principal**.

### Baja

**7. PPTX desde plantilla real** *(mitigado en v2.5.0)* — hoy el formato se replica por código; se podría partir del `.pptx` real como template.

**8. OCR para PDF escaneado** — hoy solo avisa de que hace falta OCR.

**9. Textos largos en cajas de 0,53 pulgadas** — verificar que no se corten; si pasa, subir la altura a 0,62.

---

## 3-bis. Banco de pruebas — LEER ANTES DE TOCAR EL LAYOUT

`bench/` mide la calidad del lienzo y del export PPTX sobre BPMN reales.
**Úsalo antes y después de cualquier cambio de layout, ruteo o export.**

    // en la consola de la app, pegar bench/harness.js y luego:
    const r = await PIQBench.correr();

Línea base en `bench/baseline.json` (v2.7.3, 12 casos, 1.042 nodos). Si
`txtSobreTxt`, `txtSobreFig` o `fueraDeLamina` suben, es una regresión.

> ⚠️ `bench/fixtures/` **no se versiona**: el repo es público y los ficheros
> son procesos reales de cliente. Están en local; si se pierden, se
> reextraen del ZIP de evaluación de MBC Process Disruptor.

**Hallazgo clave del banco:** `flechaSobreCaja` en el lienzo predice casi 1:1
los solapes de texto del PPTX (59 nodos: 6 → 52 solapes; 154 nodos: 366 → 344).
Arreglar el ruteo arregla el entregable.

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

**Medidas en pulgadas, extraídas del XML de la plantilla** (verificadas contra
`theme2.xml`, `slideMaster2.xml`, `slideLayout18.xml` y `slide2.xml`):

| Elemento | Medida | Color |
|---|---|---|
| Caja actividad | 1,303 x 0,531 · `roundRect` adj 5882 | `E4E3DD` |
| Diamante (gateway) | 0,315 x 0,315 | `4F062A` (Pruno) |
| Círculo inicio | 0,297 | `44B757` (accent2) |
| Círculo fin | 0,297 | `F05C95` |
| Chip de rol (rotado 270 grados) | 1,252 ancho x 0,472 alto | `F7C29E` (accent4 lumMod 40 / lumOff 60) |
| Conectores | 0,5 pt | `FF0054` (accent1) |
| Separador de carril | 1 pt | `D0CEC1` (bg2 lumMod 90) |
| Panel del flujo | `octagon` adj 2000 sobre el fondo | `FFFFFF` |
| Tipografía | 8,5 pt cajas / 8 pt etiquetas | **ForFuture Sans** |

**Chrome corporativo (layout18):** antetítulo `x 0,367 · y 0,354 · w 12,6` ·
título `y 0,6` a 28 pt Pruno · pie `y 7,001` · nº de lámina `x 12,547 · y 7,001`.
**Portada (layout42):** wordmark `minsait` en `x 0,421 · y 6,692 · 1,963 x 0,39`;
`An Indra company` en `x 8,843 · y 6,931`.

**Tema del deck:** dk1 `4F062A` (Pruno) · dk2 `260717` (Pruno Oscuro) ·
lt1 `FFFFFF` · lt2 `E3E2DA` (Gris Cerámica) · accent1 `FF0054` (Fucsia) ·
accent2 `44B757` · accent3 `8661F5` · accent4 `E56813` · accent5 `00B0BD` ·
accent6 `EF659D` · folHlink `A40037`. Fuente mayor y menor: **ForFuture Sans**.

> ⚠️ **ForFuture Sans no es una fuente de sistema.** En un equipo Minsait se ve
> correcta; fuera de la organización PowerPoint la sustituye. No es un defecto
> del export.

**Logotipos:** los tres wordmarks oficiales (`minsait` oscuro, `minsait` blanco,
`An Indra company`) están embebidos en `app.js` como data URI base64,
extraídos de `image9/11/8.png` de la propia plantilla. Pesan ~2 KB en total.

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

> ⚠️ **Desde la red corporativa el dominio nuevo esta bloqueado** (medido el 6-sep-2026):
> https://procesos.mbc-latam.com devuelve 403 con la pagina "Noncompliant action" y la
> cabecera X-Direct-Response, sin ninguna cabecera de GitHub; github.io si responde con
> Server: GitHub.com y redirige al dominio. Es un proxy de red que aun no categoriza el
> dominio, no un fallo del despliegue. Para verificar la version desplegada sin pasar por el
> dominio: gh api repos/nelson2206/process-iq/contents/index.html --jq .content | base64 -d
> | grep app.js?v= ; y comparar gh api .../pages/builds/latest --jq .commit con git rev-parse HEAD.
> Pedir a Seguridad que categorice procesos.mbc-latam.com; hasta entonces los usuarios en
> red corporativa veran el mismo 403.

### Edición de código

- **NO pasar scripts Python por stdin en Windows**: se decodifican como cp1252 y **corrompen los acentos**, rompiendo los anchors de búsqueda. Escribir el script a un `.py` y ejecutarlo.
- **Los heredocs con backticks** (template literals de JS, code fences de Markdown) **rompen bash**. Escribir ese contenido con la herramienta de escritura o a un archivo aparte.
- Los anchors de búsqueda deben ser **ASCII puro** (evitar "quedó", "según").
- Validar siempre tras editar: `node -e "new Function(require('fs').readFileSync('app.js','utf8'))"`

### Pruebas en navegador

- **El export PPTX NO se puede verificar dentro del panel del navegador de la
  sesion.** Medido el 25-ago-2026: la pestana esta siempre en document.hidden
  = true y Chrome estrangula los timers encadenados (el sexto setTimeout(0)
  espero 5,7 s). JSZip genera el zip encadenando decenas de esos timers, asi
  que pres.write() NUNCA termina ahi. No es un bug del export: en un navegador
  normal en primer plano funciona. Para verificar la serializacion, reproducir
  la presentacion en un Web Worker (no se estrangula): capturar pres
  interceptando PptxGenJS.prototype.write, serializar _slides a JSON y
  reproducirla con addText/addShape/addImage dentro del worker. Asi se valido
  la v3.0.1 (2,6 s de escritura, 28 conectores anclados).


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
