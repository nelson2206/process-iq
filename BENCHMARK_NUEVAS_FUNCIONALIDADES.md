# Benchmark 2026 + Detección de Nuevas Funcionalidades — ProcessIQ

> Análisis del estado del arte BPM / Process Mining 2026 cruzado contra las capacidades actuales de ProcessIQ, para detectar **funcionalidades nuevas a implementar**.
> Fecha: 2026-06-05

---

## 1. Tendencias del mercado 2026 (qué hace puntero a un BPM hoy)

| Tendencia 2026 | Qué significa | Fuente |
|---|---|---|
| **Simulación como mainstream** | Comparar **múltiples escenarios what-if** ("¿y si elimino esta aprobación?", "¿y si reduzco handoffs?") sobre datos reales, antes de tocar la operación | PRIME BPM, GBTEC |
| **Agentes de IA en BPM** | IA acelera el ciclo BPM hasta **90%**: mapea, analiza, documenta y propone mejoras automáticamente | PRIME BPM |
| **Automation discovery** | La IA **identifica y prioriza** las tareas repetitivas rule-based automatizables | bizdata360 |
| **Conformance checking** | Comparar el proceso **real descubierto vs un modelo de referencia** y marcar desviaciones (compliance) | Celonis, Signavio, ARIS |
| **Process intelligence** | Analítica del event log: **variantes**, cycle time, tasa de reproceso, cuellos de botella | Celonis, KYP.ai |
| **Task mining** | Captura del comportamiento humano a nivel de escritorio entre apps | KYP.ai |

---

## 2. ProcessIQ hoy (capacidades existentes)

✅ Ingesta multi-fuente (audio, notas, documento, event log CSV) ·
✅ Diagramación BPMN 2.0 (marcadores, códigos, swimlanes, message flows) ·
✅ Detección de pains + heatmap + matriz impacto-esfuerzo ·
✅ KPIs Perú con benchmark ·
✅ Simulador FTE/costo (**1 escenario**) ·
✅ To-Be por nivel ·
✅ RACI / SIPOC ·
✅ Linter MBB ·
✅ 6 exports (JSON/SVG/PNG/BPMN/PPTX/Word) ·
✅ As-Is / To-Be · Onboarding · Modo presentación

---

## 3. GAPS detectados → Nuevas funcionalidades a implementar

### 🥇 PRIORIDAD ALTA (alto valor + alineadas a 2026 + factibles client-side)

#### F1. Comparador de escenarios What-If
- **Gap**: el simulador hoy calcula **un solo** escenario. La tendencia #1 de 2026 es comparar varios.
- **Qué**: sandbox donde defines N variantes ("Eliminar aprobación manual", "Paralelizar pasos 4-5", "Automatizar captura") y ves una **tabla/gráfico comparativo** de FTE, lead time, costo y ahorro entre escenarios.
- **Sirve a**: diseño To-Be, mejoras de procesos.
- **Implementación**: nueva pestaña "Escenarios" en el panel derecho; cada escenario es un set de transformaciones aplicadas sobre el as-is; recalcula simulación por escenario; tabla comparativa + export.

#### F2. Scoring de oportunidades de automatización
- **Gap**: To-Be Operativo convierte algunas tareas, pero **no rankea ni cuantifica** el potencial.
- **Qué**: detecta tareas candidatas (manuales, rule-based, alto volumen) y las **rankea por ROI**: tipo de automatización sugerida (RPA / IDP / IA / workflow), esfuerzo, ahorro FTE estimado, payback. Tabla priorizada + burbujas en matriz.
- **Sirve a**: mejoras de procesos (automation discovery 2026).
- **Implementación**: heurística sobre executionType + volumen + tiempo + categoría de pain; cálculo de ahorro = tiempo×volumen automatizable.

#### F3. Análisis de cuello de botella + critical path
- **Gap**: el simulador suma lead time **linealmente**; no identifica el **constraint** real.
- **Qué**: calcula la ruta crítica (camino más largo en tiempo), marca la **actividad cuello de botella** (mayor tiempo×volumen o mayor cola), y la resalta en el diagrama.
- **Sirve a**: identificación de pains, mejoras.
- **Implementación**: BFS/DFS con pesos de tiempo; resaltar nodo crítico; badge "⛔ cuello".

