/* ============================================================
   ProcessIQ — App logic
   MVP: canvas, paneles, copiloto (mock), persistencia y export.
   ============================================================ */

(() => {
  'use strict';

  // =================== STATE ===================
  const STORAGE_KEY = 'processiq.v1';
  const state = {
    meta: { name: '', industry: '', macroprocess: '', client: '', owner: '' },
    nodes: [],   // { id, type, x, y, w, h, label, owner, system, time, volume, va, notes, pains:[] }
    edges: [],   // { id, from, to, label }
    activeView: 'asis',         // 'asis' | 'tobe'
    _views: { asis: null, tobe: null },  // snapshots de la vista inactiva
    selectedNodeId: null,
    selectedEdgeId: null,
    mode: 'edit', // 'edit' | 'connect'
    connectSourceId: null,
    drag: null,   // { id, offsetX, offsetY }
    nextId: 1
  };

  const SHAPE_DEFAULTS = {
    start:        { w: 54,  h: 54,  label: 'Inicio' },
    end:          { w: 54,  h: 54,  label: 'Fin' },
    intermediate: { w: 54,  h: 54,  label: 'Evento' },
    task:         { w: 158, h: 76,  label: 'Actividad' },
    decision:     { w: 110, h: 80,  label: '¿Decisión?' },
    document:     { w: 110, h: 70,  label: 'Documento' },
    data:         { w: 110, h: 60,  label: 'Data' },
    system:       { w: 158, h: 76,  label: 'Sistema' }
  };

  // =================== DOM ===================
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const canvas = $('#canvas');
  const nodesLayer = $('#nodesLayer');
  const edgesLayer = $('#edgesLayer');
  const swimlanesLayer = $('#swimlanesLayer');
  const laneHeadersLayer = $('#laneHeadersLayer');
  const canvasHint = $('#canvasHint');

  // =================== INIT ===================
  function init() {
    populateSelects();
    populateKpiLibrary();
    populatePainCategories();
    populateExecutionTypes();
    attachHeaderListeners();
    attachToolbarListeners();
    attachCanvasListeners();
    attachTabListeners();
    attachPropertyListeners();
    attachPainListeners();
    attachCopilotListeners();
    attachKpiListeners();
    attachSimulatorListeners();
    attachKeyboardShortcuts();
    attachOnboardListeners();
    attachZoomInteractions();
    attachPresentListeners();
    loadFromStorage();
    // Si hay nodos pero faltan lanes (versión vieja en localStorage), genera layout
    if (state.nodes.length > 0 && !state._lanes) {
      autoLayout();
    } else {
      render();
    }
    resetHistory();   // línea base del historial (estado al abrir)
    attachUndoRedoListeners();
    // Hook para demos/pruebas (cargadores de ejemplo)
    window.ProcessIQ = { loadDemo: loadDemoProcess, loadComplex: loadComplexDemo, loadComplex2: loadComplexDemo2, loadComplex3: loadComplexDemo3, loadComplex4: loadComplexDemo4, loadComplex5: loadComplexDemo5, loadComplex6: loadComplexDemo6, loadComplex7: loadComplexDemo7, loadComplex8: loadComplexDemo8, loadComplex9: loadComplexDemo9, loadComplex10: loadComplexDemo10, loadComplex11: loadComplexDemo11, loadComplex12: loadComplexDemo12 };
  }

  function populateSelects() {
    const ind = $('#processIndustry');
    const mac = $('#processMacro');
    const filt = $('#kpiFilterIndustry');
    window.INDUSTRIES.forEach(i => {
      ind.insertAdjacentHTML('beforeend', `<option value="${i}">${i}</option>`);
      filt.insertAdjacentHTML('beforeend', `<option value="${i}">${i}</option>`);
    });
    window.MACROPROCESSES.forEach(m => {
      mac.insertAdjacentHTML('beforeend', `<option value="${m}">${m}</option>`);
    });
  }

  function populatePainCategories() {
    const sel = $('#painCategory');
    window.PAIN_CATEGORIES.forEach(c => {
      sel.insertAdjacentHTML('beforeend', `<option value="${c.id}">${c.icon} ${c.label}</option>`);
    });
  }

  function populateExecutionTypes() {
    const sel = $('#propExecType');
    if (!sel) return;
    (window.EXECUTION_TYPES || []).forEach(t => {
      sel.insertAdjacentHTML('beforeend', `<option value="${t.id}">${t.label}</option>`);
    });
  }

  // =================== HEADER ===================
  function attachHeaderListeners() {
    $('#processName').addEventListener('input', e => { state.meta.name = e.target.value; persist(); });
    $('#processIndustry').addEventListener('change', e => { state.meta.industry = e.target.value; persist(); renderKpiLibrary(); });
    $('#processMacro').addEventListener('change', e => { state.meta.macroprocess = e.target.value; persist(); });

    $('#btnNew').addEventListener('click', () => {
      if (confirm('¿Crear un nuevo proceso? Se perderá el actual si no fue exportado.')) resetState();
    });

    // View toggle as-is / to-be
    $('#btnViewAsIs').addEventListener('click', () => setView('asis'));
    $('#btnViewToBe').addEventListener('click', () => setView('tobe'));
    $('#btnCloneToBe').addEventListener('click', cloneAsIsToToBe);
    $('#btnTransformToBe').addEventListener('click', openTransformToBeModal);

    $('#btnIngest').addEventListener('click', openIngestModal);
    $('#btnImport').addEventListener('click', () => $('#fileImport').click());
    $('#fileImport').addEventListener('change', importJson);

    // Export dropdown
    const dd = $('#exportDropdown');
    const ddBtn = $('#btnExportMenu');
    const setDdOpen = (open) => {
      ddBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      const ch = ddBtn.querySelector('.chevron');
      if (ch) ch.style.transform = open ? 'rotate(180deg)' : 'rotate(0)';
      if (open) {
        dd.classList.remove('closing');
        dd.hidden = false;
      } else if (!dd.hidden) {
        dd.classList.add('closing');
        setTimeout(() => { dd.hidden = true; dd.classList.remove('closing'); }, 120);
      }
    };
    ddBtn.addEventListener('click', e => {
      e.stopPropagation();
      setDdOpen(dd.hidden);
    });
    document.addEventListener('click', () => setDdOpen(false));
    dd.addEventListener('click', e => e.stopPropagation());
    dd.querySelectorAll('button[data-export]').forEach(b => {
      b.addEventListener('click', () => {
        setDdOpen(false);
        switch (b.dataset.export) {
          case 'json': exportJson(); break;
          case 'svg':  exportSvg();  break;
          case 'png':  exportPng();  break;
          case 'bpmn': exportBpmn(); break;
          case 'pptx': exportPptx(); break;
          case 'word': exportWord(); break;
        }
      });
    });
  }

  // =================== TOOLBAR ===================
  function attachToolbarListeners() {
    $$('.shape-btn[data-shape]').forEach(btn => {
      btn.addEventListener('dragstart', e => {
        e.dataTransfer.setData('shape', btn.dataset.shape);
        e.dataTransfer.effectAllowed = 'copy';
      });
    });

    $('#btnConnect').addEventListener('click', toggleConnectMode);
    $('#btnDelete').addEventListener('click', deleteSelection);
    $('#btnAutoLayout').addEventListener('click', autoLayout);
  }

  function toggleConnectMode() {
    state.mode = state.mode === 'connect' ? 'edit' : 'connect';
    state.connectSourceId = null;
    $('#btnConnect').classList.toggle('active', state.mode === 'connect');
    canvas.classList.toggle('connect-mode', state.mode === 'connect');
    $('#statusMode').textContent = `Modo: ${state.mode === 'connect' ? 'conexión (click origen y destino)' : 'edición'}`;
    render();
  }

  // =================== CANVAS ===================
  function updateStickyHeaders() {
    if (!laneHeadersLayer || !state._lanes) return;
    const wrapper = $('#canvasWrapper');
    if (!wrapper) return;
    laneHeadersLayer.setAttribute('transform', `translate(${wrapper.scrollLeft}, 0)`);
  }

  function attachCanvasListeners() {
    canvas.addEventListener('dragover', e => e.preventDefault());

    // Sticky headers de swimlanes: se trasladan con el scroll horizontal
    const wrapper = $('#canvasWrapper');
    if (wrapper) {
      wrapper.addEventListener('scroll', updateStickyHeaders, { passive: true });
    }
    canvas.addEventListener('drop', e => {
      e.preventDefault();
      const shape = e.dataTransfer.getData('shape');
      if (!shape) return;
      const pt = svgPoint(e.clientX, e.clientY);
      addNode(shape, pt.x, pt.y);
    });

    canvas.addEventListener('mousedown', e => {
      if (e.target === canvas || e.target.id === 'gridBg') {
        state.selectedNodeId = null;
        state.selectedEdgeId = null;
        render();
      }
    });

    canvas.addEventListener('mousemove', e => {
      if (!state.drag) return;
      const pt = svgPoint(e.clientX, e.clientY);
      const n = getNode(state.drag.id);
      if (!n) return;
      n.x = pt.x - state.drag.offsetX;
      n.y = pt.y - state.drag.offsetY;
      render();
    });

    canvas.addEventListener('mouseup', () => {
      if (state.drag) { state.drag = null; persist(); }
    });
    canvas.addEventListener('mouseleave', () => {
      if (state.drag) { state.drag = null; persist(); }
    });
  }

  function svgPoint(clientX, clientY) {
    // Conversión robusta vía matriz: respeta viewBox/zoom y scroll (necesario para el zoom).
    if (canvas.getScreenCTM) {
      const ctm = canvas.getScreenCTM();
      if (ctm) {
        const p = canvas.createSVGPoint();
        p.x = clientX; p.y = clientY;
        const inv = p.matrixTransform(ctm.inverse());
        return { x: inv.x, y: inv.y };
      }
    }
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function addNode(type, x, y) {
    const def = SHAPE_DEFAULTS[type];
    // Tipo de ejecución por defecto según shape
    const defaultExec = type === 'system' ? 'system' : (type === 'task' ? 'manual' : '');
    const node = {
      id: 'n' + (state.nextId++),
      type,
      x: x - def.w / 2,
      y: y - def.h / 2,
      w: def.w,
      h: def.h,
      label: def.label,
      executionType: defaultExec,
      activityCode: '',
      owner: '', system: '', time: '', volume: '', va: '',
      sla: '', docsIn: '', docsOut: '', rules: '', notes: '',
      pains: []
    };
    state.nodes.push(node);
    state.selectedNodeId = node.id;
    assignActivityCodes();   // asigna [PREFIX-NN] al nuevo nodo
    persist();
    render();
  }

  function addEdge(fromId, toId) {
    if (fromId === toId) return;
    const exists = state.edges.some(e => e.from === fromId && e.to === toId);
    if (exists) return;
    state.edges.push({ id: 'e' + (state.nextId++), from: fromId, to: toId, label: '' });
    persist();
    render();
  }

  function deleteSelection() {
    if (state.selectedNodeId) {
      state.nodes = state.nodes.filter(n => n.id !== state.selectedNodeId);
      state.edges = state.edges.filter(e => e.from !== state.selectedNodeId && e.to !== state.selectedNodeId);
      state.selectedNodeId = null;
    } else if (state.selectedEdgeId) {
      state.edges = state.edges.filter(e => e.id !== state.selectedEdgeId);
      state.selectedEdgeId = null;
    }
    persist();
    render();
  }

  function getNode(id) { return state.nodes.find(n => n.id === id); }
  function getEdge(id) { return state.edges.find(e => e.id === id); }

  // =================== RENDER ===================
  function render() {
    nodesLayer.innerHTML = '';
    edgesLayer.innerHTML = '';
    swimlanesLayer.innerHTML = '';
    laneHeadersLayer.innerHTML = '';

    // Render de swimlanes (carreteras) si están definidas
    if (state._lanes && state._lanes.list.length > 0) {
      const L = state._lanes;
      const ns = 'http://www.w3.org/2000/svg';
      // Ancho total de las lanes: cubre todos los nodos
      let maxRight = L.padX + L.headerW + L.innerPadL + L.totalRanks * L.colW + 60;
      state.nodes.forEach(n => { maxRight = Math.max(maxRight, n.x + n.w + 40); });
      const lanesWidth = maxRight - L.padX;

      L.list.forEach((laneName, idx) => {
        const y = L.padY + idx * L.laneH;

        // ===== Capa fondo (bg + separadores) =====
        const bg = document.createElementNS(ns, 'rect');
        bg.setAttribute('x', L.padX);
        bg.setAttribute('y', y);
        bg.setAttribute('width', lanesWidth);
        bg.setAttribute('height', L.laneH);
        bg.setAttribute('fill', idx % 2 === 0 ? 'rgba(247, 247, 247, 0.45)' : 'rgba(255, 255, 255, 0.0)');
        bg.setAttribute('stroke', '#E5E5E5');
        bg.setAttribute('stroke-width', '1');
        swimlanesLayer.appendChild(bg);

        // ===== Capa headers (sticky — se traslada con scroll) =====
        // Header background (con shadow para destacarse cuando scroll)
        const header = document.createElementNS(ns, 'rect');
        header.setAttribute('x', L.padX);
        header.setAttribute('y', y);
        header.setAttribute('width', L.headerW);
        header.setAttribute('height', L.laneH);
        header.setAttribute('fill', '#FFFFFF');
        header.setAttribute('stroke', '#D6D6D6');
        header.setAttribute('stroke-width', '1');
        header.setAttribute('filter', 'drop-shadow(2px 0 4px rgba(0,0,0,0.08))');
        laneHeadersLayer.appendChild(header);

        // Acento color
        const accent = document.createElementNS(ns, 'rect');
        accent.setAttribute('x', L.padX);
        accent.setAttribute('y', y);
        accent.setAttribute('width', 4);
        accent.setAttribute('height', L.laneH);
        accent.setAttribute('fill', laneColor(laneName, idx));
        laneHeadersLayer.appendChild(accent);

        // Texto del rol — wrap si es largo
        const label = document.createElementNS(ns, 'text');
        label.setAttribute('x', L.padX + L.headerW / 2 + 2);
        label.setAttribute('y', y + L.laneH / 2);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('dominant-baseline', 'middle');
        label.setAttribute('font-family', "'Inter', -apple-system, sans-serif");
        label.setAttribute('font-size', '12');
        label.setAttribute('font-weight', '600');
        label.setAttribute('fill', '#3A3A3A');
        label.setAttribute('text-rendering', 'geometricPrecision');
        const words = laneName.split(' ');
        if (laneName.length > 14 && words.length > 1) {
          const mid = Math.ceil(words.length / 2);
          const line1 = words.slice(0, mid).join(' ');
          const line2 = words.slice(mid).join(' ');
          const t1 = document.createElementNS(ns, 'tspan');
          t1.setAttribute('x', L.padX + L.headerW / 2 + 2);
          t1.setAttribute('dy', '-0.5em');
          t1.textContent = line1;
          const t2 = document.createElementNS(ns, 'tspan');
          t2.setAttribute('x', L.padX + L.headerW / 2 + 2);
          t2.setAttribute('dy', '1.2em');
          t2.textContent = line2;
          label.appendChild(t1);
          label.appendChild(t2);
        } else {
          label.textContent = laneName;
        }
        laneHeadersLayer.appendChild(label);
      });

      // Activa sticky: traslada laneHeadersLayer en X según scrollLeft
      updateStickyHeaders();
    }

    // Edges
    state.edges.forEach(e => {
      const a = getNode(e.from), b = getNode(e.to);
      if (!a || !b) return;
      const p1 = nodeCenter(a), p2 = nodeCenter(b);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', orthoPath(p1, p2));
      // Message flow (punteado) si cruza lanes/responsables distintos; sequence flow (sólido) si no
      const laneOfA = state._lanes?.laneOf?.[a.id];
      const laneOfB = state._lanes?.laneOf?.[b.id];
      const isMessageFlow = laneOfA && laneOfB && laneOfA !== laneOfB &&
                            a.type !== 'start' && b.type !== 'end';
      path.setAttribute('class', 'edge-path' +
        (isMessageFlow ? ' edge-message' : '') +
        (e.id === state.selectedEdgeId ? ' selected' : ''));
      path.setAttribute('marker-end', isMessageFlow ? 'url(#arrow-open)' : 'url(#arrow)');
      path.addEventListener('click', ev => {
        ev.stopPropagation();
        state.selectedEdgeId = e.id;
        state.selectedNodeId = null;
        render();
      });
      path.addEventListener('dblclick', ev => {
        ev.stopPropagation();
        const v = prompt('Etiqueta de la conexión (ej. "Sí", "No", "Aprobado", o frecuencia):', e.label || '');
        if (v !== null) { e.label = v.trim(); persist(); render(); }
      });
      // Capa invisible más ancha para facilitar el click (hit area)
      const hit = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      hit.setAttribute('d', path.getAttribute('d'));
      hit.setAttribute('fill', 'none');
      hit.setAttribute('stroke', 'transparent');
      hit.setAttribute('stroke-width', '12');
      hit.style.cursor = 'pointer';
      hit.addEventListener('click', ev => {
        ev.stopPropagation();
        state.selectedEdgeId = e.id;
        state.selectedNodeId = null;
        render();
      });
      hit.addEventListener('dblclick', ev => {
        ev.stopPropagation();
        const v = prompt('Etiqueta de la conexión:', e.label || '');
        if (v !== null) { e.label = v.trim(); persist(); render(); }
      });
      edgesLayer.appendChild(hit);
      edgesLayer.appendChild(path);

      if (e.label) {
        const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
        const nsv = 'http://www.w3.org/2000/svg';
        const txt = document.createElementNS(nsv, 'text');
        txt.setAttribute('x', mx);
        txt.setAttribute('y', my - 4);
        txt.setAttribute('class', 'edge-label');
        txt.setAttribute('text-anchor', 'middle');
        txt.textContent = e.label;
        edgesLayer.appendChild(txt);
        // Fondo "pill" para legibilidad (insertado DETRÁS del texto, medido con getBBox)
        try {
          const bb = txt.getBBox();
          const padX = 4, padY = 1.5;
          const pill = document.createElementNS(nsv, 'rect');
          pill.setAttribute('x', bb.x - padX);
          pill.setAttribute('y', bb.y - padY);
          pill.setAttribute('width', bb.width + padX * 2);
          pill.setAttribute('height', bb.height + padY * 2);
          pill.setAttribute('rx', '4');
          pill.setAttribute('class', 'edge-label-bg');
          edgesLayer.insertBefore(pill, txt);
        } catch (_) { /* getBBox puede fallar si no está en layout */ }
      }
    });

    // Nodes
    state.nodes.forEach(n => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      // Heatmap: clasifica por max score de pains
      let painClass = '';
      if (n.pains && n.pains.length > 0) {
        const maxScore = Math.max(...n.pains.map(p => p.severity * p.frequency));
        if (maxScore >= 16) painClass = ' pain-high';
        else if (maxScore >= 9) painClass = ' pain-med';
        else painClass = ' pain-low';
      }
      g.setAttribute('class', 'node-group' +
        (n.id === state.selectedNodeId ? ' selected' : '') +
        (n.id === state.connectSourceId ? ' connect-source' : '') +
        (n.id === state._bottleneckId ? ' bottleneck' : '') +
        painClass);
      g.setAttribute('transform', `translate(${n.x},${n.y})`);

      const shape = createShape(n);
      shape.setAttribute('class', 'node-shape');
      g.appendChild(shape);

      const ns = 'http://www.w3.org/2000/svg';
      const isTask = (n.type === 'task' || n.type === 'system');
      const exec = isTask ? (window.EXECUTION_TYPES || []).find(t => t.id === n.executionType) : null;

      // ─────────── EVENTOS (start/intermediate/end): icono de subtipo BPMN + label ───────────
      if (n.type === 'start' || n.type === 'end' || n.type === 'intermediate') {
        const cx = n.w / 2, cy = n.h / 2;
        const ev = n.eventType || 'none';
        const stroke = n.type === 'start' ? '#2E7D32' : (n.type === 'end' ? '#B91C1C' : '#B45309');
        // Catch (start / intermediate catch) = icono outline; Throw (end / intermediate throw) = icono relleno
        const filled = n.type === 'end' || n.throw === true;
        const evGlyphs = {
          message: 'M -7 -5 H 7 V 5 H -7 Z M -7 -5 L 0 1 L 7 -5',
          timer:   'M 0 -8 A 8 8 0 1 1 0 8 A 8 8 0 1 1 0 -8 M 0 -4 V 0 L 3 2',
          error:   'M -6 6 L -2 -3 L 1 1 L 5 -6',
          signal:  'M 0 -7 L 7 6 H -7 Z'
        };
        if (n.type === 'end' && n.terminate) {
          // Evento de terminación BPMN: disco relleno (termina toda la instancia)
          const disc = document.createElementNS(ns, 'circle');
          disc.setAttribute('cx', cx); disc.setAttribute('cy', cy);
          disc.setAttribute('r', Math.min(cx, cy) - 7);
          disc.setAttribute('fill', stroke);
          g.appendChild(disc);
          const tt = document.createElementNS(ns, 'title');
          tt.textContent = 'Evento de terminación (fin inmediato de la instancia)';
          g.appendChild(tt);
        } else if (ev !== 'none' && evGlyphs[ev]) {
          const ic = document.createElementNS(ns, 'path');
          ic.setAttribute('d', evGlyphs[ev]);
          ic.setAttribute('transform', `translate(${cx},${cy})`);
          ic.setAttribute('fill', (filled && (ev === 'message' || ev === 'signal')) ? stroke : 'none');
          ic.setAttribute('stroke', stroke);
          ic.setAttribute('stroke-width', ev === 'timer' ? '1.4' : '1.8');
          ic.setAttribute('stroke-linecap', 'round');
          ic.setAttribute('stroke-linejoin', 'round');
          g.appendChild(ic);
        } else {
          const lbl = document.createElementNS(ns, 'text');
          lbl.setAttribute('x', cx); lbl.setAttribute('y', cy);
          lbl.setAttribute('class', 'node-label'); lbl.setAttribute('font-size', '13');
          lbl.textContent = n.type === 'start' ? '▶' : (n.type === 'end' ? '■' : '◇');
          g.appendChild(lbl);
        }
        const sub = document.createElementNS(ns, 'text');
        sub.setAttribute('x', cx); sub.setAttribute('y', n.h + 13);
        sub.setAttribute('class', 'node-label'); sub.setAttribute('font-size', '10.5');
        sub.textContent = truncate(n.label, 26);
        g.appendChild(sub);
      }
      // ─────────── GATEWAY BPMN: marcador (X/+/O) + label ───────────
      else if (n.type === 'decision') {
        const gw = n.gatewayType || 'exclusive';
        if (gw === 'parallel' || gw === 'inclusive') {
          // Marcador grande al centro del rombo + label DEBAJO (estilo BPMN)
          const mk = document.createElementNS(ns, 'g');
          mk.setAttribute('transform', `translate(${n.w / 2}, ${n.h / 2})`);
          if (gw === 'parallel') {
            const plus = document.createElementNS(ns, 'path');
            plus.setAttribute('d', 'M -10 0 H 10 M 0 -10 V 10');
            plus.setAttribute('stroke', '#C68400'); plus.setAttribute('stroke-width', '3.5');
            plus.setAttribute('stroke-linecap', 'round'); plus.setAttribute('fill', 'none');
            mk.appendChild(plus);
          } else {
            const circ = document.createElementNS(ns, 'circle');
            circ.setAttribute('r', '9'); circ.setAttribute('fill', 'none');
            circ.setAttribute('stroke', '#C68400'); circ.setAttribute('stroke-width', '3');
            mk.appendChild(circ);
          }
          g.appendChild(mk);
          const sub = document.createElementNS(ns, 'text');
          sub.setAttribute('x', n.w / 2); sub.setAttribute('y', n.h + 13);
          sub.setAttribute('class', 'node-label'); sub.setAttribute('font-size', '10.5');
          sub.textContent = truncate(n.label, 30);
          g.appendChild(sub);
        } else {
          // Exclusivo: X sutil al fondo + label dentro
          const xMk = document.createElementNS(ns, 'path');
          xMk.setAttribute('d', `M ${n.w/2-7} ${n.h/2-7} L ${n.w/2+7} ${n.h/2+7} M ${n.w/2+7} ${n.h/2-7} L ${n.w/2-7} ${n.h/2+7}`);
          xMk.setAttribute('stroke', '#E0B84D'); xMk.setAttribute('stroke-width', '2.5');
          xMk.setAttribute('stroke-linecap', 'round'); xMk.setAttribute('fill', 'none');
          xMk.setAttribute('opacity', '0.45');
          g.appendChild(xMk);
          wrapLabelInto(g, n.label, n.w / 2, n.h / 2, n.w - 18, 10.5, 3);
        }
      }
      // ─────────── TAREAS: marcador BPMN + código + label envuelto ───────────
      else if (isTask) {
        // Marcador BPMN top-left (icono de línea)
        if (exec) {
          const mk = document.createElementNS(ns, 'g');
          mk.setAttribute('class', 'bpmn-marker');
          mk.setAttribute('transform', 'translate(6, 6)');
          const icon = document.createElementNS(ns, 'path');
          icon.setAttribute('d', exec.marker || exec.glyph);
          icon.setAttribute('fill', exec.filled ? exec.stroke : 'none');
          icon.setAttribute('stroke', exec.stroke || exec.color);
          icon.setAttribute('stroke-width', '1.1');
          icon.setAttribute('stroke-linecap', 'round');
          icon.setAttribute('stroke-linejoin', 'round');
          mk.appendChild(icon);
          const ttl = document.createElementNS(ns, 'title');
          ttl.textContent = exec.bpmn + ' — ' + exec.desc;
          mk.appendChild(ttl);
          g.appendChild(mk);
        }
        // Código de actividad (top-left, después del marcador)
        if (n.activityCode) {
          const code = document.createElementNS(ns, 'text');
          code.setAttribute('x', exec ? 26 : 8);
          code.setAttribute('y', 15);
          code.setAttribute('class', 'node-code');
          code.setAttribute('fill', exec ? exec.color : '#6B7280');
          code.textContent = '[' + n.activityCode + ']';
          g.appendChild(code);
        }
        // Label envuelto, centrado en el espacio inferior
        wrapLabelInto(g, n.label, n.w / 2, (n.h + 18) / 2 + 6, n.w - 16, 11, 3);
        // Marcador de actividad BPMN (base, centrado abajo): subproceso ＋, loop ↻, multi-instancia ‖
        if (n.marker && n.marker !== 'none') {
          const am = document.createElementNS(ns, 'g');
          am.setAttribute('class', 'bpmn-activity-marker');
          am.setAttribute('transform', `translate(${n.w / 2 - 7}, ${n.h - 17})`);
          const mp = document.createElementNS(ns, 'path');
          mp.setAttribute('fill', 'none');
          mp.setAttribute('stroke', '#5B6472');
          mp.setAttribute('stroke-width', '1.4');
          mp.setAttribute('stroke-linecap', 'round');
          let d = '', boxed = true, mt = '';
          if (n.marker === 'subprocess') {            // ＋ en caja → subproceso colapsado
            d = 'M 7 3 V 11 M 3 7 H 11'; mt = 'Subproceso (colapsado)';
          } else if (n.marker === 'loop') {           // ↻ → actividad cíclica
            d = 'M 11 5 A 4.5 4.5 0 1 0 11.5 9 M 11 2 V 5 H 8'; boxed = false; mt = 'Actividad de loop';
          } else if (n.marker === 'multiinstance') {  // ‖‖‖ paralelo
            d = 'M 3 3 V 11 M 7 3 V 11 M 11 3 V 11'; boxed = false; mt = 'Multi-instancia (paralela)';
          } else if (n.marker === 'multiinstance-seq') { // ≡ secuencial
            d = 'M 3 4 H 11 M 3 7 H 11 M 3 10 H 11'; boxed = false; mt = 'Multi-instancia (secuencial)';
          }
          if (boxed) {
            const box = document.createElementNS(ns, 'rect');
            box.setAttribute('x', '0'); box.setAttribute('y', '0');
            box.setAttribute('width', '14'); box.setAttribute('height', '14');
            box.setAttribute('rx', '1.5'); box.setAttribute('fill', 'none');
            box.setAttribute('stroke', '#5B6472'); box.setAttribute('stroke-width', '1.2');
            am.appendChild(box);
          }
          mp.setAttribute('d', d);
          am.appendChild(mp);
          const mtt = document.createElementNS(ns, 'title');
          mtt.textContent = mt;
          am.appendChild(mtt);
          g.appendChild(am);
        }
        // Evento de borde BPMN (boundary): círculo pequeño sobre el borde de la tarea.
        // Anillo simple = interrumpe; anillo punteado = no interrumpe. Glyph timer/error/message.
        if (n.boundary) {
          const bt = typeof n.boundary === 'string' ? n.boundary : (n.boundary.type || 'timer');
          const interrupting = (typeof n.boundary === 'object') ? n.boundary.interrupting !== false : true;
          const br = 11, bcx = 10, bcy = n.h - 3;   // esquina inferior izquierda (libre de pain/marcador), sobre el borde
          const bg = document.createElementNS(ns, 'g');
          bg.setAttribute('class', 'bpmn-boundary');
          const outer = document.createElementNS(ns, 'circle');
          outer.setAttribute('cx', bcx); outer.setAttribute('cy', bcy); outer.setAttribute('r', br);
          outer.setAttribute('fill', '#FEF7E0'); outer.setAttribute('stroke', '#B45309'); outer.setAttribute('stroke-width', '1.4');
          if (!interrupting) outer.setAttribute('stroke-dasharray', '3 2');
          bg.appendChild(outer);
          const inner = document.createElementNS(ns, 'circle');
          inner.setAttribute('cx', bcx); inner.setAttribute('cy', bcy); inner.setAttribute('r', br - 3);
          inner.setAttribute('fill', 'none'); inner.setAttribute('stroke', '#B45309'); inner.setAttribute('stroke-width', '1');
          if (!interrupting) inner.setAttribute('stroke-dasharray', '3 2');
          bg.appendChild(inner);
          const bGlyphs = {
            timer:   'M 0 -5 A 5 5 0 1 1 0 5 A 5 5 0 1 1 0 -5 M 0 -3 V 0 L 2 1.5',
            error:   'M -4 4 L -1.3 -2 L 0.7 0.7 L 3.3 -4',
            message: 'M -4.5 -3 H 4.5 V 3 H -4.5 Z M -4.5 -3 L 0 0.7 L 4.5 -3'
          };
          const bp = document.createElementNS(ns, 'path');
          bp.setAttribute('d', bGlyphs[bt] || bGlyphs.timer);
          bp.setAttribute('transform', `translate(${bcx},${bcy})`);
          bp.setAttribute('fill', 'none'); bp.setAttribute('stroke', '#B45309');
          bp.setAttribute('stroke-width', bt === 'timer' ? '1' : '1.3');
          bp.setAttribute('stroke-linecap', 'round'); bp.setAttribute('stroke-linejoin', 'round');
          bg.appendChild(bp);
          const btt = document.createElementNS(ns, 'title');
          btt.textContent = 'Evento de borde ' + (interrupting ? '(interrumpe)' : '(no interrumpe)') + ' — ' + bt;
          bg.appendChild(btt);
          g.appendChild(bg);
        }
      }
      // ─────────── DOCUMENTO / DATA: label centrado ───────────
      else {
        const lbl = document.createElementNS(ns, 'text');
        lbl.setAttribute('x', n.w / 2);
        lbl.setAttribute('y', n.h / 2 - 4);
        lbl.setAttribute('class', 'node-label');
        lbl.textContent = truncate(n.label, 20);
        g.appendChild(lbl);
      }

      // Meta debajo del nodo: responsable · sistema
      if (n.owner && n.type !== 'start' && n.type !== 'end' && n.type !== 'intermediate') {
        const meta = document.createElementNS(ns, 'text');
        meta.setAttribute('x', n.w / 2);
        meta.setAttribute('y', n.h + 12);
        meta.setAttribute('class', 'node-meta');
        meta.textContent = n.owner + (n.system ? ' · ' + n.system : '');
        g.appendChild(meta);
      }

      // Badge de owner inferido → esquina superior DERECHA (alerta validación manual)
      if (n._inferredOwner && (isTask || n.type === 'decision')) {
        const alertG = document.createElementNS(ns, 'g');
        alertG.setAttribute('class', 'owner-alert-badge');
        alertG.setAttribute('transform', `translate(${n.w - 18}, 4)`);
        const circ = document.createElementNS(ns, 'circle');
        circ.setAttribute('cx', 7); circ.setAttribute('cy', 7); circ.setAttribute('r', 7);
        circ.setAttribute('fill', '#B45309');
        circ.setAttribute('stroke', '#FFFFFF');
        circ.setAttribute('stroke-width', '1.5');
        alertG.appendChild(circ);
        const tri = document.createElementNS(ns, 'path');
        tri.setAttribute('d', 'M 7 3 L 11 10 L 3 10 Z M 7 5.5 V 7.5 M 7 8.5 V 8.8');
        tri.setAttribute('fill', 'none');
        tri.setAttribute('stroke', '#FFFFFF');
        tri.setAttribute('stroke-width', '1.2');
        tri.setAttribute('stroke-linecap', 'round');
        tri.setAttribute('stroke-linejoin', 'round');
        alertG.appendChild(tri);
        const title = document.createElementNS(ns, 'title');
        title.textContent = `Responsable inferido: "${state._lanes?.laneOf?.[n.id] || ''}" — validar manualmente`;
        alertG.appendChild(title);
        g.appendChild(alertG);
      }

      // Badge de pains → esquina inferior derecha
      if (n.pains && n.pains.length > 0) {
        const badge = document.createElementNS(ns, 'g');
        const cx = n.w - 9, cy = n.h - 9;
        const circ = document.createElementNS(ns, 'circle');
        circ.setAttribute('cx', cx); circ.setAttribute('cy', cy); circ.setAttribute('r', 9);
        circ.setAttribute('fill', '#FF4713');
        circ.setAttribute('stroke', '#FFFFFF');
        circ.setAttribute('stroke-width', '1.5');
        badge.appendChild(circ);
        const txt = document.createElementNS(ns, 'text');
        txt.setAttribute('x', cx); txt.setAttribute('y', cy);
        txt.setAttribute('class', 'node-pain-badge');
        txt.textContent = n.pains.length;
        badge.appendChild(txt);
        g.appendChild(badge);
      }

      // Badge de cuello de botella (F3) — esquina inferior izquierda
      if (n.id === state._bottleneckId) {
        const b = document.createElementNS(ns, 'g');
        b.setAttribute('transform', `translate(4, ${n.h - 20})`);
        const r = document.createElementNS(ns, 'rect');
        r.setAttribute('width', 64); r.setAttribute('height', 16); r.setAttribute('rx', 3);
        r.setAttribute('fill', '#B91C1C');
        b.appendChild(r);
        const t = document.createElementNS(ns, 'text');
        t.setAttribute('x', 32); t.setAttribute('y', 8);
        t.setAttribute('text-anchor', 'middle'); t.setAttribute('dominant-baseline', 'middle');
        t.setAttribute('font-size', '9'); t.setAttribute('font-weight', '700'); t.setAttribute('fill', '#fff');
        t.textContent = '⛔ CUELLO';
        b.appendChild(t);
        g.appendChild(b);
      }

      g.addEventListener('mousedown', ev => {
        ev.stopPropagation();
        if (state.mode === 'connect') {
          if (!state.connectSourceId) {
            state.connectSourceId = n.id;
            render();
          } else {
            addEdge(state.connectSourceId, n.id);
            state.connectSourceId = null;
            render();
          }
          return;
        }
        state.selectedNodeId = n.id;
        state.selectedEdgeId = null;
        const pt = svgPoint(ev.clientX, ev.clientY);
        state.drag = { id: n.id, offsetX: pt.x - n.x, offsetY: pt.y - n.y };
        render();
      });

      g.addEventListener('dblclick', ev => {
        ev.stopPropagation();
        // Edición rápida de etiqueta del nodo
        const v = prompt('Etiqueta del nodo:', n.label || '');
        if (v !== null) { n.label = v.trim(); persist(); render(); }
      });

      nodesLayer.appendChild(g);
    });

    // Hint
    canvasHint.style.display = state.nodes.length === 0 ? 'block' : 'none';

    // Ajusta dimensiones del SVG al bounding box del contenido (con padding) para habilitar scroll
    const wrapperRect = $('#canvasWrapper').getBoundingClientRect();
    let needW = wrapperRect.width, needH = wrapperRect.height;
    if (state.nodes.length > 0) {
      const padding = 120;
      let maxX = 0, maxY = 0;
      state.nodes.forEach(n => {
        maxX = Math.max(maxX, n.x + n.w);
        maxY = Math.max(maxY, n.y + n.h + 20);
      });
      needW = Math.max(needW, maxX + padding);
      needH = Math.max(needH, maxY + padding);
    }
    // Guarda extensión de contenido para el zoom-to-fit
    state._contentW = needW; state._contentH = needH;
    const zoom = state.zoom || 1;
    // viewBox en unidades de contenido; width/height escalados por zoom → SVG escala el dibujo.
    // getScreenCTM refleja esta escala, por lo que svgPoint (matriz) sigue siendo exacto.
    canvas.setAttribute('viewBox', `0 0 ${needW} ${needH}`);
    canvas.setAttribute('width', needW * zoom);
    canvas.setAttribute('height', needH * zoom);
    canvas.style.minWidth = (needW * zoom) + 'px';
    canvas.style.minHeight = (needH * zoom) + 'px';
    // El grid background necesita cubrir todo el SVG (en unidades de contenido)
    const gridBg = $('#gridBg');
    if (gridBg) { gridBg.setAttribute('width', needW); gridBg.setAttribute('height', needH); }

    // Status
    $('#statusNodes').textContent = `${state.nodes.length} nodos`;
    $('#statusEdges').textContent = `${state.edges.length} conexiones`;

    renderProperties();
    renderPains();
    runLinter();
  }

  function createShape(n) {
    const ns = 'http://www.w3.org/2000/svg';
    let el;
    switch (n.type) {
      case 'start':
        el = document.createElementNS(ns, 'ellipse');
        el.setAttribute('cx', n.w / 2); el.setAttribute('cy', n.h / 2);
        el.setAttribute('rx', n.w / 2); el.setAttribute('ry', n.h / 2);
        el.setAttribute('fill', getCss('--node-start-fill'));
        el.setAttribute('stroke', getCss('--node-start-stroke'));
        el.setAttribute('stroke-width', 2);
        break;
      case 'end':
        el = document.createElementNS(ns, 'ellipse');
        el.setAttribute('cx', n.w / 2); el.setAttribute('cy', n.h / 2);
        el.setAttribute('rx', n.w / 2); el.setAttribute('ry', n.h / 2);
        el.setAttribute('fill', getCss('--node-end-fill'));
        el.setAttribute('stroke', getCss('--node-end-stroke'));
        el.setAttribute('stroke-width', 3);
        break;
      case 'intermediate': {
        // Evento intermedio BPMN: doble anillo
        el = document.createElementNS(ns, 'g');
        const outer = document.createElementNS(ns, 'circle');
        outer.setAttribute('cx', n.w / 2); outer.setAttribute('cy', n.h / 2); outer.setAttribute('r', n.w / 2);
        outer.setAttribute('fill', '#FEF7E0'); outer.setAttribute('stroke', '#B45309'); outer.setAttribute('stroke-width', 1.8);
        const inner = document.createElementNS(ns, 'circle');
        inner.setAttribute('cx', n.w / 2); inner.setAttribute('cy', n.h / 2); inner.setAttribute('r', n.w / 2 - 4);
        inner.setAttribute('fill', 'none'); inner.setAttribute('stroke', '#B45309'); inner.setAttribute('stroke-width', 1.5);
        el.appendChild(outer); el.appendChild(inner);
        break;
      }
      case 'decision':
        el = document.createElementNS(ns, 'polygon');
        el.setAttribute('points', `${n.w/2},0 ${n.w},${n.h/2} ${n.w/2},${n.h} 0,${n.h/2}`);
        el.setAttribute('fill', getCss('--node-decision-fill'));
        el.setAttribute('stroke', getCss('--node-decision-stroke'));
        el.setAttribute('stroke-width', 1.5);
        break;
      case 'document':
        el = document.createElementNS(ns, 'path');
        el.setAttribute('d', `M 0 0 L ${n.w} 0 L ${n.w} ${n.h-10} Q ${n.w*0.75} ${n.h+6} ${n.w/2} ${n.h-6} Q ${n.w*0.25} ${n.h-18} 0 ${n.h-6} Z`);
        el.setAttribute('fill', getCss('--node-doc-fill'));
        el.setAttribute('stroke', getCss('--node-doc-stroke'));
        el.setAttribute('stroke-width', 1.5);
        break;
      case 'data':
        el = document.createElementNS(ns, 'path');
        el.setAttribute('d', `M 15 0 L ${n.w} 0 L ${n.w-15} ${n.h} L 0 ${n.h} Z`);
        el.setAttribute('fill', getCss('--node-data-fill'));
        el.setAttribute('stroke', getCss('--node-data-stroke'));
        el.setAttribute('stroke-width', 1.5);
        break;
      case 'system':
        el = document.createElementNS(ns, 'rect');
        el.setAttribute('width', n.w); el.setAttribute('height', n.h);
        el.setAttribute('rx', 3); el.setAttribute('ry', 3);
        el.setAttribute('fill', getCss('--node-system-fill'));
        el.setAttribute('stroke', getCss('--node-system-stroke'));
        el.setAttribute('stroke-width', 1.5);
        el.setAttribute('stroke-dasharray', '4 3');
        break;
      case 'task':
      default:
        el = document.createElementNS(ns, 'rect');
        el.setAttribute('width', n.w); el.setAttribute('height', n.h);
        el.setAttribute('rx', 6); el.setAttribute('ry', 6);
        // Modo mapa de valor Lean (F5): tinta por VA/BVA/NVA. Si no, tinte por tipo de ejecución.
        let fill = getCss('--node-task-fill');
        if (state._valueMode) {
          fill = n.va === 'VA' ? '#DCFCE7' : (n.va === 'BVA' ? '#FEF3C7' : (n.va === 'NVA' ? '#FEE2E2' : '#F3F4F6'));
        } else if (n.executionType) {
          const exec = (window.EXECUTION_TYPES || []).find(t => t.id === n.executionType);
          if (exec) fill = exec.tint;
        }
        el.setAttribute('fill', fill);
        el.setAttribute('stroke', getCss('--node-task-stroke'));
        el.setAttribute('stroke-width', 1.5);
    }
    return el;
  }

  function nodeCenter(n) {
    return { x: n.x + n.w / 2, y: n.y + n.h / 2 };
  }

  function orthoPath(p1, p2) {
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      const mx = p1.x + dx / 2;
      return `M ${p1.x} ${p1.y} L ${mx} ${p1.y} L ${mx} ${p2.y} L ${p2.x} ${p2.y}`;
    } else {
      const my = p1.y + dy / 2;
      return `M ${p1.x} ${p1.y} L ${p1.x} ${my} L ${p2.x} ${my} L ${p2.x} ${p2.y}`;
    }
  }

  function getCss(varName) {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  }

  function truncate(s, n) { return !s ? '' : (s.length > n ? s.slice(0, n - 1) + '…' : s); }

  // Envuelve texto en varias líneas dentro de un <text> centrado en (cx, cy).
  // maxW = ancho disponible en px; charPx ≈ ancho medio de carácter a fontSize 11 ≈ 6px.
  function wrapLabelInto(g, text, cx, cy, maxW, fontSize, maxLines) {
    const ns = 'http://www.w3.org/2000/svg';
    text = (text || '').trim();
    const charPx = fontSize * 0.55;
    const maxChars = Math.max(6, Math.floor(maxW / charPx));
    const words = text.split(/\s+/);
    const lines = [];
    let cur = '';
    for (const w of words) {
      if (!cur) { cur = w; }
      else if ((cur + ' ' + w).length <= maxChars) { cur += ' ' + w; }
      else { lines.push(cur); cur = w; }
      if (lines.length >= maxLines) break;
    }
    if (cur && lines.length < maxLines) lines.push(cur);
    // Si quedó texto fuera, añade elipsis a la última línea
    if (lines.length === maxLines) {
      const used = lines.join(' ').length;
      if (used < text.length) {
        let last = lines[maxLines - 1];
        if (last.length > maxChars - 1) last = last.slice(0, maxChars - 1);
        lines[maxLines - 1] = last.replace(/\s*\S*$/, '') + '…';
      }
    }
    const lineH = fontSize + 2;
    const startY = cy - ((lines.length - 1) * lineH) / 2;
    const txt = document.createElementNS(ns, 'text');
    txt.setAttribute('x', cx);
    txt.setAttribute('y', startY);
    txt.setAttribute('class', 'node-label');
    txt.setAttribute('font-size', fontSize);
    lines.forEach((ln, i) => {
      const tspan = document.createElementNS(ns, 'tspan');
      tspan.setAttribute('x', cx);
      tspan.setAttribute('dy', i === 0 ? 0 : lineH);
      tspan.textContent = ln;
      txt.appendChild(tspan);
    });
    g.appendChild(txt);
    return txt;
  }

  // Paleta para acentos de swimlanes — colores estables por nombre
  const LANE_PALETTE = ['#1E5BAA', '#2E7D32', '#B45309', '#6D28D9', '#B91C1C', '#0F766E', '#9D174D', '#374151', '#1F2937', '#0D9488'];
  function laneColor(name, idx) {
    if (name === '— Proceso —') return '#9CA3AF';
    if (name === 'Sistema') return '#37474F';
    if (name === 'Sin asignar') return '#D6D6D6';
    // Hash simple para color estable por nombre
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return LANE_PALETTE[h % LANE_PALETTE.length];
  }

  // =================== TABS ===================
  function attachTabListeners() {
    $$('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        $$('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.tab;
        $$('.tab-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === target));
      });
    });
  }

  // =================== PROPERTIES PANEL ===================
  function attachPropertyListeners() {
    const fields = [
      ['Label', 'label'],
      ['ExecType', 'executionType'],
      ['Owner', 'owner'],
      ['System', 'system'],
      ['Time', 'time'],
      ['Volume', 'volume'],
      ['VA', 'va'],
      ['Sla', 'sla'],
      ['DocsIn', 'docsIn'],
      ['DocsOut', 'docsOut'],
      ['Rules', 'rules'],
      ['Notes', 'notes']
    ];
    fields.forEach(([id, key]) => {
      const el = $('#prop' + id);
      if (!el) return;
      el.addEventListener('input', () => {
        const n = getNode(state.selectedNodeId);
        if (!n) return;
        n[key] = el.value;
        if (id === 'Label')    showLabelHint(el.value);
        if (id === 'ExecType') {
          showExecHint(el.value);
          // Re-asigna código si cambia el tipo de tarea (prefijo nuevo)
          const exec = (window.EXECUTION_TYPES || []).find(t => t.id === el.value);
          if (exec && n.activityCode) {
            const numMatch = n.activityCode.match(/-(\d+)$/);
            const num = numMatch ? numMatch[1] : '01';
            n.activityCode = exec.codePrefix + '-' + num;
            $('#propActivityCode').value = n.activityCode;
          }
        }
        persist();
        render();
        runLinter();
      });
    });

    // Edición manual del código de actividad
    const codeEl = $('#propActivityCode');
    if (codeEl) {
      codeEl.addEventListener('input', () => {
        const n = getNode(state.selectedNodeId);
        if (!n) return;
        n.activityCode = codeEl.value.trim().toUpperCase().replace(/[\[\]]/g, '');
        persist();
        render();
      });
    }

    // Edición manual del tipo de bloque BPMN (start/task/decision/…)
    const typeEl = $('#propNodeType');
    if (typeEl) {
      typeEl.addEventListener('change', () => {
        const n = getNode(state.selectedNodeId);
        if (!n) return;
        const newType = typeEl.value;
        const def = SHAPE_DEFAULTS[newType];
        n.type = newType;
        // Ajusta tamaño al nuevo tipo (preserva posición del centro)
        if (def) {
          const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
          n.w = def.w; n.h = def.h;
          n.x = cx - n.w / 2; n.y = cy - n.h / 2;
        }
        // Si pasa a evento, limpia tipo de ejecución y código
        if (newType === 'start' || newType === 'end' || newType === 'decision' || newType === 'intermediate') {
          n.executionType = ''; n.activityCode = '';
        } else if (!n.executionType) {
          n.executionType = newType === 'system' ? 'system' : 'manual';
        }
        // Limpia eventType si deja de ser evento
        if (newType !== 'start' && newType !== 'end' && newType !== 'intermediate') {
          n.eventType = '';
        } else if (!n.eventType) {
          n.eventType = 'none';
        }
        persist();
        renderProperties();
        render();
        runLinter();
      });
    }

    // Tipo de gateway BPMN (exclusivo/paralelo/inclusivo)
    const gwEl = $('#propGatewayType');
    if (gwEl) {
      gwEl.addEventListener('change', () => {
        const n = getNode(state.selectedNodeId);
        if (!n) return;
        n.gatewayType = gwEl.value;
        persist();
        autoLayout();   // re-evalúa ramas (paralelo no fuerza Sí/No)
      });
    }

    // Tipo de evento BPMN (mensaje/timer/error/señal) para start/end/intermediate
    const evEl = $('#propEventType');
    if (evEl) {
      evEl.addEventListener('change', () => {
        const n = getNode(state.selectedNodeId);
        if (!n) return;
        n.eventType = evEl.value === 'none' ? '' : evEl.value;
        persist();
        render();
      });
    }

    // Marcador de actividad BPMN (subproceso/loop/multi-instancia) para tareas
    const mkEl = $('#propMarker');
    if (mkEl) {
      mkEl.addEventListener('change', () => {
        const n = getNode(state.selectedNodeId);
        if (!n) return;
        n.marker = mkEl.value === 'none' ? '' : mkEl.value;
        persist();
        render();
      });
    }

    // Evento de borde BPMN (boundary) para tareas: "tipo|interrumpe"
    const bdEl = $('#propBoundary');
    if (bdEl) {
      bdEl.addEventListener('change', () => {
        const n = getNode(state.selectedNodeId);
        if (!n) return;
        if (bdEl.value === 'none') {
          n.boundary = undefined;
        } else {
          const [type, interr] = bdEl.value.split('|');
          n.boundary = { type, interrupting: interr === 'true' };
        }
        persist();
        render();
      });
    }

    // Evento de terminación BPMN (solo para fin)
    const termEl = $('#propTerminate');
    if (termEl) {
      termEl.addEventListener('change', () => {
        const n = getNode(state.selectedNodeId);
        if (!n) return;
        n.terminate = termEl.checked || undefined;
        persist();
        render();
      });
    }
  }

  function showLabelHint(value) {
    const hint = $('#propLabelHint');
    if (!hint) return;
    const v = (value || '').trim();
    if (!v) { hint.hidden = true; return; }

    const lower = v.toLowerCase();
    const firstWord = lower.split(/\s+/)[0].replace(/[^a-záéíóúñ]/g, '');

    // Verbo prohibido?
    const forbidden = window.VERBS_FORBIDDEN || {};
    if (forbidden[firstWord]) {
      hint.hidden = false;
      hint.className = 'field-hint error';
      hint.textContent = `"${firstWord}" → ${forbidden[firstWord]}`;
      return;
    }

    // Verbo permitido?
    const allowed = window.VERBS_ALLOWED || [];
    const isAllowed = allowed.some(a => firstWord.startsWith(a));

    // Longitud
    const words = v.split(/\s+/).length;
    if (v.length > 50 || words > 8) {
      hint.hidden = false;
      hint.className = 'field-hint warn';
      hint.textContent = `Demasiado larga (${v.length} car, ${words} pal). Máx 50 car / 8 palabras — considera descomponer.`;
      return;
    }

    if (!isAllowed) {
      hint.hidden = false;
      hint.className = 'field-hint warn';
      hint.textContent = `"${firstWord}" no está en el catálogo MBB. Prefiere: registrar, validar, aprobar, escalar, notificar, calcular…`;
      return;
    }

    hint.hidden = false;
    hint.className = 'field-hint ok';
    hint.textContent = 'Naming OK · verbo permitido + longitud adecuada';
  }

  function showExecHint(value) {
    const hint = $('#propExecHint');
    if (!hint) return;
    if (!value) { hint.hidden = true; return; }
    const t = (window.EXECUTION_TYPES || []).find(x => x.id === value);
    if (!t) { hint.hidden = true; return; }
    hint.hidden = false;
    hint.className = 'field-hint info';
    hint.textContent = t.desc;
  }

  function renderProperties() {
    const n = getNode(state.selectedNodeId);
    if (!n) {
      $('#propsEmpty').hidden = false;
      $('#propsForm').hidden = true;
      return;
    }
    $('#propsEmpty').hidden = true;
    $('#propsForm').hidden = false;
    if ($('#propNodeType')) $('#propNodeType').value = n.type || 'task';
    // Muestra el selector de gateway solo para decisiones
    if ($('#propGatewayWrap')) {
      $('#propGatewayWrap').hidden = n.type !== 'decision';
      if (n.type === 'decision' && $('#propGatewayType')) $('#propGatewayType').value = n.gatewayType || 'exclusive';
    }
    // Muestra el selector de evento solo para start/end/intermediate
    if ($('#propEventWrap')) {
      const isEvent = n.type === 'start' || n.type === 'end' || n.type === 'intermediate';
      $('#propEventWrap').hidden = !isEvent;
      if (isEvent && $('#propEventType')) $('#propEventType').value = n.eventType || 'none';
    }
    // Checkbox de terminación solo para eventos de fin
    if ($('#propTerminateWrap')) {
      $('#propTerminateWrap').hidden = n.type !== 'end';
      if (n.type === 'end' && $('#propTerminate')) $('#propTerminate').checked = !!n.terminate;
    }
    // Muestra el selector de marcador de actividad solo para tareas
    if ($('#propMarkerWrap')) {
      const isTaskType = n.type === 'task' || n.type === 'system';
      $('#propMarkerWrap').hidden = !isTaskType;
      if (isTaskType && $('#propMarker')) $('#propMarker').value = n.marker || 'none';
    }
    // Selector de evento de borde (boundary) solo para tareas
    if ($('#propBoundaryWrap')) {
      const isTaskType = n.type === 'task' || n.type === 'system';
      $('#propBoundaryWrap').hidden = !isTaskType;
      if (isTaskType && $('#propBoundary')) {
        const b = n.boundary;
        $('#propBoundary').value = b ? `${(typeof b === 'string' ? b : b.type)}|${(typeof b === 'object' ? b.interrupting !== false : true)}` : 'none';
      }
    }
    if ($('#propActivityCode')) $('#propActivityCode').value = n.activityCode || '';
    $('#propLabel').value = n.label || '';
    $('#propExecType').value = n.executionType || '';
    $('#propOwner').value = n.owner || '';
    $('#propSystem').value = n.system || '';
    $('#propTime').value = n.time || '';
    $('#propVolume').value = n.volume || '';
    $('#propVA').value = n.va || '';
    $('#propSla').value = n.sla || '';
    $('#propDocsIn').value = n.docsIn || '';
    $('#propDocsOut').value = n.docsOut || '';
    $('#propRules').value = n.rules || '';
    $('#propNotes').value = n.notes || '';
    showLabelHint(n.label || '');
    showExecHint(n.executionType || '');
  }

  // =================== PAINS PANEL ===================
  function attachPainListeners() {
    $('#btnAddPain').addEventListener('click', () => {
      const n = getNode(state.selectedNodeId);
      if (!n) return;
      const desc = $('#painDescription').value.trim();
      if (!desc) { alert('Describe el pain.'); return; }
      n.pains.push({
        id: 'p' + (state.nextId++),
        category: $('#painCategory').value,
        description: desc,
        severity: parseInt($('#painSeverity').value, 10),
        frequency: parseInt($('#painFrequency').value, 10)
      });
      $('#painDescription').value = '';
      persist();
      render();
    });
  }

  function renderPains() {
    const list = $('#painsList');
    const add = $('#painsAdd');
    list.innerHTML = '';
    const n = getNode(state.selectedNodeId);
    if (!n) {
      add.hidden = true;
      list.innerHTML = '<div class="empty-state">Selecciona un nodo para capturar sus pain points.</div>';
      return;
    }
    add.hidden = false;
    if (n.pains.length === 0) {
      list.innerHTML = '<div class="panel-hint">Sin pains capturados aún.</div>';
    } else {
      n.pains.forEach(p => {
        const cat = window.PAIN_CATEGORIES.find(c => c.id === p.category) || { label: '?', color: '#999', icon: '•' };
        const score = p.severity * p.frequency;
        const card = document.createElement('div');
        card.className = 'pain-card';
        card.style.borderLeftColor = cat.color;
        card.innerHTML = `
          <div class="pain-cat" style="color:${cat.color}">${cat.icon} ${cat.label}</div>
          <div class="pain-desc">${escapeHtml(p.description)}</div>
          <div class="pain-meta">Sev ${p.severity} · Frec ${p.frequency} · Score ${score}</div>
          <button class="pain-remove" data-id="${p.id}" title="Eliminar">✕</button>`;
        card.querySelector('.pain-remove').addEventListener('click', () => {
          n.pains = n.pains.filter(x => x.id !== p.id);
          persist(); render();
        });
        list.appendChild(card);
      });
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  // =================== KPI LIBRARY ===================
  function attachKpiListeners() {
    $('#kpiSearch').addEventListener('input', renderKpiLibrary);
    $('#kpiFilterIndustry').addEventListener('change', renderKpiLibrary);
  }

  function populateKpiLibrary() { renderKpiLibrary(); }

  function renderKpiLibrary() {
    const q = ($('#kpiSearch').value || '').toLowerCase();
    const ind = $('#kpiFilterIndustry').value || state.meta.industry || '';
    const list = $('#kpiList');
    list.innerHTML = '';
    const filtered = window.KPI_LIBRARY.filter(k => {
      const okInd = !ind || k.industry === ind || k.industry === 'Transversal';
      const okQ = !q || k.name.toLowerCase().includes(q) || k.description.toLowerCase().includes(q);
      return okInd && okQ;
    });
    if (filtered.length === 0) {
      list.innerHTML = '<div class="panel-hint">Sin coincidencias.</div>';
      return;
    }
    filtered.forEach(k => {
      const card = document.createElement('div');
      card.className = 'kpi-card';
      card.innerHTML = `
        <div class="kpi-name">${escapeHtml(k.name)} <span style="color:#7A7A7A;font-weight:400">(${escapeHtml(k.unit)})</span></div>
        <div class="kpi-tags">
          <span class="kpi-tag">${escapeHtml(k.industry)}</span>
          <span class="kpi-tag">${escapeHtml(k.macroprocess)}</span>
        </div>
        <div class="kpi-bench">Benchmark: ${escapeHtml(k.benchmark)}</div>
        <div class="kpi-desc">${escapeHtml(k.description)}</div>`;
      // KPI status badge si ya fue capturado
      state._kpiValues = state._kpiValues || {};
      const captured = state._kpiValues[k.id];
      if (captured) {
        card.innerHTML += `<div style="margin-top:6px;padding:4px 8px;background:#FFF3E0;border-radius:3px;font-size:11px;color:#E65100"><strong>Valor actual:</strong> ${escapeHtml(captured.value)} · <strong>Gap:</strong> ${escapeHtml(captured.gap || '—')}</div>`;
      }
      card.addEventListener('click', () => {
        openKpiCaptureModal(k);
      });
      list.appendChild(card);
    });
  }

  // Modal: capturar valor actual del cliente + calcular gap
  function openKpiCaptureModal(k) {
    state._kpiValues = state._kpiValues || {};
    const current = state._kpiValues[k.id] || {};
    const html = `
      <div style="margin-bottom:10px"><strong>${escapeHtml(k.name)}</strong> <span style="color:#7A7A7A">(${escapeHtml(k.unit)})</span></div>
      <div style="background:#F8F8F8;padding:10px;border-radius:4px;margin-bottom:12px;font-size:12px">
        ${escapeHtml(k.description)}
        <div style="margin-top:6px;color:#FF4713;font-weight:600">Benchmark sectorial: ${escapeHtml(k.benchmark)}</div>
      </div>
      <label style="display:block;margin-bottom:8px;font-size:12px;font-weight:600">Valor actual del cliente
        <input type="text" id="kpiActualValue" value="${escapeHtml(current.value || '')}" placeholder="ej. 6.2" style="width:100%;padding:7px;border:1px solid #ddd;border-radius:3px;margin-top:3px" />
      </label>
      <label style="display:block;margin-bottom:8px;font-size:12px;font-weight:600">Gap vs benchmark (calculado o manual)
        <input type="text" id="kpiGap" value="${escapeHtml(current.gap || '')}" placeholder="ej. -2.2 pp (por encima del benchmark)" style="width:100%;padding:7px;border:1px solid #ddd;border-radius:3px;margin-top:3px" />
      </label>
      <label style="display:block;font-size:12px;font-weight:600">Fuente del dato
        <input type="text" id="kpiSource" value="${escapeHtml(current.source || '')}" placeholder="ej. Dashboard SBS, reporte interno BO 04/2026" style="width:100%;padding:7px;border:1px solid #ddd;border-radius:3px;margin-top:3px" />
      </label>
      <p class="panel-hint" style="margin-top:10px">Los KPIs capturados aparecen en el slide PPTX con su gap. El gap se calcula automáticamente si valor y benchmark son numéricos.</p>`;

    openModal('Capturar valor actual · KPI', html, () => {
      const v = $('#kpiActualValue').value.trim();
      let g = $('#kpiGap').value.trim();
      const src = $('#kpiSource').value.trim();
      // Auto-calcular gap si ambos son números
      if (!g && v) {
        const numActual = parseFloat(v.replace(/[^\d.\-]/g, ''));
        const numBench = parseFloat(k.benchmark.replace(/[^\d.\-]/g, ''));
        if (!isNaN(numActual) && !isNaN(numBench)) {
          const diff = numActual - numBench;
          const sign = diff >= 0 ? '+' : '';
          g = `${sign}${diff.toFixed(2)} ${k.unit}`;
        }
      }
      if (v) {
        state._kpiValues[k.id] = { name: k.name, unit: k.unit, benchmark: k.benchmark, value: v, gap: g, source: src };
      } else {
        delete state._kpiValues[k.id];
      }
      persist();
      renderKpiLibrary();
      copilotPost('ai', `KPI capturado: **${k.name}** = ${v || '—'} (gap ${g || '—'}). Se incluirá en el slide de KPIs del PPTX.`);
    });
  }

  // =================== COPILOT (mock) ===================
  function attachCopilotListeners() {
    $$('.copilot-action').forEach(b => {
      b.addEventListener('click', () => handleCopilotAction(b.dataset.action));
    });
    $('#btnCopilotSend').addEventListener('click', () => {
      const txt = $('#copilotPrompt').value.trim();
      if (!txt) return;
      copilotPost('user', txt);
      $('#copilotPrompt').value = '';
      setTimeout(() => copilotPost('ai', mockCopilotResponse(txt)), 350);
    });
    copilotPost('ai',
      '¡Hola! Soy tu copiloto **ProcessIQ**.\n\n' +
      'Estoy aquí para ayudarte a levantar, diagnosticar y reingenierizar procesos más rápido.\n' +
      'Empieza completando el **nombre, industria y macroproceso** arriba, y luego usa las acciones rápidas o pídeme algo en lenguaje natural.\n\n' +
      'Ejemplo: *"Levanta el proceso de gestión de reclamos para un banco minorista peruano."*');
  }

  function handleCopilotAction(action) {
    activateTab('copilot');
    switch (action) {
      case 'generate':
        openModal('Generar proceso desde descripción',
          '<textarea id="modalInput" placeholder="Describe el proceso a levantar..."></textarea>',
          () => {
            const desc = $('#modalInput').value.trim();
            if (!desc) return;
            copilotPost('user', 'Generar proceso: ' + desc);
            generateProcessFromDescription(desc);
          });
        break;
      case 'detect-pains':
        copilotPost('user', 'Detecta pains en el diagrama actual.');
        setTimeout(detectPainsMock, 300);
        break;
      case 'suggest-kpis':
        copilotPost('user', 'Sugiere KPIs aplicables.');
        setTimeout(suggestKpisMock, 300);
        break;
      case 'propose-tobe':
        copilotPost('user', 'Propón reingeniería to-be.');
        setTimeout(proposeToBeMock, 300);
        break;
      case 'raci':
        copilotPost('user', 'Generar matriz RACI.');
        setTimeout(generateRaci, 250);
        break;
      case 'sipoc':
        copilotPost('user', 'Generar SIPOC del proceso.');
        setTimeout(generateSipoc, 250);
        break;
      case 'impact-effort':
        copilotPost('user', 'Generar matriz impacto-esfuerzo.');
        setTimeout(generateImpactEffort, 250);
        break;
      case 'whatif':
        copilotPost('user', 'Comparar escenarios What-If.');
        setTimeout(openWhatIfModal, 250);
        break;
      case 'automation':
        copilotPost('user', 'Detectar oportunidades de automatización.');
        setTimeout(analyzeAutomation, 250);
        break;
      case 'bottleneck':
        copilotPost('user', 'Identificar cuello de botella y ruta crítica.');
        setTimeout(analyzeBottleneck, 250);
        break;
      case 'variants':
        copilotPost('user', 'Analizar variantes del proceso.');
        setTimeout(analyzeVariants, 250);
        break;
      case 'value-map':
        copilotPost('user', 'Mostrar mapa de valor Lean (VA/NVA).');
        setTimeout(toggleValueMap, 250);
        break;
      case 'backlog':
        copilotPost('user', 'Generar backlog de iniciativas.');
        setTimeout(generateBacklog, 250);
        break;
      case 'exec-summary':
        copilotPost('user', 'Resumen ejecutivo del diagnóstico.');
        setTimeout(execSummaryMock, 300);
        break;
    }
  }

  function copilotPost(who, text) {
    const wrap = $('#copilotMessages');
    const div = document.createElement('div');
    div.className = 'copilot-msg ' + who;
    if (who === 'ai') {
      div.innerHTML = `<div class="author">ProcessIQ · IA</div><div class="bubble">${formatMd(text)}</div>`;
    } else {
      div.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>`;
    }
    wrap.appendChild(div);
    wrap.scrollTop = wrap.scrollHeight;
  }

  function formatMd(s) {
    return escapeHtml(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }

  function activateTab(name) {
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    $$('.tab-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === name));
  }

  // -------- Mock generation: detecta verbos comunes para crear actividades --------
  function generateProcessFromDescription(desc) {
    const lower = desc.toLowerCase();
    let template;
    if (lower.includes('reclamo') || lower.includes('queja')) {
      template = [
        { type: 'start',    label: 'Reclamo recibido' },
        { type: 'task',     label: 'Registrar reclamo en CRM', owner: 'Asesor Call Center', system: 'CRM', executionType: 'system' },
        { type: 'decision', label: '¿Se resuelve en primera línea?' },
        { type: 'task',     label: 'Resolver y cerrar caso', owner: 'Asesor Call Center', executionType: 'phone' },
        { type: 'task',     label: 'Escalar a back office', owner: 'Asesor Call Center', system: 'Workflow', executionType: 'system' },
        { type: 'task',     label: 'Investigar caso', owner: 'Analista Back Office', executionType: 'manual' },
        { type: 'task',     label: 'Aprobar resolución', owner: 'Jefe Back Office', executionType: 'manual' },
        { type: 'task',     label: 'Notificar al cliente', owner: 'Asesor Call Center', executionType: 'email' },
        { type: 'end',      label: 'Reclamo resuelto a favor cliente' },
        { type: 'end',      label: 'Reclamo desestimado' }
      ];
    } else if (lower.includes('cobranza') || lower.includes('o2c') || lower.includes('ventas')) {
      template = [
        { type: 'start',    label: 'Pedido recibido' },
        { type: 'task',     label: 'Validar crédito del cliente', owner: 'Riesgos', system: 'ERP', executionType: 'system' },
        { type: 'task',     label: 'Registrar pedido', owner: 'Comercial', system: 'ERP', executionType: 'system' },
        { type: 'task',     label: 'Despachar mercadería', owner: 'Logística', system: 'WMS', executionType: 'system' },
        { type: 'task',     label: 'Emitir factura', owner: 'Facturación', system: 'ERP', executionType: 'automatic' },
        { type: 'task',     label: 'Aplicar cobro', owner: 'Tesorería', executionType: 'manual' },
        { type: 'end',      label: 'Cobro aplicado' }
      ];
    } else if (lower.includes('compra') || lower.includes('p2p') || lower.includes('proveedor')) {
      template = [
        { type: 'start',    label: 'Necesidad identificada' },
        { type: 'task',     label: 'Crear requisición', owner: 'Solicitante', system: 'ERP', executionType: 'system' },
        { type: 'task',     label: 'Aprobar requisición', owner: 'Gerencia', executionType: 'manual' },
        { type: 'task',     label: 'Emitir orden de compra', owner: 'Compras', system: 'ERP', executionType: 'system' },
        { type: 'task',     label: 'Recibir bien o servicio', owner: 'Almacén', system: 'WMS', executionType: 'system' },
        { type: 'task',     label: 'Conciliar 3-way match', owner: 'Cuentas por Pagar', executionType: 'manual' },
        { type: 'task',     label: 'Liberar pago a proveedor', owner: 'Tesorería', system: 'ERP', executionType: 'system' },
        { type: 'end',      label: 'Pago liberado' }
      ];
    } else if (lower.includes('onboarding') || lower.includes('alta de cliente') || lower.includes('kyc')) {
      template = [
        { type: 'start',    label: 'Cliente solicita alta' },
        { type: 'task',     label: 'Capturar datos del cliente', owner: 'Comercial', system: 'CRM', executionType: 'system' },
        { type: 'task',     label: 'Validar identidad y AML', owner: 'Compliance', system: 'KYC Tool', executionType: 'ai' },
        { type: 'decision', label: '¿KYC aprobado?' },
        { type: 'task',     label: 'Notificar rechazo al cliente', owner: 'Compliance', executionType: 'email' },
        { type: 'task',     label: 'Crear cliente en core bancario', owner: 'Operaciones', system: 'Core', executionType: 'automatic' },
        { type: 'task',     label: 'Activar productos contratados', owner: 'Operaciones', system: 'Core', executionType: 'system' },
        { type: 'end',      label: 'Cliente activo' },
        { type: 'end',      label: 'Cliente rechazado por KYC' }
      ];
    } else {
      template = [
        { type: 'start',    label: 'Solicitud recibida' },
        { type: 'task',     label: 'Validar requisitos', executionType: 'manual' },
        { type: 'task',     label: 'Registrar caso', executionType: 'system' },
        { type: 'decision', label: '¿Cumple criterios?' },
        { type: 'task',     label: 'Procesar aprobación', executionType: 'system' },
        { type: 'task',     label: 'Notificar rechazo', executionType: 'email' },
        { type: 'end',      label: 'Caso aprobado' },
        { type: 'end',      label: 'Caso rechazado' }
      ];
    }

    // Limpia y dibuja
    state.nodes = [];
    state.edges = [];
    state.selectedNodeId = null;
    let x = 80, y = 100;
    const created = [];
    template.forEach((t, idx) => {
      const def = SHAPE_DEFAULTS[t.type];
      const defaultExec = t.type === 'system' ? 'system' : (t.type === 'task' ? 'manual' : '');
      const node = {
        id: 'n' + (state.nextId++),
        type: t.type,
        x, y,
        w: def.w, h: def.h,
        label: t.label,
        executionType: t.executionType || defaultExec,
        owner: t.owner || '', system: t.system || '',
        time: '', volume: '', va: '',
        sla: '', docsIn: '', docsOut: '', rules: '', notes: '', pains: []
      };
      state.nodes.push(node);
      created.push(node);
      x += def.w + 60;
      if ((idx + 1) % 5 === 0) { x = 80; y += 140; }
    });

    // Conecta linealmente (sin encadenar end → end)
    for (let i = 0; i < created.length - 1; i++) {
      if (created[i + 1].type === 'end' && created[i].type === 'end') continue;
      state.edges.push({ id: 'e' + (state.nextId++), from: created[i].id, to: created[i + 1].id, label: '' });
    }

    // Reconecta ends huérfanos desde el último gateway disponible (rama "No")
    const inDegMap = {};
    state.edges.forEach(e => inDegMap[e.to] = (inDegMap[e.to] || 0) + 1);
    created.forEach((n, idx) => {
      if (n.type !== 'end' || inDegMap[n.id]) return;
      for (let j = idx - 1; j >= 0; j--) {
        if (created[j].type === 'decision') {
          state.edges.push({ id: 'e' + (state.nextId++), from: created[j].id, to: n.id, label: 'No' });
          // Etiqueta también la rama positiva del gateway si está vacía
          const positiveBranch = state.edges.find(e => e.from === created[j].id && !e.label && e.to !== n.id);
          if (positiveBranch) positiveBranch.label = 'Sí';
          break;
        }
      }
    });

    ensureDecisionBranches();
    persist();
    autoLayout();  // ← aplica top-to-bottom MBB
    render();
    copilotPost('ai',
      `He generado un proceso as-is con **${created.length} actividades** basado en patrones APQC PCF + playbook MBB.\n\n` +
      `Sugerencias inmediatas:\n` +
      `• Completa los **responsables** y **sistemas soporte** en cada actividad.\n` +
      `• Captura **pain points** (handoffs, esperas, reprocesos) — son el insumo del diagnóstico.\n` +
      `• Revisa la pestaña **KPIs** para vincular indicadores sectoriales.\n\n` +
      `¿Quieres que detecte pains típicos del sector?`);
  }

  function detectPainsMock() {
    if (state.nodes.length === 0) { copilotPost('ai', 'No hay un diagrama aún. Genera o dibuja un proceso primero.'); return; }
    const handoffs = countHandoffs();
    const decisions = state.nodes.filter(n => n.type === 'decision').length;
    const manual = state.nodes.filter(n => n.type === 'task' && !n.system).length;

    let msg = `**Diagnóstico automático del as-is**\n\n`;
    msg += `• **${handoffs} handoff(s)** detectados entre roles distintos. Cada handoff agrega ~10-15% de lead time y riesgo de pérdida de información.\n`;
    msg += `• **${decisions} punto(s) de decisión**. Si carecen de criterios documentados, son fuente de variabilidad e inequidad.\n`;
    msg += `• **${manual} actividad(es) sin sistema soporte** — candidatas a automatización (RPA / workflow).\n\n`;
    msg += `**Pain points típicos del sector ${state.meta.industry || '(define industria)'}:**\n`;
    if (state.meta.industry === 'Banca') {
      msg += `• Reproceso por documentación incompleta del cliente.\n• Tiempos de respuesta heterogéneos según canal.\n• Validaciones manuales duplicadas entre frontline y back office.`;
    } else if (state.meta.industry === 'Retail') {
      msg += `• Quiebres de stock por baja sincronización tienda-CD.\n• Devoluciones sin trazabilidad financiera.\n• Promociones ejecutadas con desfase entre canales.`;
    } else if (state.meta.industry === 'Manufactura') {
      msg += `• Paradas no planificadas por mantenimiento reactivo.\n• Inventario en proceso sobre-dimensionado.\n• Calidad detectada al final de línea, no en estación.`;
    } else if (state.meta.industry === 'Sector Público') {
      msg += `• Trámites con múltiples ventanillas (one-stop-shop ausente).\n• Documentación física que duplica registros digitales.\n• Plazos TUPA incumplidos por handoffs inter-áreas.`;
    } else {
      msg += `• Define la industria del proceso para sugerencias específicas.`;
    }
    copilotPost('ai', msg);
  }

  function countHandoffs() {
    let count = 0;
    state.edges.forEach(e => {
      const a = getNode(e.from), b = getNode(e.to);
      if (a && b && a.owner && b.owner && a.owner !== b.owner) count++;
    });
    return count;
  }

  function suggestKpisMock() {
    const ind = state.meta.industry;
    const mac = state.meta.macroprocess;
    let kpis = window.KPI_LIBRARY.filter(k => (k.industry === ind || k.industry === 'Transversal') && (!mac || k.macroprocess === mac)).slice(0, 5);
    if (kpis.length === 0) kpis = window.KPI_LIBRARY.slice(0, 5);
    let msg = `**KPIs recomendados** para ${ind || 'tu proceso'}${mac ? ' (' + mac + ')' : ''}:\n\n`;
    kpis.forEach(k => {
      msg += `• **${k.name}** (${k.unit}) — benchmark: ${k.benchmark}\n`;
    });
    msg += `\nRevisa la pestaña **KPIs** para ver la librería completa y hacer click en cada uno para agregarlo al diagnóstico.`;
    copilotPost('ai', msg);
  }

  function proposeToBeMock() {
    if (state.nodes.length === 0) { copilotPost('ai', 'Necesito un diagrama as-is para proponer el to-be.'); return; }
    const manual = state.nodes.filter(n => n.type === 'task' && !n.system);
    const handoffs = countHandoffs();
    let totalPains = 0;
    state.nodes.forEach(n => totalPains += (n.pains?.length || 0));

    let msg = `**Propuesta de reingeniería (to-be)**\n\n`;
    msg += `Lectura del as-is: ${state.nodes.length} actividades, ${handoffs} handoffs entre roles, ${manual.length} sin sistema, ${totalPains} pains capturados.\n\n`;
    msg += `**Palancas sugeridas:**\n`;
    msg += `1. **Automatización RPA** en las ${manual.length} actividades sin sistema soporte → ahorro estimado 0.3-0.5 FTE por actividad de alto volumen.\n`;
    msg += `2. **Eliminar handoffs** mediante célula multifuncional o workflow orquestado → reducción 20-30% en lead time.\n`;
    msg += `3. **Self-service / canal digital** en las actividades de captura → reducción 40-60% en errores de origen.\n`;
    msg += `4. **Reglas de decisión codificadas** (DMN / motor de reglas) en los puntos de gateway → consistencia y trazabilidad.\n`;
    msg += `5. **KPIs en tiempo real** con dashboard único → ciclos de mejora mensuales en lugar de trimestrales.\n\n`;
    msg += `**Beneficios estimados** (rango referencia industria):\n`;
    msg += `• Lead time: -35% a -50%\n• FTE liberados: 15-25% de la dotación actual\n• Calidad (errores): -60%\n• CSAT/NPS: +10 a +20 puntos\n\n`;
    msg += `Dime "dibuja el to-be" si quieres que genere la versión optimizada en un nuevo lienzo.`;
    copilotPost('ai', msg);
  }

  function execSummaryMock() {
    const name = state.meta.name || '[Nombre del proceso]';
    const ind = state.meta.industry || '[Industria]';
    const mac = state.meta.macroprocess || '[Macroproceso]';
    const nodes = state.nodes.length;
    const handoffs = countHandoffs();
    let painsTotal = 0, painsCrit = 0;
    state.nodes.forEach(n => (n.pains || []).forEach(p => {
      painsTotal++;
      if (p.severity >= 4) painsCrit++;
    }));

    const msg =
`**RESUMEN EJECUTIVO — DIAGNÓSTICO DE PROCESO**

**Proceso:** ${name}
**Industria / Macroproceso:** ${ind} · ${mac}

**Hallazgos clave:**
• El proceso comprende ${nodes} actividades con ${handoffs} handoffs inter-rol.
• Se identificaron ${painsTotal} pain points (${painsCrit} críticos, severidad ≥ 4).
• Existe oportunidad de automatización en actividades sin sistema soporte.

**Recomendaciones priorizadas:**
1. Quick wins (0-3 meses): estandarización de criterios de decisión + eliminación de controles duplicados.
2. Mediano plazo (3-9 meses): automatización RPA/IDP en actividades manuales de alto volumen.
3. Estructural (9-18 meses): rediseño organizacional hacia células multifuncionales + dashboard en tiempo real.

**Impacto estimado:**
Lead time -40%, FTE liberados 15-25%, mejora de CSAT/NPS doble dígito.

**Próximo paso sugerido:**
Validar hallazgos con sponsor, priorizar oportunidades en matriz impacto-esfuerzo, y construir business case.`;

    copilotPost('ai', msg);
  }

  // F7 — Edición por lenguaje natural. Interpreta comandos y los aplica al diagrama.
  // Devuelve un string de confirmación, o null si no es un comando de edición.
  function tryNlCommand(prompt) {
    const p = prompt.trim();
    const low = p.toLowerCase();
    // Busca nodo por coincidencia de etiqueta (substring, case-insensitive)
    const findNode = (q) => {
      if (!q) return null;
      const ql = q.toLowerCase().trim().replace(/^["']|["']$/g, '');
      // exacto primero, luego substring
      return state.nodes.find(n => (n.label || '').toLowerCase() === ql) ||
             state.nodes.find(n => (n.label || '').toLowerCase().includes(ql)) ||
             state.nodes.find(n => ql.includes((n.label || '').toLowerCase()) && n.label);
    };
    const clean = (s) => s.replace(/^["']|["']$/g, '').replace(/^(el |la |paso |actividad |tarea |la actividad |el paso )/i, '').trim();

    // 1) Agregar/insertar X después/antes de Y
    let m = low.match(/^(?:agregar|añadir|anadir|insertar|crear)\s+(?:paso|actividad|tarea)?\s*(.+?)\s+(despu[eé]s|antes)\s+de\s+(.+)$/i);
    if (m) {
      const after = m[2].startsWith('desp');
      const ref = findNode(m[3]);
      if (!ref) return `No encontré la actividad "${clean(m[3])}". Verifica el nombre.`;
      const def = SHAPE_DEFAULTS.task;
      const node = { id: 'n' + (state.nextId++), type: 'task', x: ref.x, y: ref.y, w: def.w, h: def.h,
        label: titleCaseFirst(clean(m[1])), executionType: 'manual', activityCode: '',
        owner: ref.owner || '', system: '', time: '', volume: '', va: '', sla: '', docsIn: '', docsOut: '', rules: '', notes: '', pains: [] };
      state.nodes.push(node);
      if (after) {
        // Redirige las salidas de ref hacia el nuevo nodo
        const outs = state.edges.filter(e => e.from === ref.id);
        outs.forEach(e => { e.from = node.id; });
        state.edges.push({ id: 'e' + (state.nextId++), from: ref.id, to: node.id, label: '' });
      } else {
        const ins = state.edges.filter(e => e.to === ref.id);
        ins.forEach(e => { e.to = node.id; });
        state.edges.push({ id: 'e' + (state.nextId++), from: node.id, to: ref.id, label: '' });
      }
      ensureDecisionBranches(); persist(); autoLayout();
      return `✅ Agregué "${node.label}" ${after ? 'después' : 'antes'} de "${ref.label}".`;
    }

    // 2) Eliminar / borrar / quitar X
    m = low.match(/^(?:eliminar|borrar|quitar|remover)\s+(?:el |la |paso |actividad |tarea )?(.+)$/i);
    if (m) {
      const ref = findNode(m[1]);
      if (!ref) return `No encontré "${clean(m[1])}" para eliminar.`;
      // Reconecta: predecesores → sucesores
      const preds = state.edges.filter(e => e.to === ref.id).map(e => e.from);
      const succs = state.edges.filter(e => e.from === ref.id).map(e => e.to);
      state.edges = state.edges.filter(e => e.from !== ref.id && e.to !== ref.id);
      preds.forEach(pr => succs.forEach(su => {
        if (!state.edges.some(e => e.from === pr && e.to === su)) state.edges.push({ id: 'e' + (state.nextId++), from: pr, to: su, label: '' });
      }));
      state.nodes = state.nodes.filter(n => n.id !== ref.id);
      persist(); autoLayout();
      return `✅ Eliminé "${ref.label}" y reconecté el flujo.`;
    }

    // 3) Renombrar / cambiar X a/por Y
    m = low.match(/^(?:renombrar|renombra|cambiar|cambia)\s+(.+?)\s+(?:a|por)\s+(.+)$/i);
    if (m) {
      const ref = findNode(m[1]);
      if (!ref) return `No encontré "${clean(m[1])}" para renombrar.`;
      const oldL = ref.label;
      ref.label = titleCaseFirst(clean(m[2]));
      persist(); render();
      return `✅ Renombré "${oldL}" → "${ref.label}".`;
    }

    // 4) Conectar X con/a Y
    m = low.match(/^(?:conectar|conecta|une|unir)\s+(.+?)\s+(?:con|a|hacia|y)\s+(.+)$/i);
    if (m) {
      const a = findNode(m[1]), b = findNode(m[2]);
      if (!a || !b) return `No encontré ${!a ? '"' + clean(m[1]) + '"' : '"' + clean(m[2]) + '"'}.`;
      if (!state.edges.some(e => e.from === a.id && e.to === b.id)) {
        state.edges.push({ id: 'e' + (state.nextId++), from: a.id, to: b.id, label: '' });
        persist(); autoLayout();
        return `✅ Conecté "${a.label}" → "${b.label}".`;
      }
      return `Ya existe esa conexión.`;
    }

    // 5) Marcar X como [tipo de ejecución]
    m = low.match(/^(?:marcar|marca|cambiar tipo de|poner)\s+(.+?)\s+como\s+(autom[aá]tic[oa]|manual|sistema|rpa|bot|ia|correo|email|tel[eé]fono|documental)/i);
    if (m) {
      const ref = findNode(m[1]);
      if (!ref) return `No encontré "${clean(m[1])}".`;
      const map = { 'automatico':'automatic','manual':'manual','sistema':'system','rpa':'rpa','bot':'rpa','ia':'ai','correo':'email','email':'email','telefono':'phone','documental':'document' };
      // Normaliza acentos para el lookup (automático → automatico)
      const key = m[2].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const exec = map[key] || 'manual';
      ref.executionType = exec; ref.activityCode = '';
      ensureDecisionBranches(); persist(); autoLayout();
      const t = (window.EXECUTION_TYPES || []).find(x => x.id === exec);
      return `✅ "${ref.label}" marcada como ${t ? t.bpmn : exec}.`;
    }

    return null; // no es un comando de edición
  }

  function titleCaseFirst(s) { s = (s || '').trim(); return s.charAt(0).toUpperCase() + s.slice(1); }

  function mockCopilotResponse(prompt) {
    // F7: intenta interpretar como comando de edición primero
    const cmd = tryNlCommand(prompt);
    if (cmd !== null) return cmd;
    const p = prompt.toLowerCase();
    if (p.includes('hola') || p.includes('buenos') || p.includes('buenas')) return '¡Hola! ¿En qué proceso te ayudo hoy?';
    if (p.includes('genera') || p.includes('levanta') || p.includes('dibuja')) { generateProcessFromDescription(prompt); return 'Procesando…'; }
    if (p.includes('pain') || p.includes('dolor')) { detectPainsMock(); return ''; }
    if (p.includes('kpi') || p.includes('indicador')) { suggestKpisMock(); return ''; }
    if (p.includes('to-be') || p.includes('tobe') || p.includes('reingenier')) { proposeToBeMock(); return ''; }
    if (p.includes('resumen') || p.includes('ejecutivo')) { execSummaryMock(); return ''; }
    return `Entiendo tu pedido. En el MVP el copiloto trabaja con plantillas locales — al conectar Claude API en v1 daré respuestas contextualizadas a tu diagrama, industria y entregables previos del área.\n\nPrueba con las acciones rápidas arriba: generar, detectar pains, sugerir KPIs, to-be, o resumen ejecutivo.`;
  }

  // =================== MODAL ===================
  function openModal(title, bodyHtml, onOk) {
    const modal = $('#modal');
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = bodyHtml;
    modal.hidden = false;

    const cancel = () => { modal.hidden = true; };

    $('#modalCancel').onclick = cancel;
    $('#modalOk').onclick = () => {
      try { onOk(); } catch (err) { console.error('[ProcessIQ] modal onOk error:', err); alert('Error: ' + err.message); }
      cancel();
    };
    // Click outside (sobre el backdrop) cierra el modal
    modal.onclick = (e) => { if (e.target === modal) cancel(); };
    // ESC cierra
    const escHandler = (e) => { if (e.key === 'Escape') { cancel(); document.removeEventListener('keydown', escHandler); } };
    document.addEventListener('keydown', escHandler);
    // Auto-focus primer input/textarea del body
    requestAnimationFrame(() => {
      const first = $('#modalBody').querySelector('textarea, input:not([type=hidden]), select');
      if (first) first.focus();
    });
  }

  // =================== KEYBOARD ===================
  function attachKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { deleteSelection(); e.preventDefault(); }
      if (e.key === 'c' || e.key === 'C') toggleConnectMode();
      if (e.key === 'Escape') {
        if (document.body.classList.contains('present-mode')) { togglePresentMode(false); return; }
        state.selectedNodeId = null; state.selectedEdgeId = null; state.connectSourceId = null; render();
      }
    });
  }

  // Onboarding: botones del empty-state
  function attachOnboardListeners() {
    const onb = (id, fn) => { const el = $('#' + id); if (el) el.addEventListener('click', fn); };
    onb('onbIngest', () => openIngestModal());
    onb('onbDemo', () => openExamplesModal());
    onb('onbDraw', () => { activateTab('copilot'); });

    // Toggle de la leyenda BPMN sobre el canvas
    const legend = $('#bpmnLegend'), legendBtn = $('#btnLegend');
    const setLegend = (show) => {
      if (!legend) return;
      legend.hidden = !show;
      if (legendBtn) legendBtn.classList.toggle('active', show);
    };
    if (legendBtn) legendBtn.addEventListener('click', () => setLegend(legend.hidden));
    onb('btnLegendClose', () => setLegend(false));

    // Controles de zoom
    onb('btnZoomIn', () => setZoom((state.zoom || 1) * 1.2));
    onb('btnZoomOut', () => setZoom((state.zoom || 1) / 1.2));
    onb('btnZoomLevel', () => setZoom(1));
    onb('btnZoomFit', () => zoomToFit());

    // Ocultar/mostrar el panel derecho (Props, Pains, KPIs…)
    onb('btnTogglePanel', () => {
      const collapsed = document.body.classList.toggle('panel-collapsed');
      const btn = $('#btnTogglePanel');
      if (btn) { btn.textContent = collapsed ? '⇤ Mostrar panel' : '⇥ Ocultar panel'; btn.classList.toggle('active', collapsed); }
      // El lienzo cambió de ancho → reajusta el SVG tras la transición del grid
      render(); setTimeout(render, 220);
    });

    // Comprimir/expandir la barra de shapes (formato compacto solo-iconos)
    onb('btnToggleToolbar', () => {
      const collapsed = document.body.classList.toggle('toolbar-collapsed');
      const btn = $('#btnToggleToolbar');
      if (btn) { btn.classList.toggle('active', collapsed); btn.title = collapsed ? 'Expandir la barra de shapes' : 'Comprimir la barra de shapes'; }
      render(); setTimeout(render, 220);
    });
  }

  const ZOOM_MIN = 0.2, ZOOM_MAX = 3;
  // setZoom(z, opts): opts puede ser {keepScroll:true} o {anchor:{clientX,clientY}} para zoom hacia el cursor.
  function setZoom(z, opts) {
    opts = opts || {};
    z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
    const wrap = $('#canvasWrapper');
    if (!wrap) { state.zoom = z; render(); return; }
    const wrect = wrap.getBoundingClientRect();
    // Punto de contenido que debe quedar fijo tras el zoom
    let fixCx, fixCy, fixVpX, fixVpY;   // contenido (fix*) y su posición en viewport (fixVp*)
    if (opts.anchor) {
      // Zoom hacia el cursor: el punto bajo el cursor permanece bajo el cursor
      fixVpX = opts.anchor.clientX - wrect.left;
      fixVpY = opts.anchor.clientY - wrect.top;
    } else if (!opts.keepScroll) {
      // Zoom con botones: mantén el centro del viewport
      fixVpX = wrap.clientWidth / 2;
      fixVpY = wrap.clientHeight / 2;
    }
    const prev = state.zoom || 1;
    if (fixVpX != null) {
      fixCx = (wrap.scrollLeft + fixVpX) / prev;
      fixCy = (wrap.scrollTop + fixVpY) / prev;
    }
    state.zoom = z;
    render();
    const lvl = $('#btnZoomLevel');
    if (lvl) lvl.textContent = Math.round(z * 100) + '%';
    if (fixCx != null) {
      wrap.scrollLeft = fixCx * z - fixVpX;
      wrap.scrollTop = fixCy * z - fixVpY;
    }
  }
  // Atajos y rueda del mouse para manejar el zoom sobre el flujo
  function attachZoomInteractions() {
    const wrap = $('#canvasWrapper');
    if (!wrap) return;
    // Ctrl/⌘ + rueda → zoom hacia el cursor (igual que Figma/draw.io; el pinch del trackpad envía ctrlKey)
    wrap.addEventListener('wheel', (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;   // rueda sola = scroll normal
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      setZoom((state.zoom || 1) * factor, { anchor: { clientX: e.clientX, clientY: e.clientY } });
    }, { passive: false });
    // Atajos de teclado: Ctrl/⌘ +/-/0 ; tecla "f" = ajustar
    document.addEventListener('keydown', (e) => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
      if (typing) return;
      if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) { e.preventDefault(); setZoom((state.zoom || 1) * 1.2); }
      else if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); setZoom((state.zoom || 1) / 1.2); }
      else if ((e.ctrlKey || e.metaKey) && e.key === '0') { e.preventDefault(); setZoom(1); }
      else if (e.key === 'f' || e.key === 'F') { zoomToFit(); }
    });
  }
  function zoomToFit() {
    const wrap = $('#canvasWrapper');
    if (!wrap || state.nodes.length === 0) { setZoom(1); return; }
    // Extensión real del contenido (sin el padding del scroll)
    let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
    state.nodes.forEach(n => {
      minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.w); maxY = Math.max(maxY, n.y + n.h);
    });
    const margin = 80;
    const contentW = (maxX - minX) + margin * 2;
    const contentH = (maxY - minY) + margin * 2 + 40; // +40 por labels bajo nodos
    const z = Math.min(wrap.clientWidth / contentW, wrap.clientHeight / contentH);
    setZoom(z, { keepScroll: true });
    // Lleva el scroll al inicio del contenido (arriba-izquierda)
    const wrap2 = $('#canvasWrapper');
    if (wrap2) { wrap2.scrollLeft = Math.max(0, (minX - margin) * (state.zoom || 1)); wrap2.scrollTop = Math.max(0, (minY - margin) * (state.zoom || 1)); }
  }

  // Selector de ejemplos pre-cargados
  function openExamplesModal() {
    const examples = [
      { fn: loadDemoProcess,   t: 'Gestión de Reclamos (Banca)', d: 'Simple · 7 actividades · 4 actores · pains + KPIs + simulación' },
      { fn: loadComplexDemo,   t: 'Originación de Crédito Hipotecario', d: 'Complejo · 23 nodos · 8 actores · loop de reproceso · cuello de botella' },
      { fn: loadComplexDemo2,  t: 'Onboarding de Personal', d: 'Gateway paralelo ＋ · 7 actores · fork/join (IT/Legal/Finanzas/Seguridad)' },
      { fn: loadComplexDemo3,  t: 'Devolución y Reembolso (Retail)', d: 'Eventos BPMN · timer ⏱ + mensaje ✉ + error ⚡ · 5 actores' },
      { fn: loadComplexDemo4,  t: 'Gestión de Siniestros (Seguros)', d: 'BPMN avanzado · gateway inclusivo ○ · marcadores loop/multi-instancia/subproceso · 7 actores' },
      { fn: loadComplexDemo5,  t: 'Atención de Emergencia (Salud)', d: 'Señal ▲ broadcast · gateway paralelo ＋ fork/join · timer ⏱ · 6 actores' },
      { fn: loadComplexDemo6,  t: 'Orden a Despacho (Manufactura)', d: 'Evento de terminación ⬤ · make-to-stock vs make-to-order · gateway paralelo ＋ · 7 actores' },
      { fn: loadComplexDemo7,  t: 'Avería Telecom T2R (Telecom)', d: 'Escalamiento L1→L2→campo · timer SLA ⏱ · marcadores BPMN · export PPTX con iconografía · 5 actores' },
      { fn: loadComplexDemo8,  t: 'Licencia Municipal (Sector Público)', d: 'Plazo legal TUPA ⏱ · 2 fines de error · leyenda BPMN en PPTX · 6 actores' },
      { fn: loadComplexDemo9,  t: 'Nuevo Suministro Eléctrico (Utilities)', d: 'Gateway paralelo ＋ · terminación ⬤ · timer ⏱ · todos los elementos BPMN · 6 actores' },
      { fn: loadComplexDemo10, t: 'Procure-to-Pay P2P (Transversal)', d: '3-way match (subproceso ⊞) · 2 fines de error · timer ⏱ · proceso cross-funcional · 7 actores' },
      { fn: loadComplexDemo11, t: '★ Crédito PYME — showcase (Banca)', d: 'TODOS los elementos BPMN: doc ▤ + data ▱ + XOR/AND/OR + señal ▲ + terminación ⬤ + timer ⏱ + 3 marcadores · 9 actores, 27 nodos' },
      { fn: loadComplexDemo12, t: 'Fulfillment E-commerce SLA (Retail)', d: 'Eventos de borde ◎ (boundary timer no-interrumpente) para escalamiento por SLA · 6 actores' }
    ];
    const html = `<p class="panel-hint">Elige un proceso de ejemplo pre-cargado (con pains, KPIs y simulación) para explorar las capacidades.</p>
      <div class="examples-list">${examples.map((e, i) =>
        `<button class="example-item" data-ex="${i}"><span class="example-t">${e.t}</span><span class="example-d">${e.d}</span></button>`).join('')}</div>`;
    openModal('✨ Cargar ejemplo', html, () => {});
    setTimeout(() => {
      document.querySelectorAll('.example-item').forEach(b => b.addEventListener('click', () => {
        examples[+b.dataset.ex].fn();
        $('#modal').hidden = true;
        maybeFitOnLoad();   // si el proceso es más ancho que la pantalla, encuádralo para verlo completo
      }));
    }, 50);
  }

  // Encuadra automáticamente el proceso recién cargado si no cabe a 100% en el viewport
  function maybeFitOnLoad() {
    const wrap = $('#canvasWrapper');
    if (!wrap || state.nodes.length === 0) return;
    let minX = Infinity, maxX = 0, minY = Infinity, maxY = 0;
    state.nodes.forEach(n => { minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x + n.w); minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y + n.h); });
    const contentW = (maxX - minX) + 160, contentH = (maxY - minY) + 160;
    // Solo encuadra si desborda; procesos pequeños se quedan a 100%
    if (contentW > wrap.clientWidth || contentH > wrap.clientHeight) {
      zoomToFit();
    } else {
      setZoom(1, { keepScroll: true });
    }
  }

  // Modo presentación: maximiza el lienzo ocultando paneles laterales
  function togglePresentMode(force) {
    const on = force != null ? force : !document.body.classList.contains('present-mode');
    document.body.classList.toggle('present-mode', on);
    const btn = $('#btnPresent');
    if (btn) btn.innerHTML = on ? '✕ Salir' : '⛶ Presentar';
    // Re-render para recalcular dimensiones del SVG al nuevo viewport
    setTimeout(render, 60);
  }

  function attachPresentListeners() {
    const btn = $('#btnPresent');
    if (btn) btn.addEventListener('click', () => togglePresentMode());
  }

  // =================== AUTO LAYOUT (swimlanes horizontales + flow left-to-right) ===================
  // Arriba-izquierda → abajo-derecha. Cada "carretera" horizontal = responsable.
  // Las actividades se colocan en su carretera según su rank (BFS).
  function autoLayout() {
    if (state.nodes.length === 0) return;
    ensureDecisionBranches();

    const starts = state.nodes.filter(n => n.type === 'start');
    const ranks = {};
    const outMap = {};
    state.edges.forEach(e => { (outMap[e.from] = outMap[e.from] || []).push(e.to); });

    // Raíces: starts, o nodos sin entrada si no hay start
    let roots = starts.map(n => n.id);
    if (roots.length === 0) {
      const inMap = {};
      state.edges.forEach(e => { inMap[e.to] = true; });
      const orphans = state.nodes.filter(n => !inMap[n.id]);
      roots = (orphans.length ? orphans : [state.nodes[0]]).map(n => n.id);
    }

    // 1) Detecta back-edges (aristas que cierran ciclos, ej. loop de reproceso) con DFS.
    //    Excluirlas evita que un loop infle los ranks y desordene el layout.
    const color = {};                         // 0/undef=blanco, 1=gris(en pila), 2=negro
    const backEdges = new Set();
    const dfs = (u) => {
      color[u] = 1;
      (outMap[u] || []).forEach(v => {
        if (color[v] === 1) backEdges.add(u + '->' + v);   // back-edge → ciclo
        else if (!color[v]) dfs(v);
      });
      color[u] = 2;
    };
    roots.forEach(r => { if (!color[r]) dfs(r); });
    state.nodes.forEach(n => { if (!color[n.id]) dfs(n.id); });   // componentes desconectados

    // 2) Longest-path rank sobre el DAG (sin back-edges) vía orden topológico (Kahn).
    const dagOut = {}, inDeg = {};
    state.nodes.forEach(n => { inDeg[n.id] = 0; });
    state.edges.forEach(e => {
      if (backEdges.has(e.from + '->' + e.to)) return;
      (dagOut[e.from] = dagOut[e.from] || []).push(e.to);
      inDeg[e.to] = (inDeg[e.to] || 0) + 1;
    });
    state.nodes.forEach(n => { ranks[n.id] = 0; });
    const q2 = state.nodes.filter(n => inDeg[n.id] === 0).map(n => n.id);
    const indeg2 = Object.assign({}, inDeg);
    let guard = 0, maxGuard = state.nodes.length * 4 + 10;
    while (q2.length && guard++ < maxGuard) {
      const u = q2.shift();
      (dagOut[u] || []).forEach(v => {
        if (ranks[u] + 1 > ranks[v]) ranks[v] = ranks[u] + 1;
        if (--indeg2[v] === 0) q2.push(v);
      });
    }

    // Override: ends auto-generados ("Caso no procede") → mismo rank que su decisión origen
    state.nodes.filter(n => n.type === 'end' && n._autoGen).forEach(n => {
      const edge = state.edges.find(e => e.to === n.id);
      if (edge && ranks[edge.from] !== undefined) ranks[n.id] = ranks[edge.from] + 1;
    });

    // Computa owners inferidos (sin lanes "Sistema" ni "Sin asignar")
    const ownerMap = computeOwners();
    const laneOf = (n) => ownerMap[n.id] || 'Por asignar';

    // Detecta lanes preservando orden de aparición (por rank)
    const laneOrder = [];
    const ranksList = Object.keys(ranks).map(id => ({ id, rank: ranks[id] })).sort((a, b) => a.rank - b.rank);
    ranksList.forEach(({ id }) => {
      const n = state.nodes.find(x => x.id === id);
      if (!n) return;
      const lane = laneOf(n);
      if (!laneOrder.includes(lane)) laneOrder.push(lane);
    });

    // Layout parámetros — espaciado generoso para evitar superposición de cajas y labels
    const headerW = 140;            // ancho del header de la swimlane (label izquierda)
    const colW = 240;               // separación horizontal entre ranks (caja 158 + holgura)
    const laneH = 170;              // altura de cada carretera (caja 76 + meta + holgura)
    const padX = 30;
    const padY = 30;
    const innerPadL = 30;

    // Posiciona cada nodo: x = rank, y = centro de su lane
    state.nodes.forEach(n => {
      const r = ranks[n.id] || 0;
      const lane = laneOf(n);
      const laneIdx = laneOrder.indexOf(lane);
      n.x = padX + headerW + innerPadL + r * colW;
      n.y = padY + laneIdx * laneH + (laneH - n.h) / 2;
    });

    // Colisiones: varios nodos en mismo rank+lane → reparte verticalmente DENTRO de la lane,
    // centrados, con gap suficiente (caja + meta) para que no se superpongan.
    const groups = {};
    state.nodes.forEach(n => {
      const key = laneOf(n) + '|' + (ranks[n.id] || 0);
      (groups[key] = groups[key] || []).push(n);
    });
    Object.values(groups).forEach(grp => {
      if (grp.length < 2) return;
      const laneIdx = laneOrder.indexOf(laneOf(grp[0]));
      const laneTop = padY + laneIdx * laneH;
      const gap = grp[0].h + 26;                     // alto de caja + espacio para meta
      const totalH = (grp.length - 1) * gap;
      const startY = laneTop + (laneH - grp[0].h) / 2 - totalH / 2;
      grp.forEach((n, i) => { n.y = Math.max(laneTop + 4, startY + i * gap); });
    });

    // Guarda metadata de lanes para render
    state._lanes = {
      list: laneOrder,
      laneOf: ownerMap,
      ranks: ranks,
      headerW, colW, laneH, padX, padY, innerPadL,
      totalRanks: Math.max(...Object.values(ranks), 0) + 1,
      inferredCount: state.nodes.filter(n => n._inferredOwner).length
    };

    // Asigna códigos de actividad BPMN ahora que existen ranks (orden izq→der)
    assignActivityCodes();

    persist();
    render();
  }

  // =================== PERSISTENCE ===================
  // Feedback visual de auto-save (estado "Guardando" → "Guardado")
  let _saveTimer = null;
  function showSaving() {
    const el = $('#statusSaved');
    if (!el) return;
    el.classList.add('saving');
    el.innerHTML = '<span class="dot"></span>Guardando';
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
      el.classList.remove('saving');
      el.innerHTML = '<span class="dot"></span>Guardado';
    }, 350);
  }

  function persist() {
    try {
      // Commit del view activo a _views antes de serializar
      state._views[state.activeView] = {
        nodes: state.nodes,
        edges: state.edges
      };
      const snapshot = {
        meta: state.meta,
        nodes: state.nodes,
        edges: state.edges,
        activeView: state.activeView,
        views: state._views,
        nextId: state.nextId,
        raci: state._raci || null,
        sipoc: state._sipoc || null,
        simResults: state._simResults || null,
        kpiValues: state._kpiValues || null,
        lanes: state._lanes || null,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      showSaving();
    } catch (e) {
      $('#statusSaved').innerHTML = '<span class="dot" style="background:var(--danger)"></span>Error al guardar';
    }
    recordHistory();
  }

  // =================== HISTORIAL (DESHACER / REHACER) ===================
  let historyPaused = false;
  const HISTORY_CAP = 60;
  function buildHistorySnapshot() {
    return JSON.stringify({
      meta: state.meta, nodes: state.nodes, edges: state.edges,
      activeView: state.activeView, views: state._views, nextId: state.nextId,
      raci: state._raci || null, sipoc: state._sipoc || null,
      kpiValues: state._kpiValues || null, lanes: state._lanes || null
    });
  }
  function recordHistory() {
    if (historyPaused || state._restoringHistory) return;
    if (!state._history) { state._history = []; state._histIdx = -1; }
    const snap = buildHistorySnapshot();
    if (state._history[state._histIdx] === snap) return;   // dedupe estados idénticos
    state._history = state._history.slice(0, state._histIdx + 1);   // descarta rama de rehacer
    state._history.push(snap);
    if (state._history.length > HISTORY_CAP) state._history.shift();
    state._histIdx = state._history.length - 1;
    updateUndoRedoUi();
  }
  function resetHistory() {
    state._history = []; state._histIdx = -1;
    recordHistory();   // captura el estado actual como línea base
  }
  function applyHistorySnapshot(snap) {
    const data = JSON.parse(snap);
    state.nodes = data.nodes || [];
    state.edges = data.edges || [];
    state.meta = data.meta || state.meta;
    state.activeView = data.activeView || 'asis';
    state._views = data.views || { asis: null, tobe: null };
    state.nextId = data.nextId || 1;
    state._raci = data.raci || null;
    state._sipoc = data.sipoc || null;
    state._kpiValues = data.kpiValues || {};
    state._lanes = data.lanes || null;
    state.selectedNodeId = null; state.selectedEdgeId = null;
    state._restoringHistory = true;
    $('#processName').value = state.meta.name || '';
    $('#processIndustry').value = state.meta.industry || '';
    $('#processMacro').value = state.meta.macroprocess || '';
    updateViewUi();
    render();
    renderProperties();
    runLinter();
    persist();   // persiste el estado restaurado (recordHistory queda neutralizado por la bandera)
    state._restoringHistory = false;
    updateUndoRedoUi();
  }
  function undo() {
    if (!state._history || state._histIdx <= 0) return;
    state._histIdx--;
    applyHistorySnapshot(state._history[state._histIdx]);
  }
  function redo() {
    if (!state._history || state._histIdx >= state._history.length - 1) return;
    state._histIdx++;
    applyHistorySnapshot(state._history[state._histIdx]);
  }
  function updateUndoRedoUi() {
    const u = $('#btnUndo'), r = $('#btnRedo');
    if (u) u.disabled = !state._history || state._histIdx <= 0;
    if (r) r.disabled = !state._history || state._histIdx >= state._history.length - 1;
  }
  function attachUndoRedoListeners() {
    const u = $('#btnUndo'), r = $('#btnRedo');
    if (u) u.addEventListener('click', undo);
    if (r) r.addEventListener('click', redo);
    document.addEventListener('keydown', (e) => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
      if (typing) return;
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((e.ctrlKey || e.metaKey) && ((e.key === 'z' || e.key === 'Z') && e.shiftKey || e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redo(); }
    });
    updateUndoRedoUi();
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      state.meta = data.meta || state.meta;
      state.nodes = data.nodes || [];
      state.edges = data.edges || [];
      state.activeView = data.activeView || 'asis';
      state._views = data.views || { asis: null, tobe: null };
      state.nextId = data.nextId || 1;
      state._raci = data.raci || null;
      state._sipoc = data.sipoc || null;
      state._simResults = data.simResults || null;
      state._kpiValues = data.kpiValues || {};
      state._lanes = data.lanes || null;
      $('#processName').value = state.meta.name || '';
      $('#processIndustry').value = state.meta.industry || '';
      $('#processMacro').value = state.meta.macroprocess || '';
      updateViewUi();
    } catch (e) { /* ignore */ }
  }

  function resetState() {
    // Pausa el historial durante la carga (demo/Nuevo) y captura UNA línea base al terminar (microtask)
    historyPaused = true;
    Promise.resolve().then(() => { historyPaused = false; resetHistory(); });
    state.meta = { name: '', industry: '', macroprocess: '', client: '', owner: '' };
    state.nodes = [];
    state.edges = [];
    state.selectedNodeId = null;
    state.selectedEdgeId = null;
    state.nextId = 1;
    state.activeView = 'asis';
    state._views = { asis: null, tobe: null };
    state._raci = null;
    state._sipoc = null;
    state._simResults = null;
    state._kpiValues = {};
    state._bottleneckId = null;
    state._variants = null;
    state._valueMode = false;
    state._backlog = null;
    updateViewUi();
    $('#processName').value = '';
    $('#processIndustry').value = '';
    $('#processMacro').value = '';
    persist();
    render();
  }

  // Proceso demo completo pre-poblado (para presentaciones a cliente)
  function loadDemoProcess() {
    resetState();
    state.meta = { name: 'Gestión de Reclamos — Banca Minorista', industry: 'Banca', macroprocess: 'Servicio', client: '', owner: '' };
    $('#processName').value = state.meta.name;
    $('#processIndustry').value = 'Banca';
    $('#processMacro').value = 'Servicio';

    const T = [
      { type: 'start', label: 'Reclamo recibido', owner: 'Cliente' },
      { type: 'task', label: 'Registrar reclamo', owner: 'Asesor Call Center', system: 'CRM', exec: 'system', time: 8, vol: 1200, va: 'BVA' },
      { type: 'decision', label: '¿Resuelve en 1ra línea?', owner: 'Asesor Call Center' },
      { type: 'task', label: 'Resolver y cerrar', owner: 'Asesor Call Center', exec: 'phone', time: 12, vol: 720, va: 'VA',
        pains: [{ category: 'rework', description: 'Reapertura por solución incompleta', severity: 3, frequency: 3 }] },
      { type: 'task', label: 'Escalar a back office', owner: 'Asesor Call Center', system: 'Workflow', exec: 'system', time: 5, vol: 480, va: 'NVA',
        pains: [{ category: 'handoff', description: 'Pérdida de contexto en traspaso a BO', severity: 5, frequency: 4 }] },
      { type: 'task', label: 'Investigar caso', owner: 'Analista Back Office', exec: 'manual', time: 45, vol: 480, va: 'VA',
        pains: [{ category: 'wait', description: 'Espera de información de otras áreas', severity: 4, frequency: 4 }] },
      { type: 'task', label: 'Aprobar resolución', owner: 'Jefe Back Office', exec: 'manual', time: 15, vol: 480, va: 'BVA' },
      { type: 'task', label: 'Notificar al cliente', owner: 'Asesor Call Center', exec: 'email', time: 6, vol: 1200, va: 'VA' },
      { type: 'end', label: 'Reclamo resuelto', owner: 'Cliente' }
    ];

    const created = [];
    let x = 80, y = 100;
    T.forEach(t => {
      const def = SHAPE_DEFAULTS[t.type];
      const node = {
        id: 'n' + (state.nextId++), type: t.type, x, y, w: def.w, h: def.h,
        label: t.label, executionType: t.exec || (t.type === 'task' ? 'manual' : ''),
        activityCode: '', owner: t.owner || '', system: t.system || '',
        time: t.time != null ? String(t.time) : '', volume: t.vol != null ? String(t.vol) : '', va: t.va || '',
        sla: '', docsIn: '', docsOut: '', rules: '', notes: '', pains: (t.pains || []).map(p => ({ id: 'p' + (state.nextId++), ...p }))
      };
      state.nodes.push(node); created.push(node);
      x += def.w + 60;
    });
    // Conexión lineal + rama de decisión
    for (let i = 0; i < created.length - 1; i++) {
      if (created[i].type === 'decision') {
        state.edges.push({ id: 'e' + (state.nextId++), from: created[i].id, to: created[i + 1].id, label: 'Sí' });
        // rama No → escalar (created[i+2])
        if (created[i + 2]) state.edges.push({ id: 'e' + (state.nextId++), from: created[i].id, to: created[i + 2].id, label: 'No' });
        // saltar la conexión lineal del "resolver" hacia "escalar" para evitar duplicado
        state.edges.push({ id: 'e' + (state.nextId++), from: created[i + 1].id, to: created[created.length - 1].id, label: '' });
        i++; // ya conectamos i+1
      } else {
        state.edges.push({ id: 'e' + (state.nextId++), from: created[i].id, to: created[i + 1].id, label: '' });
      }
    }

    // KPIs capturados (gap vs benchmark) para la demo
    state._kpiValues = {
      'bnk-03': { name: 'First Contact Resolution (FCR)', unit: '%', benchmark: '> 75%', value: '60', gap: '-15 pp', source: 'Dashboard CRM Q1' },
      'per-ind-01': { name: 'Tiempo de respuesta reclamo (Indecopi)', unit: 'días hábiles', benchmark: '≤ 30 días', value: '34', gap: '+4 días', source: 'Reporte Compliance' }
    };

    ensureDecisionBranches();
    persist();
    autoLayout();
    runSimulation();
    persist();   // guarda los resultados de simulación
    activateTab('copilot');
    copilotPost('ai',
      `**Proceso demo cargado: Gestión de Reclamos — Banca Minorista.**\n\n` +
      `Incluye: 7 actividades con tipos BPMN, 4 pain points (1 crítico: handoff a BO), 2 KPIs con gap vs benchmark (FCR 60% vs >75%, Indecopi 34 vs ≤30 días), tiempos y volúmenes para el simulador.\n\n` +
      `Prueba: **Detecta pains**, **Matriz impacto-esfuerzo**, **✨ To-Be IA**, o exporta a **PPTX/Word**. Ideal para mostrar el flujo completo a un cliente.`);
  }

  // Proceso COMPLEJO de prueba: Originación de Crédito Hipotecario (8 actores, ~23 nodos, loop)
  function loadComplexDemo() {
    resetState();
    state.meta = { name: 'Originación de Crédito Hipotecario', industry: 'Banca', macroprocess: 'O2C', client: '', owner: '' };
    $('#processName').value = state.meta.name;
    $('#processIndustry').value = 'Banca';
    $('#processMacro').value = 'O2C';

    // k = clave local para definir edges
    const N = [
      { k: 's',   type: 'start', label: 'Solicitud hipoteca recibida', owner: 'Cliente' },
      { k: 'a1',  type: 'task',  label: 'Presentar documentación', owner: 'Cliente', exec: 'document', time: 20, vol: 600, va: 'BVA',
        pains: [{ category: 'handoff', description: 'Documentos entregados en físico, sin trazabilidad digital', severity: 3, frequency: 4 }] },
      { k: 'a2',  type: 'task',  label: 'Registrar solicitud', owner: 'Ejecutivo Comercial', system: 'CRM', exec: 'system', time: 12, vol: 600, va: 'BVA' },
      { k: 'a3',  type: 'task',  label: 'Validar documentación', owner: 'Ejecutivo Comercial', exec: 'manual', time: 15, vol: 600, va: 'NVA',
        pains: [{ category: 'rework', description: 'Documentación incompleta genera reprocesos', severity: 4, frequency: 5 }] },
      { k: 'd1',  type: 'decision', label: '¿Documentación completa?', owner: 'Ejecutivo Comercial' },
      { k: 'a4',  type: 'task',  label: 'Solicitar subsanación', owner: 'Ejecutivo Comercial', exec: 'email', time: 8, vol: 240, va: 'NVA',
        pains: [{ category: 'wait', description: 'Espera de respuesta del cliente alarga el ciclo', severity: 3, frequency: 4 }] },
      { k: 'a5',  type: 'task',  label: 'Verificar antecedentes', owner: 'Analista de Crédito', system: 'Centrales', exec: 'system', time: 18, vol: 540, va: 'VA' },
      { k: 'a6',  type: 'task',  label: 'Evaluar capacidad pago', owner: 'Analista de Crédito', system: 'Scoring', exec: 'ai', time: 30, vol: 540, va: 'VA' },
      { k: 'd2',  type: 'decision', label: '¿Cumple política de riesgo?', owner: 'Analista de Crédito' },
      { k: 'a7',  type: 'task',  label: 'Programar tasación', owner: 'Tasador', exec: 'email', time: 8, vol: 420, va: 'NVA',
        pains: [{ category: 'handoff', description: 'Coordinación manual con perito externo', severity: 4, frequency: 4 }] },
      { k: 'a8',  type: 'task',  label: 'Tasar inmueble', owner: 'Tasador', exec: 'manual', time: 120, vol: 420, va: 'VA',
        pains: [{ category: 'wait', description: 'Disponibilidad del perito: 3-5 días de espera', severity: 5, frequency: 5 }] },
      { k: 'a9',  type: 'task',  label: 'Emitir informe tasación', owner: 'Tasador', exec: 'document', time: 30, vol: 420, va: 'BVA' },
      { k: 'a10', type: 'task',  label: 'Analizar riesgo crediticio', owner: 'Riesgos', exec: 'system', time: 45, vol: 420, va: 'VA' },
      { k: 'd3',  type: 'decision', label: '¿Monto supera umbral comité?', owner: 'Riesgos' },
      { k: 'a11', type: 'task',  label: 'Evaluar en comité', owner: 'Comité de Crédito', exec: 'manual', time: 60, vol: 200, va: 'BVA',
        pains: [{ category: 'wait', description: 'Comité sesiona 1 vez/semana: cuello de botella', severity: 5, frequency: 4 }] },
      { k: 'd4',  type: 'decision', label: '¿Aprobado por comité?', owner: 'Comité de Crédito' },
      { k: 'a12', type: 'task',  label: 'Revisar título propiedad', owner: 'Legal', exec: 'manual', time: 90, vol: 380, va: 'BVA',
        pains: [{ category: 'control', description: 'Revisión legal duplica validaciones de Riesgos', severity: 3, frequency: 3 }] },
      { k: 'a13', type: 'task',  label: 'Elaborar minuta y contrato', owner: 'Legal', exec: 'document', time: 60, vol: 380, va: 'VA' },
      { k: 'a14', type: 'task',  label: 'Constituir hipoteca', owner: 'Operaciones', system: 'Core', exec: 'system', time: 40, vol: 380, va: 'VA' },
      { k: 'a15', type: 'task',  label: 'Desembolsar crédito', owner: 'Operaciones', system: 'Core', exec: 'automatic', time: 5, vol: 380, va: 'VA' },
      { k: 'a16', type: 'task',  label: 'Notificar al cliente', owner: 'Operaciones', exec: 'email', time: 6, vol: 600, va: 'VA' },
      { k: 'e1',  type: 'end',   label: 'Crédito desembolsado', owner: 'Cliente' },
      { k: 'e2',  type: 'end',   label: 'Solicitud rechazada', owner: 'Cliente' }
    ];
    const E = [
      ['s','a1'], ['a1','a2'], ['a2','a3'], ['a3','d1'],
      ['d1','a5','Sí'], ['d1','a4','No'], ['a4','a3'],          // loop de reproceso
      ['a5','a6'], ['a6','d2'],
      ['d2','a7','Sí'], ['d2','e2','No'],
      ['a7','a8'], ['a8','a9'], ['a9','a10'], ['a10','d3'],
      ['d3','a11','Sí'], ['d3','a12','No'],
      ['a11','d4'], ['d4','a12','Sí'], ['d4','e2','No'],
      ['a12','a13'], ['a13','a14'], ['a14','a15'], ['a15','a16'], ['a16','e1']
    ];

    const idMap = {};
    N.forEach(t => {
      const def = SHAPE_DEFAULTS[t.type];
      const node = {
        id: 'n' + (state.nextId++), type: t.type, x: 0, y: 0, w: def.w, h: def.h,
        label: t.label, executionType: t.exec || (t.type === 'task' ? 'manual' : ''),
        activityCode: '', owner: t.owner || '', system: t.system || '',
        time: t.time != null ? String(t.time) : '', volume: t.vol != null ? String(t.vol) : '', va: t.va || '',
        sla: '', docsIn: '', docsOut: '', rules: '', notes: '', pains: (t.pains || []).map(p => ({ id: 'p' + (state.nextId++), ...p }))
      };
      idMap[t.k] = node.id;
      state.nodes.push(node);
    });
    E.forEach(([a, b, lbl]) => {
      state.edges.push({ id: 'e' + (state.nextId++), from: idMap[a], to: idMap[b], label: lbl || '' });
    });

    state._kpiValues = {
      'bnk-02': { name: 'Time-to-Yes', unit: 'horas', benchmark: '< 24h banca minorista', value: '120', gap: '+96 h', source: 'Reporte Comercial' },
      'bnk-01': { name: 'Tasa de aprobación de créditos', unit: '%', benchmark: '65-75%', value: '52', gap: '-13 pp', source: 'Dashboard Riesgos' }
    };

    ensureDecisionBranches();
    persist();
    autoLayout();
    runSimulation();
    persist();
    activateTab('copilot');
    const tasks = state.nodes.filter(n => n.type === 'task').length;
    const lanes = (state._lanes?.list || []).length;
    copilotPost('ai',
      `**Proceso COMPLEJO cargado: Originación de Crédito Hipotecario.**\n\n` +
      `${tasks} actividades · ${lanes} actores (swimlanes) · 4 decisiones · 1 loop de reproceso · 2 ends (aprobado/rechazado).\n` +
      `Pains críticos: tasación (espera 3-5 días) y comité (sesiona 1x/semana). KPIs con gap: Time-to-Yes 120h vs <24h, aprobación 52% vs 65-75%.\n\n` +
      `Es un caso de stress: prueba **🔴 Cuello de botella**, **🔬 What-If**, **🤖 Automatización**, **📋 Backlog** y exporta a **PPTX** (multi-slide) para medir el rendimiento.`);
  }

  // Proceso COMPLEJO 2: Onboarding de Personal — con gateway PARALELO (fork/join), 7 actores
  function loadComplexDemo2() {
    resetState();
    state.meta = { name: 'Onboarding de Personal Nuevo', industry: 'Transversal', macroprocess: 'H2R', client: '', owner: '' };
    $('#processName').value = state.meta.name;
    $('#processIndustry').value = 'Transversal';
    $('#processMacro').value = 'H2R';

    const N = [
      { k: 's',   type: 'start', label: 'Candidato seleccionado', owner: 'RRHH' },
      { k: 'a1',  type: 'task',  label: 'Enviar oferta laboral', owner: 'RRHH', exec: 'email', time: 10, vol: 100, va: 'VA' },
      { k: 'd1',  type: 'decision', label: '¿Oferta aceptada?', owner: 'RRHH', gateway: 'exclusive' },
      { k: 'erej',type: 'end',   label: 'Vacante reabierta', owner: 'RRHH' },
      { k: 'a2',  type: 'task',  label: 'Recopilar documentación', owner: 'Empleado', exec: 'document', time: 30, vol: 80, va: 'BVA',
        pains: [{ category: 'wait', description: 'Demora del candidato en enviar documentos', severity: 3, frequency: 4 }] },
      { k: 'a3',  type: 'task',  label: 'Registrar en sistema RRHH', owner: 'RRHH', system: 'Workday', exec: 'system', time: 15, vol: 80, va: 'BVA' },
      { k: 'g1',  type: 'decision', label: 'Iniciar provisión en paralelo', owner: 'RRHH', gateway: 'parallel' },
      { k: 'bit', type: 'task',  label: 'Crear usuario y correo', owner: 'IT', system: 'Active Directory', exec: 'system', time: 20, vol: 80, va: 'VA' },
      { k: 'bleg',type: 'task',  label: 'Preparar contrato', owner: 'Legal', exec: 'document', time: 45, vol: 80, va: 'VA',
        pains: [{ category: 'manual', description: 'Contrato redactado manualmente sin plantilla', severity: 3, frequency: 4 }] },
      { k: 'bfin',type: 'task',  label: 'Dar de alta en nómina', owner: 'Finanzas', system: 'SAP HR', exec: 'system', time: 25, vol: 80, va: 'BVA' },
      { k: 'bseg',type: 'task',  label: 'Asignar accesos físicos', owner: 'Seguridad', exec: 'manual', time: 15, vol: 80, va: 'BVA' },
      { k: 'g2',  type: 'decision', label: 'Sincronizar provisión', owner: 'RRHH', gateway: 'parallel' },
      { k: 'a4',  type: 'task',  label: 'Asignar equipo y puesto', owner: 'IT', exec: 'manual', time: 30, vol: 80, va: 'VA' },
      { k: 'a5',  type: 'task',  label: 'Firmar contrato', owner: 'Empleado', exec: 'document', time: 20, vol: 80, va: 'VA' },
      { k: 'a6',  type: 'task',  label: 'Programar inducción', owner: 'RRHH', exec: 'email', time: 10, vol: 80, va: 'BVA' },
      { k: 'a7',  type: 'task',  label: 'Realizar inducción Día 1', owner: 'Manager', exec: 'phone', time: 120, vol: 80, va: 'VA',
        pains: [{ category: 'handoff', description: 'Inducción sin material estandarizado por área', severity: 4, frequency: 3 }] },
      { k: 'a8',  type: 'task',  label: 'Asignar plan capacitación', owner: 'Manager', exec: 'ai', time: 30, vol: 80, va: 'VA' },
      { k: 'a9',  type: 'task',  label: 'Validar onboarding completo', owner: 'RRHH', exec: 'system', time: 15, vol: 80, va: 'BVA' },
      { k: 'e1',  type: 'end',   label: 'Empleado activo', owner: 'Empleado' }
    ];
    const E = [
      ['s','a1'], ['a1','d1'], ['d1','a2','Sí'], ['d1','erej','No'],
      ['a2','a3'], ['a3','g1'],
      ['g1','bit'], ['g1','bleg'], ['g1','bfin'], ['g1','bseg'],   // fork paralelo
      ['bit','g2'], ['bleg','g2'], ['bfin','g2'], ['bseg','g2'],   // join paralelo
      ['g2','a4'], ['a4','a5'], ['a5','a6'], ['a6','a7'], ['a7','a8'], ['a8','a9'], ['a9','e1']
    ];

    const idMap = {};
    N.forEach(t => {
      const def = SHAPE_DEFAULTS[t.type];
      const node = {
        id: 'n' + (state.nextId++), type: t.type, x: 0, y: 0, w: def.w, h: def.h,
        label: t.label, executionType: t.exec || (t.type === 'task' ? 'manual' : ''),
        gatewayType: t.gateway || undefined, activityCode: '',
        owner: t.owner || '', system: t.system || '',
        time: t.time != null ? String(t.time) : '', volume: t.vol != null ? String(t.vol) : '', va: t.va || '',
        sla: '', docsIn: '', docsOut: '', rules: '', notes: '', pains: (t.pains || []).map(p => ({ id: 'p' + (state.nextId++), ...p }))
      };
      idMap[t.k] = node.id;
      state.nodes.push(node);
    });
    E.forEach(([a, b, lbl]) => state.edges.push({ id: 'e' + (state.nextId++), from: idMap[a], to: idMap[b], label: lbl || '' }));

    state._kpiValues = {
      'trv-04': { name: 'Time-to-hire', unit: 'días', benchmark: '< 30 días', value: '45', gap: '+15 días', source: 'Dashboard RRHH' }
    };

    ensureDecisionBranches();
    persist();
    autoLayout();
    runSimulation();
    persist();
    activateTab('copilot');
    copilotPost('ai',
      `**Proceso cargado: Onboarding de Personal Nuevo** (nomenclatura BPMN completa).\n\n` +
      `7 actores · 16 actividades · gateway **exclusivo** (¿oferta aceptada?) + gateway **paralelo** ＋ (fork: IT/Legal/Finanzas/Seguridad en paralelo, luego join).\n` +
      `Formas BPMN: eventos (▶/■), tareas con marcador de tipo (User/Service/Send/Manual/Script-IA/Documental), gateways con marca (✕ exclusivo / ＋ paralelo).\n\n` +
      `El gateway paralelo muestra cómo 4 áreas provisionan al nuevo empleado simultáneamente. Edita el tipo de gateway en **Props** de cualquier decisión.`);
  }

  // Proceso COMPLEJO 3: Gestión de Devolución y Reembolso — con EVENTOS BPMN (timer/mensaje/error)
  function loadComplexDemo3() {
    resetState();
    state.meta = { name: 'Gestión de Devolución y Reembolso', industry: 'Retail', macroprocess: 'Devoluciones', client: '', owner: '' };
    $('#processName').value = state.meta.name;
    $('#processIndustry').value = 'Retail';
    $('#processMacro').value = 'Devoluciones';

    const N = [
      { k: 's',   type: 'start', label: 'Solicitud de devolución', owner: 'Cliente', event: 'message' },
      { k: 'a1',  type: 'task',  label: 'Validar política de devolución', owner: 'Atención al Cliente', system: 'CRM', exec: 'system', time: 10, vol: 500, va: 'BVA' },
      { k: 'd1',  type: 'decision', label: '¿Aplica devolución?', owner: 'Atención al Cliente', gateway: 'exclusive' },
      { k: 'erej',type: 'end',   label: 'Devolución rechazada', owner: 'Atención al Cliente', event: 'error' },
      { k: 'a2',  type: 'task',  label: 'Generar guía de retorno', owner: 'Atención al Cliente', system: 'WMS', exec: 'system', time: 8, vol: 400, va: 'VA' },
      { k: 'a3',  type: 'task',  label: 'Enviar instrucciones', owner: 'Atención al Cliente', exec: 'email', time: 5, vol: 400, va: 'VA' },
      { k: 'iv1', type: 'intermediate', label: 'Esperar envío (5 días)', owner: 'Cliente', event: 'timer' },
      { k: 'iv2', type: 'intermediate', label: 'Recibir paquete devuelto', owner: 'Almacén', event: 'message' },
      { k: 'a4',  type: 'task',  label: 'Inspeccionar producto', owner: 'Calidad', exec: 'manual', time: 20, vol: 400, va: 'VA',
        pains: [{ category: 'wait', description: 'Cola de inspección en picos de devolución', severity: 4, frequency: 4 }] },
      { k: 'd2',  type: 'decision', label: '¿Producto conforme?', owner: 'Calidad', gateway: 'exclusive' },
      { k: 'a5',  type: 'task',  label: 'Registrar producto dañado', owner: 'Calidad', system: 'WMS', exec: 'system', time: 10, vol: 80, va: 'NVA' },
      { k: 'a6',  type: 'task',  label: 'Reingresar a inventario', owner: 'Almacén', system: 'WMS', exec: 'system', time: 12, vol: 320, va: 'BVA' },
      { k: 'a7',  type: 'task',  label: 'Autorizar reembolso', owner: 'Finanzas', exec: 'manual', time: 15, vol: 400, va: 'BVA',
        pains: [{ category: 'control', description: 'Autorización manual aunque el monto sea bajo', severity: 3, frequency: 5 }] },
      { k: 'a8',  type: 'task',  label: 'Procesar reembolso', owner: 'Finanzas', system: 'Pasarela', exec: 'automatic', time: 5, vol: 400, va: 'VA' },
      { k: 'iv3', type: 'intermediate', label: 'Esperar liquidación (48h)', owner: 'Finanzas', event: 'timer' },
      { k: 'a9',  type: 'task',  label: 'Notificar reembolso', owner: 'Atención al Cliente', exec: 'email', time: 4, vol: 400, va: 'VA' },
      { k: 'e1',  type: 'end',   label: 'Reembolso confirmado', owner: 'Cliente', event: 'message' }
    ];
    const E = [
      ['s','a1'], ['a1','d1'], ['d1','a2','Sí'], ['d1','erej','No'],
      ['a2','a3'], ['a3','iv1'], ['iv1','iv2'], ['iv2','a4'], ['a4','d2'],
      ['d2','a6','Conforme'], ['d2','a5','No conforme'],
      ['a6','a7'], ['a5','a7'],
      ['a7','a8'], ['a8','iv3'], ['iv3','a9'], ['a9','e1']
    ];

    const idMap = {};
    N.forEach(t => {
      const def = SHAPE_DEFAULTS[t.type];
      const node = {
        id: 'n' + (state.nextId++), type: t.type, x: 0, y: 0, w: def.w, h: def.h,
        label: t.label, executionType: t.exec || (t.type === 'task' ? 'manual' : ''),
        gatewayType: t.gateway || undefined, eventType: t.event || undefined, activityCode: '',
        owner: t.owner || '', system: t.system || '',
        time: t.time != null ? String(t.time) : '', volume: t.vol != null ? String(t.vol) : '', va: t.va || '',
        sla: '', docsIn: '', docsOut: '', rules: '', notes: '', pains: (t.pains || []).map(p => ({ id: 'p' + (state.nextId++), ...p }))
      };
      idMap[t.k] = node.id;
      state.nodes.push(node);
    });
    E.forEach(([a, b, lbl]) => state.edges.push({ id: 'e' + (state.nextId++), from: idMap[a], to: idMap[b], label: lbl || '' }));

    state._kpiValues = {
      'ret-07': { name: 'Tasa de devolución', unit: '%', benchmark: '< 8% retail físico', value: '11', gap: '+3 pp', source: 'Dashboard Comercial' }
    };

    ensureDecisionBranches();
    persist();
    autoLayout();
    runSimulation();
    persist();
    activateTab('copilot');
    copilotPost('ai',
      `**Proceso cargado: Gestión de Devolución y Reembolso** (eventos BPMN completos).\n\n` +
      `5 actores · 13 actividades · **3 eventos intermedios**: 2 timer ⏱ (esperar envío 5 días, liquidación 48h) + 1 mensaje ✉ (recibir paquete). Evento inicio de **mensaje** ✉, fin de **error** ⚡ y fin de **mensaje** ✉.\n\n` +
      `Nomenclatura BPMN: eventos catch (outline) vs throw (relleno), evento intermedio = doble anillo. Los timers modelan las **esperas (lead time)** del proceso — fuente directa de mejora.`);
  }

  function loadComplexDemo4() {
    resetState();
    state.meta = { name: 'Gestión de Siniestros de Seguros', industry: 'Seguros', macroprocess: 'Siniestros', client: '', owner: '' };
    $('#processName').value = state.meta.name;
    $('#processIndustry').value = 'Seguros';
    $('#processMacro').value = 'Siniestros';

    const N = [
      { k: 's',   type: 'start', label: 'Aviso de siniestro', owner: 'Asegurado', event: 'message' },
      { k: 'a1',  type: 'task',  label: 'Registrar siniestro', owner: 'Contact Center', system: 'Core Seguros', exec: 'system', time: 8, vol: 1200, va: 'BVA' },
      { k: 'a2',  type: 'task',  label: 'Validar póliza vigente', owner: 'Contact Center', system: 'Core Seguros', exec: 'system', time: 5, vol: 1200, va: 'VA' },
      { k: 'd1',  type: 'decision', label: '¿Póliza cubre el siniestro?', owner: 'Suscripción', gateway: 'exclusive' },
      { k: 'erej',type: 'end',   label: 'Siniestro rechazado', owner: 'Suscripción', event: 'error' },
      { k: 'g1',  type: 'decision', label: '¿Qué acciones aplican?', owner: 'Analista de Siniestros', gateway: 'inclusive' },
      { k: 'a3',  type: 'task',  label: 'Solicitar documentación', owner: 'Analista de Siniestros', exec: 'email', time: 10, vol: 1000, va: 'BVA', marker: 'loop',
        pains: [{ category: 'rework', description: 'Reenvíos por documentación incompleta del asegurado', severity: 4, frequency: 4 }] },
      { k: 'a4',  type: 'task',  label: 'Activar peritaje', owner: 'Perito', exec: 'manual', time: 45, vol: 700, va: 'VA' },
      { k: 'a5',  type: 'task',  label: 'Cotizar talleres', owner: 'Perito', exec: 'manual', time: 30, vol: 700, va: 'BVA', marker: 'multiinstance' },
      { k: 'iv1', type: 'intermediate', label: 'Esperar informe pericial', owner: 'Perito', event: 'timer' },
      { k: 'a6',  type: 'task',  label: 'Evaluar cobertura', owner: 'Analista de Siniestros', system: 'Core Seguros', exec: 'manual', time: 25, vol: 1000, va: 'VA', marker: 'subprocess' },
      { k: 'd2',  type: 'decision', label: '¿Indemnización procede?', owner: 'Analista de Siniestros', gateway: 'exclusive' },
      { k: 'a7',  type: 'task',  label: 'Liquidar reserva', owner: 'Analista de Siniestros', system: 'Core Seguros', exec: 'system', time: 8, vol: 200, va: 'NVA' },
      { k: 'a8',  type: 'task',  label: 'Autorizar pago', owner: 'Jefe de Siniestros', exec: 'manual', time: 15, vol: 800, va: 'BVA',
        pains: [{ category: 'control', description: 'Autorización manual aun en montos menores al umbral', severity: 3, frequency: 5 }] },
      { k: 'a9',  type: 'task',  label: 'Ejecutar pago', owner: 'Tesorería', system: 'ERP', exec: 'automatic', time: 5, vol: 800, va: 'VA' },
      { k: 'iv2', type: 'intermediate', label: 'Esperar abono (48h)', owner: 'Tesorería', event: 'timer' },
      { k: 'a10', type: 'task',  label: 'Notificar al asegurado', owner: 'Contact Center', exec: 'email', time: 4, vol: 800, va: 'VA' },
      { k: 'e1',  type: 'end',   label: 'Siniestro indemnizado', owner: 'Asegurado', event: 'message' }
    ];
    const E = [
      ['s','a1'], ['a1','a2'], ['a2','d1'],
      ['d1','g1','Sí'], ['d1','erej','No'],
      ['g1','a3','Documentos'], ['g1','a4','Peritaje'],
      ['a3','a6'], ['a4','a5'], ['a5','iv1'], ['iv1','a6'],
      ['a6','d2'], ['d2','a7','No procede'], ['d2','a8','Procede'],
      ['a7','a10'], ['a8','a9'], ['a9','iv2'], ['iv2','a10'], ['a10','e1']
    ];

    const idMap = {};
    N.forEach(t => {
      const def = SHAPE_DEFAULTS[t.type];
      const node = {
        id: 'n' + (state.nextId++), type: t.type, x: 0, y: 0, w: def.w, h: def.h,
        label: t.label, executionType: t.exec || (t.type === 'task' ? 'manual' : ''),
        gatewayType: t.gateway || undefined, eventType: t.event || undefined, marker: t.marker || '', activityCode: '',
        owner: t.owner || '', system: t.system || '',
        time: t.time != null ? String(t.time) : '', volume: t.vol != null ? String(t.vol) : '', va: t.va || '',
        sla: '', docsIn: '', docsOut: '', rules: '', notes: '', pains: (t.pains || []).map(p => ({ id: 'p' + (state.nextId++), ...p }))
      };
      idMap[t.k] = node.id;
      state.nodes.push(node);
    });
    E.forEach(([a, b, lbl]) => state.edges.push({ id: 'e' + (state.nextId++), from: idMap[a], to: idMap[b], label: lbl || '' }));

    state._kpiValues = {
      'seg-03': { name: 'Lead time de siniestro', unit: 'días', benchmark: '< 7 días (P50 mercado)', value: '12', gap: '+5 días', source: 'Core Seguros' }
    };

    ensureDecisionBranches();
    persist();
    autoLayout();
    runSimulation();
    persist();
    activateTab('copilot');
    copilotPost('ai',
      `**Proceso cargado: Gestión de Siniestros de Seguros** (BPMN avanzado).\n\n` +
      `7 actores · 14 actividades · **gateway inclusivo ○ (OR)** que abre documentación y/o peritaje en paralelo · **2 timers ⏱** (informe pericial, abono 48h) · inicio de **mensaje ✉**, fin de **error ⚡** y fin de **mensaje ✉**.\n\n` +
      `**Marcadores de actividad BPMN**: *Solicitar documentación* = ↻ loop (reenvíos), *Cotizar talleres* = ‖ multi-instancia (varios talleres), *Evaluar cobertura* = ⊞ subproceso. Estos marcadores hacen explícito el patrón de ejecución — clave para dimensionar automatización y SLA.`);
  }

  function loadComplexDemo5() {
    resetState();
    state.meta = { name: 'Atención Hospitalaria de Emergencia', industry: 'Salud', macroprocess: 'Atención', client: '', owner: '' };
    $('#processName').value = state.meta.name;
    $('#processIndustry').value = 'Salud';
    $('#processMacro').value = 'Atención';

    const N = [
      { k: 's',   type: 'start', label: 'Llegada del paciente', owner: 'Paciente', event: 'message' },
      { k: 'a1',  type: 'task',  label: 'Registrar admisión', owner: 'Admisión', system: 'HIS', exec: 'system', time: 6, vol: 3000, va: 'BVA' },
      { k: 'g1',  type: 'decision', label: 'Iniciar atención', owner: 'Triaje', gateway: 'parallel' },
      { k: 'a2',  type: 'task',  label: 'Clasificar en triaje', owner: 'Triaje', exec: 'manual', time: 7, vol: 3000, va: 'VA' },
      { k: 'a3',  type: 'task',  label: 'Tomar signos vitales', owner: 'Triaje', system: 'Monitor', exec: 'manual', time: 5, vol: 3000, va: 'VA' },
      { k: 'g2',  type: 'decision', label: 'Consolidar triaje', owner: 'Triaje', gateway: 'parallel' },
      { k: 'd1',  type: 'decision', label: '¿Nivel de urgencia?', owner: 'Médico de Emergencia', gateway: 'exclusive' },
      { k: 'sig', type: 'intermediate', label: 'Difundir código rojo', owner: 'Médico de Emergencia', event: 'signal', throw: true },
      { k: 'a4',  type: 'task',  label: 'Estabilizar paciente', owner: 'Médico de Emergencia', exec: 'manual', time: 40, vol: 600, va: 'VA', marker: 'subprocess',
        pains: [{ category: 'wait', description: 'Falta de camas críticas en horas pico', severity: 5, frequency: 4 }] },
      { k: 'a5',  type: 'task',  label: 'Asignar sala de espera', owner: 'Admisión', exec: 'manual', time: 3, vol: 2400, va: 'NVA' },
      { k: 'a6',  type: 'task',  label: 'Evaluar al paciente', owner: 'Médico de Emergencia', system: 'HIS', exec: 'manual', time: 18, vol: 3000, va: 'VA' },
      { k: 'a7',  type: 'task',  label: 'Solicitar exámenes', owner: 'Médico de Emergencia', system: 'LIS', exec: 'system', time: 5, vol: 2200, va: 'BVA' },
      { k: 'a8',  type: 'task',  label: 'Procesar muestras', owner: 'Laboratorio', system: 'LIS', exec: 'automatic', time: 25, vol: 2200, va: 'VA', marker: 'multiinstance' },
      { k: 'iv1', type: 'intermediate', label: 'Esperar resultados', owner: 'Laboratorio', event: 'timer' },
      { k: 'a9',  type: 'task',  label: 'Interpretar resultados', owner: 'Médico de Emergencia', exec: 'manual', time: 12, vol: 2200, va: 'VA', marker: 'loop',
        pains: [{ category: 'rework', description: 'Reevaluación por resultados incompletos o diferidos', severity: 3, frequency: 3 }] },
      { k: 'd2',  type: 'decision', label: '¿Requiere hospitalización?', owner: 'Médico de Emergencia', gateway: 'exclusive' },
      { k: 'a10', type: 'task',  label: 'Gestionar internamiento', owner: 'Admisión', system: 'HIS', exec: 'system', time: 15, vol: 700, va: 'BVA' },
      { k: 'a11', type: 'task',  label: 'Indicar tratamiento', owner: 'Médico de Emergencia', exec: 'manual', time: 8, vol: 1500, va: 'VA' },
      { k: 'a12', type: 'task',  label: 'Dispensar medicación', owner: 'Farmacia', system: 'HIS', exec: 'system', time: 6, vol: 1500, va: 'VA' },
      { k: 'eder',type: 'end',   label: 'Derivar a otro centro', owner: 'Médico de Emergencia', event: 'error' },
      { k: 'e1',  type: 'end',   label: 'Paciente dado de alta', owner: 'Paciente', event: 'message' }
    ];
    const E = [
      ['s','a1'], ['a1','g1'],
      ['g1','a2'], ['g1','a3'],
      ['a2','g2'], ['a3','g2'],
      ['g2','d1'],
      ['d1','sig','Crítico I-II'], ['d1','a5','Estándar III-V'],
      ['sig','a4'], ['a4','a6'], ['a5','a6'],
      ['a6','a7'], ['a7','a8'], ['a8','iv1'], ['iv1','a9'], ['a9','d2'],
      ['d2','a10','Sí'], ['d2','a11','No'],
      ['a10','eder'], ['a11','a12'], ['a12','e1']
    ];

    const idMap = {};
    N.forEach(t => {
      const def = SHAPE_DEFAULTS[t.type];
      const node = {
        id: 'n' + (state.nextId++), type: t.type, x: 0, y: 0, w: def.w, h: def.h,
        label: t.label, executionType: t.exec || (t.type === 'task' ? 'manual' : ''),
        gatewayType: t.gateway || undefined, eventType: t.event || undefined, throw: t.throw || undefined,
        marker: t.marker || '', activityCode: '',
        owner: t.owner || '', system: t.system || '',
        time: t.time != null ? String(t.time) : '', volume: t.vol != null ? String(t.vol) : '', va: t.va || '',
        sla: '', docsIn: '', docsOut: '', rules: '', notes: '', pains: (t.pains || []).map(p => ({ id: 'p' + (state.nextId++), ...p }))
      };
      idMap[t.k] = node.id;
      state.nodes.push(node);
    });
    E.forEach(([a, b, lbl]) => state.edges.push({ id: 'e' + (state.nextId++), from: idMap[a], to: idMap[b], label: lbl || '' }));

    state._kpiValues = {
      'hlt-01': { name: 'Tiempo de espera en emergencia', unit: 'minutos', benchmark: '< 30 min triaje', value: '52', gap: '+22 min', source: 'HIS' }
    };

    ensureDecisionBranches();
    persist();
    autoLayout();
    runSimulation();
    persist();
    activateTab('copilot');
    copilotPost('ai',
      `**Proceso cargado: Atención Hospitalaria de Emergencia** (BPMN completo).\n\n` +
      `6 actores · 16 actividades · **gateway paralelo ＋** (triaje + signos vitales en simultáneo, fork/join) · gateways exclusivos · **evento de señal ▲ (throw, relleno)** que difunde el *código rojo* a todo el equipo · timer ⏱ (esperar resultados) · inicio de **mensaje ✉**, fin de **error ⚡** (derivación) y fin de **mensaje ✉** (alta).\n\n` +
      `**Marcadores**: *Estabilizar paciente* = ⊞ subproceso, *Procesar muestras* = ‖ multi-instancia, *Interpretar resultados* = ↻ loop. El evento de señal modela un **broadcast** (1→N) — distinto del mensaje (1→1). El tiempo puerta-médico (52 min vs <30) es el cuello visible.`);
  }

  function loadComplexDemo6() {
    resetState();
    state.meta = { name: 'Orden de Producción a Despacho', industry: 'Manufactura', macroprocess: 'Producción', client: '', owner: '' };
    $('#processName').value = state.meta.name;
    $('#processIndustry').value = 'Manufactura';
    $('#processMacro').value = 'Producción';

    const N = [
      { k: 's',   type: 'start', label: 'Recepción de orden de compra', owner: 'Cliente', event: 'message' },
      { k: 'a1',  type: 'task',  label: 'Registrar pedido', owner: 'Comercial', system: 'ERP', exec: 'system', time: 8, vol: 900, va: 'BVA' },
      { k: 'd0',  type: 'decision', label: '¿Crédito aprobado?', owner: 'Comercial', gateway: 'exclusive' },
      { k: 'eterm',type: 'end',  label: 'Orden cancelada', owner: 'Comercial', terminate: true },
      { k: 'd1',  type: 'decision', label: '¿Hay stock disponible?', owner: 'Planificación', gateway: 'exclusive' },
      { k: 'a2',  type: 'task',  label: 'Reservar inventario', owner: 'Almacén', system: 'WMS', exec: 'system', time: 6, vol: 350, va: 'VA' },
      { k: 'a3',  type: 'task',  label: 'Planificar producción', owner: 'Planificación', system: 'MRP', exec: 'system', time: 25, vol: 550, va: 'VA' },
      { k: 'g1',  type: 'decision', label: 'Lanzar aprovisionamiento', owner: 'Planificación', gateway: 'parallel' },
      { k: 'a4',  type: 'task',  label: 'Comprar insumos', owner: 'Almacén', exec: 'email', time: 12, vol: 550, va: 'BVA' },
      { k: 'iv1', type: 'intermediate', label: 'Esperar materiales', owner: 'Almacén', event: 'timer' },
      { k: 'a5',  type: 'task',  label: 'Recepcionar materiales', owner: 'Almacén', system: 'WMS', exec: 'system', time: 10, vol: 550, va: 'BVA' },
      { k: 'a6',  type: 'task',  label: 'Preparar línea', owner: 'Producción', exec: 'manual', time: 40, vol: 550, va: 'BVA',
        pains: [{ category: 'wait', description: 'Setup largo por cambios de formato (SMED no aplicado)', severity: 4, frequency: 4 }] },
      { k: 'g2',  type: 'decision', label: 'Sincronizar producción', owner: 'Producción', gateway: 'parallel' },
      { k: 'a7',  type: 'task',  label: 'Fabricar lote', owner: 'Producción', exec: 'manual', time: 120, vol: 550, va: 'VA', marker: 'subprocess' },
      { k: 'a8',  type: 'task',  label: 'Inspeccionar calidad', owner: 'Calidad', exec: 'manual', time: 18, vol: 550, va: 'BVA', marker: 'multiinstance' },
      { k: 'd2',  type: 'decision', label: '¿Lote conforme?', owner: 'Calidad', gateway: 'exclusive' },
      { k: 'a9',  type: 'task',  label: 'Reprocesar lote', owner: 'Producción', exec: 'manual', time: 35, vol: 70, va: 'NVA', marker: 'loop',
        pains: [{ category: 'rework', description: 'Reprocesos por defectos de calibración', severity: 3, frequency: 3 }] },
      { k: 'a10', type: 'task',  label: 'Empacar producto', owner: 'Producción', system: 'MES', exec: 'system', time: 15, vol: 550, va: 'VA' },
      { k: 'a11', type: 'task',  label: 'Despachar pedido', owner: 'Despacho', system: 'WMS', exec: 'system', time: 12, vol: 900, va: 'VA' },
      { k: 'e1',  type: 'end',   label: 'Pedido entregado', owner: 'Cliente', event: 'message' }
    ];
    const E = [
      ['s','a1'], ['a1','d0'],
      ['d0','d1','Sí'], ['d0','eterm','No'],
      ['d1','a2','Sí'], ['d1','a3','No'],
      ['a3','g1'], ['g1','a4'], ['g1','a6'],
      ['a4','iv1'], ['iv1','a5'], ['a5','g2'], ['a6','g2'],
      ['g2','a7'], ['a7','a8'], ['a8','d2'],
      ['d2','a10','Conforme'], ['d2','a9','No conforme'],
      ['a9','a10'], ['a10','a11'], ['a2','a11'], ['a11','e1']
    ];

    const idMap = {};
    N.forEach(t => {
      const def = SHAPE_DEFAULTS[t.type];
      const node = {
        id: 'n' + (state.nextId++), type: t.type, x: 0, y: 0, w: def.w, h: def.h,
        label: t.label, executionType: t.exec || (t.type === 'task' ? 'manual' : ''),
        gatewayType: t.gateway || undefined, eventType: t.event || undefined, throw: t.throw || undefined,
        terminate: t.terminate || undefined, marker: t.marker || '', activityCode: '',
        owner: t.owner || '', system: t.system || '',
        time: t.time != null ? String(t.time) : '', volume: t.vol != null ? String(t.vol) : '', va: t.va || '',
        sla: '', docsIn: '', docsOut: '', rules: '', notes: '', pains: (t.pains || []).map(p => ({ id: 'p' + (state.nextId++), ...p }))
      };
      idMap[t.k] = node.id;
      state.nodes.push(node);
    });
    E.forEach(([a, b, lbl]) => state.edges.push({ id: 'e' + (state.nextId++), from: idMap[a], to: idMap[b], label: lbl || '' }));

    ensureDecisionBranches();
    persist();
    autoLayout();
    runSimulation();
    persist();
    activateTab('copilot');
    copilotPost('ai',
      `**Proceso cargado: Orden de Producción a Despacho** (Manufactura — BPMN completo).\n\n` +
      `7 actores · 15 actividades · **gateway paralelo ＋** (compra de insumos ∥ preparación de línea, fork/join) · gateways exclusivos (crédito, stock, calidad) · **evento de terminación ⬤** (*Orden cancelada* — corta toda la instancia, distinto de un fin normal) · timer ⏱ (esperar materiales) · inicio y fin de **mensaje ✉**.\n\n` +
      `**Marcadores**: *Fabricar lote* = ⊞ subproceso, *Inspeccionar calidad* = ‖ multi-instancia, *Reprocesar lote* = ↻ loop. El **make-to-stock** (hay stock → despacho directo) y **make-to-order** (sin stock → planificar + producir) conviven como dos rutas que convergen en *Despachar*.`);
  }

  function loadComplexDemo7() {
    resetState();
    state.meta = { name: 'Gestión de Avería Telecom (T2R)', industry: 'Telecomunicaciones', macroprocess: 'Servicio', client: '', owner: '' };
    $('#processName').value = state.meta.name;
    $('#processIndustry').value = 'Telecomunicaciones';
    $('#processMacro').value = 'Servicio';

    const N = [
      { k: 's',   type: 'start', label: 'Reporte de avería', owner: 'Cliente', event: 'message' },
      { k: 'a1',  type: 'task',  label: 'Registrar ticket', owner: 'Mesa de Ayuda', system: 'CRM', exec: 'system', time: 5, vol: 4000, va: 'BVA' },
      { k: 'a2',  type: 'task',  label: 'Diagnosticar remoto', owner: 'Mesa de Ayuda', system: 'NMS', exec: 'manual', time: 12, vol: 4000, va: 'VA' },
      { k: 'd1',  type: 'decision', label: '¿Resuelto en L1?', owner: 'Mesa de Ayuda', gateway: 'exclusive' },
      { k: 'a3',  type: 'task',  label: 'Escalar a soporte L2', owner: 'Soporte L2', system: 'CRM', exec: 'system', time: 4, vol: 2200, va: 'BVA' },
      { k: 'd2',  type: 'decision', label: '¿Requiere visita técnica?', owner: 'Soporte L2', gateway: 'exclusive' },
      { k: 'a4',  type: 'task',  label: 'Resolver remoto', owner: 'Soporte L2', system: 'NMS', exec: 'manual', time: 25, vol: 1200, va: 'VA' },
      { k: 'a5',  type: 'task',  label: 'Despachar cuadrilla', owner: 'Soporte L2', exec: 'email', time: 6, vol: 1000, va: 'BVA' },
      { k: 'iv1', type: 'intermediate', label: 'Esperar ventana SLA', owner: 'Cuadrilla de Campo', event: 'timer' },
      { k: 'a6',  type: 'task',  label: 'Atender en sitio', owner: 'Cuadrilla de Campo', exec: 'manual', time: 90, vol: 1000, va: 'VA', marker: 'subprocess',
        pains: [{ category: 'wait', description: 'Tiempos de traslado largos en zonas alejadas', severity: 4, frequency: 5 }] },
      { k: 'a7',  type: 'task',  label: 'Reemplazar equipo', owner: 'Cuadrilla de Campo', system: 'Inventario', exec: 'manual', time: 30, vol: 600, va: 'VA', marker: 'multiinstance' },
      { k: 'a8',  type: 'task',  label: 'Validar restablecimiento', owner: 'Soporte L2', system: 'NMS', exec: 'manual', time: 10, vol: 1000, va: 'BVA', marker: 'loop',
        pains: [{ category: 'rework', description: 'Reintentos por restablecimiento parcial del servicio', severity: 3, frequency: 3 }] },
      { k: 'a9',  type: 'task',  label: 'Confirmar con cliente', owner: 'Mesa de Ayuda', exec: 'email', time: 5, vol: 4000, va: 'VA' },
      { k: 'd3',  type: 'decision', label: '¿Cliente conforme?', owner: 'Mesa de Ayuda', gateway: 'exclusive' },
      { k: 'ereop',type: 'end',   label: 'Reapertura del ticket', owner: 'Mesa de Ayuda', event: 'error' },
      { k: 'a10', type: 'task',  label: 'Cerrar ticket', owner: 'Mesa de Ayuda', system: 'CRM', exec: 'system', time: 4, vol: 4000, va: 'VA' },
      { k: 'a11', type: 'task',  label: 'Aplicar créditos SLA', owner: 'Facturación', system: 'ERP', exec: 'automatic', time: 6, vol: 800, va: 'BVA' },
      { k: 'e1',  type: 'end',   label: 'Avería resuelta', owner: 'Cliente', event: 'message' }
    ];
    const E = [
      ['s','a1'], ['a1','a2'], ['a2','d1'],
      ['d1','a10','Sí'], ['d1','a3','No'],
      ['a3','d2'],
      ['d2','a4','No'], ['d2','a5','Sí'],
      ['a4','a9'],
      ['a5','iv1'], ['iv1','a6'], ['a6','a7'], ['a7','a8'], ['a8','a9'],
      ['a9','d3'],
      ['d3','a10','Sí'], ['d3','ereop','No'],
      ['a10','a11'], ['a11','e1']
    ];

    const idMap = {};
    N.forEach(t => {
      const def = SHAPE_DEFAULTS[t.type];
      const node = {
        id: 'n' + (state.nextId++), type: t.type, x: 0, y: 0, w: def.w, h: def.h,
        label: t.label, executionType: t.exec || (t.type === 'task' ? 'manual' : ''),
        gatewayType: t.gateway || undefined, eventType: t.event || undefined, throw: t.throw || undefined,
        terminate: t.terminate || undefined, marker: t.marker || '', activityCode: '',
        owner: t.owner || '', system: t.system || '',
        time: t.time != null ? String(t.time) : '', volume: t.vol != null ? String(t.vol) : '', va: t.va || '',
        sla: '', docsIn: '', docsOut: '', rules: '', notes: '', pains: (t.pains || []).map(p => ({ id: 'p' + (state.nextId++), ...p }))
      };
      idMap[t.k] = node.id;
      state.nodes.push(node);
    });
    E.forEach(([a, b, lbl]) => state.edges.push({ id: 'e' + (state.nextId++), from: idMap[a], to: idMap[b], label: lbl || '' }));

    state._kpiValues = {
      'tel-01': { name: 'MTTR (tiempo medio de reparación)', unit: 'horas', benchmark: '< 8 h (avería masiva < 4 h)', value: '14', gap: '+6 h', source: 'CRM/NMS' }
    };

    ensureDecisionBranches();
    persist();
    autoLayout();
    runSimulation();
    persist();
    activateTab('copilot');
    copilotPost('ai',
      `**Proceso cargado: Gestión de Avería Telecom (Trouble-to-Resolve)** (BPMN completo).\n\n` +
      `5 actores · 14 actividades · escalamiento **L1 → L2 → campo** con gateways exclusivos (¿resuelto en L1? ¿requiere visita? ¿cliente conforme?) · timer ⏱ (ventana SLA) · inicio de **mensaje ✉**, fin de **error ⚡** (reapertura) y fin de **mensaje ✉** (resuelta).\n\n` +
      `**Marcadores**: *Atender en sitio* = ⊞ subproceso, *Reemplazar equipo* = ‖ multi-instancia, *Validar restablecimiento* = ↻ loop. El **MTTR (14 h vs <8 h)** y el traslado a zonas alejadas son los cuellos visibles. Todos estos elementos ahora también se **exportan a PPTX** con su iconografía BPMN.`);
  }

  function loadComplexDemo8() {
    resetState();
    state.meta = { name: 'Licencia de Funcionamiento Municipal', industry: 'Sector Público', macroprocess: 'Trámites', client: '', owner: '' };
    $('#processName').value = state.meta.name;
    $('#processIndustry').value = 'Sector Público';
    $('#processMacro').value = 'Trámites';

    const N = [
      { k: 's',   type: 'start', label: 'Solicitud de licencia', owner: 'Ciudadano', event: 'message' },
      { k: 'a1',  type: 'task',  label: 'Recibir expediente', owner: 'Mesa de Partes', system: 'SGD', exec: 'system', time: 8, vol: 2000, va: 'BVA' },
      { k: 'a2',  type: 'task',  label: 'Verificar pago de tasa', owner: 'Caja', system: 'SIAF', exec: 'system', time: 5, vol: 2000, va: 'BVA' },
      { k: 'd1',  type: 'decision', label: '¿Expediente completo?', owner: 'Mesa de Partes', gateway: 'exclusive' },
      { k: 'eobs', type: 'end',  label: 'Expediente observado', owner: 'Mesa de Partes', event: 'error' },
      { k: 'a3',  type: 'task',  label: 'Evaluar requisitos', owner: 'Evaluación Técnica', exec: 'manual', time: 30, vol: 1700, va: 'VA' },
      { k: 'd2',  type: 'decision', label: '¿Requiere ITSE?', owner: 'Evaluación Técnica', gateway: 'exclusive' },
      { k: 'a4',  type: 'task',  label: 'Programar inspección', owner: 'Inspección ITSE', exec: 'email', time: 10, vol: 900, va: 'BVA' },
      { k: 'iv1', type: 'intermediate', label: 'Plazo legal (TUPA)', owner: 'Inspección ITSE', event: 'timer' },
      { k: 'a5',  type: 'task',  label: 'Inspeccionar local', owner: 'Inspección ITSE', exec: 'manual', time: 60, vol: 900, va: 'VA', marker: 'subprocess',
        pains: [{ category: 'wait', description: 'Agenda de inspectores saturada — excede plazo TUPA', severity: 5, frequency: 4 }] },
      { k: 'a6',  type: 'task',  label: 'Consolidar evaluación', owner: 'Evaluación Técnica', system: 'SGD', exec: 'manual', time: 15, vol: 1700, va: 'BVA' },
      { k: 'a7',  type: 'task',  label: 'Proyectar resolución', owner: 'Gerencia', exec: 'manual', time: 25, vol: 1700, va: 'BVA', marker: 'loop',
        pains: [{ category: 'control', description: 'Múltiples revisiones legales del proyecto de resolución', severity: 3, frequency: 4 }] },
      { k: 'd3',  type: 'decision', label: '¿Procede la licencia?', owner: 'Gerencia', gateway: 'exclusive' },
      { k: 'erej', type: 'end',  label: 'Licencia denegada', owner: 'Gerencia', event: 'error' },
      { k: 'a8',  type: 'task',  label: 'Emitir resolución', owner: 'Gerencia', system: 'SGD', exec: 'system', time: 6, vol: 1500, va: 'VA' },
      { k: 'a9',  type: 'task',  label: 'Notificar al ciudadano', owner: 'Mesa de Partes', exec: 'email', time: 5, vol: 1500, va: 'VA' },
      { k: 'e1',  type: 'end',   label: 'Licencia otorgada', owner: 'Ciudadano', event: 'message' }
    ];
    const E = [
      ['s','a1'], ['a1','a2'], ['a2','d1'],
      ['d1','a3','Sí'], ['d1','eobs','No'],
      ['a3','d2'],
      ['d2','a4','Sí'], ['d2','a6','No'],
      ['a4','iv1'], ['iv1','a5'], ['a5','a6'],
      ['a6','a7'], ['a7','d3'],
      ['d3','a8','Sí'], ['d3','erej','No'],
      ['a8','a9'], ['a9','e1']
    ];

    const idMap = {};
    N.forEach(t => {
      const def = SHAPE_DEFAULTS[t.type];
      const node = {
        id: 'n' + (state.nextId++), type: t.type, x: 0, y: 0, w: def.w, h: def.h,
        label: t.label, executionType: t.exec || (t.type === 'task' ? 'manual' : ''),
        gatewayType: t.gateway || undefined, eventType: t.event || undefined, throw: t.throw || undefined,
        terminate: t.terminate || undefined, marker: t.marker || '', activityCode: '',
        owner: t.owner || '', system: t.system || '',
        time: t.time != null ? String(t.time) : '', volume: t.vol != null ? String(t.vol) : '', va: t.va || '',
        sla: '', docsIn: '', docsOut: '', rules: '', notes: '', pains: (t.pains || []).map(p => ({ id: 'p' + (state.nextId++), ...p }))
      };
      idMap[t.k] = node.id;
      state.nodes.push(node);
    });
    E.forEach(([a, b, lbl]) => state.edges.push({ id: 'e' + (state.nextId++), from: idMap[a], to: idMap[b], label: lbl || '' }));

    state._kpiValues = {
      'gov-01': { name: 'Tiempo medio de resolución de trámite', unit: 'días hábiles', benchmark: 'según TUPA (15 d)', value: '38', gap: '+23 días', source: 'SGD' }
    };

    ensureDecisionBranches();
    persist();
    autoLayout();
    runSimulation();
    persist();
    activateTab('copilot');
    copilotPost('ai',
      `**Proceso cargado: Licencia de Funcionamiento Municipal** (Sector Público — BPMN completo).\n\n` +
      `6 actores · 13 actividades · gateways exclusivos (¿expediente completo? ¿requiere ITSE? ¿procede?) · **timer ⏱ del plazo legal TUPA** (la inspección que lo excede es el cuello: silencio administrativo) · inicio de **mensaje ✉**, dos fines de **error ⚡** (expediente observado, licencia denegada) y fin de **mensaje ✉** (otorgada).\n\n` +
      `**Marcadores**: *Inspeccionar local* = ⊞ subproceso, *Proyectar resolución* = ↻ loop. El **tiempo de resolución (38 días vs 15 TUPA)** evidencia el incumplimiento del plazo. El export a PPTX incluye además una **slide de leyenda BPMN** para que el cliente lea la nomenclatura.`);
  }

  function loadComplexDemo9() {
    resetState();
    state.meta = { name: 'Conexión de Nuevo Suministro Eléctrico', industry: 'Utilities', macroprocess: 'Atención', client: '', owner: '' };
    $('#processName').value = state.meta.name;
    $('#processIndustry').value = 'Utilities';
    $('#processMacro').value = 'Atención';

    const N = [
      { k: 's',   type: 'start', label: 'Solicitud de suministro', owner: 'Cliente', event: 'message' },
      { k: 'a1',  type: 'task',  label: 'Registrar solicitud', owner: 'Atención Comercial', system: 'Comercial', exec: 'system', time: 8, vol: 1500, va: 'BVA' },
      { k: 'a2',  type: 'task',  label: 'Verificar concesión', owner: 'Factibilidad Técnica', system: 'GIS', exec: 'system', time: 10, vol: 1500, va: 'VA' },
      { k: 'd1',  type: 'decision', label: '¿Factible técnicamente?', owner: 'Factibilidad Técnica', gateway: 'exclusive' },
      { k: 'erej', type: 'end',  label: 'Solicitud no factible', owner: 'Factibilidad Técnica', event: 'error' },
      { k: 'a3',  type: 'task',  label: 'Elaborar presupuesto', owner: 'Factibilidad Técnica', exec: 'manual', time: 25, vol: 1300, va: 'VA' },
      { k: 'a4',  type: 'task',  label: 'Comunicar presupuesto', owner: 'Atención Comercial', exec: 'email', time: 5, vol: 1300, va: 'BVA' },
      { k: 'iv1', type: 'intermediate', label: 'Esperar pago del cliente', owner: 'Cliente', event: 'timer' },
      { k: 'd2',  type: 'decision', label: '¿Pagó el presupuesto?', owner: 'Atención Comercial', gateway: 'exclusive' },
      { k: 'earch', type: 'end',  label: 'Solicitud archivada', owner: 'Atención Comercial', terminate: true },
      { k: 'g1',  type: 'decision', label: 'Ejecutar conexión', owner: 'Cuadrilla de Obras', gateway: 'parallel' },
      { k: 'a5',  type: 'task',  label: 'Ejecutar obra de conexión', owner: 'Cuadrilla de Obras', exec: 'manual', time: 240, vol: 1100, va: 'VA', marker: 'subprocess',
        pains: [{ category: 'wait', description: 'Demoras por permisos de vía pública y clima', severity: 4, frequency: 4 }] },
      { k: 'a6',  type: 'task',  label: 'Actualizar catastro', owner: 'Catastro GIS', system: 'GIS', exec: 'system', time: 15, vol: 1100, va: 'BVA' },
      { k: 'g2',  type: 'decision', label: 'Consolidar conexión', owner: 'Cuadrilla de Obras', gateway: 'parallel' },
      { k: 'a7',  type: 'task',  label: 'Instalar medidor', owner: 'Cuadrilla de Obras', exec: 'manual', time: 30, vol: 1100, va: 'VA' },
      { k: 'a8',  type: 'task',  label: 'Inspeccionar instalación', owner: 'Factibilidad Técnica', exec: 'manual', time: 20, vol: 1100, va: 'BVA', marker: 'loop',
        pains: [{ category: 'rework', description: 'Reinspecciones por observaciones de seguridad', severity: 3, frequency: 3 }] },
      { k: 'a9',  type: 'task',  label: 'Activar suministro', owner: 'Atención Comercial', system: 'Comercial', exec: 'system', time: 6, vol: 1100, va: 'VA' },
      { k: 'a10', type: 'task',  label: 'Crear cuenta de facturación', owner: 'Facturación', system: 'ERP', exec: 'automatic', time: 5, vol: 1100, va: 'BVA' },
      { k: 'e1',  type: 'end',   label: 'Suministro energizado', owner: 'Cliente', event: 'message' }
    ];
    const E = [
      ['s','a1'], ['a1','a2'], ['a2','d1'],
      ['d1','a3','Sí'], ['d1','erej','No'],
      ['a3','a4'], ['a4','iv1'], ['iv1','d2'],
      ['d2','g1','Sí'], ['d2','earch','No'],
      ['g1','a5'], ['g1','a6'], ['a5','g2'], ['a6','g2'],
      ['g2','a7'], ['a7','a8'], ['a8','a9'], ['a9','a10'], ['a10','e1']
    ];

    const idMap = {};
    N.forEach(t => {
      const def = SHAPE_DEFAULTS[t.type];
      const node = {
        id: 'n' + (state.nextId++), type: t.type, x: 0, y: 0, w: def.w, h: def.h,
        label: t.label, executionType: t.exec || (t.type === 'task' ? 'manual' : ''),
        gatewayType: t.gateway || undefined, eventType: t.event || undefined, throw: t.throw || undefined,
        terminate: t.terminate || undefined, marker: t.marker || '', activityCode: '',
        owner: t.owner || '', system: t.system || '',
        time: t.time != null ? String(t.time) : '', volume: t.vol != null ? String(t.vol) : '', va: t.va || '',
        sla: '', docsIn: '', docsOut: '', rules: '', notes: '', pains: (t.pains || []).map(p => ({ id: 'p' + (state.nextId++), ...p }))
      };
      idMap[t.k] = node.id;
      state.nodes.push(node);
    });
    E.forEach(([a, b, lbl]) => state.edges.push({ id: 'e' + (state.nextId++), from: idMap[a], to: idMap[b], label: lbl || '' }));

    state._kpiValues = {
      'utl-05': { name: 'Tiempo de conexión nuevo suministro', unit: 'días', benchmark: '< 7 días', value: '18', gap: '+11 días', source: 'Sistema Comercial' }
    };

    ensureDecisionBranches();
    persist();
    autoLayout();
    runSimulation();
    persist();
    activateTab('copilot');
    copilotPost('ai',
      `**Proceso cargado: Conexión de Nuevo Suministro Eléctrico** (Utilities — BPMN completo).\n\n` +
      `6 actores · 14 actividades · **gateway paralelo ＋** (obra de conexión ∥ actualización de catastro GIS, fork/join) · gateways exclusivos (factibilidad, pago) · timer ⏱ (esperar pago del cliente) · **evento de terminación ⬤** (*Solicitud archivada* si no paga) · inicio de **mensaje ✉**, fin de **error ⚡** (no factible) y fin de **mensaje ✉** (energizado).\n\n` +
      `**Marcadores**: *Ejecutar obra de conexión* = ⊞ subproceso, *Inspeccionar instalación* = ↻ loop. El **tiempo de conexión (18 días vs <7)** triplica el benchmark OSINERGMIN — la obra de conexión y sus permisos son el cuello. Abre la **Leyenda BPMN** (botón sobre el lienzo) para ver toda la nomenclatura.`);
  }

  function loadComplexDemo10() {
    resetState();
    state.meta = { name: 'Procure-to-Pay (P2P)', industry: 'Transversal', macroprocess: 'P2P', client: '', owner: '' };
    $('#processName').value = state.meta.name;
    $('#processIndustry').value = 'Transversal';
    $('#processMacro').value = 'P2P';

    const N = [
      { k: 's',   type: 'start', label: 'Necesidad de compra', owner: 'Solicitante', event: 'message' },
      { k: 'a1',  type: 'task',  label: 'Crear requisición', owner: 'Solicitante', system: 'ERP', exec: 'system', time: 10, vol: 2400, va: 'BVA' },
      { k: 'd1',  type: 'decision', label: '¿Supera el umbral?', owner: 'Compras', gateway: 'exclusive' },
      { k: 'a2',  type: 'task',  label: 'Aprobar requisición', owner: 'Aprobador', exec: 'manual', time: 20, vol: 900, va: 'BVA',
        pains: [{ category: 'wait', description: 'Aprobaciones detenidas por gerentes fuera de oficina', severity: 4, frequency: 4 }] },
      { k: 'a3',  type: 'task',  label: 'Generar orden de compra', owner: 'Compras', system: 'ERP', exec: 'system', time: 12, vol: 2400, va: 'VA' },
      { k: 'a4',  type: 'task',  label: 'Enviar OC al proveedor', owner: 'Compras', exec: 'email', time: 4, vol: 2400, va: 'BVA' },
      { k: 'iv1', type: 'intermediate', label: 'Esperar entrega', owner: 'Proveedor', event: 'timer' },
      { k: 'a5',  type: 'task',  label: 'Despachar mercadería', owner: 'Proveedor', exec: 'manual', time: 30, vol: 2400, va: 'VA' },
      { k: 'a6',  type: 'task',  label: 'Recepcionar mercadería', owner: 'Almacén', system: 'WMS', exec: 'manual', time: 18, vol: 2400, va: 'BVA' },
      { k: 'd2',  type: 'decision', label: '¿Recepción conforme?', owner: 'Almacén', gateway: 'exclusive' },
      { k: 'a7',  type: 'task',  label: 'Devolver al proveedor', owner: 'Almacén', exec: 'email', time: 15, vol: 200, va: 'NVA', marker: 'loop' },
      { k: 'erech', type: 'end', label: 'Recepción rechazada', owner: 'Almacén', event: 'error' },
      { k: 'a8',  type: 'task',  label: 'Validar factura', owner: 'Cuentas por Pagar', system: 'ERP', exec: 'manual', time: 22, vol: 2200, va: 'VA', marker: 'subprocess',
        pains: [{ category: 'rework', description: 'Discrepancias OC / recepción / factura (3-way match manual)', severity: 5, frequency: 4 }] },
      { k: 'd3',  type: 'decision', label: '¿Match correcto?', owner: 'Cuentas por Pagar', gateway: 'exclusive' },
      { k: 'edisp', type: 'end', label: 'Factura en disputa', owner: 'Cuentas por Pagar', event: 'error' },
      { k: 'a9',  type: 'task',  label: 'Contabilizar factura', owner: 'Cuentas por Pagar', system: 'ERP', exec: 'system', time: 8, vol: 2000, va: 'BVA' },
      { k: 'a10', type: 'task',  label: 'Programar pago', owner: 'Tesorería', system: 'ERP', exec: 'system', time: 6, vol: 2000, va: 'VA' },
      { k: 'a11', type: 'task',  label: 'Ejecutar pago', owner: 'Tesorería', system: 'Banca', exec: 'automatic', time: 4, vol: 2000, va: 'VA' },
      { k: 'e1',  type: 'end',   label: 'Pago realizado', owner: 'Proveedor', event: 'message' }
    ];
    const E = [
      ['s','a1'], ['a1','d1'],
      ['d1','a2','Sí'], ['d1','a3','No'],
      ['a2','a3'], ['a3','a4'], ['a4','iv1'], ['iv1','a5'], ['a5','a6'], ['a6','d2'],
      ['d2','a8','Sí'], ['d2','a7','No'],
      ['a7','erech'],
      ['a8','d3'],
      ['d3','a9','Sí'], ['d3','edisp','No'],
      ['a9','a10'], ['a10','a11'], ['a11','e1']
    ];

    const idMap = {};
    N.forEach(t => {
      const def = SHAPE_DEFAULTS[t.type];
      const node = {
        id: 'n' + (state.nextId++), type: t.type, x: 0, y: 0, w: def.w, h: def.h,
        label: t.label, executionType: t.exec || (t.type === 'task' ? 'manual' : ''),
        gatewayType: t.gateway || undefined, eventType: t.event || undefined, throw: t.throw || undefined,
        terminate: t.terminate || undefined, marker: t.marker || '', activityCode: '',
        owner: t.owner || '', system: t.system || '',
        time: t.time != null ? String(t.time) : '', volume: t.vol != null ? String(t.vol) : '', va: t.va || '',
        sla: '', docsIn: '', docsOut: '', rules: '', notes: '', pains: (t.pains || []).map(p => ({ id: 'p' + (state.nextId++), ...p }))
      };
      idMap[t.k] = node.id;
      state.nodes.push(node);
    });
    E.forEach(([a, b, lbl]) => state.edges.push({ id: 'e' + (state.nextId++), from: idMap[a], to: idMap[b], label: lbl || '' }));

    state._kpiValues = {
      'tx-p2p-01': { name: 'Cycle time P2P (req → pago)', unit: 'días', benchmark: '< 10 días (best-in-class)', value: '21', gap: '+11 días', source: 'ERP' }
    };

    ensureDecisionBranches();
    persist();
    autoLayout();
    runSimulation();
    persist();
    activateTab('copilot');
    copilotPost('ai',
      `**Proceso cargado: Procure-to-Pay (P2P)** (Transversal — BPMN completo).\n\n` +
      `7 actores · 15 actividades · gateways exclusivos (umbral de aprobación, recepción conforme, 3-way match) · timer ⏱ (esperar entrega del proveedor) · inicio de **mensaje ✉**, **dos fines de error ⚡** (recepción rechazada, factura en disputa) y fin de **mensaje ✉** (pago realizado).\n\n` +
      `**Marcadores**: *Validar factura* = ⊞ subproceso (el **3-way match** OC/recepción/factura) y *Devolver al proveedor* = ↻ loop. El **cycle time P2P (21 días vs <10)** y el match manual son los cuellos. Proceso clásico **transversal** que cruza Solicitante → Compras → Aprobador → Proveedor → Almacén → Cuentas por Pagar → Tesorería.`);
  }

  function loadComplexDemo11() {
    resetState();
    state.meta = { name: 'Originación de Crédito Comercial PYME', industry: 'Banca', macroprocess: 'Riesgos', client: '', owner: '' };
    $('#processName').value = state.meta.name;
    $('#processIndustry').value = 'Banca';
    $('#processMacro').value = 'Riesgos';

    const N = [
      { k: 's',   type: 'start', label: 'Solicitud de crédito', owner: 'Cliente', event: 'message' },
      { k: 'a1',  type: 'task',  label: 'Registrar solicitud', owner: 'Ejecutivo Comercial', system: 'CRM', exec: 'system', time: 10, vol: 1800, va: 'BVA' },
      { k: 'doc1',type: 'document', label: 'Expediente del cliente', owner: 'Ejecutivo Comercial' },
      { k: 'd0',  type: 'decision', label: '¿Cliente continúa?', owner: 'Ejecutivo Comercial', gateway: 'exclusive' },
      { k: 'eterm',type: 'end',  label: 'Solicitud cancelada', owner: 'Ejecutivo Comercial', terminate: true },
      { k: 'a2',  type: 'task',  label: 'Validar documentación', owner: 'Plataforma Digital', system: 'BPM', exec: 'system', time: 8, vol: 1700, va: 'VA' },
      { k: 'd1',  type: 'decision', label: '¿Documentación completa?', owner: 'Plataforma Digital', gateway: 'exclusive' },
      { k: 'a3',  type: 'task',  label: 'Subsanar documentación', owner: 'Cliente', exec: 'email', time: 20, vol: 500, va: 'NVA', marker: 'loop',
        pains: [{ category: 'rework', description: 'Reenvíos por documentación incompleta', severity: 4, frequency: 4 }] },
      { k: 'g1',  type: 'decision', label: 'Iniciar evaluación', owner: 'Análisis de Crédito', gateway: 'parallel' },
      { k: 'a4',  type: 'task',  label: 'Evaluar capacidad de pago', owner: 'Análisis de Crédito', exec: 'manual', time: 35, vol: 1500, va: 'VA', marker: 'subprocess' },
      { k: 'a5',  type: 'task',  label: 'Consultar centrales de riesgo', owner: 'Riesgos', system: 'SBS/Infocorp', exec: 'automatic', time: 6, vol: 1500, va: 'VA' },
      { k: 'data1',type: 'data', label: 'Score crediticio', owner: 'Riesgos' },
      { k: 'g2',  type: 'decision', label: 'Consolidar evaluación', owner: 'Análisis de Crédito', gateway: 'parallel' },
      { k: 'd2',  type: 'decision', label: '¿Validaciones adicionales?', owner: 'Análisis de Crédito', gateway: 'inclusive' },
      { k: 'a6',  type: 'task',  label: 'Tasar garantías', owner: 'Riesgos', exec: 'manual', time: 40, vol: 900, va: 'VA', marker: 'multiinstance',
        pains: [{ category: 'wait', description: 'Disponibilidad de peritos tasadores', severity: 3, frequency: 3 }] },
      { k: 'a7',  type: 'task',  label: 'Revisar contratos', owner: 'Legal', exec: 'manual', time: 25, vol: 700, va: 'BVA' },
      { k: 'a8',  type: 'task',  label: 'Consolidar propuesta', owner: 'Análisis de Crédito', exec: 'manual', time: 18, vol: 1500, va: 'VA' },
      { k: 'd3',  type: 'decision', label: '¿Supera umbral del comité?', owner: 'Análisis de Crédito', gateway: 'exclusive' },
      { k: 'a9',  type: 'task',  label: 'Presentar a comité', owner: 'Comité de Crédito', exec: 'manual', time: 30, vol: 600, va: 'BVA',
        pains: [{ category: 'wait', description: 'Comité sesiona solo 2 veces por semana', severity: 4, frequency: 5 }] },
      { k: 'iv1', type: 'intermediate', label: 'Esperar sesión de comité', owner: 'Comité de Crédito', event: 'timer' },
      { k: 'd4',  type: 'decision', label: '¿Crédito aprobado?', owner: 'Comité de Crédito', gateway: 'exclusive' },
      { k: 'erej',type: 'end',   label: 'Crédito denegado', owner: 'Comité de Crédito', event: 'error' },
      { k: 'a10', type: 'task',  label: 'Formalizar contrato', owner: 'Legal', exec: 'manual', time: 22, vol: 1100, va: 'VA' },
      { k: 'sig', type: 'intermediate', label: 'Difundir aprobación', owner: 'Ejecutivo Comercial', event: 'signal', throw: true },
      { k: 'a11', type: 'task',  label: 'Constituir garantías', owner: 'Operaciones', system: 'Core', exec: 'system', time: 15, vol: 1100, va: 'BVA' },
      { k: 'a12', type: 'task',  label: 'Desembolsar crédito', owner: 'Tesorería', system: 'Core', exec: 'automatic', time: 5, vol: 1100, va: 'VA' },
      { k: 'e1',  type: 'end',   label: 'Crédito desembolsado', owner: 'Cliente', event: 'message' }
    ];
    const E = [
      ['s','a1'], ['a1','doc1'], ['doc1','d0'],
      ['d0','a2','Sí'], ['d0','eterm','No'],
      ['a2','d1'],
      ['d1','g1','Sí'], ['d1','a3','No'], ['a3','a2'],
      ['g1','a4'], ['g1','a5'], ['a5','data1'], ['data1','g2'], ['a4','g2'],
      ['g2','d2'],
      ['d2','a6','Garantías'], ['d2','a7','Legal'],
      ['a6','a8'], ['a7','a8'],
      ['a8','d3'],
      ['d3','a9','Sí'], ['d3','d4','No'],
      ['a9','iv1'], ['iv1','d4'],
      ['d4','a10','Sí'], ['d4','erej','No'],
      ['a10','sig'], ['sig','a11'], ['a11','a12'], ['a12','e1']
    ];

    const idMap = {};
    N.forEach(t => {
      const def = SHAPE_DEFAULTS[t.type];
      const node = {
        id: 'n' + (state.nextId++), type: t.type, x: 0, y: 0, w: def.w, h: def.h,
        label: t.label, executionType: t.exec || (t.type === 'task' ? 'manual' : ''),
        gatewayType: t.gateway || undefined, eventType: t.event || undefined, throw: t.throw || undefined,
        terminate: t.terminate || undefined, marker: t.marker || '', activityCode: '',
        owner: t.owner || '', system: t.system || '',
        time: t.time != null ? String(t.time) : '', volume: t.vol != null ? String(t.vol) : '', va: t.va || '',
        sla: '', docsIn: '', docsOut: '', rules: '', notes: '', pains: (t.pains || []).map(p => ({ id: 'p' + (state.nextId++), ...p }))
      };
      idMap[t.k] = node.id;
      state.nodes.push(node);
    });
    E.forEach(([a, b, lbl]) => state.edges.push({ id: 'e' + (state.nextId++), from: idMap[a], to: idMap[b], label: lbl || '' }));

    state._kpiValues = {
      'per-sbs-01': { name: 'Ratio de morosidad (SBS)', unit: '%', benchmark: '< 4% sistema PE', value: '6.2', gap: '+2.2 pp', source: 'Core / SBS' }
    };

    ensureDecisionBranches();
    persist();
    autoLayout();
    runSimulation();
    persist();
    activateTab('copilot');
    copilotPost('ai',
      `**Proceso cargado: Originación de Crédito Comercial PYME** (Banca — *showcase* BPMN completo).\n\n` +
      `**9 actores · 27 nodos** — ejercita TODOS los elementos BPMN en un flujo: nodos **Documento ▤** (expediente) y **Data ▱** (score crediticio) · **gateway exclusivo ✕, paralelo ＋ (fork/join) e inclusivo ○** (garantías y/o legal) · **timer ⏱** (esperar comité) · **señal ▲ throw** (difundir aprobación) · **evento de terminación ⬤** (cancelación) · 2 fines de **error ⚡** · inicio y fin de **mensaje ✉**.\n\n` +
      `**Marcadores**: ⊞ subproceso (capacidad de pago), ‖ multi-instancia (tasar garantías), ↻ loop (subsanar). Es el ejemplo más grande: úsalo para validar que el **auto-layout se mantiene limpio a escala** (0 cruces, 0 solapamientos) y que el export PPTX parte el flujo en slides legibles.`);
  }

  function loadComplexDemo12() {
    resetState();
    state.meta = { name: 'Fulfillment E-commerce con SLA', industry: 'Retail', macroprocess: 'Supply Chain', client: '', owner: '' };
    $('#processName').value = state.meta.name;
    $('#processIndustry').value = 'Retail';
    $('#processMacro').value = 'Supply Chain';

    const N = [
      { k: 's',   type: 'start', label: 'Pedido confirmado', owner: 'Cliente', event: 'message' },
      { k: 'a1',  type: 'task',  label: 'Validar pago', owner: 'Pagos', system: 'Pasarela', exec: 'automatic', time: 3, vol: 5000, va: 'BVA' },
      { k: 'd1',  type: 'decision', label: '¿Pago aprobado?', owner: 'Pagos', gateway: 'exclusive' },
      { k: 'erej',type: 'end',   label: 'Pedido rechazado', owner: 'Pagos', event: 'error' },
      { k: 'a2',  type: 'task',  label: 'Preparar pedido (picking)', owner: 'Almacén', system: 'WMS', exec: 'manual', time: 25, vol: 4600, va: 'VA',
        boundary: { type: 'timer', interrupting: false },
        pains: [{ category: 'wait', description: 'Picking excede el SLA en campañas de alta demanda', severity: 4, frequency: 4 }] },
      { k: 'aesc',type: 'task',  label: 'Priorizar pedido', owner: 'Supervisor', exec: 'manual', time: 8, vol: 600, va: 'BVA' },
      { k: 'a3',  type: 'task',  label: 'Empacar y etiquetar', owner: 'Almacén', exec: 'manual', time: 10, vol: 4600, va: 'VA' },
      { k: 'a4',  type: 'task',  label: 'Asignar transportista', owner: 'Logística', system: 'TMS', exec: 'system', time: 5, vol: 4600, va: 'BVA' },
      { k: 'iv1', type: 'intermediate', label: 'Esperar recojo', owner: 'Transportista', event: 'timer' },
      { k: 'a5',  type: 'task',  label: 'Despachar a ruta', owner: 'Transportista', exec: 'manual', time: 15, vol: 4600, va: 'VA',
        boundary: { type: 'timer', interrupting: false } },
      { k: 'anot',type: 'task',  label: 'Notificar retraso', owner: 'Logística', exec: 'email', time: 4, vol: 700, va: 'BVA' },
      { k: 'a6',  type: 'task',  label: 'Entregar pedido', owner: 'Transportista', exec: 'manual', time: 20, vol: 4600, va: 'VA' },
      { k: 'd2',  type: 'decision', label: '¿Entrega exitosa?', owner: 'Transportista', gateway: 'exclusive' },
      { k: 'a7',  type: 'task',  label: 'Reprogramar entrega', owner: 'Logística', system: 'TMS', exec: 'system', time: 12, vol: 500, va: 'NVA', marker: 'loop',
        pains: [{ category: 'rework', description: 'Reintentos por cliente ausente', severity: 3, frequency: 4 }] },
      { k: 'a8',  type: 'task',  label: 'Confirmar entrega', owner: 'Logística', system: 'TMS', exec: 'system', time: 4, vol: 4400, va: 'VA' },
      { k: 'e1',  type: 'end',   label: 'Pedido entregado', owner: 'Cliente', event: 'message' }
    ];
    const E = [
      ['s','a1'], ['a1','d1'],
      ['d1','a2','Sí'], ['d1','erej','No'],
      ['a2','a3'], ['a2','aesc','SLA 2h vencido'], ['aesc','a3'],
      ['a3','a4'], ['a4','iv1'], ['iv1','a5'],
      ['a5','a6'], ['a5','anot','Demora > 24h'], ['anot','a6'],
      ['a6','d2'],
      ['d2','a8','Sí'], ['d2','a7','No'], ['a7','a6'],
      ['a8','e1']
    ];

    const idMap = {};
    N.forEach(t => {
      const def = SHAPE_DEFAULTS[t.type];
      const node = {
        id: 'n' + (state.nextId++), type: t.type, x: 0, y: 0, w: def.w, h: def.h,
        label: t.label, executionType: t.exec || (t.type === 'task' ? 'manual' : ''),
        gatewayType: t.gateway || undefined, eventType: t.event || undefined, throw: t.throw || undefined,
        terminate: t.terminate || undefined, marker: t.marker || '', boundary: t.boundary || undefined, activityCode: '',
        owner: t.owner || '', system: t.system || '',
        time: t.time != null ? String(t.time) : '', volume: t.vol != null ? String(t.vol) : '', va: t.va || '',
        sla: '', docsIn: '', docsOut: '', rules: '', notes: '', pains: (t.pains || []).map(p => ({ id: 'p' + (state.nextId++), ...p }))
      };
      idMap[t.k] = node.id;
      state.nodes.push(node);
    });
    E.forEach(([a, b, lbl]) => state.edges.push({ id: 'e' + (state.nextId++), from: idMap[a], to: idMap[b], label: lbl || '' }));

    state._kpiValues = {
      'ret-07': { name: 'Tasa de pedidos fuera de SLA', unit: '%', benchmark: '< 5%', value: '13', gap: '+8 pp', source: 'WMS/TMS' }
    };

    ensureDecisionBranches();
    persist();
    autoLayout();
    runSimulation();
    persist();
    activateTab('copilot');
    copilotPost('ai',
      `**Proceso cargado: Fulfillment E-commerce con SLA** (Retail — estrena **eventos de borde** BPMN).\n\n` +
      `6 actores · 13 actividades · **2 eventos de borde (boundary) de temporizador ⏱ no-interrumpentes** (anillo punteado) sobre tareas: *Preparar pedido* → si vence el **SLA de 2h** escala a *Priorizar pedido*; *Despachar a ruta* → si hay **demora >24h** dispara *Notificar retraso*. El flujo principal continúa en paralelo (no-interrumpente). Gateways exclusivos (pago, entrega), timer intermedio (esperar recojo), inicio/fin de **mensaje ✉**, fin de **error ⚡**, marcador ↻ loop (reprogramar).\n\n` +
      `Los **boundary events** modelan el manejo de excepciones por SLA sin romper el camino feliz — patrón clave en operaciones. La tasa fuera de SLA (13% vs <5%) es el cuello.`);
  }

  // =================== EXPORT / IMPORT ===================
  function exportJson() {
    const data = { meta: state.meta, nodes: state.nodes, edges: state.edges, exportedAt: new Date().toISOString() };
    download(JSON.stringify(data, null, 2), filename('json'), 'application/json');
  }

  function importJson(e) {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        state.meta = data.meta || state.meta;
        state.nodes = data.nodes || [];
        state.edges = data.edges || [];
        state.nextId = (Math.max(0, ...state.nodes.map(n => parseInt(n.id.slice(1), 10) || 0)) || 0) + 1;
        $('#processName').value = state.meta.name || '';
        $('#processIndustry').value = state.meta.industry || '';
        $('#processMacro').value = state.meta.macroprocess || '';
        persist();
        render();
      } catch (err) { alert('Archivo JSON inválido.'); }
    };
    reader.readAsText(f);
    e.target.value = '';
  }

  function exportSvg() {
    const svgString = serializeCanvasSvg();
    download(svgString, filename('svg'), 'image/svg+xml');
  }

  function exportPng() {
    const svgString = serializeCanvasSvg();
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const cnv = document.createElement('canvas');
      const padding = 20;
      cnv.width = img.width + padding * 2;
      cnv.height = img.height + padding * 2;
      const ctx = cnv.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, cnv.width, cnv.height);
      ctx.drawImage(img, padding, padding);
      cnv.toBlob(b => {
        const u = URL.createObjectURL(b);
        const a = document.createElement('a');
        a.href = u; a.download = filename('png'); a.click();
        URL.revokeObjectURL(u);
      }, 'image/png');
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  function serializeCanvasSvg() {
    // Bounding box de nodos
    if (state.nodes.length === 0) return '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"></svg>';
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    state.nodes.forEach(n => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.w);
      maxY = Math.max(maxY, n.y + n.h + 20);
    });
    const w = maxX - minX + 40;
    const h = maxY - minY + 40;
    const clone = canvas.cloneNode(true);
    clone.setAttribute('width', w);
    clone.setAttribute('height', h);
    clone.setAttribute('viewBox', `${minX - 20} ${minY - 20} ${w} ${h}`);
    // Remove grid background
    const grid = clone.querySelector('#gridBg');
    if (grid) grid.remove();
    return new XMLSerializer().serializeToString(clone);
  }

  function filename(ext) {
    const name = (state.meta.name || 'proceso').replace(/[^a-zA-Z0-9-_]+/g, '_');
    const ts = new Date().toISOString().slice(0, 10);
    return `ProcessIQ_${name}_${ts}.${ext}`;
  }

  function download(content, name, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }

  // ============================================================
  // LINTER MBB — validaciones automáticas del playbook
  // ============================================================
  const SEV = { critical: 4, high: 3, medium: 2, low: 1 };

  function lintProcess() {
    const issues = [];
    const nodes = state.nodes;
    const edges = state.edges;
    if (nodes.length === 0) return issues;

    const allowed = window.VERBS_ALLOWED || [];
    const forbidden = window.VERBS_FORBIDDEN || {};

    // Mapas de in/out grade
    const inDeg = {}, outDeg = {};
    edges.forEach(e => {
      outDeg[e.from] = (outDeg[e.from] || 0) + 1;
      inDeg[e.to] = (inDeg[e.to] || 0) + 1;
    });

    const starts = nodes.filter(n => n.type === 'start');
    const ends = nodes.filter(n => n.type === 'end');

    // R1: al menos 1 start
    if (starts.length === 0) issues.push({ sev: 'critical', title: 'Falta evento Start', detail: 'Todo proceso debe iniciar en un evento "Inicio".' });
    // R2: al menos 1 end
    if (ends.length === 0) issues.push({ sev: 'critical', title: 'Falta evento End', detail: 'Todo proceso debe cerrar en al menos un "Fin".' });
    // R3: end genérico
    ends.forEach(n => {
      const lower = (n.label || '').toLowerCase().trim();
      if (!lower || lower === 'fin' || lower === 'final' || lower === 'fin del proceso') {
        issues.push({ sev: 'medium', title: 'End event genérico', detail: 'Cada "Fin" debe describir un outcome distinto (ej. "Crédito aprobado", "Solicitud rechazada").', target: n.id });
      }
    });

    nodes.forEach(n => {
      const label = (n.label || '').trim();
      const lower = label.toLowerCase();
      const firstWord = lower.split(/\s+/)[0].replace(/[^a-záéíóúñ]/g, '');

      // R4: actividad sin etiqueta
      if (!label) issues.push({ sev: 'high', title: 'Nodo sin etiqueta', detail: 'Asigna un nombre descriptivo al nodo.', target: n.id });

      // Validaciones específicas a tasks/system
      if (n.type === 'task' || n.type === 'system') {
        // R5: verbo prohibido
        if (firstWord && forbidden[firstWord]) {
          issues.push({ sev: 'medium', title: `Verbo prohibido: "${firstWord}"`, detail: forbidden[firstWord], target: n.id });
        } else if (firstWord && !allowed.some(a => firstWord.startsWith(a))) {
          // R6: verbo fuera de catálogo (solo warning bajo)
          issues.push({ sev: 'low', title: `Verbo fuera de catálogo: "${firstWord}"`, detail: 'Considera un verbo del catálogo MBB (registrar, validar, aprobar…).', target: n.id });
        }

        // R7: longitud excesiva
        const words = label.split(/\s+/).length;
        if (label.length > 50 || words > 8) {
          issues.push({ sev: 'medium', title: 'Etiqueta demasiado larga', detail: `"${label}" tiene ${label.length} car / ${words} pal. Máx 50/8 → considera descomponer.`, target: n.id });
        }

        // R8: sin responsable
        if (!n.owner) issues.push({ sev: 'high', title: 'Actividad sin responsable', detail: `"${label}" debe tener un rol asignado.`, target: n.id });

        // R9: sin tipo de ejecución
        if (!n.executionType) issues.push({ sev: 'high', title: 'Actividad sin tipo de ejecución', detail: `Asigna manual/sistema/automático/IA/etc. a "${label}".`, target: n.id });

        // R10: actividad manual muy larga
        if (n.executionType === 'manual' && parseFloat(n.time) > 120) {
          issues.push({ sev: 'low', title: 'Actividad manual >120 min', detail: `"${label}" es manual y dura más de 2 horas — considera descomponer.`, target: n.id });
        }

        // R11: contradicción tipo automático con responsable humano
        if (n.executionType === 'automatic' && n.owner && !/sistema|bot|auto/i.test(n.owner)) {
          issues.push({ sev: 'low', title: 'Automático con responsable humano', detail: `"${label}" es automática pero tiene responsable "${n.owner}". ¿Es correcto?`, target: n.id });
        }
      }

      // R12: gateway sin "?"
      if (n.type === 'decision') {
        if (label && !label.startsWith('¿') && !label.endsWith('?')) {
          issues.push({ sev: 'medium', title: 'Gateway sin pregunta', detail: `"${label}" debe formularse como pregunta cerrada (¿Sí/No?) o ramificación (¿Qué tipo?).`, target: n.id });
        }
      }

      // R13: actividad huérfana
      if (n.type !== 'start' && (inDeg[n.id] || 0) === 0) {
        issues.push({ sev: 'critical', title: 'Nodo sin entrada', detail: `"${label || n.id}" no tiene conexión entrante. Conecta o elimina.`, target: n.id });
      }
      if (n.type !== 'end' && (outDeg[n.id] || 0) === 0) {
        issues.push({ sev: 'critical', title: 'Nodo sin salida', detail: `"${label || n.id}" no tiene conexión saliente. Conecta o márcalo como Fin.`, target: n.id });
      }
    });

    // R14: gateway con salidas sin etiquetar
    nodes.filter(n => n.type === 'decision').forEach(g => {
      const out = edges.filter(e => e.from === g.id);
      if (out.length >= 2) {
        const unlabeled = out.filter(e => !e.label || !e.label.trim()).length;
        if (unlabeled > 0) issues.push({ sev: 'medium', title: `Gateway con ${unlabeled} salida(s) sin etiquetar`, detail: `"${g.label}" — etiqueta cada salida (Sí/No o valor específico).`, target: g.id });
      }
      if (out.length > 4) issues.push({ sev: 'low', title: 'Gateway con >4 salidas', detail: `"${g.label}" tiene ${out.length} salidas. Considera descomponer o usar subproceso.`, target: g.id });
    });

    // R15: cantidad de nodos
    if (nodes.length > 15) {
      issues.push({ sev: 'low', title: `Proceso con ${nodes.length} nodos`, detail: 'Más de 15 nodos visibles → considera extraer secciones a subprocesos.' });
    }
    if (nodes.length < 3) {
      issues.push({ sev: 'low', title: 'Proceso muy simple', detail: 'Menos de 3 nodos. ¿Falta detalle?' });
    }

    // R16: roles únicos (sugerir swimlanes)
    const roles = [...new Set(nodes.map(n => n.owner).filter(Boolean))];
    if (roles.length > 6) {
      issues.push({ sev: 'low', title: `${roles.length} roles distintos`, detail: 'Considera agrupar roles o dividir el proceso para mejorar claridad.' });
    }

    return issues;
  }

  function runLinter() {
    const issues = lintProcess();
    renderLintPanel(issues);
    const critHigh = issues.filter(i => i.sev === 'critical' || i.sev === 'high').length;
    const badge = $('#lintBadge');
    if (!badge) return;
    if (issues.length === 0) {
      badge.hidden = true;
      badge.textContent = '';
    } else {
      badge.hidden = false;
      badge.textContent = issues.length;
      badge.style.background = critHigh > 0 ? 'var(--danger)' : 'var(--warning)';
    }
  }

  function renderLintPanel(issues) {
    const list = $('#lintList');
    const score = $('#lintScore');
    if (!list || !score) return;

    if (state.nodes.length === 0) {
      list.innerHTML = '<div class="panel-hint">Genera o dibuja un proceso para validar.</div>';
      score.innerHTML = '';
      return;
    }

    if (issues.length === 0) {
      list.innerHTML = '<div class="lint-empty">¡Cero issues! El proceso cumple el playbook MBB.</div>';
      score.className = 'lint-score good';
      score.innerHTML = '<div><div class="score-num">100</div><div class="score-detail">Score MBB · sin issues</div></div>';
      return;
    }

    // Score: 100 - 15*crit - 8*high - 3*medium - 1*low (mín 0)
    const c = { critical: 0, high: 0, medium: 0, low: 0 };
    issues.forEach(i => c[i.sev]++);
    const scoreVal = Math.max(0, 100 - 15 * c.critical - 8 * c.high - 3 * c.medium - 1 * c.low);
    const cls = scoreVal >= 80 ? 'good' : (scoreVal >= 50 ? 'warn' : 'bad');
    score.className = 'lint-score ' + cls;
    score.innerHTML = `
      <div><div class="score-num">${scoreVal}</div><div class="score-detail">Score MBB</div></div>
      <div style="flex:1;text-align:right">
        <div style="display:flex;gap:6px;justify-content:flex-end;margin-bottom:3px">
          ${c.critical ? `<span class="sev-tag sev-critical">${c.critical} crit</span>` : ''}
          ${c.high ? `<span class="sev-tag sev-high">${c.high} alto</span>` : ''}
          ${c.medium ? `<span class="sev-tag sev-medium">${c.medium} medio</span>` : ''}
          ${c.low ? `<span class="sev-tag sev-low">${c.low} bajo</span>` : ''}
        </div>
        <div class="score-detail">${issues.length} issue${issues.length === 1 ? '' : 's'} detectado${issues.length === 1 ? '' : 's'}</div>
      </div>`;

    // Ordena por severidad
    const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const sorted = issues.slice().sort((a, b) => sevOrder[a.sev] - sevOrder[b.sev]);
    const icons = { critical: '✕', high: '!', medium: '⚠', low: 'ⓘ' };

    list.innerHTML = sorted.map(i => `
      <div class="lint-item sev-${i.sev}" data-target="${i.target || ''}">
        <div class="lint-icon">${icons[i.sev]}</div>
        <div class="lint-body">
          <div class="lint-title">${escapeHtml(i.title)}</div>
          <div class="lint-detail">${escapeHtml(i.detail)}</div>
          ${i.target ? '<div class="lint-target">→ click para ir al nodo</div>' : ''}
        </div>
      </div>`).join('');

    list.querySelectorAll('.lint-item[data-target]').forEach(el => {
      const tid = el.dataset.target;
      if (!tid) return;
      el.addEventListener('click', () => {
        state.selectedNodeId = tid;
        state.selectedEdgeId = null;
        activateTab('properties');
        render();
      });
    });
  }

  // ============================================================
  // COMPARADOR As-Is / To-Be
  // ============================================================
  function setView(view) {
    if (view === state.activeView) return;
    // Snapshot del view activo antes de cambiar
    state._views[state.activeView] = {
      nodes: JSON.parse(JSON.stringify(state.nodes)),
      edges: JSON.parse(JSON.stringify(state.edges))
    };
    state.activeView = view;
    const target = state._views[view];
    if (target) {
      state.nodes = target.nodes;
      state.edges = target.edges;
    } else {
      state.nodes = [];
      state.edges = [];
    }
    state.selectedNodeId = null;
    state.selectedEdgeId = null;
    updateViewUi();
    persist();
    render();
  }

  function updateViewUi() {
    document.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === state.activeView));
    let ind = document.getElementById('tobeIndicator');
    if (state.activeView === 'tobe') {
      if (!ind) {
        ind = document.createElement('div');
        ind.id = 'tobeIndicator';
        ind.className = 'tobe-indicator';
        ind.textContent = 'TO-BE · REINGENIERÍA';
        $('#canvasWrapper').appendChild(ind);
      }
    } else if (ind) ind.remove();
  }

  function cloneAsIsToToBe() {
    if (state.nodes.length === 0 && state.activeView === 'asis') {
      alert('Genera o dibuja un proceso As-Is primero.');
      return;
    }
    // Garantiza que el as-is actual esté guardado
    if (state.activeView === 'asis') {
      state._views.asis = {
        nodes: JSON.parse(JSON.stringify(state.nodes)),
        edges: JSON.parse(JSON.stringify(state.edges))
      };
    } else if (!state._views.asis) {
      alert('No hay un As-Is que clonar.');
      return;
    }
    // Clona profundo
    state._views.tobe = JSON.parse(JSON.stringify(state._views.asis));
    setView('tobe');
    activateTab('copilot');
    copilotPost('ai',
      `Cloné el As-Is al To-Be. Ahora puedes editar el flujo sin afectar el original.\n\n` +
      `**Sugerencias de reingeniería rápidas:**\n` +
      `• Elimina nodos de control duplicado.\n` +
      `• Marca actividades manuales como **sistema** (automatización).\n` +
      `• Une handoffs en una célula multifuncional.\n` +
      `• Mueve decisiones a reglas codificadas (DMN).\n\n` +
      `Cuando termines, exporta a PPTX — incluiré un slide comparativo lado a lado.`);
  }

  // ============================================================
  // TRANSFORMAR A TO-BE por nivel (Operativo / Táctico / Estratégico)
  // Inspirado en MBC Process Disruptor: "Generar To-Be · Mantener Nivel"
  // ============================================================
  const TOBE_LEVELS = {
    operativo: {
      label: 'Operativo — Quick wins',
      desc: 'Automatiza tareas manuales repetitivas, elimina reprocesos. Cambios de bajo riesgo, 0-3 meses.'
    },
    tactico: {
      label: 'Táctico — Rediseño de flujo',
      desc: 'Elimina handoffs, paraleliza, consolida controles duplicados. 3-9 meses.'
    },
    estrategico: {
      label: 'Estratégico — Reimaginar',
      desc: 'Self-service digital, elimina pasos sin valor, repensar el proceso end-to-end. 9-18 meses.'
    }
  };

  function openTransformToBeModal() {
    const asisNodes = state.activeView === 'asis' ? state.nodes : (state._views.asis?.nodes || []);
    if (asisNodes.length === 0) { alert('Genera o dibuja un proceso As-Is primero.'); return; }
    const html = `
      <p class="panel-hint" style="margin-bottom:10px">ProcessIQ clona el As-Is y aplica palancas de reingeniería según el <strong>nivel</strong> elegido. Luego puedes editar manualmente el resultado.</p>
      <label style="display:block;margin-bottom:8px;font-size:12px;font-weight:600">Nivel de transformación
        <select id="tobeLevelSel" style="width:100%;padding:7px;border:1px solid #ddd;border-radius:6px;margin-top:3px">
          <option value="operativo">${TOBE_LEVELS.operativo.label}</option>
          <option value="tactico">${TOBE_LEVELS.tactico.label}</option>
          <option value="estrategico">${TOBE_LEVELS.estrategico.label}</option>
        </select>
      </label>
      <div id="tobeLevelDesc" class="field-hint info" style="margin-bottom:10px">${TOBE_LEVELS.operativo.desc}</div>
      <label style="display:block;font-size:12px;font-weight:600">Cambios específicos (opcional)
        <textarea id="tobeChanges" rows="3" placeholder="Ej. 'Eliminar la validación manual del paso 3', 'Añadir autoservicio en la captura'…" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;margin-top:3px;font-family:inherit"></textarea>
      </label>`;
    openModal('✨ Transformar a To-Be por nivel', html, () => {
      const level = $('#tobeLevelSel').value;
      const changes = $('#tobeChanges').value.trim();
      transformToBe(level, changes);
    });
    // Actualiza descripción al cambiar nivel
    setTimeout(() => {
      const sel = $('#tobeLevelSel');
      if (sel) sel.addEventListener('change', () => {
        $('#tobeLevelDesc').textContent = TOBE_LEVELS[sel.value].desc;
      });
    }, 50);
  }

  function transformToBe(level, changes) {
    // Asegura as-is guardado
    if (state.activeView === 'asis') {
      state._views.asis = { nodes: JSON.parse(JSON.stringify(state.nodes)), edges: JSON.parse(JSON.stringify(state.edges)) };
    }
    if (!state._views.asis) { alert('No hay As-Is que transformar.'); return; }

    // Clona profundo
    const tobe = JSON.parse(JSON.stringify(state._views.asis));
    const changeLog = [];

    if (level === 'operativo') {
      // Automatiza tareas manuales de alto volumen / repetitivas
      tobe.nodes.forEach(n => {
        if (n.type === 'task' && n.executionType === 'manual') {
          // Convierte a RPA/automático si parece rule-based (registrar, validar, calcular…)
          const lbl = (n.label || '').toLowerCase();
          if (/registr|ingres|valid|calcul|consult|verific|notific|envi|gener/.test(lbl)) {
            n.executionType = /notific|envi|correo/.test(lbl) ? 'automatic' : 'rpa';
            n.activityCode = '';  // se re-asignará
            changeLog.push(`Automatizada: "${n.label}" → ${n.executionType === 'rpa' ? 'RPA/Bot' : 'Service Task'}`);
          }
        }
      });
    } else if (level === 'tactico') {
      // Elimina handoffs: une tareas consecutivas del mismo responsable; convierte manuales en sistema
      const owners = {};
      tobe.nodes.forEach(n => { owners[n.id] = n.owner; });
      tobe.nodes.forEach(n => {
        if (n.type === 'task' && n.executionType === 'manual') {
          n.executionType = 'system';
          n.activityCode = '';
          changeLog.push(`Digitalizada: "${n.label}" → User Task (sistema)`);
        }
      });
      // Marca decisiones para codificar como reglas (DMN)
      tobe.nodes.filter(n => n.type === 'decision').forEach(d => {
        if (!/regla|dmn/i.test(d.notes || '')) {
          d.notes = (d.notes ? d.notes + ' ' : '') + '[To-Be: codificar como regla DMN]';
          changeLog.push(`Decisión "${d.label}" → regla codificada (DMN)`);
        }
      });
    } else if (level === 'estrategico') {
      // Self-service: marca tareas de captura/cliente como automáticas/IA; elimina algunos handoffs
      tobe.nodes.forEach(n => {
        if (n.type === 'task') {
          const lbl = (n.label || '').toLowerCase();
          if (/solicit|captur|ingres|registr|complet|llen/.test(lbl)) {
            n.executionType = 'automatic';
            n.activityCode = '';
            n.label = n.label.replace(/^(Solicitar|Capturar|Ingresar|Registrar|Completar|Llenar)/i, 'Autoservicio:');
            changeLog.push(`Self-service: "${n.label}"`);
          } else if (/valid|verific|evalu|analiz|diagnostic|scoring/.test(lbl)) {
            n.executionType = 'ai';
            n.activityCode = '';
            changeLog.push(`IA-assisted: "${n.label}" → Script/IA Task`);
          }
        }
      });
    }

    if (changes) changeLog.push(`Cambios manuales solicitados: ${changes}`);

    // Aplica el to-be
    state._views.tobe = tobe;
    setView('tobe');
    autoLayout();  // re-asigna códigos y layout

    activateTab('copilot');
    const lv = TOBE_LEVELS[level];
    copilotPost('ai',
      `**To-Be generado · nivel ${lv.label.split(' — ')[0]}**\n\n` +
      `${lv.desc}\n\n` +
      `**${changeLog.length} cambio(s) aplicado(s):**\n` +
      (changeLog.slice(0, 12).map(c => '• ' + c).join('\n') || '• Sin cambios automáticos — edita manualmente.') +
      (changeLog.length > 12 ? `\n• …y ${changeLog.length - 12} más.` : '') +
      `\n\nEdita manualmente cualquier nodo en Props. Exporta a PPTX para el comparativo As-Is vs To-Be.`);
  }

  // ============================================================
  // SIMULADOR de carga (FTE, lead time, costo)
  // ============================================================
  function attachSimulatorListeners() {
    $('#btnSimRun').addEventListener('click', runSimulation);
    $('#btnSimWizard').addEventListener('click', openSimWizard);
  }

  function openSimWizard() {
    const tasks = state.nodes.filter(n => n.type === 'task' || n.type === 'system');
    if (tasks.length === 0) { alert('Necesito actividades en el diagrama primero.'); return; }

    let html = `<p style="font-size:13px;margin:0 0 8px 0">Captura tiempo y volumen para cada actividad. Los verdes ya tienen datos, los amarillos están vacíos. Tab/Enter para avanzar rápido.</p>
      <div style="max-height:50vh;overflow:auto"><table class="sim-wizard-table">
        <thead><tr><th>#</th><th>Actividad</th><th>Responsable</th><th>Tiempo (min)</th><th>Volumen/mes</th></tr></thead>
        <tbody>`;
    tasks.forEach((t, i) => {
      const hasData = t.time && t.volume;
      html += `<tr class="${hasData ? 'has-data' : 'no-data'}">
        <td>${i + 1}</td>
        <td>${escapeHtml(t.label)}</td>
        <td>${escapeHtml(t.owner || '—')}</td>
        <td><input type="number" min="0" step="0.5" data-wid="${t.id}" data-wfield="time" value="${escapeHtml(t.time || '')}" placeholder="ej. 15" /></td>
        <td><input type="number" min="0" step="1" data-wid="${t.id}" data-wfield="volume" value="${escapeHtml(t.volume || '')}" placeholder="ej. 500" /></td>
      </tr>`;
    });
    html += '</tbody></table></div>';

    openModal(`⚡ Wizard de tiempos · ${tasks.length} actividades`, html, () => {
      document.querySelectorAll('.sim-wizard-table input').forEach(inp => {
        const n = getNode(inp.dataset.wid);
        if (n) n[inp.dataset.wfield] = inp.value;
      });
      persist();
      render();
      runSimulation();
      copilotPost('ai', `Capturé tiempos/volúmenes en ${tasks.length} actividades. Simulación actualizada automáticamente.`);
    });
  }

  function runSimulation() {
    if (state.nodes.length === 0) {
      $('#simResults').hidden = false;
      $('#simResults').innerHTML = '<div class="empty-state">Sin proceso. Genera o dibuja uno primero.</div>';
      return;
    }
    const cost = parseFloat($('#simCostFte').value) || 0;
    const hours = parseFloat($('#simHours').value) || 160;
    const reduction = (parseFloat($('#simReduction').value) || 0) / 100;
    const minPerMonth = hours * 60;

    let totalMinutes = 0;        // Σ tiempo × volumen mensual
    let leadTimeChain = 0;       // suma de tiempos del camino más largo (estimación)
    let activitiesWithData = 0;
    let totalVolume = 0;
    state.nodes.forEach(n => {
      if (n.type === 'task' || n.type === 'system') {
        const t = parseFloat(n.time) || 0;
        const v = parseFloat(n.volume) || 0;
        if (t > 0 && v > 0) { activitiesWithData++; totalMinutes += t * v; totalVolume += v; }
        leadTimeChain += t; // approximación: suma lineal
      }
    });

    const fteCurrent = totalMinutes / minPerMonth;
    const monthlyCost = fteCurrent * cost;
    const fteToBe = fteCurrent * (1 - reduction);
    const monthlySavings = (fteCurrent - fteToBe) * cost;
    const annualSavings = monthlySavings * 12;

    const fmtN = (n) => isFinite(n) ? n.toLocaleString('es-PE', { maximumFractionDigits: 1 }) : '—';
    const fmtCur = (n) => isFinite(n) ? n.toLocaleString('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 }) : '—';

    state._simResults = { fteCurrent, fteToBe, monthlyCost, monthlySavings, annualSavings, leadTimeChain, activitiesWithData };

    $('#simResults').hidden = false;
    $('#simResults').innerHTML = `
      ${activitiesWithData === 0 ? '<div class="empty-state" style="color:#C62828">⚠ Ninguna actividad tiene tiempo y volumen. Completa esos campos en Props.</div>' : ''}
      <div class="sim-metric"><span class="label">Actividades con datos</span><span class="value">${activitiesWithData} / ${state.nodes.length}</span></div>
      <div class="sim-metric"><span class="label">Esfuerzo total / mes</span><span class="value">${fmtN(totalMinutes / 60)} h</span></div>
      <div class="sim-metric highlight"><span class="label">FTE actual</span><span class="value">${fmtN(fteCurrent)}</span></div>
      <div class="sim-metric"><span class="label">Lead time del flujo (suma)</span><span class="value">${fmtN(leadTimeChain)} min</span></div>
      <div class="sim-metric"><span class="label">Costo mensual de operación</span><span class="value">${fmtCur(monthlyCost)}</span></div>
      <div class="sim-metric"><span class="label">FTE to-be (-${Math.round(reduction*100)}%)</span><span class="value">${fmtN(fteToBe)}</span></div>
      <div class="sim-savings">
        Ahorro anual estimado
        <span class="big">${fmtCur(annualSavings)}</span>
        <span style="font-size:11px;opacity:0.9">${fmtN((fteCurrent - fteToBe))} FTE liberados</span>
      </div>`;
  }

  // ============================================================
  // RACI matrix (modal)
  // ============================================================
  function generateRaci() {
    const tasks = state.nodes.filter(n => n.type === 'task' || n.type === 'system' || n.type === 'decision');
    if (tasks.length === 0) { copilotPost('ai', 'Necesito actividades en el diagrama para generar RACI.'); return; }

    // Roles únicos detectados en owner; si no hay, usar genéricos
    let roles = [...new Set(tasks.map(t => t.owner).filter(Boolean))];
    if (roles.length === 0) roles = ['Frontline', 'Back Office', 'Gerencia', 'Sistemas'];

    // Inicia matriz
    state._raci = state._raci || {};
    tasks.forEach(t => {
      state._raci[t.id] = state._raci[t.id] || {};
      roles.forEach(r => {
        if (!state._raci[t.id][r]) {
          state._raci[t.id][r] = (t.owner === r) ? 'R/A' : '';
        }
      });
    });

    let html = '<table class="raci-table"><thead><tr><th>Actividad</th>';
    roles.forEach(r => html += `<th>${escapeHtml(r)}</th>`);
    html += '</tr></thead><tbody>';
    tasks.forEach(t => {
      html += `<tr><td>${escapeHtml(t.label)}</td>`;
      roles.forEach(r => {
        const val = state._raci[t.id][r] || '';
        html += `<td class="cell-center"><select class="raci-pick" data-tid="${t.id}" data-role="${escapeHtml(r)}">
          <option value="">—</option>
          <option value="R" ${val==='R'?'selected':''}>R · Responsable</option>
          <option value="A" ${val==='A'?'selected':''}>A · Accountable</option>
          <option value="R/A" ${val==='R/A'?'selected':''}>R/A</option>
          <option value="C" ${val==='C'?'selected':''}>C · Consulta</option>
          <option value="I" ${val==='I'?'selected':''}>I · Informado</option>
        </select></td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table><p class="panel-hint" style="margin-top:8px">R=Responsable · A=Accountable · C=Consultado · I=Informado. La matriz se exportará al PPTX automáticamente.</p>';

    openModal('Matriz RACI · ' + (state.meta.name || 'Proceso'), html, () => {
      // Captura cambios
      document.querySelectorAll('.raci-pick').forEach(sel => {
        const tid = sel.dataset.tid, role = sel.dataset.role;
        state._raci[tid] = state._raci[tid] || {};
        state._raci[tid][role] = sel.value;
      });
      persist();
      copilotPost('ai', `Matriz RACI guardada con ${tasks.length} actividades × ${roles.length} roles. Se incluirá en el próximo export PPTX.`);
    });
  }

  // ============================================================
  // SIPOC (modal)
  // ============================================================
  function generateSipoc() {
    if (state.nodes.length === 0) { copilotPost('ai', 'Genera o dibuja un proceso primero.'); return; }
    const dataNodes = state.nodes.filter(n => n.type === 'data' || n.type === 'document');
    const startNode = state.nodes.find(n => n.type === 'start');
    const endNode = state.nodes.find(n => n.type === 'end');
    const owners = [...new Set(state.nodes.map(n => n.owner).filter(Boolean))];
    const systems = [...new Set(state.nodes.map(n => n.system).filter(Boolean))];

    state._sipoc = state._sipoc || {
      suppliers: owners.slice(0, 3).join(', ') || 'Cliente, Proveedor',
      inputs: (dataNodes.map(d => d.label).slice(0, 4).join(', ') || 'Solicitud, Documentación'),
      process: state.meta.name || 'Proceso ProcessIQ',
      outputs: 'Resultado entregado, Notificación al cliente',
      customers: 'Cliente final, Áreas internas'
    };

    const s = state._sipoc;
    const html = `
      <table class="sipoc-table">
        <thead><tr><th>Supplier</th><th>Input</th><th>Process</th><th>Output</th><th>Customer</th></tr></thead>
        <tbody><tr>
          <td><textarea data-sipoc="suppliers" rows="4" style="width:100%;border:1px solid #ddd;border-radius:3px;padding:4px">${escapeHtml(s.suppliers)}</textarea></td>
          <td><textarea data-sipoc="inputs" rows="4" style="width:100%;border:1px solid #ddd;border-radius:3px;padding:4px">${escapeHtml(s.inputs)}</textarea></td>
          <td><textarea data-sipoc="process" rows="4" style="width:100%;border:1px solid #ddd;border-radius:3px;padding:4px">${escapeHtml(s.process)}</textarea></td>
          <td><textarea data-sipoc="outputs" rows="4" style="width:100%;border:1px solid #ddd;border-radius:3px;padding:4px">${escapeHtml(s.outputs)}</textarea></td>
          <td><textarea data-sipoc="customers" rows="4" style="width:100%;border:1px solid #ddd;border-radius:3px;padding:4px">${escapeHtml(s.customers)}</textarea></td>
        </tr></tbody>
      </table>
      <p class="panel-hint" style="margin-top:8px">SIPOC pre-llenado desde el diagrama (roles, data nodes). Edita libremente. Se incluirá en el PPTX.</p>`;

    openModal('SIPOC · ' + (state.meta.name || 'Proceso'), html, () => {
      document.querySelectorAll('[data-sipoc]').forEach(ta => {
        state._sipoc[ta.dataset.sipoc] = ta.value;
      });
      persist();
      copilotPost('ai', 'SIPOC guardado. Se exportará junto al PPTX.');
    });
  }

  // ============================================================
  // Matriz Impacto-Esfuerzo de pains
  // ============================================================
  function generateImpactEffort() {
    const allPains = [];
    state.nodes.forEach(n => (n.pains || []).forEach(p => allPains.push({ ...p, activity: n.label })));
    if (allPains.length === 0) { copilotPost('ai', 'Captura pains primero (selecciona un nodo → tab Pains).'); return; }

    // Esfuerzo estimado: si categoría incluye sistema/regulatorio → alto; manual/handoff → bajo
    const effortMap = { system: 4, regulatory: 5, control: 3, data: 3, handoff: 2, manual: 2, wait: 2, rework: 2 };

    let html = `<svg viewBox="0 0 400 320" style="width:100%;background:#FAFAFA;border:1px solid #ddd">
      <line x1="40" y1="290" x2="380" y2="290" stroke="#999" stroke-width="1"/>
      <line x1="40" y1="20" x2="40" y2="290" stroke="#999" stroke-width="1"/>
      <line x1="210" y1="20" x2="210" y2="290" stroke="#ccc" stroke-dasharray="3 3"/>
      <line x1="40" y1="155" x2="380" y2="155" stroke="#ccc" stroke-dasharray="3 3"/>
      <text x="125" y="15" font-size="10" text-anchor="middle" fill="#2E7D32">QUICK WINS</text>
      <text x="295" y="15" font-size="10" text-anchor="middle" fill="#1565C0">PROYECTOS ESTRATÉGICOS</text>
      <text x="125" y="310" font-size="10" text-anchor="middle" fill="#999">FILL-INS</text>
      <text x="295" y="310" font-size="10" text-anchor="middle" fill="#C62828">RECONSIDERAR</text>
      <text x="210" y="305" font-size="9" text-anchor="middle" fill="#666">→ Esfuerzo</text>
      <text x="15" y="155" font-size="9" text-anchor="middle" fill="#666" transform="rotate(-90 15 155)">→ Impacto</text>`;

    allPains.forEach((p, i) => {
      const impact = (p.severity * p.frequency) / 25; // 0..1
      const effort = (effortMap[p.category] || 3) / 5;  // 0..1
      const x = 40 + effort * 340;
      const y = 290 - impact * 270;
      html += `<circle cx="${x}" cy="${y}" r="${6 + impact * 8}" fill="#FF4713" opacity="0.7" stroke="#fff" stroke-width="1.5"/>
               <text x="${x}" y="${y + 3}" font-size="10" text-anchor="middle" fill="white" font-weight="700">${i + 1}</text>`;
    });

    html += '</svg><div style="margin-top:12px"><strong>Leyenda</strong><ol style="margin:4px 0;padding-left:20px;font-size:12px">';
    allPains.forEach(p => {
      html += `<li><strong>${escapeHtml(p.activity)}</strong>: ${escapeHtml(p.description)} <span style="color:#FF4713">(sev ${p.severity} · frec ${p.frequency})</span></li>`;
    });
    html += '</ol></div>';

    state._impactEffort = allPains;
    openModal('Matriz Impacto · Esfuerzo · ' + allPains.length + ' pains', html, () => {
      copilotPost('ai', `Matriz impacto-esfuerzo lista con ${allPains.length} oportunidades. Quick wins (alto impacto / bajo esfuerzo) = candidatos para fase 0-3 meses.`);
    });
  }

  // ============================================================
  // ANALÍTICA AVANZADA (F1-F4) — benchmark 2026
  // ============================================================

  // Helper: simulación pura sobre un set de nodos (sin tocar el DOM)
  function computeSimOn(nodes, reductionPct) {
    const cost = parseFloat($('#simCostFte')?.value) || 5000;
    const hours = parseFloat($('#simHours')?.value) || 160;
    const minPerMonth = hours * 60;
    let totalMin = 0, leadTime = 0, withData = 0;
    nodes.forEach(n => {
      if (n.type === 'task' || n.type === 'system') {
        const t = parseFloat(n.time) || 0, v = parseFloat(n.volume) || 0;
        if (t > 0 && v > 0) { withData++; totalMin += t * v; }
        leadTime += t;
      }
    });
    const fte = totalMin / minPerMonth;
    const fteToBe = fte * (1 - (reductionPct || 0) / 100);
    return {
      fte, fteToBe, leadTime, withData,
      monthlyCost: fte * cost,
      annualSavings: (fte - fteToBe) * cost * 12
    };
  }

  // F3 — Cuello de botella + ruta crítica
  function analyzeBottleneck() {
    const tasks = state.nodes.filter(n => n.type === 'task' || n.type === 'system');
    if (tasks.length === 0) { copilotPost('ai', 'No hay actividades para analizar.'); return; }

    // Carga por actividad = tiempo × volumen (minutos/mes). El mayor = cuello.
    const withLoad = tasks.map(n => ({
      n, load: (parseFloat(n.time) || 0) * (parseFloat(n.volume) || 0), time: parseFloat(n.time) || 0
    })).filter(x => x.load > 0 || x.time > 0);

    if (withLoad.length === 0) {
      copilotPost('ai', 'Captura **tiempo** y **volumen** en las actividades (pestaña Props o wizard del simulador) para detectar el cuello de botella.');
      return;
    }

    // Cuello por carga
    withLoad.sort((a, b) => b.load - a.load);
    const bottleneck = withLoad[0];
    state._bottleneckId = bottleneck.n.id;

    // Ruta crítica = camino con mayor suma de tiempos (DFS desde start)
    const outMap = {};
    state.edges.forEach(e => { (outMap[e.from] = outMap[e.from] || []).push(e.to); });
    const timeOf = (id) => { const n = getNode(id); return n ? (parseFloat(n.time) || 0) : 0; };
    const memo = {};
    function longest(id, visited) {
      if (memo[id]) return memo[id];
      if (visited.has(id)) return { t: 0, path: [] };
      visited.add(id);
      let best = { t: timeOf(id), path: [id] };
      (outMap[id] || []).forEach(to => {
        const sub = longest(to, new Set(visited));
        if (timeOf(id) + sub.t > best.t) best = { t: timeOf(id) + sub.t, path: [id, ...sub.path] };
      });
      memo[id] = best;
      return best;
    }
    const starts = state.nodes.filter(n => n.type === 'start');
    let critical = { t: 0, path: [] };
    (starts.length ? starts : [state.nodes[0]]).forEach(s => {
      const r = longest(s.id, new Set());
      if (r.t > critical.t) critical = r;
    });
    const critLabels = critical.path.map(id => getNode(id)?.label).filter(Boolean);

    render(); // re-render para mostrar el badge de cuello

    const fmt = (n) => n.toLocaleString('es-PE', { maximumFractionDigits: 0 });
    let msg = `**🔴 Análisis de cuello de botella y ruta crítica**\n\n`;
    msg += `**Cuello de botella:** "${bottleneck.n.label}" — carga de **${fmt(bottleneck.load / 60)} h/mes** (${bottleneck.time} min × ${parseFloat(bottleneck.n.volume) || 0} casos). Es la actividad que más capacidad consume; cualquier mejora aquí tiene el mayor impacto en throughput.\n\n`;
    msg += `**Top 3 por carga:**\n` + withLoad.slice(0, 3).map((x, i) => `${i + 1}. ${x.n.label} — ${fmt(x.load / 60)} h/mes`).join('\n') + '\n\n';
    msg += `**Ruta crítica** (${fmt(critical.t)} min de lead time): ${critLabels.join(' → ')}.\n\n`;
    msg += `Recomendación: ataca primero el cuello (automatizar, paralelizar o redistribuir carga) y acorta la ruta crítica eliminando esperas/handoffs.`;
    copilotPost('ai', msg);
  }

  // F2 — Scoring de oportunidades de automatización
  function analyzeAutomation() {
    const tasks = state.nodes.filter(n => n.type === 'task' || n.type === 'system');
    if (tasks.length === 0) { copilotPost('ai', 'No hay actividades para analizar.'); return; }

    const cost = parseFloat($('#simCostFte')?.value) || 5000;
    const hours = parseFloat($('#simHours')?.value) || 160;
    const minPerMonth = hours * 60;

    // Heurística de automatización por etiqueta + tipo de ejecución
    function candidate(n) {
      const lbl = (n.label || '').toLowerCase();
      const ex = n.executionType;
      if (ex === 'automatic' || ex === 'rpa') return null; // ya automatizado
      let tech = null, autoPct = 0;
      if (/registr|ingres|carg|copiar|trasl|consolid|calcul/.test(lbl)) { tech = 'RPA'; autoPct = 0.9; }
      else if (/valid|verific|concili|comparar|revisar/.test(lbl)) { tech = 'RPA + reglas'; autoPct = 0.7; }
      else if (/escane|adjunt|extraer|leer doc|clasific/.test(lbl)) { tech = 'IDP (doc AI)'; autoPct = 0.8; }
      else if (/evalu|analiz|diagnostic|scoring|priorizar|recomend/.test(lbl)) { tech = 'IA / ML'; autoPct = 0.5; }
      else if (/notific|enviar|comunicar|email|correo/.test(lbl)) { tech = 'Workflow/email auto'; autoPct = 0.95; }
      else if (ex === 'manual') { tech = 'Workflow'; autoPct = 0.4; }
      if (!tech) return null;
      const t = parseFloat(n.time) || 0, v = parseFloat(n.volume) || 0;
      const minSaved = t * v * autoPct;
      const fteSaved = minSaved / minPerMonth;
      const annualSaving = fteSaved * cost * 12;
      const effort = tech.startsWith('IA') ? 'Alto' : (tech.startsWith('IDP') ? 'Medio-alto' : 'Bajo-medio');
      return { n, tech, autoPct, fteSaved, annualSaving, effort };
    }

    const cands = tasks.map(candidate).filter(Boolean).sort((a, b) => b.annualSaving - a.annualSaving);
    if (cands.length === 0) { copilotPost('ai', 'No detecté tareas claramente automatizables. Asegúrate de tener actividades manuales con tiempo y volumen capturados.'); return; }

    const fmtCur = (n) => n.toLocaleString('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 });
    const rows = cands.map((c, i) => `<tr>
      <td>${i + 1}</td><td>${escapeHtml(c.n.label)}</td>
      <td><b>${c.tech}</b></td>
      <td style="text-align:center">${Math.round(c.autoPct * 100)}%</td>
      <td style="text-align:center">${c.fteSaved.toFixed(2)}</td>
      <td style="text-align:right;color:#1E7E34"><b>${c.annualSaving ? fmtCur(c.annualSaving) : '—'}</b></td>
      <td style="text-align:center">${c.effort}</td>
    </tr>`).join('');
    const totalSaving = cands.reduce((a, c) => a + (c.annualSaving || 0), 0);
    const totalFte = cands.reduce((a, c) => a + c.fteSaved, 0);

    const html = `<p class="panel-hint">${cands.length} actividad(es) con potencial de automatización, ordenadas por ahorro anual estimado.</p>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <tr style="background:#232323;color:#fff"><th style="padding:5px">#</th><th style="padding:5px;text-align:left">Actividad</th><th style="padding:5px">Tecnología</th><th style="padding:5px">% auto</th><th style="padding:5px">FTE</th><th style="padding:5px">Ahorro/año</th><th style="padding:5px">Esfuerzo</th></tr>
        ${rows}
      </table>
      <div style="margin-top:12px;padding:10px;background:#E8F5E9;border-radius:6px;text-align:center">
        <b>Potencial total:</b> ${totalFte.toFixed(1)} FTE liberados · <b style="color:#1E7E34">${fmtCur(totalSaving)}/año</b>
      </div>`;
    openModal('🤖 Oportunidades de automatización', html, () => {
      copilotPost('ai', `Detecté **${cands.length} oportunidades de automatización** con potencial de **${totalFte.toFixed(1)} FTE** y **${fmtCur(totalSaving)}/año**. Top candidato: "${cands[0].n.label}" (${cands[0].tech}). Úsalo para priorizar el roadmap de RPA/IDP/IA.`);
    });
  }

  // F4 — Análisis de variantes (desde event log)
  function analyzeVariants() {
    if (!state._variants || state._variants.length === 0) {
      copilotPost('ai', 'No hay variantes para analizar. Ingresa un **event log CSV** (📥 Ingestar → Event Log) — las variantes se calculan de los casos reales.');
      return;
    }
    const total = state._variantsTotalCases || state._variants.reduce((a, v) => a + v.count, 0);
    const top = state._variants.slice(0, 10);
    const happyPath = state._variants[0];
    const exceptions = state._variants.length - 1;
    const exceptionCases = total - happyPath.count;

    const rows = top.map((v, i) => `<tr>
      <td style="text-align:center">${i + 1}</td>
      <td style="font-size:11px">${escapeHtml(v.seq.length > 90 ? v.seq.slice(0, 88) + '…' : v.seq)}</td>
      <td style="text-align:center">${v.steps}</td>
      <td style="text-align:center"><b>${v.count}</b></td>
      <td style="text-align:center;color:#FF4713"><b>${v.pct}%</b></td>
    </tr>`).join('');
    const html = `<p class="panel-hint"><b>${state._variants.length} variantes</b> en ${total} casos. La variante #1 es el "happy path"; las demás son excepciones/reprocesos — fuente directa de pains.</p>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <tr style="background:#232323;color:#fff"><th style="padding:5px">#</th><th style="padding:5px;text-align:left">Secuencia</th><th style="padding:5px">Pasos</th><th style="padding:5px">Casos</th><th style="padding:5px">%</th></tr>
        ${rows}
      </table>
      <div style="margin-top:12px;padding:10px;background:#FEF3C7;border-radius:6px">
        <b>Happy path:</b> ${happyPath.pct}% de los casos (${happyPath.count}). <b>Excepciones:</b> ${exceptions} variantes cubren el ${Math.round(exceptionCases / total * 100)}% restante — revisar para estandarizar y reducir reprocesos.
      </div>`;
    openModal('🔀 Análisis de variantes', html, () => {
      copilotPost('ai', `**${state._variants.length} variantes** detectadas. El happy path cubre ${happyPath.pct}% de los casos; el resto son excepciones (candidatas a estandarización). Mientras más variantes, mayor variabilidad e indisciplina del proceso.`);
    });
  }

  // F5 — Mapa de valor Lean (VA / BVA / NVA)
  function toggleValueMap() {
    const tasks = state.nodes.filter(n => n.type === 'task' || n.type === 'system');
    if (tasks.length === 0) { copilotPost('ai', 'No hay actividades para mapear.'); return; }
    state._valueMode = !state._valueMode;
    render();
    if (!state._valueMode) { copilotPost('ai', 'Mapa de valor desactivado — vuelve a colores por tipo de tarea.'); return; }

    // Reparto de tiempo por categoría de valor
    let tVA = 0, tBVA = 0, tNVA = 0, tNA = 0, total = 0;
    tasks.forEach(n => {
      const t = (parseFloat(n.time) || 0) * (parseFloat(n.volume) || 1);
      total += t || 1;
      if (n.va === 'VA') tVA += t || 1;
      else if (n.va === 'BVA') tBVA += t || 1;
      else if (n.va === 'NVA') tNVA += t || 1;
      else tNA += t || 1;
    });
    const pct = (x) => total ? Math.round(x / total * 100) : 0;
    const nvaCount = tasks.filter(n => n.va === 'NVA').length;
    const unclass = tasks.filter(n => !n.va).length;

    let msg = `**♻ Mapa de valor Lean activado** (verde=VA · amarillo=BVA · rojo=NVA · gris=sin clasificar)\n\n`;
    msg += `**Reparto de carga por valor:**\n`;
    msg += `• 🟢 Valor Añadido (VA): **${pct(tVA)}%**\n`;
    msg += `• 🟡 Necesario sin valor (BVA): **${pct(tBVA)}%**\n`;
    msg += `• 🔴 Desperdicio (NVA): **${pct(tNVA)}%** — ${nvaCount} actividad(es)\n`;
    if (unclass) msg += `• ⚪ Sin clasificar: ${pct(tNA)}% (${unclass} actividades — asigna VA/BVA/NVA en Props)\n`;
    msg += `\n**Diagnóstico Lean:** ${pct(tNVA) >= 30 ? 'Alto desperdicio — prioriza eliminar/automatizar las actividades NVA.' : (pct(tNVA) > 0 ? 'Desperdicio moderado — revisa las actividades NVA.' : 'Sin desperdicio clasificado. Asigna VA/BVA/NVA para el análisis Lean.')}\n\nVuelve a pulsar para desactivar el mapa.`;
    copilotPost('ai', msg);
  }

  // F6 — Backlog de iniciativas auto-generado (consolida pains + automatización + gaps KPI)
  function generateBacklog() {
    const items = [];
    const cost = parseFloat($('#simCostFte')?.value) || 5000;
    const hours = parseFloat($('#simHours')?.value) || 160;
    const minPerMonth = hours * 60;

    // 1) De pain points
    const effortMap = { system: 4, regulatory: 5, control: 3, data: 3, handoff: 2, manual: 2, wait: 2, rework: 2 };
    state.nodes.forEach(n => (n.pains || []).forEach(p => {
      const impact = p.severity * p.frequency; // 1..25
      const effort = effortMap[p.category] || 3; // 1..5
      items.push({
        fuente: 'Pain', iniciativa: `Resolver: ${p.description}`, actividad: n.label,
        impacto: impact, esfuerzo: effort,
        horizonte: (impact >= 12 && effort <= 2) ? '0-3m' : (effort >= 4 ? '9-18m' : '3-9m'),
        owner: n.owner || 'Por asignar',
        beneficio: impact >= 16 ? 'Alto' : (impact >= 9 ? 'Medio' : 'Bajo')
      });
    }));

    // 2) De oportunidades de automatización
    state.nodes.filter(n => n.type === 'task' && n.executionType === 'manual').forEach(n => {
      const lbl = (n.label || '').toLowerCase();
      let tech = null, autoPct = 0;
      if (/registr|ingres|carg|consolid|calcul/.test(lbl)) { tech = 'RPA'; autoPct = 0.9; }
      else if (/valid|verific|concili|comparar/.test(lbl)) { tech = 'RPA+reglas'; autoPct = 0.7; }
      else if (/escane|adjunt|clasific/.test(lbl)) { tech = 'IDP'; autoPct = 0.8; }
      else if (/evalu|analiz|scoring/.test(lbl)) { tech = 'IA'; autoPct = 0.5; }
      else if (/notific|enviar|correo/.test(lbl)) { tech = 'Workflow'; autoPct = 0.95; }
      if (!tech) return;
      const saved = (parseFloat(n.time) || 0) * (parseFloat(n.volume) || 0) * autoPct;
      const annual = (saved / minPerMonth) * cost * 12;
      items.push({
        fuente: 'Automatización', iniciativa: `Automatizar "${n.label}" con ${tech}`, actividad: n.label,
        impacto: Math.min(25, Math.round(annual / 5000)), esfuerzo: tech.startsWith('IA') ? 4 : (tech === 'IDP' ? 3 : 2),
        horizonte: tech.startsWith('IA') ? '9-18m' : '0-3m', owner: n.owner || 'TI / RPA',
        beneficio: annual ? annual.toLocaleString('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 }) + '/año' : 'Medio'
      });
    });

    // 3) De gaps de KPI
    Object.values(state._kpiValues || {}).forEach(k => {
      if (k.gap && k.gap !== '—') items.push({
        fuente: 'KPI', iniciativa: `Cerrar gap de ${k.name} (${k.value} vs ${k.benchmark})`, actividad: '—',
        impacto: 14, esfuerzo: 3, horizonte: '3-9m', owner: 'Dueño del KPI', beneficio: 'Gap: ' + k.gap
      });
    });

    if (items.length === 0) { copilotPost('ai', 'No hay insumos para el backlog. Captura pains, ten actividades manuales o KPIs con gap.'); return; }

    // Prioriza: ratio impacto/esfuerzo desc
    items.sort((a, b) => (b.impacto / b.esfuerzo) - (a.impacto / a.esfuerzo));
    items.forEach((it, i) => it.prioridad = i + 1);
    state._backlog = items;

    const fuenteColor = { 'Pain': '#B91C1C', 'Automatización': '#1E7E34', 'KPI': '#1E5BAA' };
    const rows = items.map(it => `<tr>
      <td style="text-align:center">${it.prioridad}</td>
      <td><span style="color:${fuenteColor[it.fuente]};font-weight:600">${it.fuente}</span></td>
      <td>${escapeHtml(it.iniciativa.length > 60 ? it.iniciativa.slice(0, 58) + '…' : it.iniciativa)}</td>
      <td style="text-align:center">${it.impacto}</td>
      <td style="text-align:center">${it.esfuerzo}</td>
      <td style="text-align:center"><b>${it.horizonte}</b></td>
      <td>${escapeHtml(it.owner)}</td>
      <td style="font-size:11px">${escapeHtml(String(it.beneficio))}</td>
    </tr>`).join('');
    const html = `<p class="panel-hint">${items.length} iniciativas consolidadas de pains, automatización y gaps de KPI, priorizadas por ratio impacto/esfuerzo.</p>
      <div style="max-height:50vh;overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">
        <tr style="background:#232323;color:#fff;position:sticky;top:0"><th style="padding:5px">#</th><th style="padding:5px">Fuente</th><th style="padding:5px;text-align:left">Iniciativa</th><th style="padding:5px">Imp</th><th style="padding:5px">Esf</th><th style="padding:5px">Horizonte</th><th style="padding:5px">Owner</th><th style="padding:5px">Beneficio</th></tr>
        ${rows}
      </table></div>
      <div style="margin-top:10px;text-align:right"><button id="blExportBtn" class="btn btn-ghost btn-mini">⤓ Exportar backlog (CSV)</button></div>`;
    openModal(`📋 Backlog de iniciativas · ${items.length}`, html, () => {
      copilotPost('ai', `**Backlog de ${items.length} iniciativas** generado y priorizado. ${items.filter(i => i.horizonte === '0-3m').length} quick wins (0-3m). Fuentes: ${items.filter(i => i.fuente === 'Pain').length} pains, ${items.filter(i => i.fuente === 'Automatización').length} automatización, ${items.filter(i => i.fuente === 'KPI').length} KPI. Úsalo como roadmap de transformación.`);
    });
    // Botón de export CSV dentro del modal
    setTimeout(() => {
      const b = $('#blExportBtn');
      if (b) b.addEventListener('click', exportBacklogCsv);
    }, 50);
  }

  function exportBacklogCsv() {
    if (!state._backlog) return;
    const head = ['Prioridad', 'Fuente', 'Iniciativa', 'Impacto', 'Esfuerzo', 'Horizonte', 'Owner', 'Beneficio'];
    const esc = s => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
    const lines = [head.join(',')].concat(state._backlog.map(it =>
      [it.prioridad, it.fuente, it.iniciativa, it.impacto, it.esfuerzo, it.horizonte, it.owner, it.beneficio].map(esc).join(',')));
    download('﻿' + lines.join('\n'), filename('csv').replace('.csv', '_backlog.csv'), 'text/csv;charset=utf-8');
  }

  // F1 — Comparador de escenarios What-If
  const WHATIF_LEVERS = {
    autom_manual:   { label: 'Automatizar tareas manuales rule-based', apply: (nodes) => nodes.forEach(n => { if (n.type === 'task' && n.executionType === 'manual' && /registr|ingres|valid|calcul|consult|verific|notific/.test((n.label || '').toLowerCase())) { n.executionType = 'rpa'; } }) },
    elim_handoff:   { label: 'Eliminar handoffs (−20% lead time)', factor: 0.8 },
    parallel:       { label: 'Paralelizar pasos (−25% lead time)', factor: 0.75 },
    selfservice:    { label: 'Self-service en captura (−40% tareas de captura)', apply: (nodes) => nodes.forEach(n => { if (n.type === 'task' && /solicit|captur|ingres|registr|complet/.test((n.label || '').toLowerCase())) { n.executionType = 'automatic'; n.volume = String(Math.round((parseFloat(n.volume) || 0) * 0.6)); } }) }
  };

  function openWhatIfModal() {
    const tasks = state.nodes.filter(n => n.type === 'task' || n.type === 'system');
    if (tasks.length === 0) { copilotPost('ai', 'Genera un proceso primero.'); return; }
    const withData = tasks.filter(n => parseFloat(n.time) > 0 && parseFloat(n.volume) > 0).length;
    const dataWarn = withData === 0 ? '<div class="field-hint warn" style="margin-bottom:10px">⚠ Ninguna actividad tiene tiempo y volumen. Captura datos (wizard del simulador) para que la comparación tenga cifras.</div>' : '';
    const leverChecks = Object.entries(WHATIF_LEVERS).map(([k, l]) =>
      `<label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-weight:400;font-size:13px;text-transform:none">
        <input type="checkbox" class="wi-lever" value="${k}" style="width:auto"> ${l.label}</label>`).join('');
    const html = `${dataWarn}
      <p class="panel-hint">Selecciona las palancas para construir un <b>escenario To-Be</b> y compáralo contra el As-Is actual.</p>
      <div style="margin-bottom:12px">${leverChecks}</div>
      <label style="display:block;font-size:12px;font-weight:600">Reducción adicional de lead time esperada (%)
        <input type="number" id="wiReduction" value="0" min="0" max="80" step="5" style="width:100%;padding:7px;border:1px solid #ddd;border-radius:6px;margin-top:3px">
      </label>`;
    openModal('🔬 Comparador de escenarios What-If', html, () => {
      const levers = [...document.querySelectorAll('.wi-lever:checked')].map(c => c.value);
      const extraRed = parseFloat($('#wiReduction')?.value) || 0;
      runWhatIfComparison(levers, extraRed);
    });
  }

  function runWhatIfComparison(levers, extraReduction) {
    // As-Is base
    const asis = computeSimOn(state.nodes, 0);
    // To-Be: clona nodos, aplica palancas
    const clone = JSON.parse(JSON.stringify(state.nodes));
    let leadFactor = 1;
    levers.forEach(k => {
      const lever = WHATIF_LEVERS[k];
      if (lever.apply) lever.apply(clone);
      if (lever.factor) leadFactor *= lever.factor;
    });
    // Reducción de FTE por automatización: tareas ahora rpa/automatic no cuentan
    const tobe = computeSimOn(clone.map(n => {
      if (n.executionType === 'rpa' || n.executionType === 'automatic') return { ...n, time: '0' };
      return n;
    }), extraReduction);
    tobe.leadTime = asis.leadTime * leadFactor * (1 - extraReduction / 100);

    const fmt = (n) => isFinite(n) ? n.toLocaleString('es-PE', { maximumFractionDigits: 1 }) : '—';
    const cur = (n) => isFinite(n) ? n.toLocaleString('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 }) : '—';
    const delta = (a, b, inv) => { const d = b - a; const good = inv ? d < 0 : d > 0; return `<span style="color:${good ? '#1E7E34' : (d === 0 ? '#888' : '#B91C1C')}">${d > 0 ? '+' : ''}${fmt(d)}</span>`; };

    const fteSaved = asis.fte - tobe.fteToBe;
    const annual = fteSaved * (parseFloat($('#simCostFte')?.value) || 5000) * 12;

    const html = `<p class="panel-hint">${levers.length} palanca(s) aplicada(s). Comparación As-Is vs escenario To-Be:</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr style="background:#232323;color:#fff"><th style="padding:6px;text-align:left">Métrica</th><th style="padding:6px">As-Is</th><th style="padding:6px">To-Be</th><th style="padding:6px">Δ</th></tr>
        <tr><td style="padding:6px;border:1px solid #eee">FTE</td><td style="padding:6px;border:1px solid #eee;text-align:center">${fmt(asis.fte)}</td><td style="padding:6px;border:1px solid #eee;text-align:center">${fmt(tobe.fteToBe)}</td><td style="padding:6px;border:1px solid #eee;text-align:center">${delta(asis.fte, tobe.fteToBe, true)}</td></tr>
        <tr><td style="padding:6px;border:1px solid #eee">Lead time (min)</td><td style="padding:6px;border:1px solid #eee;text-align:center">${fmt(asis.leadTime)}</td><td style="padding:6px;border:1px solid #eee;text-align:center">${fmt(tobe.leadTime)}</td><td style="padding:6px;border:1px solid #eee;text-align:center">${delta(asis.leadTime, tobe.leadTime, true)}</td></tr>
        <tr><td style="padding:6px;border:1px solid #eee">Costo mensual</td><td style="padding:6px;border:1px solid #eee;text-align:center">${cur(asis.monthlyCost)}</td><td style="padding:6px;border:1px solid #eee;text-align:center">${cur(tobe.fteToBe * (parseFloat($('#simCostFte')?.value) || 5000))}</td><td style="padding:6px;border:1px solid #eee;text-align:center">—</td></tr>
      </table>
      <div style="margin-top:12px;padding:12px;background:linear-gradient(135deg,#FF4713,#D63A0E);color:#fff;border-radius:8px;text-align:center">
        Ahorro anual del escenario<br><span style="font-size:24px;font-weight:700">${cur(annual)}</span><br>
        <span style="font-size:11px;opacity:.9">${fmt(fteSaved)} FTE liberados · lead time −${Math.round((1 - tobe.leadTime / Math.max(asis.leadTime, 0.01)) * 100)}%</span>
      </div>`;
    openModal('🔬 Resultado What-If', html, () => {
      copilotPost('ai', `**Escenario What-If:** con ${levers.length} palanca(s), el proceso pasa de ${fmt(asis.fte)} a ${fmt(tobe.fteToBe)} FTE (ahorro ${cur(annual)}/año) y reduce lead time ~${Math.round((1 - tobe.leadTime / Math.max(asis.leadTime, 0.01)) * 100)}%. Compara varios escenarios para elegir el de mejor relación impacto/esfuerzo.`);
    });
  }

  // ============================================================
  // EXPORT BPMN 2.0 XML
  // ============================================================
  // ============================================================
  // EXPORT WORD — informe del proceso (HTML compatible con Word)
  // Inspirado en MBC Process Disruptor: "Generar Informe Word"
  // ============================================================
  function exportWord() {
    if (state.nodes.length === 0) { alert('No hay proceso para documentar.'); return; }
    const meta = state.meta;
    const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
    const MAGENTA = '#FF4713', DARK = '#232323', GRAY = '#7A7A7A';
    const fechaLarga = new Date().toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' });

    const tasks = state.nodes.filter(n => n.type === 'task' || n.type === 'system');
    const decisions = state.nodes.filter(n => n.type === 'decision');
    const ownerMap = state._lanes?.laneOf || {};
    const bpmnName = (n) => {
      const e = (window.EXECUTION_TYPES || []).find(t => t.id === n.executionType);
      return e ? e.bpmn : (n.type === 'system' ? 'User Task' : 'Task');
    };

    // ── Tabla de actividades ──
    const actRows = tasks.map((n, i) => {
      const va = n.va === 'NVA' ? '<span style="color:#B91C1C">NVA</span>' : (n.va === 'VA' ? '<span style="color:#1E7E34">VA</span>' : (n.va || '—'));
      return `<tr>
        <td style="font-family:Consolas;font-size:9pt;color:${MAGENTA}"><b>${esc(n.activityCode || '—')}</b></td>
        <td>${esc(n.label)}</td>
        <td style="font-size:9pt">${esc(bpmnName(n))}</td>
        <td>${esc(ownerMap[n.id] || n.owner || '—')}</td>
        <td>${esc(n.system || '—')}</td>
        <td style="text-align:center">${esc(n.time || '—')}</td>
        <td style="text-align:center">${va}</td>
      </tr>`;
    }).join('');

    // ── Pain points priorizados ──
    const allPains = [];
    state.nodes.forEach(n => (n.pains || []).forEach(p => allPains.push({ ...p, activity: n.label })));
    allPains.sort((a, b) => (b.severity * b.frequency) - (a.severity * a.frequency));
    const painRows = allPains.map(p => {
      const cat = (window.PAIN_CATEGORIES || []).find(c => c.id === p.category);
      return `<tr>
        <td>${esc(p.activity)}</td>
        <td>${esc(cat ? cat.label : p.category)}</td>
        <td>${esc(p.description)}</td>
        <td style="text-align:center">${p.severity}</td>
        <td style="text-align:center">${p.frequency}</td>
        <td style="text-align:center"><b>${p.severity * p.frequency}</b></td>
        <td style="font-size:9pt">${esc(typeof painImplication === 'function' ? painImplication(p) : '')}</td>
      </tr>`;
    }).join('');

    // ── KPIs sugeridos ──
    const kpis = (window.KPI_LIBRARY || [])
      .filter(k => !meta.industry || k.industry === meta.industry || k.industry === 'Transversal')
      .slice(0, 10);
    const kpiRows = kpis.map(k => `<tr>
      <td>${esc(k.name)}</td><td style="text-align:center">${esc(k.unit)}</td>
      <td>${esc(k.benchmark)}</td><td style="font-size:9pt">${esc(k.description)}</td>
    </tr>`).join('');

    // ── RACI (si existe) ──
    let raciSection = '';
    if (state._raci && Object.keys(state._raci).length > 0) {
      const roles = [...new Set(Object.values(state._raci).flatMap(r => Object.keys(r)))];
      const rtasks = state.nodes.filter(n => state._raci[n.id]);
      const head = '<th>Actividad</th>' + roles.map(r => `<th style="text-align:center">${esc(r)}</th>`).join('');
      const body = rtasks.map(t => '<tr><td>' + esc(t.label) + '</td>' +
        roles.map(r => `<td style="text-align:center"><b>${esc(state._raci[t.id][r] || '')}</b></td>`).join('') + '</tr>').join('');
      raciSection = `<h2>6. Matriz RACI</h2><table><tr>${head}</tr>${body}</table>
        <p style="font-size:9pt;color:${GRAY}">R = Responsable · A = Accountable · C = Consultado · I = Informado</p>`;
    }

    // ── SIPOC (si existe) ──
    let sipocSection = '';
    if (state._sipoc) {
      const s = state._sipoc;
      sipocSection = `<h2>7. SIPOC</h2><table>
        <tr><th>Supplier</th><th>Input</th><th>Process</th><th>Output</th><th>Customer</th></tr>
        <tr><td>${esc(s.suppliers)}</td><td>${esc(s.inputs)}</td><td>${esc(s.process)}</td><td>${esc(s.outputs)}</td><td>${esc(s.customers)}</td></tr>
      </table>`;
    }

    // ── Simulador (si existe) ──
    let simSection = '';
    if (state._simResults && state._simResults.activitiesWithData > 0) {
      const r = state._simResults;
      const fmt = (n) => isFinite(n) ? n.toLocaleString('es-PE', { maximumFractionDigits: 1 }) : '—';
      const cur = (n) => isFinite(n) ? n.toLocaleString('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 }) : '—';
      simSection = `<h2>8. Cuantificación (simulador)</h2>
        <table>
          <tr><td><b>FTE actual</b></td><td>${fmt(r.fteCurrent)}</td><td><b>FTE to-be</b></td><td>${fmt(r.fteToBe)}</td></tr>
          <tr><td><b>Costo mensual</b></td><td>${cur(r.monthlyCost)}</td><td><b>Ahorro anual estimado</b></td><td style="color:${MAGENTA}"><b>${cur(r.annualSavings)}</b></td></tr>
        </table>`;
    }

    // ── Linter / hallazgos de calidad ──
    const issues = typeof lintProcess === 'function' ? lintProcess() : [];
    const handoffs = typeof countHandoffs === 'function' ? countHandoffs() : 0;
    const manualCount = tasks.filter(n => n.executionType === 'manual').length;

    // ── Resumen ejecutivo ──
    const resumen = `El proceso <b>${esc(meta.name || 'analizado')}</b> comprende <b>${tasks.length} actividades</b> y <b>${decisions.length} punto(s) de decisión</b>, distribuidas en <b>${(state._lanes?.list || []).length} responsable(s)</b>. ` +
      `Se identificaron <b>${allPains.length} pain point(s)</b>${allPains.filter(p => p.severity >= 4).length ? ` (${allPains.filter(p => p.severity >= 4).length} críticos)` : ''} y <b>${handoffs} handoff(s)</b> inter-rol. ` +
      `<b>${manualCount}</b> actividad(es) son manuales — candidatas a automatización.`;

    const guiaImpl = `<h2>10. Guía de implementación sugerida</h2>
      <p><b>Fase 0-3 meses (Quick wins):</b> estandarizar criterios de decisión, eliminar controles duplicados, automatizar tareas manuales rule-based con RPA.</p>
      <p><b>Fase 3-9 meses (Táctico):</b> eliminar handoffs mediante célula multifuncional o workflow orquestado; codificar reglas de decisión (DMN).</p>
      <p><b>Fase 9-18 meses (Estratégico):</b> self-service digital en captura, KPIs en tiempo real, rediseño organizacional.</p>`;

    // ── Documento HTML compatible con Word ──
    const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(meta.name || 'Proceso')}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
  @page { size: A4; margin: 2cm; }
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: ${DARK}; line-height: 1.4; }
  h1 { font-size: 24pt; color: ${DARK}; margin: 0 0 4pt 0; }
  h2 { font-size: 14pt; color: ${MAGENTA}; border-bottom: 2px solid ${MAGENTA}; padding-bottom: 3pt; margin-top: 22pt; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0; font-size: 10pt; }
  th { background: ${DARK}; color: #fff; padding: 5pt 7pt; text-align: left; font-size: 9pt; }
  td { border: 1px solid #ccc; padding: 4pt 7pt; vertical-align: top; }
  tr:nth-child(even) td { background: #f7f7f7; }
  .cover { border-left: 6px solid ${MAGENTA}; padding-left: 16pt; margin-bottom: 30pt; }
  .muted { color: ${GRAY}; font-size: 10pt; }
  .tag { display:inline-block; background:${MAGENTA}; color:#fff; padding:1pt 6pt; font-size:9pt; border-radius:3pt; }
</style></head>
<body>
  <div class="cover">
    <p class="tag">MINSAIT BUSINESS CONSULTING · PERÚ</p>
    <h1>${esc(meta.name || 'Diagnóstico de Proceso')}</h1>
    <p class="muted">Industria: <b>${esc(meta.industry || '—')}</b> &nbsp;·&nbsp; Macroproceso: <b>${esc(meta.macroprocess || '—')}</b> &nbsp;·&nbsp; ${esc(fechaLarga)}</p>
    <p class="muted">Informe generado por <b>ProcessIQ</b> · Documento confidencial — uso interno</p>
  </div>

  <h2>1. Resumen ejecutivo</h2>
  <p>${resumen}</p>

  <h2>2. Ficha del proceso</h2>
  <table>
    <tr><td style="width:30%"><b>Proceso</b></td><td>${esc(meta.name || '—')}</td></tr>
    <tr><td><b>Industria</b></td><td>${esc(meta.industry || '—')}</td></tr>
    <tr><td><b>Macroproceso</b></td><td>${esc(meta.macroprocess || '—')}</td></tr>
    <tr><td><b>Actividades</b></td><td>${tasks.length} (${manualCount} manuales)</td></tr>
    <tr><td><b>Decisiones</b></td><td>${decisions.length}</td></tr>
    <tr><td><b>Responsables (swimlanes)</b></td><td>${esc((state._lanes?.list || []).join(', ') || '—')}</td></tr>
    <tr><td><b>Handoffs inter-rol</b></td><td>${handoffs}</td></tr>
    <tr><td><b>Score de calidad MBB</b></td><td>${Math.max(0, 100 - issues.reduce((a, i) => a + ({critical:15,high:8,medium:3,low:1}[i.sev] || 0), 0))} / 100</td></tr>
  </table>

  <h2>3. Actividades del proceso (BPMN)</h2>
  <table>
    <tr><th>Código</th><th>Actividad</th><th>Tipo BPMN</th><th>Responsable</th><th>Sistema</th><th>Min</th><th>VA</th></tr>
    ${actRows}
  </table>

  <h2>4. Pain points identificados</h2>
  ${allPains.length ? `<table>
    <tr><th>Actividad</th><th>Categoría</th><th>Descripción</th><th>Sev</th><th>Frec</th><th>Score</th><th>Implicancia</th></tr>
    ${painRows}
  </table>` : '<p class="muted">No se capturaron pain points en este levantamiento.</p>'}

  <h2>5. KPIs sugeridos (benchmark de industria)</h2>
  <table>
    <tr><th>KPI</th><th>Unidad</th><th>Benchmark</th><th>Descripción</th></tr>
    ${kpiRows}
  </table>

  ${raciSection}
  ${sipocSection}
  ${simSection}

  <h2>9. Diagnóstico y recomendaciones</h2>
  <p><b>Hallazgos clave:</b></p>
  <ul>
    <li>${tasks.length} actividades, ${handoffs} handoffs inter-rol, ${manualCount} actividades manuales.</li>
    <li>${allPains.length} pain points capturados${allPains.filter(p => p.severity >= 4).length ? `, ${allPains.filter(p => p.severity >= 4).length} críticos` : ''}.</li>
    <li>${issues.filter(i => i.sev === 'critical' || i.sev === 'high').length} issue(s) de calidad de modelado a resolver (ver linter).</li>
  </ul>
  <p><b>Recomendaciones priorizadas:</b></p>
  <ul>
    <li><b>Quick wins (0-3m):</b> automatizar las ${manualCount} actividades manuales rule-based; eliminar controles duplicados.</li>
    <li><b>Mediano plazo (3-9m):</b> eliminar handoffs con workflow orquestado; codificar decisiones como reglas (DMN).</li>
    <li><b>Estructural (9-18m):</b> self-service digital, dashboard de KPIs en tiempo real.</li>
  </ul>

  ${guiaImpl}

  <p class="muted" style="margin-top:30pt;border-top:1px solid #ccc;padding-top:8pt">Generado con ProcessIQ · Minsait Business Consulting · ${esc(fechaLarga)}</p>
</body></html>`;

    download('﻿' + html, filename('doc'), 'application/msword');
  }

  function exportBpmn() {
    if (state.nodes.length === 0) { alert('No hay proceso para exportar.'); return; }
    const xml = generateBpmnXml();
    download(xml, filename('bpmn'), 'application/xml');
  }

  function generateBpmnXml() {
    const procId = 'Process_' + Date.now();
    const planeId = 'Plane_' + procId;
    const meta = state.meta;
    const esc = s => String(s || '').replace(/[<>&"']/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;' }[c]));

    // Map ProcessIQ shape -> BPMN element (sin namespace; lo agregamos al construir el XML)
    const bpmnType = (t) => {
      switch (t) {
        case 'start':    return 'startEvent';
        case 'end':      return 'endEvent';
        case 'decision': return 'exclusiveGateway';
        case 'document':
        case 'data':     return 'dataStoreReference'; // válido a nivel process
        case 'system':   return 'serviceTask';
        case 'task':
        default:         return 'task';
      }
    };

    // Construye relaciones in/out por nodo para incoming/outgoing (mejora compliance BPMN)
    const incoming = {}, outgoing = {};
    state.edges.forEach(e => {
      (outgoing[e.from] = outgoing[e.from] || []).push(e.id);
      (incoming[e.to]   = incoming[e.to]   || []).push(e.id);
    });

    // ============ FLOW ELEMENTS ============
    let processBody = '';
    state.nodes.forEach(n => {
      const t = bpmnType(n.type);
      const ins = (incoming[n.id] || []).map(id => `      <bpmn:incoming>${id}</bpmn:incoming>`).join('\n');
      const outs = (outgoing[n.id] || []).map(id => `      <bpmn:outgoing>${id}</bpmn:outgoing>`).join('\n');

      let docs = '';
      if (n.pains && n.pains.length > 0) {
        const painsText = n.pains.map(p =>
          `[${p.category}|sev${p.severity}|frec${p.frequency}] ${p.description}`
        ).join(' || ');
        docs = `      <bpmn:documentation>Pains: ${esc(painsText)}</bpmn:documentation>\n`;
      }
      if (n.owner || n.system || n.time || n.volume) {
        const metaLine = `Owner: ${n.owner||'-'} | System: ${n.system||'-'} | Time(min): ${n.time||'-'} | Volume: ${n.volume||'-'}`;
        docs += `      <bpmn:documentation>${esc(metaLine)}</bpmn:documentation>\n`;
      }

      processBody += `    <bpmn:${t} id="${n.id}" name="${esc(n.label)}">\n`;
      processBody += docs;
      if (ins)  processBody += ins  + '\n';
      if (outs) processBody += outs + '\n';
      processBody += `    </bpmn:${t}>\n`;
    });

    state.edges.forEach(e => {
      processBody += `    <bpmn:sequenceFlow id="${e.id}" sourceRef="${e.from}" targetRef="${e.to}"${e.label ? ` name="${esc(e.label)}"` : ''} />\n`;
    });

    // ============ BPMN DI (visual interchange) ============
    let diShapes = '';
    state.nodes.forEach(n => {
      const isEvent = n.type === 'start' || n.type === 'end';
      diShapes += `      <bpmndi:BPMNShape id="${n.id}_di" bpmnElement="${n.id}"${isEvent ? '' : ''}>\n` +
                  `        <dc:Bounds x="${Math.round(n.x)}" y="${Math.round(n.y)}" width="${Math.round(n.w)}" height="${Math.round(n.h)}" />\n` +
                  `      </bpmndi:BPMNShape>\n`;
    });
    let diEdges = '';
    state.edges.forEach(e => {
      const a = getNode(e.from), b = getNode(e.to);
      if (!a || !b) return;
      const p1 = nodeCenter(a), p2 = nodeCenter(b);
      diEdges += `      <bpmndi:BPMNEdge id="${e.id}_di" bpmnElement="${e.id}">\n` +
                 `        <di:waypoint x="${Math.round(p1.x)}" y="${Math.round(p1.y)}" />\n` +
                 `        <di:waypoint x="${Math.round(p2.x)}" y="${Math.round(p2.y)}" />\n` +
                 `      </bpmndi:BPMNEdge>\n`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  id="Definitions_${procId}" targetNamespace="http://processiq.minsait/bpmn"
  exporter="ProcessIQ" exporterVersion="0.3">
  <bpmn:process id="${procId}" name="${esc(meta.name || 'Proceso ProcessIQ')}" isExecutable="false">
    <bpmn:documentation>Industria: ${esc(meta.industry)} | Macroproceso: ${esc(meta.macroprocess)}</bpmn:documentation>
${processBody}  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_${procId}">
    <bpmndi:BPMNPlane id="${planeId}" bpmnElement="${procId}">
${diShapes}${diEdges}    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
  }

  // ============================================================
  // EXPORT PPTX (pptxgenjs CDN)
  // ============================================================
  function exportPptx() {
    if (typeof PptxGenJS === 'undefined') {
      alert('La librería PPTX no se cargó (¿estás offline?). Conecta a internet o usa export SVG/PNG.');
      return;
    }
    if (state.nodes.length === 0) { alert('No hay proceso para exportar.'); return; }

    const pres = new PptxGenJS();
    pres.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 inches
    pres.title = state.meta.name || 'ProcessIQ Diagnóstico';
    pres.author = 'Minsait Business Consulting';

    const MAGENTA = 'FF4713';
    const DARK = '232323';
    const GRAY = '7A7A7A';

    // ============ SLIDE 1: PORTADA ============
    const s1 = pres.addSlide();
    s1.background = { color: 'FFFFFF' };
    s1.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.6, fill: { color: DARK } });
    s1.addShape('rect', { x: 0, y: 0.6, w: 13.33, h: 0.08, fill: { color: MAGENTA } });
    s1.addText('Minsait Business Consulting · Perú', { x: 0.4, y: 0.12, w: 8, h: 0.4, fontSize: 12, color: 'FFFFFF', fontFace: 'Calibri', bold: true });
    s1.addText('ProcessIQ', { x: 0.5, y: 1.6, w: 12, h: 1.2, fontSize: 54, color: DARK, fontFace: 'Calibri Light', bold: true });
    s1.addText(state.meta.name || 'Diagnóstico de Proceso', { x: 0.5, y: 2.9, w: 12, h: 0.8, fontSize: 28, color: MAGENTA, fontFace: 'Calibri' });
    s1.addText(`Industria: ${state.meta.industry || '—'}    ·    Macroproceso: ${state.meta.macroprocess || '—'}`, { x: 0.5, y: 3.8, w: 12, h: 0.5, fontSize: 16, color: GRAY, fontFace: 'Calibri' });
    s1.addText('Documento confidencial — uso interno', { x: 0.5, y: 6.9, w: 12, h: 0.3, fontSize: 10, color: GRAY, italic: true });

    // ============ SLIDE(S): DIAGRAMA — split en múltiples para legibilidad ============
    // Fuente adaptativa: 8pt si hay muchos actores (lanes pequeñas), 9pt si no.
    const FONT_NODE = ((state._lanes?.list || []).length > 5) ? 8 : 9;
    const FONT_EDGE = 7;            // tamaño del label de aristas
    const MIN_NODE_W_IN = 0.95;     // ancho mín de nodo en pulgadas para legibilidad a 9pt
    const SLIDE_DRAW_W = 12.6;      // ancho disponible para dibujo
    const SLIDE_DRAW_H = 6.0;       // alto disponible

    // Mapeo de owners → lanes para los slides (reutiliza state._lanes)
    const lanesData = state._lanes || null;
    const ranks = lanesData?.ranks || {};
    const laneList = lanesData?.list || [];

    // Bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    state.nodes.forEach(n => {
      minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.w); maxY = Math.max(maxY, n.y + n.h);
    });
    const srcW = Math.max(1, maxX - minX);
    const srcH = Math.max(1, maxY - minY);

    // Calcular escala que respete tamaño mínimo de nodo
    const desiredScaleByH = SLIDE_DRAW_H / srcH;
    const desiredScaleByW = SLIDE_DRAW_W / srcW;
    const fitScale = Math.min(desiredScaleByH, desiredScaleByW);

    // Si el nodo más ancho en fit-scale queda muy chico → split
    const maxNodeW = Math.max(...state.nodes.map(n => n.w));
    const nodeWAtFit = maxNodeW * fitScale;
    const needsSplit = nodeWAtFit < MIN_NODE_W_IN || srcW * desiredScaleByH > SLIDE_DRAW_W;

    // Computa scale final — FORZAR multi-slide para que cada celda tenga ancho legible (font 9pt)
    const totalRanks = lanesData?.totalRanks || 1;
    const drawableW_calc = SLIDE_DRAW_W - 0.6;
    // Menos ranks por slide cuando hay muchos actores (lanes) → cajas más grandes y legibles
    const numLanesAll = (lanesData?.list || []).length;
    const ranksPerSlice = Math.max(3, Math.min(numLanesAll > 5 ? 4 : 6, totalRanks));
    const slicesCount = Math.ceil(totalRanks / ranksPerSlice);
    const colWInches_calc = drawableW_calc / ranksPerSlice;
    // Scale per slice: cada slice cubre ranksPerSlice ranks, ocupa drawableW_calc inches
    const srcColW = state._lanes?.colW || 220;
    const sliceWPixels = ranksPerSlice * srcColW;
    const scale = Math.min(SLIDE_DRAW_H / srcH, drawableW_calc / sliceWPixels);

    const shapeKind = { task: 'rect', system: 'rect', decision: 'diamond', start: 'ellipse', end: 'ellipse', intermediate: 'ellipse', document: 'rect', data: 'parallelogram' };
    const shapeFill = { task: 'FFFFFF', system: 'ECEFF1', decision: 'FFF8E1', start: 'E8F5E9', end: 'FFEBEE', intermediate: 'FEF7E0', document: 'E3F2FD', data: 'F3E5F5' };
    const shapeBorder = { task: '414141', system: '37474F', decision: 'F9A825', start: '2E7D32', end: 'C62828', intermediate: 'B45309', document: '1565C0', data: '6A1B9A' };
    // Glyph unicode por subtipo de evento BPMN (render confiable en PowerPoint; Calibri/Segoe fallback)
    const EV_GLYPH = { message: '✉', timer: '⌛', error: '⚡', signal: '▲' };
    const MK_GLYPH = { subprocess: '⊞', loop: '↻', multiinstance: '|||', 'multiinstance-seq': '☰' };

    // Función helper: dibuja un slice del proceso en un slide
    function drawProcessSlice(slide, sliceIdx, rankStart, rankEnd) {
      // Header del slide
      slide.background = { color: 'FFFFFF' };
      slide.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.5, fill: { color: DARK } });
      slide.addShape('rect', { x: 0, y: 0.5, w: 0.15, h: 7, fill: { color: MAGENTA } });
      const subtitle = slicesCount > 1 ? ` · Parte ${sliceIdx + 1} de ${slicesCount}` : '';
      slide.addText('Mapa del proceso (As-Is)' + subtitle, { x: 0.4, y: 0.1, w: 12, h: 0.35, fontSize: 14, color: 'FFFFFF', bold: true });

      // Filtra nodos en el rango de ranks del slice
      const nodesInSlice = state.nodes.filter(n => {
        const r = ranks[n.id] || 0;
        return r >= rankStart && r < rankEnd;
      });
      if (nodesInSlice.length === 0) return;

      // Re-calcula bounding box solo de este slice
      let sMinX = Infinity, sMinY = Infinity, sMaxX = -Infinity, sMaxY = -Infinity;
      nodesInSlice.forEach(n => {
        sMinX = Math.min(sMinX, n.x); sMinY = Math.min(sMinY, n.y);
        sMaxX = Math.max(sMaxX, n.x + n.w); sMaxY = Math.max(sMaxY, n.y + n.h);
      });
      const sliceW = Math.max(1, sMaxX - sMinX);
      const sliceH = Math.max(1, sMaxY - sMinY);
      const sliceScale = Math.min(SLIDE_DRAW_H / sliceH, (SLIDE_DRAW_W - 0.6) / sliceW);
      const offX = 0.4 + ((SLIDE_DRAW_W - 0.6) - sliceW * sliceScale) / 2;
      const offY = 0.9 + (SLIDE_DRAW_H - sliceH * sliceScale) / 2;

      // Render swimlanes (bandas + labels izquierda)
      const lanesInSlice = [...new Set(nodesInSlice.map(n => state._lanes?.laneOf?.[n.id] || 'Por asignar'))];
      const orderedLanes = laneList.filter(l => lanesInSlice.includes(l));
      if (orderedLanes.length > 0) {
        const laneRowH = (SLIDE_DRAW_H - 0.2) / orderedLanes.length;
        const LANE_HEADER_W = 0.5;   // header ahora vertical (rotado) → ahorra ancho
        orderedLanes.forEach((laneName, lidx) => {
          const ly = 0.9 + lidx * laneRowH;
          // Fondo de la lane (todo el ancho)
          slide.addShape('rect', { x: 0.4, y: ly, w: SLIDE_DRAW_W - 0.4, h: laneRowH,
            fill: { color: lidx % 2 ? 'FAFAFA' : 'F4F4F4' }, line: { color: 'E0E0E0', width: 0.5 } });
          // Header sticky (vertical) en el lado izquierdo
          slide.addShape('rect', { x: 0.4, y: ly, w: LANE_HEADER_W, h: laneRowH,
            fill: { color: 'FFFFFF' }, line: { color: 'CCCCCC', width: 0.5 } });
          // Texto rotado 270° (lee de abajo hacia arriba)
          slide.addText(laneName, {
            x: 0.4, y: ly, w: LANE_HEADER_W, h: laneRowH,
            fontSize: 9, bold: true, color: '232323',
            align: 'center', valign: 'middle', fontFace: 'Calibri',
            rotate: 270, wrap: false
          });
        });
      }

      // ───── Grid de celdas: cada nodo en su rank-column × lane-row ─────
      const sliceColCount = rankEnd - rankStart;
      const cellInnerW = (SLIDE_DRAW_W - 0.4 - 0.6) / sliceColCount;  // resta header vertical (0.5) + márgenes
      const CELL_GAP_X = 0.18;
      const cellWFinal = cellInnerW - CELL_GAP_X;
      const orderedLanes2 = orderedLanes;  // alias
      const laneRowH2 = (SLIDE_DRAW_H - 0.2) / orderedLanes2.length;

      // Tamaños por tipo, ahora EN PROPORCIÓN a la celda disponible
      function cellSize(n) {
        let w = cellWFinal;
        let h;
        if (n.type === 'start' || n.type === 'end') { w = Math.min(0.7, cellWFinal * 0.5); h = w; }
        else if (n.type === 'decision') { w = cellWFinal * 0.95; h = Math.min(laneRowH2 * 0.7, 1.0); }
        else { h = Math.min(laneRowH2 * 0.72, 1.1); } // task/system grandes
        return { w, h };
      }

      // Posiciones
      const nodeBoxes = new Map();
      const stackSeen = {};
      nodesInSlice.forEach(n => {
        const owner = state._lanes?.laneOf?.[n.id] || 'Por asignar';
        const li = orderedLanes2.indexOf(owner);
        const r = (ranks[n.id] || 0) - rankStart;
        const key = li + '|' + r;
        const stackIdx = (stackSeen[key] = (stackSeen[key] === undefined ? 0 : stackSeen[key] + 1));
        const sz = cellSize(n);
        const cellX = 0.4 + 0.55 + r * cellInnerW + (cellInnerW - sz.w) / 2;
        const ly = 0.9 + li * laneRowH2;
        const baseY = ly + (laneRowH2 - sz.h) / 2;
        const stackOff = stackIdx * (sz.h * 0.5 + 0.05) - (stackIdx > 0 ? sz.h * 0.5 : 0);
        const cellY = baseY + stackOff;
        nodeBoxes.set(n.id, { x: cellX, y: cellY, w: sz.w, h: sz.h, cx: cellX + sz.w/2, cy: cellY + sz.h/2 });
      });

      // ───── Dibuja nodos ─────
      nodesInSlice.forEach(n => {
        const b = nodeBoxes.get(n.id);
        if (!b) return;
        const kind = shapeKind[n.type] || 'rect';
        const shapeOpts = {
          x: b.x, y: b.y, w: b.w, h: b.h,
          fill: { color: shapeFill[n.type] || 'FFFFFF' },
          line: { color: shapeBorder[n.type] || '414141', width: 1 }
        };
        if (kind === 'rect') shapeOpts.rectRadius = 0.08;
        slide.addShape(kind, shapeOpts);
        // Para eventos: ícono dentro + label debajo
        if (n.type === 'start' || n.type === 'end' || n.type === 'intermediate') {
          // Evento intermedio: doble anillo (anillo interior)
          if (n.type === 'intermediate') {
            slide.addShape('ellipse', { x: b.x + 0.04, y: b.y + 0.04, w: b.w - 0.08, h: b.h - 0.08,
              fill: { type: 'none' }, line: { color: shapeBorder.intermediate, width: 1 } });
          }
          // Símbolo: subtipo BPMN si lo tiene; terminate = disco; si no, ▶/■/◇
          let sym, symColor = shapeBorder[n.type], symBold = true, symSize = 12;
          if (n.type === 'end' && n.terminate) {
            // Disco de terminación (relleno)
            slide.addShape('ellipse', { x: b.x + b.w*0.28, y: b.y + b.h*0.28, w: b.w*0.44, h: b.h*0.44,
              fill: { color: shapeBorder.end }, line: { type: 'none' } });
            sym = '';
          } else if (n.eventType && EV_GLYPH[n.eventType]) {
            sym = EV_GLYPH[n.eventType]; symSize = n.eventType === 'signal' ? 11 : 12;
          } else {
            sym = n.type === 'start' ? '▶' : (n.type === 'end' ? '■' : '◆');
          }
          if (sym) {
            slide.addText(sym, { x: b.x, y: b.y, w: b.w, h: b.h,
              fontSize: symSize, color: symColor, align: 'center', valign: 'middle', bold: symBold });
          }
          // Label debajo del círculo
          if (n.label && n.label !== 'Inicio') {
            slide.addText(n.label, {
              x: b.x - 0.3, y: b.y + b.h + 0.02, w: b.w + 0.6, h: 0.3,
              fontSize: FONT_NODE, color: '232323', align: 'center', valign: 'top',
              fontFace: 'Calibri', wrap: true, autoFit: false
            });
          } else if (n.label === 'Inicio') {
            slide.addText('Inicio', { x: b.x - 0.3, y: b.y + b.h + 0.02, w: b.w + 0.6, h: 0.25,
              fontSize: FONT_NODE, color: '232323', align: 'center', fontFace: 'Calibri' });
          }
        } else if (n.type === 'task' || n.type === 'system') {
          // ── Tarea BPMN: chip de tipo + código (arriba), label (abajo) ──
          const exec = (window.EXECUTION_TYPES || []).find(t => t.id === n.executionType);
          const hasCode = !!n.activityCode;
          if (exec) {
            // Marcador BPMN: chip de color con la inicial del tipo (USR, RCV, SRV...)
            slide.addShape('roundRect', {
              x: b.x + 0.05, y: b.y + 0.05, w: 0.42, h: 0.17,
              fill: { color: exec.color.replace('#', '') }, line: { type: 'none' }, rectRadius: 0.03
            });
            slide.addText((exec.codePrefix || 'ACT'), {
              x: b.x + 0.05, y: b.y + 0.05, w: 0.42, h: 0.17,
              fontSize: 6.5, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', fontFace: 'Calibri'
            });
          }
          // Código de actividad junto al chip
          if (hasCode) {
            slide.addText('[' + n.activityCode + ']', {
              x: b.x + (exec ? 0.5 : 0.08), y: b.y + 0.04, w: b.w - 0.55, h: 0.18,
              fontSize: 7, bold: true, color: (exec ? exec.color.replace('#', '') : '6B7280'),
              align: 'left', valign: 'middle', fontFace: 'Calibri'
            });
          }
          // Label centrado en el espacio inferior (deja hueco para el marcador si lo hay)
          const hasMarker = n.marker && n.marker !== 'none' && MK_GLYPH[n.marker];
          slide.addText(n.label || '', {
            x: b.x + 0.06, y: b.y + (hasCode || exec ? 0.22 : 0.04), w: b.w - 0.12, h: b.h - (hasCode || exec ? 0.26 : 0.08) - (hasMarker ? 0.16 : 0),
            fontSize: FONT_NODE, align: 'center', valign: 'middle',
            color: '232323', fontFace: 'Calibri', wrap: true, autoFit: false
          });
          // Marcador de actividad BPMN en la base (centro inferior)
          if (hasMarker) {
            slide.addText(MK_GLYPH[n.marker], {
              x: b.x, y: b.y + b.h - 0.20, w: b.w, h: 0.18,
              fontSize: 9, color: '5B6472', align: 'center', valign: 'middle', fontFace: 'Calibri', bold: true
            });
          }
          // Evento de borde BPMN (boundary): círculo en la esquina inferior-izquierda
          if (n.boundary) {
            const bt = typeof n.boundary === 'string' ? n.boundary : (n.boundary.type || 'timer');
            const interrupting = (typeof n.boundary === 'object') ? n.boundary.interrupting !== false : true;
            const bd = 0.19, bbx = b.x - bd * 0.45, bby = b.y + b.h - bd * 0.55;
            slide.addShape('ellipse', { x: bbx, y: bby, w: bd, h: bd,
              fill: { color: 'FEF7E0' }, line: { color: 'B45309', width: 1, dashType: interrupting ? 'solid' : 'dash' } });
            slide.addText(EV_GLYPH[bt] || '⌛', { x: bbx, y: bby, w: bd, h: bd,
              fontSize: 7, color: 'B45309', align: 'center', valign: 'middle' });
          }
        } else if (n.type === 'decision' && (n.gatewayType === 'parallel' || n.gatewayType === 'inclusive')) {
          // Gateway paralelo/inclusivo: marca (＋/○) al centro + label debajo
          slide.addText(n.gatewayType === 'parallel' ? '+' : 'O', {
            x: b.x, y: b.y, w: b.w, h: b.h,
            fontSize: 20, bold: true, color: 'C68400', align: 'center', valign: 'middle', fontFace: 'Calibri'
          });
          slide.addText(n.label || '', {
            x: b.x - 0.3, y: b.y + b.h + 0.01, w: b.w + 0.6, h: 0.3,
            fontSize: FONT_NODE, align: 'center', valign: 'top', color: '232323', fontFace: 'Calibri', wrap: true, autoFit: false
          });
        } else if (n.type === 'decision') {
          // Gateway exclusivo (XOR): marca ✕ sutil al centro + label debajo
          slide.addText('✕', {
            x: b.x, y: b.y, w: b.w, h: b.h,
            fontSize: 13, bold: true, color: 'D9B441', align: 'center', valign: 'middle', fontFace: 'Calibri'
          });
          slide.addText(n.label || '', {
            x: b.x - 0.3, y: b.y + b.h + 0.01, w: b.w + 0.6, h: 0.3,
            fontSize: FONT_NODE, align: 'center', valign: 'top', color: '232323', fontFace: 'Calibri', wrap: true, autoFit: false
          });
        } else {
          // Documento / data: label centrado
          slide.addText(n.label || '', {
            x: b.x + 0.08, y: b.y + 0.04, w: b.w - 0.16, h: b.h - 0.08,
            fontSize: FONT_NODE, align: 'center', valign: 'middle',
            color: '232323', fontFace: 'Calibri', wrap: true, autoFit: false
          });
        }
        // Badge owner inferido (esquina sup-derecha para no chocar con el chip)
        if (n._inferredOwner) {
          slide.addShape('ellipse', { x: b.x + b.w - 0.14, y: b.y - 0.06, w: 0.20, h: 0.20,
            fill: { color: 'B45309' }, line: { color: 'FFFFFF', width: 1 } });
          slide.addText('!', { x: b.x + b.w - 0.14, y: b.y - 0.06, w: 0.20, h: 0.20,
            fontSize: 11, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' });
        }
      });

      // ───── Dibuja edges ortogonales (horizontal + vertical, sin diagonales) ─────
      // Helper: dibuja una L (horizontal primero, luego vertical) o solo línea recta si están alineados
      function drawOrthoEdge(slide, ax, ay, aw, ah, bx, by, bw, bh, hasArrow, label, dash) {
        const EDGE_COLOR = dash ? '888888' : '666666', EDGE_W = dash ? 0.7 : 0.85;
        const DASH = dash ? 'dash' : 'solid';
        // Puntos de salida/entrada en bordes (no centros)
        let sx, sy, tx, ty;
        const sameRow = Math.abs((ay + ah/2) - (by + bh/2)) < 0.15;
        const sameCol = Math.abs((ax + aw/2) - (bx + bw/2)) < 0.05;
        if (sameRow) {
          // Conexión horizontal
          sx = bx > ax ? ax + aw : ax;
          sy = ay + ah / 2;
          tx = bx > ax ? bx : bx + bw;
          ty = by + bh / 2;
          slide.addShape('line', {
            x: Math.min(sx, tx), y: sy, w: Math.max(Math.abs(tx - sx), 0.01), h: 0.01,
            line: { color: EDGE_COLOR, width: EDGE_W, dashType: DASH, endArrowType: hasArrow ? 'triangle' : 'none' },
            flipH: tx < sx
          });
          if (label) {
            slide.addText(label, {
              x: (sx + tx) / 2 - 0.35, y: sy - 0.15, w: 0.7, h: 0.22,
              fontSize: FONT_EDGE, color: '666666', align: 'center',
              fontFace: 'Calibri', italic: true, fill: { color: 'FFFFFF' }
            });
          }
        } else if (sameCol) {
          // Conexión vertical
          sx = ax + aw / 2;
          sy = by > ay ? ay + ah : ay;
          tx = bx + bw / 2;
          ty = by > ay ? by : by + bh;
          slide.addShape('line', {
            x: sx, y: Math.min(sy, ty), w: 0.01, h: Math.max(Math.abs(ty - sy), 0.01),
            line: { color: EDGE_COLOR, width: EDGE_W, dashType: DASH, endArrowType: hasArrow ? 'triangle' : 'none' },
            flipV: ty < sy
          });
          if (label) {
            slide.addText(label, {
              x: sx + 0.05, y: (sy + ty) / 2 - 0.11, w: 0.7, h: 0.22,
              fontSize: FONT_EDGE, color: '666666', align: 'left',
              fontFace: 'Calibri', italic: true, fill: { color: 'FFFFFF' }
            });
          }
        } else {
          // L-shape: horizontal primero (desde borde derecho de A hasta x del centro de B),
          //          luego vertical (desde ahí hasta borde superior/inferior de B)
          sx = bx > ax ? ax + aw : ax;
          sy = ay + ah / 2;
          tx = bx + bw / 2;
          ty = by > sy ? by : by + bh;
          const cornerX = tx;
          // Segmento 1: horizontal sx→cornerX
          slide.addShape('line', {
            x: Math.min(sx, cornerX), y: sy, w: Math.max(Math.abs(cornerX - sx), 0.01), h: 0.01,
            line: { color: EDGE_COLOR, width: EDGE_W, dashType: DASH, endArrowType: 'none' }
          });
          // Segmento 2: vertical cornerX,sy → tx,ty
          slide.addShape('line', {
            x: cornerX, y: Math.min(sy, ty), w: 0.01, h: Math.max(Math.abs(ty - sy), 0.01),
            line: { color: EDGE_COLOR, width: EDGE_W, dashType: DASH, endArrowType: hasArrow ? 'triangle' : 'none' },
            flipV: ty < sy
          });
          if (label) {
            slide.addText(label, {
              x: Math.min(sx, cornerX) + Math.abs(cornerX - sx) / 2 - 0.35, y: sy - 0.18, w: 0.7, h: 0.22,
              fontSize: FONT_EDGE, color: '666666', align: 'center',
              fontFace: 'Calibri', italic: true, fill: { color: 'FFFFFF' }
            });
          }
        }
      }

      state.edges.forEach(e => {
        const a = state.nodes.find(x => x.id === e.from);
        const b = state.nodes.find(x => x.id === e.to);
        if (!a || !b) return;
        const aIn = nodeBoxes.has(a.id);
        const bIn = nodeBoxes.has(b.id);
        if (!aIn && !bIn) return;
        if (aIn && bIn) {
          const ba = nodeBoxes.get(a.id), bb = nodeBoxes.get(b.id);
          const lA = state._lanes && state._lanes.laneOf ? state._lanes.laneOf[a.id] : null;
          const lB = state._lanes && state._lanes.laneOf ? state._lanes.laneOf[b.id] : null;
          const isMsg = lA && lB && lA !== lB && a.type !== 'start' && b.type !== 'end';
          drawOrthoEdge(slide, ba.x, ba.y, ba.w, ba.h, bb.x, bb.y, bb.w, bb.h, true, e.label, isMsg);
        } else if (aIn && !bIn) {
          // Off-page derecha — letra única por arista
          const ba = nodeBoxes.get(a.id);
          const letter = edgeLetters[e.id] || '?';
          const targetSlice = Math.floor((ranks[b.id]||0) / ranksPerSlice) + 1;
          const cx = SLIDE_DRAW_W - 0.15;
          const sy = ba.y + ba.h / 2;
          slide.addShape('line', { x: ba.x + ba.w, y: sy, w: Math.max(cx - (ba.x + ba.w), 0.01), h: 0.01,
            line: { color: '666666', width: 0.85 } });
          slide.addShape('ellipse', { x: cx - 0.18, y: sy - 0.18, w: 0.36, h: 0.36,
            fill: { color: MAGENTA }, line: { color: 'FFFFFF', width: 1.5 } });
          slide.addText(letter, { x: cx - 0.18, y: sy - 0.18, w: 0.36, h: 0.36,
            fontSize: 12, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' });
          slide.addText(`Conector ${letter} → slide ${targetSlice}`, { x: cx - 2.0, y: sy + 0.22, w: 2.0, h: 0.18,
            fontSize: 7, color: GRAY, italic: true, align: 'right' });
        } else if (!aIn && bIn) {
          // Off-page izquierda — misma letra que el origen
          const bb = nodeBoxes.get(b.id);
          const letter = edgeLetters[e.id] || '?';
          const sourceSlice = Math.floor((ranks[a.id]||0) / ranksPerSlice) + 1;
          const cx = 0.15;
          const ty = bb.y + bb.h / 2;
          slide.addShape('ellipse', { x: cx - 0.18, y: ty - 0.18, w: 0.36, h: 0.36,
            fill: { color: MAGENTA }, line: { color: 'FFFFFF', width: 1.5 } });
          slide.addText(letter, { x: cx - 0.18, y: ty - 0.18, w: 0.36, h: 0.36,
            fontSize: 12, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' });
          slide.addShape('line', { x: cx + 0.18, y: ty, w: Math.max(bb.x - cx - 0.18, 0.01), h: 0.01,
            line: { color: '666666', width: 0.85, endArrowType: 'triangle' } });
          slide.addText(`Conector ${letter} ← slide ${sourceSlice}`, { x: cx, y: ty + 0.22, w: 2.0, h: 0.18,
            fontSize: 7, color: GRAY, italic: true, align: 'left' });
        }
      });

      // Footer: nota sobre conectores
      if (slicesCount > 1) {
        slide.addText(`Slide ${sliceIdx + 1}/${slicesCount} — los círculos magenta indican continuidad entre slides.`, { x: 0.4, y: 7.15, w: 12.5, h: 0.2, fontSize: 8, color: GRAY, italic: true });
      }
    }

    // Asigna letra única (A, B, C, …) a cada arista que cruza slides
    const edgeLetters = {};
    let letterIdx = 0;
    const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    state.edges.forEach(e => {
      const ra = ranks[e.from], rb = ranks[e.to];
      if (ra === undefined || rb === undefined) return;
      const sa = Math.floor(ra / ranksPerSlice), sb = Math.floor(rb / ranksPerSlice);
      if (sa !== sb) {
        edgeLetters[e.id] = LETTERS[letterIdx % 26];
        letterIdx++;
      }
    });

    // Genera N slides según slicesCount
    for (let si = 0; si < slicesCount; si++) {
      const rankStart = si * ranksPerSlice;
      const rankEnd = Math.min(totalRanks, (si + 1) * ranksPerSlice);
      const slide = pres.addSlide();
      drawProcessSlice(slide, si, rankStart, rankEnd);
    }

    // ============ SLIDE: LEYENDA BPMN ============
    (function addLegendSlide() {
      const sl = pres.addSlide();
      sl.background = { color: 'FFFFFF' };
      sl.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.5, fill: { color: DARK } });
      sl.addShape('rect', { x: 0, y: 0.5, w: 0.15, h: 7, fill: { color: MAGENTA } });
      sl.addText('Leyenda · Nomenclatura BPMN 2.0', { x: 0.4, y: 0.1, w: 12, h: 0.35, fontSize: 14, color: 'FFFFFF', bold: true });

      const colX = [0.5, 4.9, 9.3];
      const headers = ['Formas y flujos', 'Eventos (círculos)', 'Gateways y marcadores'];
      headers.forEach((h, i) => sl.addText(h, { x: colX[i], y: 0.75, w: 4.0, h: 0.3, fontSize: 12, bold: true, color: MAGENTA, fontFace: 'Calibri' }));

      // helper para una fila de leyenda: icono dibujado por callback + texto
      function row(cx, cy, drawIcon, text) {
        drawIcon(cx, cy);
        sl.addText(text, { x: cx + 0.7, y: cy - 0.07, w: 3.3, h: 0.34, fontSize: 9.5, color: '232323', valign: 'middle', fontFace: 'Calibri', wrap: true });
      }
      const ICON = 0.42;

      // ── Columna 1: formas y flujos ──
      let y = 1.2; const x1 = colX[0];
      row(x1, y, (cx, cy) => sl.addShape('rect', { x: cx, y: cy - ICON/2, w: 0.6, h: ICON, fill: { color: 'FFFFFF' }, line: { color: '414141', width: 1 }, rectRadius: 0.05 }), 'Actividad / tarea'); y += 0.55;
      row(x1, y, (cx, cy) => sl.addShape('rect', { x: cx, y: cy - ICON/2, w: 0.6, h: ICON, fill: { color: 'ECEFF1' }, line: { color: '37474F', width: 1 }, rectRadius: 0.05 }), 'Tarea de sistema'); y += 0.55;
      row(x1, y, (cx, cy) => sl.addShape('diamond', { x: cx, y: cy - ICON/2, w: ICON, h: ICON, fill: { color: 'FFF8E1' }, line: { color: 'F9A825', width: 1 } }), 'Decisión / gateway'); y += 0.55;
      row(x1, y, (cx, cy) => sl.addShape('rect', { x: cx, y: cy - ICON/2, w: 0.6, h: ICON, fill: { color: 'E3F2FD' }, line: { color: '1565C0', width: 1 } }), 'Documento'); y += 0.55;
      row(x1, y, (cx, cy) => sl.addShape('parallelogram', { x: cx, y: cy - ICON/2, w: 0.6, h: ICON, fill: { color: 'F3E5F5' }, line: { color: '6A1B9A', width: 1 } }), 'Datos / registro'); y += 0.55;
      row(x1, y, (cx, cy) => sl.addShape('line', { x: cx, y: cy, w: 0.6, h: 0.01, line: { color: '666666', width: 1.5, endArrowType: 'triangle' } }), 'Flujo de secuencia'); y += 0.5;
      row(x1, y, (cx, cy) => sl.addShape('line', { x: cx, y: cy, w: 0.6, h: 0.01, line: { color: '666666', width: 1.5, dashType: 'dash', endArrowType: 'triangle' } }), 'Flujo de mensaje (entre carriles)');

      // ── Columna 2: eventos ──
      y = 1.2; const x2 = colX[1];
      row(x2, y, (cx, cy) => { sl.addShape('ellipse', { x: cx, y: cy - ICON/2, w: ICON, h: ICON, fill: { color: 'E8F5E9' }, line: { color: '2E7D32', width: 1 } }); sl.addText('✉', { x: cx, y: cy - ICON/2, w: ICON, h: ICON, fontSize: 9, align: 'center', valign: 'middle', color: '2E7D32' }); }, 'Inicio (✉ mensaje)'); y += 0.55;
      row(x2, y, (cx, cy) => { sl.addShape('ellipse', { x: cx, y: cy - ICON/2, w: ICON, h: ICON, fill: { color: 'FEF7E0' }, line: { color: 'B45309', width: 1 } }); sl.addShape('ellipse', { x: cx+0.04, y: cy - ICON/2+0.04, w: ICON-0.08, h: ICON-0.08, fill: { type: 'none' }, line: { color: 'B45309', width: 0.75 } }); sl.addText('⌛', { x: cx, y: cy - ICON/2, w: ICON, h: ICON, fontSize: 8, align: 'center', valign: 'middle', color: 'B45309' }); }, 'Intermedio (⌛ timer · doble anillo)'); y += 0.55;
      row(x2, y, (cx, cy) => { sl.addShape('ellipse', { x: cx, y: cy - ICON/2, w: ICON, h: ICON, fill: { color: 'FFEBEE' }, line: { color: 'C62828', width: 1.5 } }); sl.addText('⚡', { x: cx, y: cy - ICON/2, w: ICON, h: ICON, fontSize: 9, align: 'center', valign: 'middle', color: 'C62828' }); }, 'Fin (⚡ error)'); y += 0.55;
      row(x2, y, (cx, cy) => { sl.addShape('ellipse', { x: cx, y: cy - ICON/2, w: ICON, h: ICON, fill: { color: 'FEF7E0' }, line: { color: 'B45309', width: 1 } }); sl.addText('▲', { x: cx, y: cy - ICON/2, w: ICON, h: ICON, fontSize: 9, align: 'center', valign: 'middle', color: 'B45309', bold: true }); }, 'Señal ▲ (broadcast 1→N)'); y += 0.55;
      row(x2, y, (cx, cy) => { sl.addShape('ellipse', { x: cx, y: cy - ICON/2, w: ICON, h: ICON, fill: { color: 'FFEBEE' }, line: { color: 'C62828', width: 1.5 } }); sl.addShape('ellipse', { x: cx+ICON*0.28, y: cy - ICON/2+ICON*0.28, w: ICON*0.44, h: ICON*0.44, fill: { color: 'C62828' }, line: { type: 'none' } }); }, 'Terminación ⬤ (corta la instancia)'); y += 0.55;
      row(x2, y, (cx, cy) => { sl.addShape('ellipse', { x: cx, y: cy - ICON/2, w: ICON, h: ICON, fill: { color: 'FEF7E0' }, line: { color: 'B45309', width: 1, dashType: 'dash' } }); sl.addText('⌛', { x: cx, y: cy - ICON/2, w: ICON, h: ICON, fontSize: 8, align: 'center', valign: 'middle', color: 'B45309' }); }, 'De borde (SLA/excepción sobre tarea)'); y += 0.55;
      sl.addText('Contorno = catch (recibe) · Relleno = throw (lanza) · Punteado = no interrumpe', { x: x2, y: y + 0.05, w: 4.0, h: 0.5, fontSize: 8.5, italic: true, color: GRAY, fontFace: 'Calibri', wrap: true });

      // ── Columna 3: gateways y marcadores ──
      y = 1.2; const x3 = colX[2];
      row(x3, y, (cx, cy) => { sl.addShape('diamond', { x: cx, y: cy - ICON/2, w: ICON, h: ICON, fill: { color: 'FFF8E1' }, line: { color: 'F9A825', width: 1 } }); sl.addText('✕', { x: cx, y: cy - ICON/2, w: ICON, h: ICON, fontSize: 9, align: 'center', valign: 'middle', color: 'C68400', bold: true }); }, 'Gateway exclusivo XOR (un camino)'); y += 0.55;
      row(x3, y, (cx, cy) => { sl.addShape('diamond', { x: cx, y: cy - ICON/2, w: ICON, h: ICON, fill: { color: 'FFF8E1' }, line: { color: 'F9A825', width: 1 } }); sl.addText('+', { x: cx, y: cy - ICON/2, w: ICON, h: ICON, fontSize: 12, align: 'center', valign: 'middle', color: 'C68400', bold: true }); }, 'Gateway paralelo AND (fork/join)'); y += 0.55;
      row(x3, y, (cx, cy) => { sl.addShape('diamond', { x: cx, y: cy - ICON/2, w: ICON, h: ICON, fill: { color: 'FFF8E1' }, line: { color: 'F9A825', width: 1 } }); sl.addText('O', { x: cx, y: cy - ICON/2, w: ICON, h: ICON, fontSize: 9, align: 'center', valign: 'middle', color: 'C68400', bold: true }); }, 'Gateway inclusivo OR (uno o varios)'); y += 0.6;
      row(x3, y, (cx, cy) => sl.addText('⊞', { x: cx, y: cy - ICON/2, w: ICON, h: ICON, fontSize: 13, align: 'center', valign: 'middle', color: '5B6472', bold: true }), 'Marcador: ⊞ subproceso'); y += 0.5;
      row(x3, y, (cx, cy) => sl.addText('↻', { x: cx, y: cy - ICON/2, w: ICON, h: ICON, fontSize: 13, align: 'center', valign: 'middle', color: '5B6472', bold: true }), 'Marcador: ↻ loop (cíclica)'); y += 0.5;
      row(x3, y, (cx, cy) => sl.addText('|||', { x: cx, y: cy - ICON/2, w: ICON, h: ICON, fontSize: 12, align: 'center', valign: 'middle', color: '5B6472', bold: true }), 'Marcador: ‖ multi-instancia');

      sl.addText('Las tareas llevan un chip de color con su tipo BPMN (USR/SRV/MAN/RCV/BOT/IA) y código [USR-01].', { x: 0.5, y: 6.7, w: 12.3, h: 0.3, fontSize: 9, italic: true, color: GRAY, fontFace: 'Calibri', align: 'center' });
    })();

    // Backwards compat: s2 alias para slides posteriores que lo usen (no aplica más)
    const s2 = null;

    // ============ SLIDE 3: PAIN POINTS ============
    const allPains = [];
    state.nodes.forEach(n => (n.pains || []).forEach(p => allPains.push({ ...p, activity: n.label })));
    const s3 = pres.addSlide();
    s3.background = { color: 'FFFFFF' };
    s3.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.5, fill: { color: DARK } });
    s3.addShape('rect', { x: 0, y: 0.5, w: 0.15, h: 7, fill: { color: MAGENTA } });
    s3.addText('Pain points identificados', { x: 0.4, y: 0.1, w: 12, h: 0.35, fontSize: 14, color: 'FFFFFF', bold: true });

    if (allPains.length === 0) {
      s3.addText('No se han capturado pain points en este levantamiento.', { x: 0.5, y: 3.5, w: 12, h: 0.5, fontSize: 16, color: GRAY, italic: true, align: 'center' });
    } else {
      const sorted = allPains.sort((a, b) => (b.severity * b.frequency) - (a.severity * a.frequency));
      const rows = [[
        { text: 'Actividad', options: { bold: true, color: 'FFFFFF', fill: { color: DARK } } },
        { text: 'Categoría', options: { bold: true, color: 'FFFFFF', fill: { color: DARK } } },
        { text: 'Descripción', options: { bold: true, color: 'FFFFFF', fill: { color: DARK } } },
        { text: 'Sev', options: { bold: true, color: 'FFFFFF', fill: { color: DARK } } },
        { text: 'Frec', options: { bold: true, color: 'FFFFFF', fill: { color: DARK } } },
        { text: 'Score', options: { bold: true, color: 'FFFFFF', fill: { color: DARK } } }
      ]];
      sorted.slice(0, 12).forEach(p => {
        const cat = (window.PAIN_CATEGORIES.find(c => c.id === p.category) || {}).label || p.category;
        rows.push([p.activity || '—', cat, p.description, String(p.severity), String(p.frequency), String(p.severity * p.frequency)]);
      });
      s3.addTable(rows, { x: 0.4, y: 0.8, w: 12.5, fontSize: 10, fontFace: 'Calibri', border: { type: 'solid', color: 'CCCCCC', pt: 0.5 } });
    }

    // ============ SLIDE 4: KPIs ============
    const s4 = pres.addSlide();
    s4.background = { color: 'FFFFFF' };
    s4.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.5, fill: { color: DARK } });
    s4.addShape('rect', { x: 0, y: 0.5, w: 0.15, h: 7, fill: { color: MAGENTA } });
    s4.addText('KPIs sugeridos (benchmark de industria)', { x: 0.4, y: 0.1, w: 12, h: 0.35, fontSize: 14, color: 'FFFFFF', bold: true });

    const kpiVals = state._kpiValues || {};
    // Prioriza KPIs capturados por el cliente; complementa con sugeridos
    const capturedIds = Object.keys(kpiVals);
    const capturedKpis = window.KPI_LIBRARY.filter(k => capturedIds.includes(k.id));
    const suggestedKpis = window.KPI_LIBRARY
      .filter(k => !capturedIds.includes(k.id) && (!state.meta.industry || k.industry === state.meta.industry || k.industry === 'Transversal'))
      .slice(0, Math.max(0, 10 - capturedKpis.length));
    const kpis = [...capturedKpis, ...suggestedKpis];

    const kpiRows = [[
      { text: 'KPI', options: { bold: true, color: 'FFFFFF', fill: { color: DARK } } },
      { text: 'Unidad', options: { bold: true, color: 'FFFFFF', fill: { color: DARK } } },
      { text: 'Benchmark', options: { bold: true, color: 'FFFFFF', fill: { color: DARK } } },
      { text: 'Actual cliente', options: { bold: true, color: 'FFFFFF', fill: { color: DARK } } },
      { text: 'Gap', options: { bold: true, color: 'FFFFFF', fill: { color: DARK } } },
      { text: 'Fuente', options: { bold: true, color: 'FFFFFF', fill: { color: DARK } } }
    ]];
    kpis.forEach(k => {
      const cap = kpiVals[k.id];
      if (cap) {
        kpiRows.push([
          k.name, k.unit, k.benchmark,
          { text: cap.value, options: { bold: true, color: 'C62828' } },
          { text: cap.gap || '—', options: { align: 'center', bold: true, color: 'C62828' } },
          cap.source || `${k.industry} · ${k.macroprocess}`
        ]);
      } else {
        kpiRows.push([
          k.name, k.unit, k.benchmark,
          { text: '— por capturar —', options: { color: '999999', italic: true } },
          { text: '—', options: { align: 'center', color: '999999' } },
          `${k.industry} · ${k.macroprocess}`
        ]);
      }
    });
    s4.addTable(kpiRows, { x: 0.4, y: 0.8, w: 12.5, fontSize: 9, fontFace: 'Calibri', border: { type: 'solid', color: 'CCCCCC', pt: 0.5 } });
    s4.addText(`${capturedKpis.length} KPIs capturados con data del cliente · ${suggestedKpis.length} sugeridos por industria. Benchmarks de fuentes públicas (APQC, SBS, Indecopi, OSINERGMIN, sectoriales).`, { x: 0.4, y: 6.9, w: 12.5, h: 0.3, fontSize: 9, color: GRAY, italic: true });

    // ============ SLIDE: AS-IS vs TO-BE (si existe to-be) ============
    // Snapshot ambos views para comparar
    const asisData = state.activeView === 'asis' ? { nodes: state.nodes, edges: state.edges } : state._views.asis;
    const tobeData = state.activeView === 'tobe' ? { nodes: state.nodes, edges: state.edges } : state._views.tobe;

    if (tobeData && tobeData.nodes && tobeData.nodes.length > 0 && asisData && asisData.nodes.length > 0) {
      const sl = pres.addSlide();
      sl.background = { color: 'FFFFFF' };
      sl.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.5, fill: { color: DARK } });
      sl.addShape('rect', { x: 0, y: 0.5, w: 0.15, h: 7, fill: { color: MAGENTA } });
      sl.addText('Comparativo As-Is vs To-Be', { x: 0.4, y: 0.1, w: 12, h: 0.35, fontSize: 14, color: 'FFFFFF', bold: true });

      // Render mini-diagramas en dos columnas
      renderMiniDiagram(sl, asisData, 0.4, 1.0, 6.2, 5.5, 'AS-IS', GRAY);
      renderMiniDiagram(sl, tobeData, 6.8, 1.0, 6.2, 5.5, 'TO-BE', MAGENTA);

      // Tabla de cambios
      const deltas = computeDeltas(asisData, tobeData);
      sl.addText('Cambios clave', { x: 0.4, y: 6.6, w: 12.5, h: 0.3, fontSize: 12, color: MAGENTA, bold: true });
      sl.addText(
        `+ ${deltas.added} actividades nuevas    ·    − ${deltas.removed} eliminadas    ·    ⟳ ${deltas.changed} modificadas    ·    Δ tipos: ${deltas.typeChanges}`,
        { x: 0.4, y: 6.9, w: 12.5, h: 0.3, fontSize: 11, color: DARK, fontFace: 'Calibri' });
    }

    // ============ SLIDE: SIPOC (si existe) ============
    if (state._sipoc) {
      const sl = pres.addSlide();
      sl.background = { color: 'FFFFFF' };
      sl.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.5, fill: { color: DARK } });
      sl.addShape('rect', { x: 0, y: 0.5, w: 0.15, h: 7, fill: { color: MAGENTA } });
      sl.addText('SIPOC — alcance del proceso', { x: 0.4, y: 0.1, w: 12, h: 0.35, fontSize: 14, color: 'FFFFFF', bold: true });
      const cols = ['suppliers', 'inputs', 'process', 'outputs', 'customers'];
      const headers = ['Supplier', 'Input', 'Process', 'Output', 'Customer'];
      const colW = 2.5;
      headers.forEach((h, i) => {
        sl.addShape('rect', { x: 0.4 + i * colW, y: 1, w: colW - 0.1, h: 0.5, fill: { color: MAGENTA } });
        sl.addText(h, { x: 0.4 + i * colW, y: 1, w: colW - 0.1, h: 0.5, fontSize: 14, color: 'FFFFFF', bold: true, align: 'center', valign: 'middle' });
      });
      cols.forEach((c, i) => {
        sl.addShape('rect', { x: 0.4 + i * colW, y: 1.55, w: colW - 0.1, h: 5, fill: { color: 'F8F8F8' }, line: { color: 'CCCCCC', width: 0.5 } });
        sl.addText(state._sipoc[c] || '—', { x: 0.5 + i * colW, y: 1.7, w: colW - 0.3, h: 4.7, fontSize: 11, color: DARK, valign: 'top', fontFace: 'Calibri' });
      });
    }

    // ============ SLIDE: RACI (si existe) ============
    if (state._raci && Object.keys(state._raci).length > 0) {
      const tasks = state.nodes.filter(n => state._raci[n.id]);
      const roles = [...new Set(Object.values(state._raci).flatMap(r => Object.keys(r)))];
      if (tasks.length > 0 && roles.length > 0) {
        const sl = pres.addSlide();
        sl.background = { color: 'FFFFFF' };
        sl.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.5, fill: { color: DARK } });
        sl.addShape('rect', { x: 0, y: 0.5, w: 0.15, h: 7, fill: { color: MAGENTA } });
        sl.addText('Matriz RACI', { x: 0.4, y: 0.1, w: 12, h: 0.35, fontSize: 14, color: 'FFFFFF', bold: true });
        const raciRows = [[
          { text: 'Actividad', options: { bold: true, color: 'FFFFFF', fill: { color: DARK } } },
          ...roles.map(r => ({ text: r, options: { bold: true, color: 'FFFFFF', fill: { color: DARK }, align: 'center' } }))
        ]];
        tasks.slice(0, 14).forEach(t => {
          raciRows.push([t.label, ...roles.map(r => ({ text: (state._raci[t.id][r] || ''), options: { align: 'center', bold: true } }))]);
        });
        sl.addTable(raciRows, { x: 0.4, y: 0.8, w: 12.5, fontSize: 10, fontFace: 'Calibri', border: { type: 'solid', color: 'CCCCCC', pt: 0.5 } });
        sl.addText('R = Responsable · A = Accountable · C = Consultado · I = Informado', { x: 0.4, y: 6.9, w: 12, h: 0.3, fontSize: 9, color: GRAY, italic: true });
      }
    }

    // ============ SLIDE: SIMULADOR (si se ejecutó) ============
    if (state._simResults && state._simResults.activitiesWithData > 0) {
      const r = state._simResults;
      const fmtN = (n) => isFinite(n) ? n.toLocaleString('es-PE', { maximumFractionDigits: 1 }) : '—';
      const fmtCur = (n) => isFinite(n) ? n.toLocaleString('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 }) : '—';
      const sl = pres.addSlide();
      sl.background = { color: 'FFFFFF' };
      sl.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.5, fill: { color: DARK } });
      sl.addShape('rect', { x: 0, y: 0.5, w: 0.15, h: 7, fill: { color: MAGENTA } });
      sl.addText('Cuantificación del proceso (data-driven)', { x: 0.4, y: 0.1, w: 12, h: 0.35, fontSize: 14, color: 'FFFFFF', bold: true });

      const tiles = [
        { label: 'FTE actual', value: fmtN(r.fteCurrent), fill: 'F8F8F8', color: DARK },
        { label: 'FTE to-be', value: fmtN(r.fteToBe), fill: 'F8F8F8', color: DARK },
        { label: 'Costo mensual', value: fmtCur(r.monthlyCost), fill: 'F8F8F8', color: DARK },
        { label: 'Ahorro anual estimado', value: fmtCur(r.annualSavings), fill: MAGENTA, color: 'FFFFFF' }
      ];
      tiles.forEach((t, i) => {
        const x = 0.5 + i * 3.1;
        sl.addShape('rect', { x, y: 1.2, w: 2.9, h: 2.2, fill: { color: t.fill }, line: { color: 'CCCCCC', width: 0.5 } });
        sl.addText(t.label, { x, y: 1.3, w: 2.9, h: 0.4, fontSize: 12, color: t.color, align: 'center', bold: true });
        sl.addText(t.value, { x, y: 1.8, w: 2.9, h: 1.3, fontSize: 28, color: t.color, align: 'center', valign: 'middle', bold: true });
      });

      sl.addText('Metodología', { x: 0.5, y: 4, w: 12, h: 0.35, fontSize: 14, color: MAGENTA, bold: true });
      sl.addText(
        `• ${r.activitiesWithData} actividades con tiempo y volumen capturados.\n` +
        `• FTE actual = Σ(tiempo × volumen) / (horas hábiles × 60).\n` +
        `• FTE to-be aplica reducción objetivo del ${Math.round((1 - r.fteToBe / Math.max(r.fteCurrent, 0.0001)) * 100)}%.\n` +
        `• Lead time del flujo (suma lineal): ${fmtN(r.leadTimeChain)} minutos.\n` +
        `• Cifras estimativas; refinar con muestreo de tiempos en sitio.`,
        { x: 0.5, y: 4.4, w: 12, h: 2.5, fontSize: 12, color: DARK, fontFace: 'Calibri', paraSpaceAfter: 4 }
      );
    }

    // ============ SLIDE: NARRATIVA DE PAINS (top 3) ============
    if (allPains.length > 0) {
      const sl = pres.addSlide();
      sl.background = { color: 'FFFFFF' };
      sl.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.5, fill: { color: DARK } });
      sl.addShape('rect', { x: 0, y: 0.5, w: 0.15, h: 7, fill: { color: MAGENTA } });
      sl.addText('Lectura ejecutiva de los pain points', { x: 0.4, y: 0.1, w: 12, h: 0.35, fontSize: 14, color: 'FFFFFF', bold: true });

      const top3 = allPains.sort((a, b) => (b.severity * b.frequency) - (a.severity * a.frequency)).slice(0, 3);
      top3.forEach((p, i) => {
        const y = 1.1 + i * 1.85;
        sl.addShape('rect', { x: 0.5, y, w: 0.4, h: 1.7, fill: { color: MAGENTA } });
        sl.addText(`#${i + 1}`, { x: 0.5, y, w: 0.4, h: 1.7, fontSize: 18, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' });
        sl.addShape('rect', { x: 1, y, w: 11.8, h: 1.7, fill: { color: 'F8F8F8' }, line: { color: 'CCCCCC', width: 0.5 } });
        sl.addText(p.activity || '—', { x: 1.2, y: y + 0.1, w: 9, h: 0.4, fontSize: 14, bold: true, color: DARK });
        sl.addText(`Sev ${p.severity} · Frec ${p.frequency} · Score ${p.severity * p.frequency}`, { x: 10, y: y + 0.1, w: 2.6, h: 0.4, fontSize: 11, color: MAGENTA, align: 'right', bold: true });
        sl.addText(`Situación observada: ${p.description}`, { x: 1.2, y: y + 0.5, w: 11.4, h: 0.4, fontSize: 11, color: DARK, fontFace: 'Calibri' });
        const cat = (window.PAIN_CATEGORIES.find(c => c.id === p.category) || {}).label || p.category;
        sl.addText(`Riesgo: ${painImplication(p)}`, { x: 1.2, y: y + 0.9, w: 11.4, h: 0.4, fontSize: 11, color: DARK, fontFace: 'Calibri' });
        sl.addText(`Recomendación: ${painRecommendation(p)}`, { x: 1.2, y: y + 1.3, w: 11.4, h: 0.4, fontSize: 11, color: '2E7D32', bold: true, fontFace: 'Calibri' });
      });
    }

    // ============ SLIDE: MATRIZ IMPACTO-ESFUERZO ============
    if (allPains.length > 0) {
      const sl = pres.addSlide();
      sl.background = { color: 'FFFFFF' };
      sl.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.5, fill: { color: DARK } });
      sl.addShape('rect', { x: 0, y: 0.5, w: 0.15, h: 7, fill: { color: MAGENTA } });
      sl.addText('Matriz Impacto-Esfuerzo de oportunidades', { x: 0.4, y: 0.1, w: 12, h: 0.35, fontSize: 14, color: 'FFFFFF', bold: true });

      const px = 0.5, py = 0.9, pw = 7, ph = 6;
      // Cuadrantes
      sl.addShape('rect', { x: px, y: py, w: pw / 2, h: ph / 2, fill: { color: 'E8F5E9' }, line: { color: 'CCCCCC', width: 0.5 } });
      sl.addShape('rect', { x: px + pw / 2, y: py, w: pw / 2, h: ph / 2, fill: { color: 'E3F2FD' }, line: { color: 'CCCCCC', width: 0.5 } });
      sl.addShape('rect', { x: px, y: py + ph / 2, w: pw / 2, h: ph / 2, fill: { color: 'F5F5F5' }, line: { color: 'CCCCCC', width: 0.5 } });
      sl.addShape('rect', { x: px + pw / 2, y: py + ph / 2, w: pw / 2, h: ph / 2, fill: { color: 'FFEBEE' }, line: { color: 'CCCCCC', width: 0.5 } });
      sl.addText('QUICK WINS', { x: px, y: py + 0.05, w: pw / 2, h: 0.3, fontSize: 11, color: '2E7D32', bold: true, align: 'center' });
      sl.addText('PROYECTOS ESTRATÉGICOS', { x: px + pw / 2, y: py + 0.05, w: pw / 2, h: 0.3, fontSize: 11, color: '1565C0', bold: true, align: 'center' });
      sl.addText('FILL-INS', { x: px, y: py + ph - 0.35, w: pw / 2, h: 0.3, fontSize: 11, color: '666666', bold: true, align: 'center' });
      sl.addText('RECONSIDERAR', { x: px + pw / 2, y: py + ph - 0.35, w: pw / 2, h: 0.3, fontSize: 11, color: 'C62828', bold: true, align: 'center' });

      const effortMap = { system: 4, regulatory: 5, control: 3, data: 3, handoff: 2, manual: 2, wait: 2, rework: 2 };
      const sorted = allPains.slice().sort((a, b) => (b.severity * b.frequency) - (a.severity * a.frequency));
      sorted.forEach((p, i) => {
        const impact = (p.severity * p.frequency) / 25;
        const effort = (effortMap[p.category] || 3) / 5;
        const cx = px + effort * pw;
        const cy = py + (1 - impact) * ph;
        const r = 0.15 + impact * 0.15;
        sl.addShape('ellipse', { x: cx - r, y: cy - r, w: r * 2, h: r * 2, fill: { color: MAGENTA }, line: { color: 'FFFFFF', width: 1 } });
        sl.addText(String(i + 1), { x: cx - r, y: cy - r, w: r * 2, h: r * 2, fontSize: 9, color: 'FFFFFF', bold: true, align: 'center', valign: 'middle' });
      });

      // Leyenda derecha
      sl.addText('Top oportunidades', { x: 8, y: 0.9, w: 5, h: 0.4, fontSize: 14, color: MAGENTA, bold: true });
      sorted.slice(0, 10).forEach((p, i) => {
        sl.addText(`${i + 1}. ${p.activity}: ${p.description}`, { x: 8, y: 1.4 + i * 0.45, w: 5, h: 0.4, fontSize: 9, color: DARK, fontFace: 'Calibri' });
      });
    }

    // ============ SLIDE 5: DIAGNÓSTICO ============
    const s5 = pres.addSlide();
    s5.background = { color: 'FFFFFF' };
    s5.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.5, fill: { color: DARK } });
    s5.addShape('rect', { x: 0, y: 0.5, w: 0.15, h: 7, fill: { color: MAGENTA } });
    s5.addText('Diagnóstico ejecutivo y palancas de reingeniería', { x: 0.4, y: 0.1, w: 12, h: 0.35, fontSize: 14, color: 'FFFFFF', bold: true });

    const handoffs = countHandoffs();
    const manual = state.nodes.filter(n => n.type === 'task' && !n.system).length;
    const critPains = allPains.filter(p => p.severity >= 4).length;

    s5.addText('Hallazgos', { x: 0.5, y: 0.9, w: 6, h: 0.4, fontSize: 18, color: MAGENTA, bold: true });
    s5.addText(
      `• ${state.nodes.length} actividades, ${handoffs} handoffs inter-rol\n` +
      `• ${manual} actividades sin sistema soporte (candidatas a automatización)\n` +
      `• ${allPains.length} pain points (${critPains} críticos, severidad ≥ 4)\n` +
      `• ${state.edges.filter(e => true).length} transiciones modeladas`,
      { x: 0.5, y: 1.4, w: 6, h: 2.5, fontSize: 13, color: DARK, fontFace: 'Calibri', paraSpaceAfter: 4 }
    );

    s5.addText('Palancas de reingeniería', { x: 7, y: 0.9, w: 6, h: 0.4, fontSize: 18, color: MAGENTA, bold: true });
    s5.addText(
      '1. Automatización RPA / IDP en actividades manuales\n' +
      '2. Eliminación de handoffs (células multifuncionales)\n' +
      '3. Reglas de decisión codificadas (DMN)\n' +
      '4. Self-service en captura\n' +
      '5. Tablero KPIs en tiempo real',
      { x: 7, y: 1.4, w: 6, h: 2.5, fontSize: 13, color: DARK, fontFace: 'Calibri', paraSpaceAfter: 4 }
    );

    s5.addText('Impacto estimado', { x: 0.5, y: 4.5, w: 12, h: 0.4, fontSize: 18, color: MAGENTA, bold: true });

    // Si se ejecutó simulación, usar valores reales; si no, rangos referenciales.
    const sim = state._simResults;
    const fmtCur = (n) => n.toLocaleString('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 });
    const t1 = sim ? `Lead time\n${Math.round(sim.leadTimeChain)} min → menor` : 'Lead time\n-35% a -50%';
    const t2 = sim ? `FTE liberados\n${(sim.fteCurrent - sim.fteToBe).toFixed(1)}` : 'FTE liberados\n15-25%';
    const t3 = sim ? `Ahorro anual\n${fmtCur(sim.annualSavings)}` : 'Errores\n-60%';
    const t4 = sim ? `Costo actual/mes\n${fmtCur(sim.monthlyCost)}` : 'CSAT/NPS\n+10 a +20 pts';

    s5.addShape('rect', { x: 0.5, y: 5.1, w: 2.9, h: 1.5, fill: { color: 'F8F8F8' }, line: { color: 'CCCCCC', width: 0.5 } });
    s5.addText(t1, { x: 0.5, y: 5.1, w: 2.9, h: 1.5, fontSize: 13, color: DARK, align: 'center', valign: 'middle', bold: true });
    s5.addShape('rect', { x: 3.55, y: 5.1, w: 2.9, h: 1.5, fill: { color: 'F8F8F8' }, line: { color: 'CCCCCC', width: 0.5 } });
    s5.addText(t2, { x: 3.55, y: 5.1, w: 2.9, h: 1.5, fontSize: 13, color: DARK, align: 'center', valign: 'middle', bold: true });
    s5.addShape('rect', { x: 6.6, y: 5.1, w: 2.9, h: 1.5, fill: { color: 'F8F8F8' }, line: { color: 'CCCCCC', width: 0.5 } });
    s5.addText(t3, { x: 6.6, y: 5.1, w: 2.9, h: 1.5, fontSize: 13, color: DARK, align: 'center', valign: 'middle', bold: true });
    s5.addShape('rect', { x: 9.65, y: 5.1, w: 2.9, h: 1.5, fill: { color: MAGENTA }, line: { color: MAGENTA, width: 0.5 } });
    s5.addText(t4, { x: 9.65, y: 5.1, w: 2.9, h: 1.5, fontSize: 13, color: 'FFFFFF', align: 'center', valign: 'middle', bold: true });

    if (sim) s5.addText('Cifras calculadas por el simulador con tiempos y volúmenes capturados en cada actividad.', { x: 0.5, y: 6.75, w: 12, h: 0.25, fontSize: 9, color: GRAY, italic: true });

    // ============ SLIDE FINAL: 1-PAGER EJECUTIVO PARA CEO/CFO ============
    const sf = pres.addSlide();
    sf.background = { color: 'FFFFFF' };
    sf.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.7, fill: { color: MAGENTA } });
    sf.addText('Diagnóstico ejecutivo · 1-pager', { x: 0.4, y: 0.15, w: 12, h: 0.5, fontSize: 20, color: 'FFFFFF', bold: true });
    sf.addText(state.meta.name || 'Proceso', { x: 0.4, y: 0.85, w: 12, h: 0.4, fontSize: 14, color: DARK, italic: true });

    // Numerador grande (5 bullets clave)
    const top3Pains = allPains.slice().sort((a, b) => (b.severity * b.frequency) - (a.severity * a.frequency)).slice(0, 3);
    const painsTxt = top3Pains.length > 0
      ? top3Pains.map((p, i) => `${i + 1}. ${p.activity}: ${painImplication(p)}`).join('\n')
      : 'Por capturar en sitio.';
    const quickWins = allPains.filter(p => (p.severity * p.frequency) >= 12 && ['handoff', 'rework', 'manual', 'control'].includes(p.category)).slice(0, 3);
    const qwTxt = quickWins.length > 0
      ? quickWins.map(p => `• ${p.activity} → ${painRecommendation(p)}`).join('\n')
      : '• Estandarización de criterios de decisión.\n• Eliminación de controles duplicados.\n• Automatización de actividades manuales (RPA).';

    // Cuadrícula 2x2 de hallazgos clave
    const carga = sim
      ? `${(sim.fteCurrent).toFixed(1)} FTE actual\n→ ${(sim.fteToBe).toFixed(1)} FTE to-be\n(${Math.round((1 - sim.fteToBe / Math.max(sim.fteCurrent, 0.0001)) * 100)}% reducción)\nAhorro: ${sim.annualSavings.toLocaleString('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 })} anual`
      : 'Pendiente capturar tiempos/volúmenes en simulador.';

    const kpiCount = Object.keys(state._kpiValues || {}).length;
    const kpisTxt = kpiCount > 0
      ? `${kpiCount} KPIs capturados con data del cliente.\nGap detectado vs benchmark sectorial.\nVer slide KPIs para detalle.`
      : `${window.KPI_LIBRARY.filter(k => !state.meta.industry || k.industry === state.meta.industry || k.industry === 'Transversal').slice(0,5).length} KPIs sugeridos por industria.\nFalta capturar valor actual del cliente.`;

    // Bloque 1: Carga & impacto
    sf.addShape('rect', { x: 0.4, y: 1.4, w: 6.2, h: 2.6, fill: { color: 'F8F8F8' }, line: { color: 'CCCCCC', width: 0.5 } });
    sf.addText('📊 Carga e impacto', { x: 0.6, y: 1.5, w: 6, h: 0.4, fontSize: 14, color: MAGENTA, bold: true });
    sf.addText(carga, { x: 0.6, y: 1.9, w: 6, h: 2, fontSize: 12, color: DARK, fontFace: 'Calibri' });

    // Bloque 2: KPIs & benchmarks
    sf.addShape('rect', { x: 6.8, y: 1.4, w: 6.2, h: 2.6, fill: { color: 'F8F8F8' }, line: { color: 'CCCCCC', width: 0.5 } });
    sf.addText('🎯 KPIs y gap sectorial', { x: 7, y: 1.5, w: 6, h: 0.4, fontSize: 14, color: MAGENTA, bold: true });
    sf.addText(kpisTxt, { x: 7, y: 1.9, w: 6, h: 2, fontSize: 12, color: DARK, fontFace: 'Calibri' });

    // Bloque 3: Top 3 pains
    sf.addShape('rect', { x: 0.4, y: 4.1, w: 6.2, h: 2.4, fill: { color: '#FFF3E0' }, line: { color: 'CCCCCC', width: 0.5 } });
    sf.addText('🚨 Top 3 dolores del proceso', { x: 0.6, y: 4.2, w: 6, h: 0.4, fontSize: 14, color: '#E65100', bold: true });
    sf.addText(painsTxt, { x: 0.6, y: 4.6, w: 6, h: 1.8, fontSize: 11, color: DARK, fontFace: 'Calibri' });

    // Bloque 4: Quick wins
    sf.addShape('rect', { x: 6.8, y: 4.1, w: 6.2, h: 2.4, fill: { color: '#E8F5E9' }, line: { color: 'CCCCCC', width: 0.5 } });
    sf.addText('⚡ Quick wins (0-3 meses)', { x: 7, y: 4.2, w: 6, h: 0.4, fontSize: 14, color: '#2E7D32', bold: true });
    sf.addText(qwTxt, { x: 7, y: 4.6, w: 6, h: 1.8, fontSize: 11, color: DARK, fontFace: 'Calibri' });

    // Footer: siguiente paso
    sf.addShape('rect', { x: 0.4, y: 6.7, w: 12.6, h: 0.55, fill: { color: DARK } });
    sf.addText('SIGUIENTE PASO  ›  Validar hallazgos con sponsor · Priorizar en matriz Impacto-Esfuerzo · Construir business case', { x: 0.5, y: 6.7, w: 12.5, h: 0.55, fontSize: 11, color: 'FFFFFF', bold: true, valign: 'middle' });

    pres.writeFile({ fileName: filename('pptx') });
  }

  // Helper: renderiza un mini-diagrama dentro de un slide PPTX en un área dada.
  function renderMiniDiagram(slide, data, x, y, w, h, label, accentColor) {
    slide.addShape('rect', { x, y, w, h, fill: { color: 'FAFAFA' }, line: { color: 'CCCCCC', width: 0.5 } });
    slide.addText(label, { x, y, w, h: 0.35, fontSize: 12, color: accentColor, bold: true, align: 'center' });
    if (!data.nodes.length) {
      slide.addText('(vacío)', { x, y: y + h / 2 - 0.2, w, h: 0.4, fontSize: 14, color: '999999', italic: true, align: 'center' });
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    data.nodes.forEach(n => {
      minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.w); maxY = Math.max(maxY, n.y + n.h);
    });
    const srcW = Math.max(1, maxX - minX), srcH = Math.max(1, maxY - minY);
    const padTop = 0.4, padOther = 0.2;
    const dstW = w - padOther * 2, dstH = h - padTop - padOther;
    const scale = Math.min(dstW / srcW, dstH / srcH);
    const offX = x + padOther + (dstW - srcW * scale) / 2;
    const offY = y + padTop + (dstH - srcH * scale) / 2;

    const shapeKind = { task: 'rect', system: 'rect', decision: 'diamond', start: 'ellipse', end: 'ellipse', document: 'rect', data: 'parallelogram' };
    const shapeFill = { task: 'FFFFFF', system: 'ECEFF1', decision: 'FFF8E1', start: 'E8F5E9', end: 'FFEBEE', document: 'E3F2FD', data: 'F3E5F5' };
    const shapeBorder = { task: '414141', system: '37474F', decision: 'F9A825', start: '2E7D32', end: 'C62828', document: '1565C0', data: '6A1B9A' };

    data.nodes.forEach(n => {
      const nx = offX + (n.x - minX) * scale;
      const ny = offY + (n.y - minY) * scale;
      const nw = n.w * scale, nh = n.h * scale;
      slide.addShape(shapeKind[n.type] || 'rect', {
        x: nx, y: ny, w: nw, h: nh,
        fill: { color: shapeFill[n.type] || 'FFFFFF' },
        line: { color: shapeBorder[n.type] || '414141', width: 0.8 }
      });
      slide.addText(n.label || '', {
        x: nx, y: ny, w: nw, h: nh, fontSize: 6,
        align: 'center', valign: 'middle', color: '232323', fontFace: 'Calibri'
      });
    });
    data.edges.forEach(e => {
      const a = data.nodes.find(n => n.id === e.from), b = data.nodes.find(n => n.id === e.to);
      if (!a || !b) return;
      const p1x = offX + (a.x + a.w / 2 - minX) * scale;
      const p1y = offY + (a.y + a.h / 2 - minY) * scale;
      const p2x = offX + (b.x + b.w / 2 - minX) * scale;
      const p2y = offY + (b.y + b.h / 2 - minY) * scale;
      const dx = p2x - p1x, dy = p2y - p1y;
      slide.addShape('line', {
        x: Math.min(p1x, p2x), y: Math.min(p1y, p2y),
        w: Math.max(Math.abs(dx), 0.01), h: Math.max(Math.abs(dy), 0.01),
        line: { color: '666666', width: 0.5, endArrowType: 'triangle' },
        flipH: dx < 0, flipV: dy < 0
      });
    });
  }

  // Helper: compara as-is vs to-be y reporta cambios.
  function computeDeltas(asis, tobe) {
    const aLabels = new Set(asis.nodes.map(n => normLabel(n.label)));
    const tLabels = new Set(tobe.nodes.map(n => normLabel(n.label)));
    let added = 0, removed = 0, typeChanges = 0, changed = 0;
    tLabels.forEach(l => { if (!aLabels.has(l)) added++; });
    aLabels.forEach(l => { if (!tLabels.has(l)) removed++; });
    // Cambios de tipo (mismo label, distinto type)
    asis.nodes.forEach(an => {
      const tn = tobe.nodes.find(x => normLabel(x.label) === normLabel(an.label));
      if (tn && tn.type !== an.type) { typeChanges++; changed++; }
    });
    return { added, removed, changed, typeChanges };
  }

  function normLabel(s) { return (s || '').toLowerCase().trim().replace(/\s+/g, ' '); }

  function painImplication(p) {
    const score = p.severity * p.frequency;
    const cat = p.category;
    if (cat === 'handoff')    return 'pérdida de contexto en traspaso entre áreas; lead time +10-15% por handoff y mayor probabilidad de errores de transmisión.';
    if (cat === 'rework')     return 'duplica esfuerzo; cada reproceso cuesta 1.5-2x el tiempo del original y degrada experiencia del cliente.';
    if (cat === 'wait')       return 'eleva lead time end-to-end sin agregar valor; típicamente 60-80% del lead time total son esperas.';
    if (cat === 'control')    return 'control duplicado entre frontline y back office; redundancia sin valor agregado.';
    if (cat === 'system')     return 'limitación tecnológica que fuerza workarounds manuales; afecta escalabilidad.';
    if (cat === 'regulatory') return 'requisito regulatorio no optimizado; oportunidad de cumplir cumplimiento con menor fricción operativa.';
    if (cat === 'manual')     return 'tarea manual repetitiva propensa a error humano; candidato directo a automatización.';
    if (cat === 'data')       return 'calidad de datos pobre que propaga errores aguas abajo; afecta reportes y decisiones.';
    return score >= 16 ? 'pain crítico que afecta el flujo end-to-end y debe priorizarse.' : 'oportunidad de mejora puntual.';
  }

  function painRecommendation(p) {
    const cat = p.category;
    const sev = p.severity;
    if (cat === 'handoff')    return sev >= 4 ? 'rediseñar con célula multifuncional o workflow orquestado (BPM).' : 'estandarizar template de traspaso (briefing estructurado).';
    if (cat === 'rework')     return 'aplicar "right first time": validar en origen + checklist + capacitación + tooling.';
    if (cat === 'wait')       return sev >= 4 ? 'paralelizar o eliminar la espera (push → pull notifications).' : 'priorizar la cola con criterios SLA/severidad.';
    if (cat === 'control')    return 'eliminar control duplicado tras análisis de riesgo, o consolidar en único punto.';
    if (cat === 'system')     return 'roadmap TI: API/integración o reemplazo de sistema. Quick win: macro/RPA puente.';
    if (cat === 'regulatory') return 'rediseñar para cumplir con menor pasos; digitalizar evidencia de cumplimiento.';
    if (cat === 'manual')     return 'automatizar con RPA si es rule-based; IDP si requiere extracción de docs; workflow si necesita orquestación.';
    if (cat === 'data')       return 'data quality at source: validaciones + master data + DQ dashboard.';
    return 'analizar root cause y diseñar contramedida específica.';
  }

  // ============================================================
  // INGEST MODAL — Audio, Notas, Event Log
  // ============================================================
  let speechRecognition = null;
  let ingestInProgress = false;

  function guardIngest(fn) {
    return function (...args) {
      if (ingestInProgress) return;
      ingestInProgress = true;
      try { fn.apply(this, args); }
      finally { setTimeout(() => { ingestInProgress = false; }, 1500); }
    };
  }

  function openIngestModal() {
    $('#ingestModal').hidden = false;
    activateIngestTab('audio');
  }

  function closeIngestModal() {
    $('#ingestModal').hidden = true;
    stopSpeechRecognition();
  }

  function attachIngestListeners() {
    $('#ingestClose').addEventListener('click', closeIngestModal);
    $('#ingestModal').addEventListener('click', e => {
      if (e.target.id === 'ingestModal') closeIngestModal();
    });

    $$('.itab').forEach(t => t.addEventListener('click', () => activateIngestTab(t.dataset.itab)));

    // Audio
    $('#btnRecStart').addEventListener('click', startSpeechRecognition);
    $('#btnRecStop').addEventListener('click', stopSpeechRecognition);
    $('#btnIngestAudio').addEventListener('click', guardIngest(() => {
      const txt = $('#audioTranscript').value.trim();
      if (!txt) { alert('No hay transcripción.'); return; }
      buildProcessFromText(txt, 'Transcripción de audio');
      closeIngestModal();
    }));

    // Notes
    $('#btnIngestNotes').addEventListener('click', guardIngest(() => {
      const txt = $('#notesInput').value.trim();
      if (!txt) { alert('Pega texto primero.'); return; }
      buildProcessFromText(txt, 'Notas/documentación');
      closeIngestModal();
    }));

    // Cargar documento de texto (.txt, .md, .csv) → vuelca al textarea
    const docBtn = $('#btnLoadDoc'), docInput = $('#docFileInput');
    if (docBtn && docInput) {
      docBtn.addEventListener('click', () => docInput.click());
      docInput.addEventListener('change', (e) => {
        const f = e.target.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
          $('#notesInput').value = reader.result;
          $('#docFileName').textContent = `✓ ${f.name} (${Math.round(f.size / 1024)} KB)`;
        };
        reader.onerror = () => alert('No se pudo leer el archivo.');
        reader.readAsText(f, 'utf-8');
        e.target.value = '';
      });
    }

    // Cargar ejemplo demo → proceso completo pre-poblado (para demostraciones a cliente)
    const sampleBtn = $('#btnLoadSample');
    if (sampleBtn) sampleBtn.addEventListener('click', guardIngest(() => {
      loadDemoProcess();
      closeIngestModal();
    }));

    // CSV event log
    $('#csvFile').addEventListener('change', handleCsvFile);
    $('#btnCsvSample').addEventListener('click', loadCsvSample);
    $('#btnIngestCsv').addEventListener('click', guardIngest(() => {
      const map = {
        case: $('#mapCase').value,
        act:  $('#mapAct').value,
        ts:   $('#mapTs').value,
        res:  $('#mapRes').value
      };
      buildProcessFromEventLog(window._csvData, map);
      closeIngestModal();
    }));
  }

  function activateIngestTab(name) {
    $$('.itab').forEach(t => t.classList.toggle('active', t.dataset.itab === name));
    $$('.ipanel').forEach(p => p.classList.toggle('active', p.dataset.ipanel === name));
  }

  // ----------- Speech recognition (Web Speech API) -----------
  function startSpeechRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert('Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge. También puedes pegar la transcripción manualmente.');
      return;
    }
    speechRecognition = new SR();
    speechRecognition.lang = 'es-PE';
    speechRecognition.continuous = true;
    speechRecognition.interimResults = true;

    const ta = $('#audioTranscript');
    let finalText = ta.value;

    speechRecognition.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript + ' ';
        else interim += r[0].transcript;
      }
      ta.value = finalText + interim;
    };

    speechRecognition.onerror = (e) => {
      $('#recStatus').textContent = 'Error: ' + e.error;
      $('#recStatus').classList.remove('recording');
    };

    speechRecognition.onend = () => {
      $('#recStatus').textContent = 'detenido';
      $('#recStatus').classList.remove('recording');
      $('#btnRecStart').disabled = false;
      $('#btnRecStop').disabled = true;
    };

    speechRecognition.start();
    $('#recStatus').textContent = 'grabando…';
    $('#recStatus').classList.add('recording');
    $('#btnRecStart').disabled = true;
    $('#btnRecStop').disabled = false;
  }

  function stopSpeechRecognition() {
    if (speechRecognition) { try { speechRecognition.stop(); } catch (e) {} speechRecognition = null; }
    $('#recStatus').textContent = 'listo';
    $('#recStatus').classList.remove('recording');
    $('#btnRecStart').disabled = false;
    $('#btnRecStop').disabled = true;
  }

  // ----------- NLP heurístico: texto → actividades -----------
  function buildProcessFromText(text, source) {
    const activities = parseTextToActivities(text);
    if (activities.length === 0) {
      alert('No pude extraer actividades del texto. Intenta separar por puntos o bullets.');
      return;
    }

    state.nodes = [];
    state.edges = [];
    state.selectedNodeId = null;

    let x = 80, y = 100;
    const cols = 5;
    const created = [];
    // Inicio
    const startNode = makeNode('start', x, y, 'Inicio');
    created.push(startNode); state.nodes.push(startNode);
    x += SHAPE_DEFAULTS.start.w + 60;

    activities.forEach((a, idx) => {
      const def = SHAPE_DEFAULTS[a.type];
      const defaultExec = a.type === 'system' ? 'system' : (a.type === 'task' ? 'manual' : '');
      const node = {
        id: 'n' + (state.nextId++),
        type: a.type,
        x, y, w: def.w, h: def.h,
        label: a.label,
        executionType: a.executionType || defaultExec,
        owner: a.owner || '', system: a.system || '',
        time: '', volume: '', va: '',
        sla: '', docsIn: '', docsOut: '', rules: '',
        notes: a.note || '', pains: []
      };
      state.nodes.push(node);
      created.push(node);
      x += def.w + 60;
      if (((created.length) % cols) === 0) { x = 80; y += 150; }
    });

    // Fin
    const endNode = makeNode('end', x, y, 'Caso completado');
    created.push(endNode); state.nodes.push(endNode);

    // Conectar linealmente
    for (let i = 0; i < created.length - 1; i++) {
      state.edges.push({ id: 'e' + (state.nextId++), from: created[i].id, to: created[i + 1].id, label: '' });
    }

    ensureDecisionBranches();
    persist();
    autoLayout();  // top-to-bottom MBB
    render();
    activateTab('copilot');
    copilotPost('ai',
      `He construido el flujograma desde la fuente **${source}**.\n\n` +
      `Detecté **${activities.length} actividades** (+ inicio/fin).\n` +
      `Patrones aplicados: actividades con verbos en infinitivo/imperativo, gateways de decisión por condicionales ("si", "cuando", "en caso").\n\n` +
      `Revisa, ajusta etiquetas y completa responsables. Cuando termines pídeme: *"detecta pains"* o *"sugiere KPIs"*.`);
  }

  // Garantiza que cada gateway de decisión tenga 2 salidas con etiquetas Sí/No
  // El end "Caso no procede" hereda el owner del decision (misma lane → sin cruces)
  function ensureDecisionBranches() {
    state.nodes.filter(n => n.type === 'decision').forEach(d => {
      // Gateways paralelos/inclusivos NO usan Sí/No — todas sus ramas se ejecutan
      if (d.gatewayType === 'parallel' || d.gatewayType === 'inclusive') return;
      const outs = state.edges.filter(e => e.from === d.id);
      if (outs.length === 0) return; // huérfano — el linter lo capta
      if (outs.length === 1) {
        if (!outs[0].label || !outs[0].label.trim()) outs[0].label = 'Sí';
        // SIEMPRE crea un end nuevo dedicado a este decision (no reusa)
        // así cada "Caso no procede" tiene rank+1 desde su decision y queda en misma lane
        const def = SHAPE_DEFAULTS.end;
        const altEnd = {
          id: 'n' + (state.nextId++),
          type: 'end',
          x: d.x + 180, y: d.y + 80,
          w: def.w, h: def.h,
          label: 'Caso no procede',
          executionType: '',
          owner: d.owner || '',           // hereda owner del decision
          system: '', time: '', volume: '', va: '',
          sla: '', docsIn: '', docsOut: '', rules: '', notes: '', pains: [],
          _autoGen: true                  // marca como auto-generado
        };
        state.nodes.push(altEnd);
        state.edges.push({ id: 'e' + (state.nextId++), from: d.id, to: altEnd.id, label: 'No' });
      } else if (outs.length >= 2) {
        if (!outs[0].label || !outs[0].label.trim()) outs[0].label = 'Sí';
        if (!outs[1].label || !outs[1].label.trim()) outs[1].label = 'No';
      }
    });
  }

  // Asigna códigos de actividad estilo BPMN/MBC: [USR-27], [RCV-18], etc.
  // Estables: solo asigna a nodos que no tengan código aún. Numeración por prefijo.
  function assignActivityCodes() {
    const counters = {};
    // Inicializa contadores con códigos ya existentes (para no repetir)
    state.nodes.forEach(n => {
      if (n.activityCode) {
        const m = n.activityCode.match(/^\[?([A-Z]+)-(\d+)\]?$/);
        if (m) counters[m[1]] = Math.max(counters[m[1]] || 0, parseInt(m[2], 10));
      }
    });
    // Recorre en orden de rank (si existe) para numerar de izquierda a derecha
    const ranks = state._lanes?.ranks || {};
    const ordered = state.nodes.slice().sort((a, b) => (ranks[a.id] || 0) - (ranks[b.id] || 0));
    ordered.forEach(n => {
      if (n.type !== 'task' && n.type !== 'system') return;
      if (n.activityCode) return; // ya tiene → respeta edición manual
      const exec = (window.EXECUTION_TYPES || []).find(t => t.id === n.executionType);
      const prefix = (exec && exec.codePrefix) || 'ACT';
      counters[prefix] = (counters[prefix] || 0) + 1;
      n.activityCode = `${prefix}-${String(counters[prefix]).padStart(2, '0')}`;
    });
  }

  // Computa el owner final de cada nodo: explícito → inferido (predecesor/sucesor) → más frecuente
  // Marca n._inferredOwner = true cuando el owner se infirió (para mostrar alerta visual)
  function computeOwners() {
    const final = {};
    state.nodes.forEach(n => {
      n._inferredOwner = false;
      if (n.owner && n.owner.trim()) final[n.id] = n.owner.trim();
    });

    // Owner más frecuente (para fallback)
    const counts = {};
    Object.values(final).forEach(o => { counts[o] = (counts[o] || 0) + 1; });
    let mostFrequent = null, bestC = 0;
    Object.entries(counts).forEach(([k, c]) => { if (c > bestC) { mostFrequent = k; bestC = c; } });

    const inMap = {}, outMap = {};
    state.edges.forEach(e => {
      (outMap[e.from] = outMap[e.from] || []).push(e.to);
      (inMap[e.to] = inMap[e.to] || []).push(e.from);
    });

    // Walk predecesores buscando owner
    function walkPred(id, visited) {
      if (final[id]) return final[id];
      if (visited.has(id)) return null;
      visited.add(id);
      for (const p of (inMap[id] || [])) {
        const o = walkPred(p, visited);
        if (o) return o;
      }
      return null;
    }
    // Walk sucesores buscando owner
    function walkSucc(id, visited) {
      if (final[id]) return final[id];
      if (visited.has(id)) return null;
      visited.add(id);
      for (const s of (outMap[id] || [])) {
        const o = walkSucc(s, visited);
        if (o) return o;
      }
      return null;
    }

    // Pasa 2: nodos sin owner → inferir
    state.nodes.forEach(n => {
      if (final[n.id]) return;
      let inferred = null;
      if (n.type === 'start') {
        inferred = walkSucc(n.id, new Set());
      } else if (n.type === 'end') {
        inferred = walkPred(n.id, new Set()) || walkSucc(n.id, new Set());
      } else {
        inferred = walkPred(n.id, new Set()) || walkSucc(n.id, new Set());
      }
      if (!inferred) inferred = mostFrequent || 'Por asignar';
      final[n.id] = inferred;
      n._inferredOwner = true;
    });

    return final;
  }

  function makeNode(type, x, y, label) {
    const def = SHAPE_DEFAULTS[type];
    const defaultExec = type === 'system' ? 'system' : (type === 'task' ? 'manual' : '');
    return {
      id: 'n' + (state.nextId++), type,
      x, y, w: def.w, h: def.h,
      label, executionType: defaultExec,
      owner: '', system: '', time: '', volume: '', va: '',
      sla: '', docsIn: '', docsOut: '', rules: '', notes: '', pains: []
    };
  }

  function parseTextToActivities(text) {
    const VERBS = ['registr','valid','aprob','revis','verific','captur','envi','reciv','recib','proces','genera','emit','firm','autoriz','rechaz','notific','consult','calcul','asign','clasific','derivar','escalar','conciliar','liquid','pag','cobr','despach','entreg','crear','actualiz','elimin','solicit','complet','llen','document','archiv','digit','escan','impr','contact','llamar','reun','analiz','evalu','diagnostic','transferir','elevar','ingresar','retir','depositar','girar','desembolsar','tramitar','gestionar','atender','resolver','programar','agendar','coordinar','informar','reportar','imprimir','adjunt','remitir','devolver','abrir','identificar','perfilar','navegar','alternar','explicar','simular','ofrecer','presentar','recibir','saludar','preguntar','realizar','iniciar','cerrar','seguir','continuar','proceder'];
    // Decisiones: requieren marca explícita de condición/pregunta, NO solo "cuando/dependiendo" narrativos
    const DECISION_HINTS = ['¿', 'si es', 'si no', 'sino', 'caso contrario', 'en caso de', 'de no ser'];
    const DECISION_VERBS = ['decide','cumple','aprueba','rechaza','tiene','requiere','necesita','existe','está','es elegible','es aprobado','califica','excede','supera','identifico','encuentro','detecto','identifica','encuentra','detecta','hay'];
    const NARRATIVE_STARTERS = ['cuando inicio', 'cuando un cliente', 'cuando empiezo', 'cuando termino', 'cuando llega', 'dependiendo de', 'durante', 'mientras', 'generalmente', 'normalmente', 'finalmente', 'también', 'luego', 'primero'];
    // Lista priorizada — roles más específicos primero
    const ROLES = ['ejecutivo comercial','asesor comercial','asesor bancario','agente comercial','back office','call center','recursos humanos','jefe de','gerente comercial','gerente de','analista de','coordinador','supervisor','tesorería','tesoreria','compliance','riesgos','operaciones','logística','logistica','almacén','almacen','compras','sistemas','contabilidad','auditoría','auditoria','rrhh','frontline','comercial','analista','gerente','asesor','ejecutivo','operario','jefe','cliente','usuario','proveedor'];
    const SYSTEMS = ['salesforce','servicenow','sharepoint','bizagi','sap','oracle','siebel','siaf','siga','workflow','portal','excel','jira','crm','erp','wms','tms','cms','core','motor de ofertas','motor de riesgo','scoring'];
    // Verbo en 1ra persona singular → infinitivo
    const FIRST_PERSON = {
      'abro':'Abrir','ingreso':'Ingresar','reviso':'Revisar','solicito':'Solicitar','realizo':'Realizar',
      'verifico':'Verificar','explico':'Explicar','contacto':'Contactar','navego':'Navegar','alterno':'Alternar',
      'saludo':'Saludar','identifico':'Identificar','pregunto':'Preguntar','hago':'Realizar','genero':'Generar',
      'escaneo':'Escanear','envío':'Enviar','envio':'Enviar','llamo':'Llamar','recibo':'Recibir','consulto':'Consultar',
      'analizo':'Analizar','procedo':'Proceder','continúo':'Continuar','continuo':'Continuar','registro':'Registrar',
      'valido':'Validar','apruebo':'Aprobar','rechazo':'Rechazar','asigno':'Asignar','clasifico':'Clasificar',
      'escalo':'Escalar','notifico':'Notificar','firmo':'Firmar','imprimo':'Imprimir','adjunto':'Adjuntar',
      'reciba':'Recibir','simulo':'Simular','ofrezco':'Ofrecer','presento':'Presentar','calculo':'Calcular',
      'preparo':'Preparar','redacto':'Redactar','comparo':'Comparar','evalúo':'Evaluar','evaluo':'Evaluar',
      'investigo':'Investigar','resuelvo':'Resolver','coordino':'Coordinar','informo':'Informar','reporto':'Reportar'
    };

    function isDecisionSentence(s) {
      const lower = s.toLowerCase().trim();
      if (/¿.+\?/.test(s)) return true;
      if (DECISION_HINTS.some(h => lower.startsWith(h) || lower.includes(' ' + h))) return true;
      // Patrón "si + sujeto + verbo de decisión"
      if (/^si\s+/.test(lower) && DECISION_VERBS.some(dv => lower.includes(dv))) return true;
      return false;
    }

    function isNarrativeStart(s) {
      const lower = s.toLowerCase().trim();
      return NARRATIVE_STARTERS.some(n => lower.startsWith(n));
    }

    // Estilo cavernícola: "Verbo + 1-2 objetos", máx 25 chars
    // Ej: "Ingresar carta", "Responder email", "Validar identidad", "Escalar caso"
    function extractLabel(s) {
      const STOPWORDS = new Set([
        'el','la','los','las','un','una','unos','unas','de','del','al','a','con','para','por','que','en','y','o','u',
        'su','sus','mi','mis','tu','tus','este','esta','estos','estas','ese','esa','le','les','me','te','se','lo',
        'muy','también','tambien','generalmente','normalmente','luego','después','despues','primero','finalmente',
        'siempre','algunas','algunos','veces','vez','durante','mientras','cuando','si','dependiendo','toda','todo','todas','todos',
        'esto','eso','aquí','aqui','allí','alli','aún','aun','ya','no','sí','si','muy','más','mas','menos','entre',
        'sobre','bajo','tras','según','segun','hacia','desde','sin','contra','ante','toda','todo','dos','tres','cinco','diez',
        'yo','tú','tu','él','el','ella','nosotros','ustedes','ellos','ellas','quien','quienes','cuyo','cuya',
        'pueden','puedo','puede','debe','debo','debemos','debes','va','vas','voy','vamos','vez','siguiente',
        'parte','etapa','proceso','conversación','minutos','horas','día','dia','manera','forma','momento',
        'oficina','ejecutivo','asesor','agente','cliente','clientes','banco','sistema','sistemas','plataforma',
        'información','datos','dato','aproximadamente','primer','primera','segundo','segunda','tercer','tercera',
        'mejor','peor','siguiente','anterior','algún','algun','alguna','algunos','algunas','ningún','ninguna',
        'cada','toda','todas','algo','nada','alguien','nadie','quién','cuál','cuáles','cuanto','cuanta','cuantos','cuantas'
      ]);

      // Verbos en infinitivo conocidos en el catálogo MBB (para detección rápida)
      const allowed = window.VERBS_ALLOWED || [];

      // Tokeniza limpiando puntuación
      const tokens = s.replace(/[¿?¡!.,;:()"'`""'']/g, ' ').toLowerCase().split(/\s+/).filter(Boolean);

      // Busca el primer verbo (en orden):
      // 1) 1ra persona conjugada → infinitivo
      // 2) Verbo del catálogo (infinitivo o forma reconocida)
      // 3) Cualquier palabra que termine en -ar/-er/-ir y tenga ≥4 letras
      // Verbos parásitos: si aparecen primero, los saltamos para buscar el verbo real
      const PARASITE = new Set(['Realizar', 'Hacer', 'Gestionar', 'Procesar', 'Tratar', 'Manejar', 'Ejecutar', 'Proceder', 'Continuar', 'Comenzar', 'Empezar']);
      let verbInf = null, verbIdx = -1;
      let parasiteFallback = null, parasiteIdx = -1;
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (FIRST_PERSON[t]) {
          const cand = FIRST_PERSON[t];
          if (PARASITE.has(cand)) {           // guarda como fallback, sigue buscando verbo real
            if (!parasiteFallback) { parasiteFallback = cand; parasiteIdx = i; }
            continue;
          }
          verbInf = cand; verbIdx = i; break;
        }
        // Verbos con pronombres enclíticos (contactarlos → Contactar)
        const stripped = t.replace(/(los|las|le|les|me|te|se|lo|la|nos)$/i, '');
        if (/(ar|er|ir)$/.test(stripped) && stripped.length >= 4 && allowed.some(v => stripped.startsWith(v))) {
          verbInf = stripped.charAt(0).toUpperCase() + stripped.slice(1);
          verbIdx = i; break;
        }
        if (/(ar|er|ir)$/.test(t) && t.length >= 4 && allowed.some(v => t.startsWith(v))) {
          const cand = t.charAt(0).toUpperCase() + t.slice(1);
          if (PARASITE.has(cand)) { if (!parasiteFallback) { parasiteFallback = cand; parasiteIdx = i; } continue; }
          verbInf = cand; verbIdx = i; break;
        }
      }
      // Si solo hubo verbo parásito, úsalo como último recurso
      if (!verbInf && parasiteFallback) { verbInf = parasiteFallback; verbIdx = parasiteIdx; }
      // Fallback: cualquier infinitivo aunque no esté en catálogo (stripeando enclíticos)
      if (!verbInf) {
        for (let i = 0; i < tokens.length; i++) {
          const raw = tokens[i];
          const t = raw.replace(/(los|las|le|les|me|te|se|lo|la|nos)$/i, '');
          if (/(ar|er|ir)$/.test(t) && t.length >= 5 && !STOPWORDS.has(t)) {
            const cand = t.charAt(0).toUpperCase() + t.slice(1);
            if (PARASITE.has(cand)) { if (!parasiteFallback) { parasiteFallback = cand; parasiteIdx = i; } continue; }
            verbInf = cand; verbIdx = i; break;
          }
        }
        if (!verbInf && parasiteFallback) { verbInf = parasiteFallback; verbIdx = parasiteIdx; }
      }

      if (!verbInf) return null; // sin verbo → no es actividad

      // Toma 1-2 substantivos después del verbo (descarta stopwords y preposiciones)
      const objs = [];
      for (let i = verbIdx + 1; i < tokens.length && objs.length < 2; i++) {
        const t = tokens[i];
        if (STOPWORDS.has(t)) continue;
        if (t.length < 3) continue;
        objs.push(t);
      }

      let label = (verbInf + (objs.length ? ' ' + objs.join(' ') : '')).trim();
      // Cap a 28 chars
      if (label.length > 28) label = label.slice(0, 25) + '…';
      return label;
    }

    // Limpia bullets/numeración y separa
    const cleaned = text
      .replace(/\r/g, '')
      .replace(/^[\s]*([0-9]+[\.\)]|[\-\*•·])\s*/gm, '');

    // Split por punto seguido de espacio, ; o saltos de línea
    const raw = cleaned.split(/(?:\.[\s\n]+|;[\s\n]+|\n+)/).map(s => s.trim()).filter(s => s.length >= 5);

    // Sub-split: divide oraciones largas en sub-cláusulas accionables
    // Filtra fragmentos cortos sin verbo (ej. "Teléfono", "Objetivos") que generan nodos basura
    const sentences = [];
    raw.forEach(s => {
      const subs = s.split(/(?:\.[\s]+|\s+también\s+|\s+luego\s+)/i).map(x => x.trim());
      const validSubs = subs.filter(x => {
        if (x.length < 20) return false;
        // Debe contener un verbo conocido O empezar como decisión
        const lower = x.toLowerCase();
        const hasVerbHere = VERBS.some(v => lower.includes(v)) ||
                            Object.keys(FIRST_PERSON).some(fp => new RegExp('\\b' + fp + '\\b').test(lower));
        const looksDecision = /^(si|cuando)\s+/.test(lower);
        return hasVerbHere || looksDecision;
      });
      if (validSubs.length <= 1) sentences.push(s); else sentences.push(...validSubs);
    });

    const activities = [];
    sentences.forEach(sentence => {
      const lower = sentence.toLowerCase();

      // Es decisión? (estricto)
      const isDecision = isDecisionSentence(sentence);

      // Saltar narrativas puras sin acción
      const startsNarrative = isNarrativeStart(sentence);
      const hasActionVerb = VERBS.some(v => lower.includes(v)) ||
                            Object.keys(FIRST_PERSON).some(fp => new RegExp('\\b' + fp + '\\b').test(lower));

      if (!isDecision && !hasActionVerb) return;
      // Si es narrativa pura sin acción real, skip
      if (startsNarrative && !hasActionVerb && !isDecision) return;

      // Detección de rol: prefiere "ejecutivo comercial" para textos de banca
      let owner = '';
      for (const r of ROLES) {
        // Busca el rol como palabra exacta (con bordes)
        const re = new RegExp('\\b' + r.replace(/\s+/g, '\\s+') + '\\b', 'i');
        if (re.test(lower)) {
          // Evita asignar "cliente" si la frase es claramente del ejecutivo actuando SOBRE el cliente
          if (r === 'cliente' && /\b(saludo|atiendo|identifico|registro|contacto|llamo|hablo|verifico|explico|ingreso|valido|reviso|consulto|solicito|envío|envio|escalo|notifico|genero|firmo|escaneo|adjunto|asigno|clasifico|aprueba|cumple|decide)\b/i.test(lower)) {
            // Si la frase es del ejecutivo, prefiere "Ejecutivo Comercial"
            owner = 'Ejecutivo Comercial';
            break;
          }
          owner = titleCase(r); break;
        }
      }

      // Extrae sistema
      let system = '';
      for (const s of SYSTEMS) {
        if (lower.includes(s)) { system = s.toUpperCase(); break; }
      }

      // Genera label: extraer verbo + objeto
      let label = extractLabel(sentence);
      if (!label || label.length < 4) return;

      // REGLA HARD: toda actividad (NO decisión) debe empezar con verbo en infinitivo
      if (!isDecision) {
        const firstWord = label.split(/\s+/)[0].toLowerCase().replace(/[^a-záéíóúñ]/g, '');
        const isInfinitiveEnding = /(?:ar|er|ir)$/i.test(firstWord) && firstWord.length >= 4;
        const isInCatalog = (window.VERBS_ALLOWED || []).some(v => firstWord.startsWith(v));
        if (!isInfinitiveEnding && !isInCatalog) {
          // Intento de salvataje: si la oración tiene un verbo conjugado conocido, lo reemplazo
          let salvaged = false;
          for (const conj in FIRST_PERSON) {
            if (new RegExp('\\b' + conj + '\\b', 'i').test(lower)) {
              label = FIRST_PERSON[conj] + ' ' + label.replace(/^\S+\s*/, '').trim();
              salvaged = true; break;
            }
          }
          if (!salvaged) return; // descartar — no es actividad válida
        }
      }

      // Inferir tipo de ejecución
      let executionType = '';
      if (isDecision) {
        executionType = '';
      } else if (/correo\b|email\b|e-?mail\b|notific/.test(lower)) {
        executionType = 'email';
      } else if (/\bllam[ao]|teléfono|telefono|\bcall\b|presencial/.test(lower)) {
        executionType = 'phone';
      } else if (/automátic|automatic|batch|nightly|trigger|sistema autom|motor de riesg|validaciones automátic|consultas? a motor/.test(lower)) {
        executionType = 'automatic';
      } else if (/\bia\b|inteligencia artificial|copilot|machine learn|\bml\b|modelo predict/.test(lower)) {
        executionType = 'ai';
      } else if (/firma física|papel|sello|expediente físic|contrato físic|firmar/.test(lower)) {
        executionType = 'document';
      } else if (/\brpa\b|\bbot\b/.test(lower)) {
        executionType = 'rpa';
      } else if (system) {
        executionType = 'system';
      } else {
        executionType = 'manual';
      }

      activities.push({
        type: isDecision ? 'decision' : (system ? 'system' : 'task'),
        label,
        owner,
        system,
        executionType,
        note: sentence
      });
    });

    return activities;
  }

  function titleCase(s) {
    return s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // ----------- CSV Event Log → Process Discovery ligero -----------
  function handleCsvFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(reader.result);
      previewCsv(parsed);
    };
    reader.readAsText(f);
  }

  function loadCsvSample() {
    const sample =
`case_id,activity,timestamp,resource
1001,Recibir solicitud,2026-01-10 09:00,Call Center
1001,Validar datos,2026-01-10 09:05,Call Center
1001,Aprobar solicitud,2026-01-10 10:20,Gerente
1001,Procesar en core,2026-01-10 11:00,Operaciones
1001,Notificar cliente,2026-01-10 11:30,Call Center
1002,Recibir solicitud,2026-01-10 09:15,Call Center
1002,Validar datos,2026-01-10 09:18,Call Center
1002,Rechazar solicitud,2026-01-10 09:25,Call Center
1002,Notificar cliente,2026-01-10 09:30,Call Center
1003,Recibir solicitud,2026-01-10 10:00,Call Center
1003,Validar datos,2026-01-10 10:03,Call Center
1003,Solicitar info adicional,2026-01-10 10:10,Call Center
1003,Validar datos,2026-01-10 14:00,Call Center
1003,Aprobar solicitud,2026-01-10 14:15,Gerente
1003,Procesar en core,2026-01-10 14:40,Operaciones
1003,Notificar cliente,2026-01-10 15:00,Call Center
1004,Recibir solicitud,2026-01-11 09:00,Call Center
1004,Validar datos,2026-01-11 09:04,Call Center
1004,Aprobar solicitud,2026-01-11 09:50,Gerente
1004,Procesar en core,2026-01-11 10:20,Operaciones
1004,Notificar cliente,2026-01-11 10:35,Call Center`;
    const parsed = parseCsv(sample);
    previewCsv(parsed);
  }

  function parseCsv(text) {
    const sep = (text.indexOf('\t') > -1 && text.indexOf(',') === -1) ? '\t' : ',';
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 0) return { headers: [], rows: [] };
    const headers = parseCsvLine(lines[0], sep).map(h => h.trim());
    const rows = lines.slice(1).map(l => {
      const cells = parseCsvLine(l, sep);
      const obj = {};
      headers.forEach((h, i) => obj[h] = (cells[i] || '').trim());
      return obj;
    });
    return { headers, rows };
  }

  // RFC 4180 — respeta comillas dobles, escaped quotes (""), separadores dentro de comillas
  function parseCsvLine(line, sep) {
    const out = [];
    let cur = '', inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQuotes) {
        if (c === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; }
          else inQuotes = false;
        } else cur += c;
      } else {
        if (c === '"') inQuotes = true;
        else if (c === sep) { out.push(cur); cur = ''; }
        else cur += c;
      }
    }
    out.push(cur);
    return out;
  }

  function previewCsv(parsed) {
    window._csvData = parsed;
    const preview = $('#csvPreview');
    preview.hidden = false;
    const sample = parsed.rows.slice(0, 6);
    let txt = parsed.headers.join(' | ') + '\n' + '-'.repeat(60) + '\n';
    sample.forEach(r => { txt += parsed.headers.map(h => r[h]).join(' | ') + '\n'; });
    txt += `\n(${parsed.rows.length} filas totales)`;
    preview.textContent = txt;

    // Llena mapping selects
    const guess = (kw) => parsed.headers.find(h => kw.some(k => h.toLowerCase().includes(k))) || parsed.headers[0];
    ['mapCase', 'mapAct', 'mapTs', 'mapRes'].forEach(id => {
      const sel = $('#' + id);
      sel.innerHTML = '';
      if (id === 'mapRes') sel.insertAdjacentHTML('beforeend', '<option value="">(ninguna)</option>');
      parsed.headers.forEach(h => sel.insertAdjacentHTML('beforeend', `<option value="${h}">${h}</option>`));
    });
    $('#mapCase').value = guess(['case', 'id']);
    $('#mapAct').value  = guess(['act', 'task', 'event', 'step']);
    $('#mapTs').value   = guess(['time', 'date', 'fecha', 'ts']);
    const resGuess = parsed.headers.find(h => ['user','res','owner','role','rol','responsab'].some(k => h.toLowerCase().includes(k)));
    $('#mapRes').value = resGuess || '';

    $('#csvMapping').hidden = false;
    $('#btnIngestCsv').disabled = false;
  }

  function buildProcessFromEventLog(parsed, map) {
    if (!parsed) return;
    const { rows } = parsed;

    // Agrupa por case
    const cases = {};
    rows.forEach(r => {
      const id = r[map.case];
      if (!id) return;
      (cases[id] = cases[id] || []).push({
        activity: r[map.act],
        ts: r[map.ts],
        resource: map.res ? r[map.res] : ''
      });
    });

    // Ordena por timestamp dentro de cada case
    Object.values(cases).forEach(events => {
      events.sort((a, b) => (a.ts || '').localeCompare(b.ts || ''));
    });

    // ── Variantes: agrupa casos por su secuencia de actividades (F4) ──
    const variantMap = {};
    const totalCasesN = Object.keys(cases).length;
    Object.values(cases).forEach(events => {
      const seq = events.map(e => e.activity).filter(Boolean).join(' → ');
      if (!seq) return;
      variantMap[seq] = (variantMap[seq] || 0) + 1;
    });
    state._variants = Object.entries(variantMap)
      .map(([seq, count]) => ({ seq, count, pct: Math.round(count / totalCasesN * 100), steps: seq.split(' → ').length }))
      .sort((a, b) => b.count - a.count);
    state._variantsTotalCases = totalCasesN;

    // Frecuencia de actividades y de transiciones (directly-follows)
    const actFreq = {};
    const actResource = {};
    const transFreq = {};
    Object.values(cases).forEach(events => {
      events.forEach((e, i) => {
        if (!e.activity) return;
        actFreq[e.activity] = (actFreq[e.activity] || 0) + 1;
        if (e.resource && !actResource[e.activity]) actResource[e.activity] = e.resource;
        if (i > 0 && events[i-1].activity) {
          const key = events[i-1].activity + '→' + e.activity;
          transFreq[key] = (transFreq[key] || 0) + 1;
        }
      });
    });

    const allActs = Object.entries(actFreq).sort((a,b) => b[1] - a[1]).map(([n]) => n);

    // Detecta start/end (actividades con muchas como primera/última en su caso)
    const startActs = {};
    const endActs = {};
    Object.values(cases).forEach(events => {
      if (events.length === 0) return;
      const first = events[0].activity, last = events[events.length-1].activity;
      if (first) startActs[first] = (startActs[first] || 0) + 1;
      if (last)  endActs[last]    = (endActs[last]    || 0) + 1;
    });

    // Construye diagrama
    state.nodes = [];
    state.edges = [];
    state.selectedNodeId = null;

    const startNode = makeNode('start', 80, 100, 'Inicio');
    const endNode   = makeNode('end',   80, 100, 'Fin');
    state.nodes.push(startNode);

    const nodeMap = {};
    let x = 220, y = 100;
    const cols = 4;
    allActs.forEach((act, idx) => {
      const isSystem = /(sistema|sap|crm|erp|core|portal)/i.test(act);
      const def = SHAPE_DEFAULTS[isSystem ? 'system' : 'task'];
      const node = {
        id: 'n' + (state.nextId++),
        type: isSystem ? 'system' : 'task',
        x, y, w: def.w, h: def.h,
        label: act,
        owner: actResource[act] || '',
        system: '', time: '',
        volume: String(actFreq[act]),
        va: '', notes: `Frecuencia observada: ${actFreq[act]}`, pains: []
      };
      state.nodes.push(node);
      nodeMap[act] = node;
      x += def.w + 60;
      if ((idx + 1) % cols === 0) { x = 220; y += 140; }
    });

    state.nodes.push(endNode);

    // Conecta start → top-2 actividades iniciales
    Object.entries(startActs).sort((a,b)=>b[1]-a[1]).slice(0,2).forEach(([act, freq]) => {
      if (nodeMap[act]) state.edges.push({ id: 'e' + (state.nextId++), from: startNode.id, to: nodeMap[act].id, label: `${freq} cases` });
    });

    // Conecta transiciones (filtra ruido: solo las que ocurren ≥ 10% del top)
    const transitions = Object.entries(transFreq).sort((a,b)=>b[1]-a[1]);
    const threshold = Math.max(1, Math.floor(transitions[0][1] * 0.1));
    transitions.forEach(([key, freq]) => {
      if (freq < threshold) return;
      const [from, to] = key.split('→');
      if (nodeMap[from] && nodeMap[to]) {
        state.edges.push({ id: 'e' + (state.nextId++), from: nodeMap[from].id, to: nodeMap[to].id, label: String(freq) });
      }
    });

    // Conecta top actividades finales → end
    Object.entries(endActs).sort((a,b)=>b[1]-a[1]).slice(0,2).forEach(([act, freq]) => {
      if (nodeMap[act]) state.edges.push({ id: 'e' + (state.nextId++), from: nodeMap[act].id, to: endNode.id, label: `${freq} cases` });
    });

    // Reposiciona end al final
    endNode.x = x + 100;
    endNode.y = y;

    persist();
    autoLayout();

    const totalCases = Object.keys(cases).length;
    activateTab('copilot');
    copilotPost('ai',
      `**Process discovery completado** desde event log.\n\n` +
      `• **${totalCases} casos** analizados\n` +
      `• **${allActs.length} actividades únicas** detectadas\n` +
      `• **${transitions.length} transiciones** descubiertas (mostrando las más frecuentes)\n` +
      `• Top inicio: *${Object.entries(startActs).sort((a,b)=>b[1]-a[1])[0]?.[0] || '—'}*\n` +
      `• Top fin: *${Object.entries(endActs).sort((a,b)=>b[1]-a[1])[0]?.[0] || '—'}*\n\n` +
      `El número en cada conexión = frecuencia observada. Las actividades con alta frecuencia que reaparecen son indicio de **reprocesos** (pain candidato).`);
  }

  // =================== BOOT ===================
  document.addEventListener('DOMContentLoaded', () => {
    init();
    attachIngestListeners();
  });
})();
