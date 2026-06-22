# Benchmark — Herramientas de Diagramación y Gestión de Procesos

> Análisis preparado como base para el diseño de **ProcessIQ**, plataforma interna de Minsait Business Consulting Perú.
> Fecha: 2026-05-17

---

## 1. Mapa competitivo

| Herramienta | Categoría | Fortaleza clave | Debilidad para consultoría MBB |
|---|---|---|---|
| **Bizagi Modeler** | BPMN puro | Estándar BPMN 2.0 estricto, gratuito, simulación de procesos | UX rígida, sin IA, sin librería de KPIs por industria |
| **Lucidchart** | Diagramación general | Colaboración real-time, plantillas amplias, integración con MS/Google | Genérico, no especializado en BPM ni reingeniería |
| **Microsoft Visio** | Diagramación corporativa | Penetración en clientes enterprise, stencils oficiales | Pesado, licenciamiento costoso, sin IA contextual |
| **Miro / Mural** | Whiteboard colaborativo | Ideal para workshops y co-creación con cliente | No es un BPM, exporta diagramas "sucios" |
| **Signavio (SAP)** | BPM + Process Intelligence | Tabla de procesos, simulación, integración process mining | Costo alto, curva de aprendizaje |
| **Celonis** | Process Mining | Descubre procesos reales desde logs (event data) | Requiere data del cliente, no es diagramador puro |
| **ARIS (Software AG)** | Enterprise Architecture | Repositorio único, gobierno de procesos | Sobre-dimensionado para una propuesta puntual |
| **Camunda Modeler** | BPMN/DMN ejecutable | Open source, exporta a motor de ejecución | Orientado a desarrollo, no a consultoría |
| **Draw.io / diagrams.net** | Diagramación libre | Gratuito, sin login, exporta a múltiples formatos | Sin lógica BPM ni inteligencia |
| **Whimsical / FigJam** | Diagramación moderna | UX rápida, ideal para flowcharts ligeros | Sin BPMN, sin métricas |
| **IBM Blueworks Live** | BPM Cloud | Descubrimiento colaborativo, análisis de oportunidades | Licencia enterprise, UI antigua |

---

## 2. Funcionalidades observadas en el mercado

### 2.1 Diagramación
- Notación BPMN 2.0 (eventos, tareas, gateways, pools, lanes, mensajes).
- Notación SIPOC, Value Stream Mapping (VSM), Flujograma cross-functional (swimlanes).
- Drag-and-drop con snap-to-grid y auto-layout.
- Versionamiento y bifurcación (como-es / a-ser / future-state).
- Comentarios in-line y revisión asincrónica.

### 2.2 Levantamiento (discovery)
- Entrevistas estructuradas (cuestionarios SIPOC, 5W2H).
- Captura por voz / transcripción.
- Importación desde Excel (matriz de actividades).
- Process mining ligero desde logs CSV.

### 2.3 Análisis y diagnóstico
- Identificación de pain points por actividad (handoffs, reprocesos, esperas, controles duplicados).
- Análisis de valor añadido (VA / NVA / BVA).
- Matriz de impacto vs esfuerzo de oportunidades.
- Tiempos: lead time, cycle time, takt time, %C&A (complete & accurate).
- Detección automática de antipatrones (loops sin salida, gateways sin convergencia, actividades huérfanas).

### 2.4 Referencia de industria
- Librería de KPIs por sector (banca, retail, manufactura, salud, utilities, sector público).
- Benchmarks APQC PCF (Process Classification Framework).
- Comparativos de madurez (CMMI, BPMM).
- Plantillas pre-cargadas: O2C, P2P, R2R, H2R, S2D.

### 2.5 Reingeniería
- Simulación what-if (variación de volúmenes, FTE, tiempos).
- Cálculo de ahorros (FTE liberados, reducción de lead time, ROI).
- Recomendaciones de automatización (RPA / IDP / workflow).
- Diseño to-be con trazabilidad versus as-is.

### 2.6 Entregables consultivos
- Export a PPT con look-and-feel corporativo (Indra/Minsait).
- Export a Word para manuales de procesos.
- Export a BPMN XML para integración con motores.
- Cuadros de mando ejecutivos.

