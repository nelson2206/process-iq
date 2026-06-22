# PROMPT MAESTRO — ProcessIQ
**Plataforma interna de diagramación, diagnóstico y reingeniería de procesos para Minsait Business Consulting Perú.**

> Este documento es el prompt de referencia que se entrega al equipo de desarrollo (humano o agentes IA) para construir ProcessIQ. Está diseñado siguiendo principios de prompt engineering avanzado: rol, contexto, restricciones, criterios de éxito, ejemplos y entregables explícitos.

---

## 1. ROL

Actúas como **Lead Product Engineer + Solutions Architect** especializado en plataformas SaaS para consultoría estratégica. Tienes experiencia construyendo herramientas internas para firmas tipo McKinsey, BCG, Bain y Big Four, y dominas: BPMN 2.0, value stream mapping, process mining, librerías APQC PCF, y diseño de copilotos basados en LLMs (Claude / Anthropic SDK).

Tu output debe ser **production-grade**: código mantenible, UX pulida, decisiones arquitectónicas justificadas, y entregables consultivos listos para ser presentados a un partner.

---

## 2. CONTEXTO DE NEGOCIO

**Cliente interno:** Minsait Business Consulting Perú (línea de servicio de Indra).

**Usuarios:**
- **Consultores junior y semi-senior** que levantan procesos en cliente (entrevistas, talleres, observación).
- **Managers y senior managers** que estructuran diagnósticos y diseñan to-be.
- **Partners / directores** que revisan y presentan a C-level del cliente.

**Problema actual:**
1. Los consultores usan Visio / Bizagi / PowerPoint de forma inconsistente, sin estándar de firma.
2. El conocimiento de proyectos previos se pierde entre carpetas de OneDrive.
3. No hay librería interna de KPIs ni benchmarks por industria — se reconstruye cada vez.
4. La identificación de pain points y oportunidades depende 100% de la experiencia del consultor.
5. El tiempo entre kickoff y entrega de diagnóstico preliminar es alto (≥3 semanas típico).
6. Los entregables no aprovechan IA generativa, mientras competencia (Deloitte, EY, PwC) ya integra copilots.

**Objetivo:**
Construir **ProcessIQ**, una plataforma web que acompañe al consultor en todo el ciclo:
`Levantar → Diagramar → Diagnosticar → Reingenierizar → Presentar`,
reduciendo el tiempo de entrega a la mitad y elevando la calidad y consistencia del entregable.

---

## 3. PRINCIPIOS DE DISEÑO (no negociables)

1. **Hecha por consultor, para consultor.** Cada decisión de UX se valida con la pregunta: *"¿esto le ahorra tiempo a un Senior Consultant un viernes a las 8pm?"*
2. **El diagrama es el medio, el diagnóstico es el fin.** El valor está en los pains, oportunidades y reingeniería — no en lo bonito del shape.
3. **IA copiloto, no autopiloto.** La IA propone; el consultor decide. Toda sugerencia es editable y auditable.
4. **Look-and-feel Minsait/Indra.** Paleta corporativa (magenta `#FF4713`, gris `#414141`), tipografía sobria, exportables listos para cliente.
5. **Funcional sin internet.** El MVP debe correr 100% local en navegador (workshops en planta de cliente sin red).
6. **Bilingüe ES/EN**, default español.
7. **Privacidad por defecto.** Data del cliente nunca sale del entorno controlado salvo autorización explícita.

---

## 4. ALCANCE FUNCIONAL

### MVP (esta iteración)
- [ ] Canvas SVG con shapes BPMN-inspired: Start, End, Task, Decision, Document, Data, System.
- [ ] Swimlanes editables (roles/áreas).
- [ ] Conectores dirigidos con etiquetas.
- [ ] Panel lateral: **Metadatos del proceso** (nombre, cliente, industria, owner, frecuencia, volumen mensual, sistema soporte, SLA actual).
- [ ] Panel lateral: **Pain points** por actividad (categoría: handoff / reproceso / espera / control duplicado / sistema / regulatorio; severidad 1-5; frecuencia 1-5).
- [ ] Panel lateral: **Librería KPIs** filtrable por industria (banca, retail, manufactura, salud, utilities, sector público) y macroproceso (O2C, P2P, R2R, H2R, S2D).
- [ ] **Copiloto IA**: chat lateral con acciones rápidas:
  - "Genera el proceso de [descripción]"
  - "Detecta pains en este diagrama"
  - "Sugiere KPIs para este proceso"
  - "Propón reingeniería to-be"
  - "Resume el diagnóstico ejecutivo"
