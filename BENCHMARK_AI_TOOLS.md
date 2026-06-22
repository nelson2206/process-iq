# Benchmark — Herramientas de Diagramación de Procesos con IA (2025-2026)

> Análisis preparado para alinear **ProcessIQ** con el estado del arte y con la herramienta hermana **MBC Process Disruptor** de Minsait.
> Fecha: 2026-05-18

---

## 1. Mapa competitivo — generadores BPMN con IA

| Herramienta | Input principal | Output | Diferenciador | Lo que debemos copiar |
|---|---|---|---|---|
| **BPMN AI** (bpmnai.com) | Texto natural, notas de reunión, SOP, política | BPMN 2.0 completo en <30s | "Text-to-map" sin drag&drop; 45 min → 30 s | Velocidad de primer borrador desde notas |
| **Just Flow It** (justflow.it) | Texto natural | BPMN 2.0 con pools, lanes, gateways XOR/AND/OR, todos los eventos, 50+ pasos | Compliance BPMN 2.0 estricto a gran escala | Soporte de **todos los tipos de gateway** y eventos |
| **BA Copilot** | Texto, screenshot de pizarra, documento | BPMN editable en segundos | Acepta **imagen de pizarra** como input | Ingesta desde imagen/foto |
| **ModelMatic** (FlowGen) | **Grabación de conversación** con stakeholder, documento | BPMN 2.0 validation-ready en ~2 min | De audio de entrevista a modelo validado | Audio → diagrama (ya lo tenemos) |
| **Miro AI** | Texto | Primer borrador / expansión de workflow | Colaboración + IA en lienzo infinito | Expansión incremental ("añade pasos") |
| **Visual Paradigm AI** | Texto descriptivo | Business Process Diagram profesional | Integrado a suite EA empresarial | Export a herramientas de arquitectura |
| **MBC Process Disruptor** (Minsait) | Fichero / info cargada | BPMN con swimlanes, códigos de actividad, iconos de tipo de tarea | **Códigos [RCV-18], [USR-27]** + informe Word + Jira + To-Be por nivel | **Referencia directa de este documento** |

---

## 2. Análisis de MBC Process Disruptor (herramienta hermana Minsait)

Lo observado en la captura de pantalla y que ProcessIQ debe replicar:

### 2.1 Nomenclatura BPMN visual
- **Swimlanes horizontales** con etiqueta vertical rotada ("Cliente / Prospecto", "MO Case Intake"). ✅ *ProcessIQ ya lo tiene*.
- **Iconos de tipo de tarea BPMN** en esquina superior-izquierda del bloque:
  - Sobre (✉) = tarea de mensaje (recibir/enviar) → color **amarillo claro**
  - Persona (👤) = User Task → color **azul claro**
- **Códigos de actividad** prefijando la etiqueta: `[RCV-18] Recibir email bienvenida`, `[USR-27] Entrar en caso en Appian`.
- **Eventos**: inicio (círculo verde delgado), documento (rectángulo con base ondulada "Cliente informado").
- **Message flows** (línea **punteada**) entre pools/lanes vs **sequence flows** (línea **sólida**) dentro de la misma lane.

### 2.2 Panel de IA (lado derecho)
- **"Cargar Info y Generar Diagrama"** desde fichero.
- **"Abrir Diagrama Proceso Principal"** / **"Proceso Referencia"** (as-is vs referencia/to-be). ✅ *ProcessIQ tiene as-is/to-be*.
- **"Preguntar a la IA"** — chat sobre el proceso, con checkbox "Tener en cuenta el input para la interacción". ✅ *Copiloto IA*.
- **"Generar To-Be"** con dropdown de **nivel** (Operativo / Táctico / Estratégico) + caja de texto "Describe los cambios". → **Mejora a importar**: nivel de reingeniería.
- **"Generar Informe Word"** con checkbox "Incluir Guía Appian". → ProcessIQ exporta PPTX; añadir Word.
- **"Subir a Jira"** — integración con backlog. → roadmap v2.
- **"Extraer de fichero"** — información adicional del proceso.

### 2.3 Lo que ProcessIQ hace mejor (mantener)
- Linter de validaciones MBB (score 0-100).
- Heatmap de pains.
- Simulador FTE/costo.
- Matriz impacto-esfuerzo, RACI, SIPOC.
- KPIs Perú regulatorios.