### 2.7 Colaboración y gobierno
- Multi-usuario en tiempo real.
- Roles (lead consultant, contributor, client viewer).
- Repositorio jerárquico (cliente → proyecto → macroproceso → proceso).
- Trazabilidad de cambios.

### 2.8 IA generativa (diferencial)
- Generación de procesos a partir de descripción en lenguaje natural ("levanta el proceso de O2C de una empresa retail con 3 canales").
- Auto-detección de pains a partir de un flujo dibujado.
- Sugerencia de KPIs aplicables al proceso.
- Generación del to-be con justificación.
- Resumen ejecutivo automático del diagnóstico.
- Comparación contra mejores prácticas APQC.

---

## 3. Brechas que ProcessIQ debe cubrir

| Brecha del mercado | Oportunidad para Minsait BC Perú |
|---|---|
| Ninguna herramienta integra IA contextual + librería de KPIs por industria + reingeniería en un solo flujo | Plataforma end-to-end pensada **para el consultor**, no para el cliente final |
| Herramientas BPM son rígidas; whiteboards son anárquicas | UX híbrida: rigor BPMN cuando se necesita, libertad de whiteboard en workshops |
| Exportables genéricos | Output directo a templates Minsait (PPT, Word) listos para presentar al cliente |
| Conocimiento institucional disperso | Memoria de proyectos previos consultable (RAG sobre entregables históricos) |
| Curva de aprendizaje alta para consultores nuevos | Onboarding guiado + copiloto de IA que enseña mientras se trabaja |

---

## 4. Funcionalidades priorizadas para ProcessIQ (MoSCoW)

### MUST (MVP)
1. Canvas de diagramación con shapes BPMN-inspired (start, task, decision, document, data, end).
2. Conectores con flechas dirigidas y etiquetas.
3. Swimlanes (roles / áreas).
4. Panel de metadatos del proceso (cliente, área, owner, frecuencia, volumen, sistema soporte).
5. Panel de pain points por actividad (categoría, severidad, frecuencia).
6. Librería de KPIs por industria (carga inicial: banca, retail, manufactura, sector público).
7. Copiloto IA: generar proceso desde descripción, detectar pains, sugerir KPIs.
8. Persistencia local (autosave) + export JSON.
9. Export SVG / PNG del diagrama.

### SHOULD (v1.1)
10. Comparador as-is / to-be lado a lado.
11. Simulador básico (tiempo total, FTE estimado).
12. Matriz de oportunidades (impacto vs esfuerzo).
13. Export a PPT con plantilla Minsait.
14. Sugerencias de automatización (RPA/IDP) por actividad.

### COULD (v2)
15. Colaboración multi-usuario en tiempo real.
16. Repositorio central de proyectos.
17. Import desde Excel y desde event logs (process mining ligero).
18. Comparativo contra APQC PCF.
19. Memoria RAG sobre entregables históricos del área.

### WON'T (por ahora)
- Motor de ejecución BPMN.
- Versionamiento tipo Git con merge.
- Marketplace público de plantillas.

---

## 5. Stack técnico recomendado

| Capa | Tecnología sugerida | Razón |
|---|---|---|
| Frontend | HTML + JS vanilla (MVP) → React + TypeScript (v1) | Iteración rápida, sin servidor para MVP demostrable |
| Canvas | SVG nativo (MVP) → React-Flow o JointJS (v1) | Control fino sobre nodos y conectores |
| Persistencia | LocalStorage (MVP) → Postgres + S3 (v1) | Cero fricción para piloto interno |
| IA | Claude API (Anthropic) | Razonamiento de procesos, generación estructurada, soporte español nativo |
| Auth (v1) | Microsoft Entra ID (SSO Minsait) | Integración corporativa estándar |
| Despliegue (v1) | Azure App Service + Static Web Apps | Alineado con stack Indra |

---

## 6. Métricas de éxito de ProcessIQ

- **Tiempo de levantamiento** por proceso: reducir de ~5 días a ~2 días.
- **Reutilización**: % de procesos partiendo de plantilla / proyecto previo.
- **Calidad de entregable**: # iteraciones internas antes de presentar al cliente.
- **Satisfacción del consultor** (NPS interno).
- **Time-to-propuesta**: días entre kickoff y entrega de diagnóstico preliminar.