- [ ] Autosave en LocalStorage + export/import JSON.
- [ ] Export SVG y PNG del diagrama.
- [ ] Branding Minsait/Indra aplicado.

### v1.1 (siguiente iteración)
- Comparador as-is vs to-be.
- Simulador (lead time, FTE, costo).
- Matriz impacto-esfuerzo de oportunidades.
- Export a PPT con plantilla corporativa.

### v2 (roadmap)
- Multi-usuario real-time (Y.js / Liveblocks).
- Repositorio central con SSO Entra ID.
- Process mining ligero desde CSV.
- RAG sobre entregables históricos del área.

---

## 5. RESTRICCIONES TÉCNICAS DEL MVP

- **Stack:** HTML5 + CSS3 + JavaScript ES2022 vanilla. Sin frameworks pesados.
- **Sin backend.** Todo corre en el navegador.
- **Sin dependencias npm.** Solo CDNs ligeros si son indispensables.
- **Compatible Chrome/Edge** (entorno corporativo Minsait).
- **Un solo `index.html` arrancable** con doble click; assets en archivos hermanos.
- **Mock del copiloto IA** con respuestas template-based, dejando interfaz lista para conectar Claude API en v1.

---

## 6. CRITERIOS DE ÉXITO DEL MVP

| Criterio | Métrica |
|---|---|
| Un consultor puede diagramar un proceso de 10 actividades en | < 5 minutos |
| Pain points capturables por actividad | ≥ 5 categorías predefinidas |
| KPIs precargados | ≥ 30 KPIs cubriendo 5 industrias |
| Entregable exportable | JSON + SVG + PNG funcionando |
| Latencia de cualquier acción UI | < 100 ms |
| Funciona offline | Sí, 100% |
| Branding | Coherente con identidad Indra/Minsait |

---

## 7. ENTREGABLES

1. **`index.html`** — shell de la aplicación y layout principal.
2. **`styles.css`** — sistema de diseño Minsait/Indra.
3. **`app.js`** — lógica del canvas, paneles, copiloto, persistencia y export.
4. **`kpi-library.js`** — base de datos de KPIs por industria/macroproceso.
5. **`README.md`** — instrucciones de uso, roadmap, próximos pasos.

---

## 8. INSTRUCCIÓN DE EJECUCIÓN

Construye el MVP completo respetando todos los puntos anteriores. Cuando termines:
- Verifica que `index.html` abre y funciona en navegador local sin errores en consola.
- Reporta funcionalidades implementadas vs planeadas.
- Identifica los 3 trade-offs más importantes que tomaste y por qué.
- Lista las 5 mejoras prioritarias para la v1.1.

---

## 9. EJEMPLO DE INTERACCIÓN ESPERADA CON EL COPILOTO

**Usuario:** *"Levanta el proceso de gestión de reclamos de un banco peruano, retail, canal call center."*

**ProcessIQ Copiloto:**
> He generado un proceso as-is con 9 actividades y 2 gateways de decisión, basado en mejores prácticas APQC para banca minorista (proceso 8.2.4 — *Resolve customer complaints*).
> Sugiero capturar estos pain points típicos del sector: rework por información incompleta (severidad 4), handoff entre frontline y back office (severidad 5), SLA de cierre incumplido en 32% de los casos según benchmark sectorial.
> KPIs propuestos: FCR (First Contact Resolution), TMO (Tiempo Medio Operativo), CSAT post-resolución, % reclamos escalados a Indecopi.
> ¿Quieres que dibuje el to-be sugerido con auto-clasificación IDP en la actividad 2?

---

**Fin del prompt maestro.**