---

## 3. Tipos de Tarea BPMN 2.0 (nomenclatura normativa)

Cada tarea lleva un **marcador gráfico en la esquina superior-izquierda** (BPMN 2.0 §10.2.3). ProcessIQ mapea su catálogo de *tipos de ejecución* a estos marcadores:

| Tipo de ejecución ProcessIQ | Tipo BPMN 2.0 | Marcador | Prefijo de código | Color tinte |
|---|---|---|---|---|
| Manual | **Manual Task** | mano | `MAN` | crema/gris |
| Soportado x sistema | **User Task** | persona | `USR` | azul claro |
| Automático | **Service Task** | engranajes | `SRV` | verde claro |
| Asistido por IA | **Script Task** (IA) | script/cerebro | `IA` | púrpura claro |
| Vía correo (recibir) | **Receive Task** | sobre (línea) | `RCV` | amarillo claro |
| Vía correo (enviar) | **Send Task** | sobre (relleno) | `SND` | amarillo claro |
| Vía teléfono | Receive Task (voz) | teléfono | `TEL` | rojo claro |
| Documental | Manual + documento | documento | `DOC` | crema |
| RPA / Bot | **Service Task** (bot) | robot | `BOT` | gris |

**Eventos:**
- Start Event: círculo de línea **delgada** (verde).
- End Event: círculo de línea **gruesa** (rojo).
- Intermediate Event (timer, mensaje): doble círculo.

**Gateways:**
- Exclusivo (XOR): rombo con "X" → decisión Sí/No.
- Paralelo (AND): rombo con "+".
- Inclusivo (OR): rombo con "O".

**Conectores:**
- Sequence Flow: línea sólida con flecha (mismo pool).
- Message Flow: línea **punteada** con flecha (entre pools/lanes distintos).
- Association: línea de puntos (a artefactos/documentos).

---

## 4. Funcionalidades priorizadas para ProcessIQ (derivadas del benchmark)

### Implementar ahora (este sprint)
1. ✅ **Marcadores de tipo de tarea BPMN** en esquina sup-izq (icono de línea, estándar BPMN).
2. ✅ **Códigos de actividad** auto-numerados `[USR-27]` por tipo, editables manualmente.
3. ✅ **Color por tipo de tarea** (amarillo mensaje, azul user, verde service…).
4. ✅ **Edición manual** del tipo de tarea y código desde el panel de propiedades.
5. ✅ **Message flow vs sequence flow** (punteado entre lanes distintas).

### Roadmap próximo
6. Nivel de To-Be (Operativo / Táctico / Estratégico) en el generador de reingeniería.
7. Export a **Informe Word** (además del PPTX).
8. Ingesta desde **imagen de pizarra** (OCR + visión).
9. Integración con **Jira** (subir actividades como issues).
10. Gateways AND/OR (paralelo/inclusivo) además del XOR.

---

## 5. Conclusión

El estado del arte 2025-2026 converge en: **texto/audio/imagen → BPMN 2.0 validado en segundos, con refinamiento iterativo por lenguaje natural**. ProcessIQ ya cubre el núcleo (ingesta multi-fuente, copiloto, as-is/to-be, linter MBB). La brecha frente a MBC Process Disruptor es **fidelidad visual BPMN**: marcadores de tipo de tarea, códigos de actividad y colores normativos. Este sprint cierra esa brecha.

---

## Fuentes

- [Best BPMN Tools 2026 — BPMN AI](https://bpmnai.com/blog/best-bpmn-tools-2026)
- [AI BPMN automation — ModelMatic](https://modelmatic.ai/blog/ai-bpmn-automation-tools-that-turn-recordings-into-validated-diagrams)
- [Just Flow It — text to BPMN](https://justflow.it/)
- [BA Copilot — AI BPMN Generator](https://ba-copilot.com/tools/ai-bpmn-diagram-generator)
- [BPMN 2.0 Symbols Reference — Camunda](https://camunda.com/bpmn/reference/)
- [BPMN 2.0 Task Types Explained — Orbus Software](https://orbus.blob.core.windows.net/media/2005376/wp0093_bpmn-20-task-types-explained.pdf)
- [BPMN Activity Types — Visual Paradigm](https://www.visual-paradigm.com/guide/bpmn/bpmn-activity-types-explained/)
