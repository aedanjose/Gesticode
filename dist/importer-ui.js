/* Ventana «Pegar tabla»: analiza el texto, deja revisar cada fila y verifica con el motor antes de importar.
   La lógica vive en importer.js y finance.js; aquí solo hay pantalla. */
'use strict';
(function () {
  const IMP = StatementImporter;
  const SLOTS = ['previous', 'current'];
  const undo = { balance: null, income: null };           // una importación por tipo se puede deshacer en esta sesión
  let session = null;                                     // { kind, text, options, proposal }
  let dialog = null;

  const clone = value => JSON.parse(JSON.stringify(value));
  // en la ventana, las etiquetas siguen los años del documento mientras esté marcada la casilla de ajustarlos
  const shownYear = () => { const y = session?.proposal?.years || []; return session?.adjustYears && y.length >= 2 && F.validYear(Math.max(...y)) ? Math.max(...y) : state.year; };
  const periodLabel = slot => slot === 'current' ? 'T2 · ' + shownYear() : 'T1 · ' + (shownYear() - 1);
  const kindName = kind => kind === 'balance' ? 'balance general' : 'estado de resultados';

  // ── Franja sobre cada tabla de Estados ─────────────────────────────────────
  window.importBarHTML = kind => '<div class="import-bar"><button type="button" class="secondary" data-import="' + kind + '">⇪ Pegar tabla…</button>'
    + '<span class="muted">Copia el ' + kindName(kind) + ' de Excel, Word o un PDF y revísalo antes de importar.</span>'
    + (undo[kind] ? '<button type="button" class="secondary" data-import-undo="' + kind + '">↶ Deshacer la última importación</button>' : '') + '</div>';
  const redrawTables = () => { renderAccounts(); renderIncomeAccounts(); };

  // ── Ventana ────────────────────────────────────────────────────────────────
  function buildDialog() {
    if (dialog) return;
    dialog = document.createElement('dialog');
    dialog.id = 'import-dialog';
    dialog.className = 'import-dialog';
    dialog.setAttribute('aria-labelledby', 'import-title');
    dialog.innerHTML = '<div class="import-head"><div><p class="eyebrow">Importar</p><h2 id="import-title">Pegar tabla</h2></div><button type="button" class="icon-button" data-import-close aria-label="Cerrar">✕</button></div>'
      + '<div class="import-body"><p class="muted" id="import-help"></p>'
      + '<textarea id="import-text" spellcheck="false" aria-label="Tabla pegada" placeholder="Efectivo\t363,000\t288,000&#10;Cuentas por cobrar\t503,000\t365,000&#10;Total activos corrientes\t…"></textarea>'
      + '<div class="import-options">'
      + '<label>Formato de números<select id="import-decimal"><option value="auto">Automático</option><option value="dot">1,234.56 (coma para miles)</option><option value="comma">1.234,56 (punto para miles)</option></select></label>'
      + '<label>Columnas<select id="import-order"><option value="auto">Automático (según los años)</option><option value="t1t2">T1 primero, T2 después</option><option value="t2t1">T2 primero, T1 después</option></select></label>'
      + '<label>Unidades<select id="import-mult"><option value="1">Cifras completas</option><option value="1000">En miles (×1,000)</option><option value="1000000">En millones (×1,000,000)</option></select></label></div>'
      + '<div class="import-actions"><button type="button" class="primary" id="import-analyze">Analizar tabla</button></div><div id="import-review" aria-live="polite"></div></div>';
    document.body.append(dialog);
    dialog.addEventListener('click', onDialogClick);
    dialog.addEventListener('input', onDialogEdit);
    dialog.addEventListener('change', onDialogEdit);
    dialog.addEventListener('cancel', () => { session = null; });
  }
  function open(kind) {
    buildDialog();
    session = { kind, text: '', options: { kind, decimal: 'auto', order: 'auto', multiplier: 1 }, proposal: null, adjustYears: true, suggestPartial: true };
    dialog.querySelector('#import-title').textContent = 'Pegar tabla · ' + (kind === 'balance' ? 'Balance general' : 'Estado de resultados');
    dialog.querySelector('#import-help').textContent = 'Copia la tabla de Excel, Word o un PDF y pégala aquí: una cuenta por línea, con sus importes al final (una o dos columnas). Puedes incluir los totales del documento: se usan para comprobar que no se copió mal ninguna cifra.';
    dialog.querySelector('#import-text').value = '';
    for (const id of ['decimal', 'order', 'mult']) dialog.querySelector('#import-' + id).value = id === 'mult' ? '1' : 'auto';
    dialog.querySelector('#import-review').innerHTML = '';
    dialog.showModal();
    dialog.querySelector('#import-text').focus();
  }
  const close = () => { dialog?.close(); session = null; };

  function analyze() {
    const text = dialog.querySelector('#import-text').value;
    session.text = text;
    session.options = { kind: session.kind, decimal: dialog.querySelector('#import-decimal').value, order: dialog.querySelector('#import-order').value, multiplier: Number(dialog.querySelector('#import-mult').value) };
    session.proposal = IMP.analyze(text, session.options);
    renderReview();
  }

  // ── Revisión ───────────────────────────────────────────────────────────────
  const stamp = (cls, text) => '<span class="stamp ' + cls + '">' + text + '</span>';
  function rowHTML(r) {
    const balance = session.kind === 'balance', p = session.proposal, cols = p.columns.length === 1 ? ['current'] : SLOTS;
    const unclassified = IMP.unclassified(session.kind, r);
    const classCell = balance
      ? '<select data-r="' + r.id + '" data-f="class" aria-label="Clasificación de ' + esc(r.name) + '">' + options({ '': 'Elegir…', ...accountClasses }, classOf(r)) + '</select>'
      : '<select data-r="' + r.id + '" data-f="category" aria-label="Categoría de ' + esc(r.name) + '">' + options({ '': 'Elegir…', ...incomeCategoryLabels }, r.category || '') + '</select>';
    const roleCell = balance ? '<select data-r="' + r.id + '" data-f="role" aria-label="Rol de ' + esc(r.name) + '">' + options(rolesFor(classOf(r)), r.role || '') + '</select>' : '<span class="muted">—</span>';
    const memoIncome = !balance && r.category && F.incomeCategories[r.category].memo;
    const modeCell = balance ? '<select data-r="' + r.id + '" data-f="mode">' + options(accountModes, modeOf(r)) + '</select>'
      : memoIncome ? '<span class="muted">De los cuales</span>' : '<select data-r="' + r.id + '" data-f="mode">' + options(incomeModes, r.sign === -1 ? 'sub' : 'add') + '</select>';
    const amounts = cols.map(s => '<td><input type="number" step="any" data-r="' + r.id + '" data-f="amount" data-slot="' + s + '" value="' + (r.amounts[s] ?? '') + '" placeholder="sin informar" aria-label="' + esc(r.name) + ' · ' + periodLabel(s) + '"></td>').join('');
    const doubts = r.doubts.map(d => '<small class="' + d.level + '">' + (d.level === 'error' ? '✗ ' : '⚠ ') + esc(d.text) + '</small>').join('') + (unclassified && !r.doubts.some(d => d.level === 'error') ? '<small class="error">✗ Falta la clasificación.</small>' : '');
    return '<tr class="' + (!r.include ? 'off ' : '') + (unclassified ? 'doubt-error' : r.doubts.length ? 'doubt-warn' : '') + '" data-row="' + r.id + '"><td><input type="checkbox" data-r="' + r.id + '" data-f="include"' + (r.include ? ' checked' : '') + ' aria-label="Importar ' + esc(r.name) + '"></td>'
      + '<td><input type="text" class="acct-name" data-r="' + r.id + '" data-f="name" maxlength="80" value="' + esc(r.name) + '" aria-label="Nombre"></td><td>' + classCell + '</td><td>' + roleCell + '</td><td>' + modeCell + '</td>' + amounts + '<td class="doubts">' + doubts + '</td></tr>';
  }
  function tableHTML() {
    const p = session.proposal, cols = p.columns.length === 1 ? ['current'] : SLOTS;
    return '<div class="table-scroll"><table class="entry-table import-table"><thead><tr><th>✓</th><th>Cuenta</th><th>' + (session.kind === 'balance' ? 'Clasificación' : 'Categoría') + '</th><th>Rol</th><th>Tratamiento</th>' + cols.map(s => '<th>' + periodLabel(s) + '</th>').join('') + '<th>Dudas</th></tr></thead><tbody id="import-rows">' + p.rows.map(rowHTML).join('') + '</tbody></table></div>';
  }
  function checksHTML() {
    const p = session.proposal, c = p.check, cols = p.columns.length === 1 ? ['current'] : SLOTS;
    let html = '';
    if (c.totals.length) {
      html += '<h3>Totales del documento</h3><p class="muted">Cada total se compara con lo que suman las cuentas propuestas. Una diferencia suele ser una cifra mal copiada.</p><div class="table-scroll"><table class="import-checks"><thead><tr><th>Total del documento</th>' + cols.map(s => '<th>' + periodLabel(s) + ' · documento</th><th>calculado</th>').join('') + '<th></th></tr></thead><tbody>'
        + c.totals.map(t => '<tr><td>' + esc(t.name) + '</td>' + cols.map(s => '<td>' + numCell(t.doc[s]) + '</td><td>' + numCell(t.expected[s]) + '</td>').join('') + '<td>' + (t.status === 'ok' ? stamp('ok', 'COINCIDE') : t.status === 'diff' ? stamp('bad', 'NO COINCIDE · ' + cols.filter(s => t.diff[s] !== null && Math.abs(t.diff[s]) > 0.5).map(s => (s === 'current' ? 'T2 ' : 'T1 ') + (t.diff[s] > 0 ? '+' : '') + fmt(t.diff[s])).join(' ')) : stamp('wait', 'SIN VERIFICAR')) + '</td></tr>').join('') + '</tbody></table></div>';
    }
    if (session.kind === 'balance') {
      html += '<h3>Cuadre</h3><div class="cuadre">' + cols.map(s => {
        const x = c.cuadre[s], st = x.state === 'ok' ? ['ok', 'CUADRA'] : x.state === 'bad' ? ['bad', 'NO CUADRA'] : x.state === 'partial' ? ['wait', 'PARCIAL'] : x.state === 'error' ? ['bad', 'REVISAR'] : ['wait', 'SIN DATOS'];
        return '<div class="cuadre-line"><span class="cuadre-period">' + periodLabel(s) + '</span>' + (x.state === 'ok' || x.state === 'bad' ? '<span>Activos <b>' + numCell(x.assets) + '</b></span><span>Pasivos + patrimonio <b>' + numCell(x.funding) + '</b></span><span>Diferencia <b class="' + (x.state === 'bad' ? 'negative' : '') + '">' + numCell(x.difference) + '</b></span>' : '<span class="muted">' + esc(x.message || '') + '</span>') + '<span class="stamp ' + st[0] + '">' + st[1] + '</span></div>';
      }).join('') + '</div>';
    } else {
      const s = c.summary.current;
      if (s) html += '<h3>Utilidades calculadas con las cuentas propuestas</h3><div class="cuadre">' + [['Utilidad bruta', s.grossProfit], ['UAII', s.ebit], ['UAI', s.ebt], ['Utilidad neta', s.netProfit], ['Para comunes', s.commonProfit]].map(([l, v]) => '<div class="cuadre-line"><span class="cuadre-period">' + l + '</span><span><b>' + numCell(v) + '</b></span></div>').join('') + '</div>';
    }
    return html;
  }
  function actionsHTML() {
    const p = session.proposal, c = p.check, present = c.partsPresent, partialSuggested = session.kind === 'balance' && c.cuadre.current?.state === 'bad' && Object.values(present).some(Boolean) && !Object.values(present).every(Boolean);
    const existing = (session.kind === 'balance' ? state.accounts : state.incomeAccounts).filter(a => SLOTS.some(s => a.amounts[s] !== null)).length;
    let html = '<div class="import-foot">';
    if (c.blockers.length) html += '<ul class="import-blockers">' + c.blockers.map(b => '<li>' + esc(b) + '</li>').join('') + '</ul>';
    if (p.years.length >= 2 && (Math.max(...p.years) !== state.year || !state.hasPrevious) && F.validYear(Math.max(...p.years))) html += '<label class="check"><input type="checkbox" id="import-years"' + (session.adjustYears ? ' checked' : '') + '> Ajustar los años del caso a ' + Math.max(...p.years) + ' y ' + (Math.max(...p.years) - 1) + '</label>';
    if (partialSuggested) html += '<label class="check"><input type="checkbox" id="import-partial"' + (session.suggestPartial ? ' checked' : '') + '> El documento no trae todas las partes del balance: activar «Balance parcial» con las que sí trae</label>';
    html += '<div class="import-buttons"><button type="button" class="primary" data-import-apply="replace"' + (c.importable ? '' : ' disabled') + '>Reemplazar las cuentas actuales' + (existing ? ' (' + existing + ' con datos)' : '') + '</button>'
      + '<button type="button" class="secondary" data-import-apply="append"' + (c.importable ? '' : ' disabled') + '>Agregar a las existentes</button><button type="button" class="secondary" data-import-close>Cancelar</button></div></div>';
    return html;
  }
  function notesHTML() {
    const p = session.proposal, out = [];
    if (p.columns.length === 2) out.push('Columna 1 → <b>' + periodLabel(p.columns[0]) + '</b> · columna 2 → <b>' + periodLabel(p.columns[1]) + '</b>' + (p.years.length >= 2 ? ' (encabezado: ' + p.years.join(' y ') + ')' : ''));
    else if (p.columns.length === 1 && p.rows.length) out.push('Una sola columna de cifras → <b>' + periodLabel('current') + '</b>.');
    for (const n of p.notes) out.push(esc(n) + (/en miles|en millones/.test(n) && session.options.multiplier === 1 ? ' <button type="button" class="text-link" data-set-mult="' + (p.unitsHint === 'miles' ? 1000 : 1000000) + '">Aplicar ×' + (p.unitsHint === 'miles' ? '1,000' : '1,000,000') + '</button>' : ''));
    return '<div class="import-notes">' + out.map(x => '<p class="notice">' + x + '</p>').join('') + '</div>';
  }
  function summaryLine() {
    const p = session.proposal, doubtful = p.rows.filter(r => r.doubts.length || IMP.unclassified(session.kind, r)).length;
    return '<p class="muted">' + p.rows.length + ' cuentas propuestas' + (doubtful ? ' · <b>' + doubtful + ' con dudas</b> (marcadas)' : ' · ninguna con dudas') + '. Corrige lo que haga falta antes de importar.</p>';
  }
  function renderReview() {
    const box = dialog.querySelector('#import-review'), p = session.proposal;
    if (!p.rows.length) { box.innerHTML = notesHTML() + '<p class="muted">No hay filas para revisar.</p>'; return; }
    box.innerHTML = notesHTML() + summaryLine() + tableHTML() + '<div id="import-live">' + checksHTML() + actionsHTML() + '</div>';
  }
  const renderLive = () => { dialog.querySelector('#import-live').innerHTML = checksHTML() + actionsHTML(); };

  // ── Ediciones en la revisión ───────────────────────────────────────────────
  function onDialogEdit(event) {
    const el = event.target;
    if (el.id === 'import-years') { session.adjustYears = el.checked; if (event.type === 'change' && session.proposal) renderReview(); return; }
    if (el.id === 'import-partial') { session.suggestPartial = el.checked; return; }
    if (['import-decimal', 'import-order', 'import-mult'].includes(el.id)) { if (event.type === 'change' && dialog.querySelector('#import-text').value.trim()) analyze(); return; }
    if (el.dataset.r === undefined || !session?.proposal) return;
    const r = session.proposal.rows.find(x => x.id === Number(el.dataset.r)), field = el.dataset.f;
    if (!r) return;
    if (field === 'include') r.include = el.checked;
    else if (field === 'name') r.name = el.value;
    else if (field === 'amount') r.amounts[el.dataset.slot] = el.value === '' ? null : Number(el.value);
    else if (field === 'class') { if (el.value === '') { r.section = null; r.term = null; r.role = null; } else { if (el.value === 'equity') { r.section = 'equity'; r.term = null; } else [r.section, r.term] = el.value.split('.'); const rule = r.role && F.accountRoles[r.role]; if (rule && !(rule.section === r.section && rule.term === r.term)) r.role = null; } if (!r.role) r.memo = false; }
    else if (field === 'category') { r.category = el.value || null; if (r.category && F.incomeCategories[r.category].memo) r.sign = 1; }
    else if (field === 'role') { r.role = el.value || null; if (!r.role) r.memo = false; }
    else if (field === 'mode') { r.memo = el.value === 'memo'; r.sign = el.value === 'sub' ? -1 : 1; }
    session.proposal.check = IMP.verify(session.proposal);
    const structural = ['include', 'class', 'category', 'role', 'mode'].includes(field);
    if (structural && event.type === 'change') {
      const tr = dialog.querySelector('[data-row="' + r.id + '"]');
      tr.outerHTML = rowHTML(r);
      dialog.querySelector('[data-row="' + r.id + '"] [data-f="' + field + '"]')?.focus();
    }
    if (event.type === 'change' || field === 'amount' || field === 'name') renderLive();
  }
  function onDialogClick(event) {
    const t = event.target;
    if (t.closest('[data-import-close]')) return close();
    if (t.closest('#import-analyze')) return analyze();
    const mult = t.closest('[data-set-mult]');
    if (mult) { dialog.querySelector('#import-mult').value = mult.dataset.setMult; return analyze(); }
    const apply = t.closest('[data-import-apply]');
    if (apply) applyImport(apply.dataset.importApply);
  }

  // ── Importar y deshacer ────────────────────────────────────────────────────
  function applyImport(mode) {
    const p = session.proposal, check = IMP.verify(p);
    if (!check.importable) return;
    const balance = session.kind === 'balance', key = balance ? 'accounts' : 'incomeAccounts', existing = state[key].filter(a => SLOTS.some(s => a.amounts[s] !== null)).length;
    if (mode === 'replace' && existing && !window.confirm('Se reemplazarán las ' + existing + ' cuentas actuales con datos por las importadas. Podrás deshacerlo en esta sesión. ¿Continuar?')) return;
    const rows = IMP.toStateRows(p).map(r => ({ id: uid(), ...r })), imported = rows.length;
    if (mode === 'append' && state[key].length + rows.length > 80) { status('Máximo 80 cuentas: quita algunas o usa «Reemplazar».', true); return; }
    undo[session.kind] = { key, list: clone(state[key]), year: state.year, hasPrevious: state.hasPrevious, partial: clone(state.partial) };
    state[key] = mode === 'replace' ? rows : [...state[key], ...rows];
    const notes = [];
    if (!balance) {   // el estado de resultados pide las seis categorías: las que el documento no trae quedan como filas en blanco para completarlas (0 si no existen)
      const blank = F.defaultIncomeAccounts().filter(t => Object.hasOwn(F.incomeParts, t.category) && !state[key].some(a => a.category === t.category || (t.category === 'taxes' && a.category === 'taxRate')));
      for (const t of blank) state[key].push({ ...t, id: uid() });
      if (blank.length) notes.push('completa en blanco: ' + blank.map(t => F.incomeParts[t.category].toLowerCase()).join(', '));
    }
    if (p.columns.length === 2 && !state.hasPrevious) { state.hasPrevious = true; notes.push('se activaron los dos ejercicios'); }
    if (session.adjustYears && p.years.length >= 2 && F.validYear(Math.max(...p.years))) { state.year = Math.max(...p.years); state.hasPrevious = true; notes.push('años ajustados a ' + state.year); }
    if (balance && dialog.querySelector('#import-partial')?.checked) { state.partial.enabled = true; state.partial.complete = { ...check.partsPresent }; notes.push('Balance parcial activado'); }
    openAccounts.clear();
    fillForms(); persist(); window.refresh?.(); navigate();
    status('Importadas ' + imported + ' cuentas del ' + kindName(session.kind) + (notes.length ? ' · ' + notes.join(' · ') : '') + '.');
    close();
  }
  document.addEventListener('click', event => {
    const openBtn = event.target.closest('[data-import]');
    if (openBtn) return open(openBtn.dataset.import);
    const undoBtn = event.target.closest('[data-import-undo]');
    if (undoBtn) {
      const kind = undoBtn.dataset.importUndo, snap = undo[kind];
      if (!snap) return;
      state[snap.key] = snap.list; state.year = snap.year; state.hasPrevious = snap.hasPrevious; state.partial = snap.partial; undo[kind] = null;
      openAccounts.clear(); fillForms(); persist(); window.refresh?.(); navigate(); status('Importación deshecha.');
    }
  });
  window.ImporterUI = { open, close, get session() { return session; }, analyze };
  redrawTables();     // dibuja la franja «Pegar tabla» ahora que el módulo está cargado
})();