#### F4. Análisis de variantes desde event log
- **Gap**: el process mining hoy solo **dibuja** el flujo; no surfacea las variantes.
- **Qué**: del event log, lista las **variantes** (happy path vs excepciones) con su **frecuencia y % de casos**, y permite filtrar el diagrama por variante.
- **Sirve a**: relevamiento (entender la realidad), identificación de pains (las variantes = reprocesos/excepciones).
- **Implementación**: agrupar trazas por secuencia de actividades; ordenar por frecuencia; tabla de variantes.

### 🥈 PRIORIDAD MEDIA

#### F5. Heatmap Lean VA/NVA
- **Gap**: se captura VA/BVA/NVA por actividad pero **no se visualiza** como mapa de desperdicio.
- **Qué**: botón que tinta el diagrama por valor (verde=VA, amarillo=BVA, rojo=NVA) + barra de % de tiempo en NVA (desperdicio).
- **Sirve a**: identificación de pains, mejoras (Lean).

#### F6. Backlog de iniciativas auto-generado
- **Gap**: pains, automatización y recomendaciones están dispersos; falta un **roadmap consolidado**.
- **Qué**: genera una **tabla de iniciativas** priorizadas (de pains + oportunidades de automatización + gaps de KPI), con impacto, esfuerzo, horizonte y owner sugerido. Exportable a Excel/Word.
- **Sirve a**: documentación, mejoras.

#### F7. Edición por lenguaje natural (NL command, lite)
- **Gap**: el copiloto es mock; no ejecuta comandos sobre el diagrama.
- **Qué**: comandos tipo "agregar paso *Validar score* después de *Registrar*", "eliminar *Aprobar*", "unir pasos 3 y 4" — interpretados por reglas y aplicados al diagrama.
- **Sirve a**: relevamiento, diseño To-Be (agente IA 2026).

### 🥉 PRIORIDAD BAJA (roadmap v1+, requieren API/infra)

| Feature | Por qué baja |
|---|---|
| **F8. Conformance checking** | Necesita un modelo de referencia formal + event log; valioso pero nicho |
| **F9. Import desde imagen de pizarra** | Requiere modelo de visión real (Claude API) |
| **F10. Task mining** | Requiere agente de escritorio — fuera de alcance web |
| **F11. Colaboración multi-usuario + comentarios** | Requiere backend (v2) |
| **F12. Copiloto IA real (Claude API)** | Reemplaza el mock; gran salto pero requiere API key |

---

## 4. Recomendación de implementación

**Sprint sugerido (orden):**
1. **F1 — Comparador de escenarios What-If** (la de mayor impacto consultivo + tendencia #1 2026)
2. **F2 — Scoring de automatización** (complementa F1, automation discovery)
3. **F3 — Cuello de botella / critical path** (rápida, alto valor visual)
4. **F4 — Variantes del event log** (potencia el process mining existente)
5. **F5 — Heatmap Lean VA/NVA** (rápida, refuerza identificación de pains)
6. **F6 — Backlog de iniciativas** (consolida y documenta)

Las F1-F6 son **100% factibles client-side** (sin backend ni API), refuerzan exactamente los 4 ejes que pidió el cliente (relevamiento, to-be, pains, mejoras) y cierran la brecha con los líderes 2026 en **simulación what-if** y **automation discovery**.

---

## Fuentes
- [Process Mining Tools 2026 — ProcessMind](https://processmind.com/resources/blog/the-best-process-mining-tools-of-2026)
- [Best Process Mining Compared 2026 — KYP.ai](https://kyp.ai/process-mining-software-comparison/)
- [How AI Agents Will Redefine BPM 2026 — PRIME BPM](https://www.primebpm.com/how-ai-agents-will-redefine-bpm-in-2026)
- [Top BPM Trends 2026 — PRIME BPM](https://www.primebpm.com/bpm-trends-2026)
- [BPM Trends 2026 — GBTEC](https://www.gbtec.com/blog/bpm-trends-2026/)
- [What is BPM Software 2026 — bizdata360](https://www.bizdata360.com/what-is-bpm-software-complete-guide-2026/)
- [Process Mining Platforms — Gartner Peer Insights](https://www.gartner.com/reviews/market/process-mining-platforms)
