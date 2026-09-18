/* Las reglas de interpretación son ejemplos didácticos configurables. */
const $ = (selector) => document.querySelector(selector);
const number = new Intl.NumberFormat('es-NI', { maximumFractionDigits: 2 });
const fmt = value => number.format(value);
const pct = value => Number.isFinite(value) ? `${fmt(value)} %` : 'No calculable';
const questions = [
  '¿La empresa paga sus obligaciones a tiempo?',
  '¿Los cobros habituales cubren los gastos operativos?',
  '¿Las deudas actuales dificultan la operación?',
  '¿Hay inventario acumulado que tarda en venderse?'
];
$('#questions').innerHTML = questions.map((q, i) => `<div class="question" role="group" aria-labelledby="question-${i}"><div class="question-text"><span class="question-index">0${i + 1}</span><h3 id="question-${i}">${q}</h3></div><div class="choices">${['Sí', 'No'].map((label, j) => `<label class="choice"><input type="radio" name="q${i}" value="${j === 0 ? 'yes' : 'no'}" aria-label="${label}"><span>${label}</span></label>`).join('')}</div></div>`).join('');
const views = {
  salud: ['Una mirada a la salud de tu empresa.', 'Reconoce las señales de riesgo antes de tomar una decisión.'],
  analisis: ['Entiende lo que cambió. Y lo que pesa.', 'Compara la evolución de las cuentas y su participación en el balance.'],
  rentabilidad: ['Los resultados, en perspectiva.', 'Relaciona la utilidad con los recursos que la hicieron posible.']
};
function navigate() {
  const key = Object.hasOwn(views, location.hash.slice(1)) ? location.hash.slice(1) : 'salud';
  document.querySelectorAll('.module').forEach(section => section.hidden = section.id !== key);
  document.querySelectorAll('.nav a').forEach(link => { const active = link.hash === `#${key}`; link.classList.toggle('active', active); if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
  $('#page-title').textContent = views[key][0]; $('#page-description').textContent = views[key][1];
}
window.addEventListener('hashchange', navigate); navigate();
let healthGenerated = false, profitGenerated = false, analysisGenerated = false;
function markStale(selector) { const result = $(selector); if (!result.querySelector('.stale')) result.insertAdjacentHTML('afterbegin', '<p class="stale">Datos modificados. Genera el resultado nuevamente para actualizarlo.</p>'); }
$('#health-form').addEventListener('change', () => { $('#health-progress').textContent = `${new FormData($('#health-form')).size ?? document.querySelectorAll('#health-form input:checked').length} de 4 respuestas`; if (healthGenerated) markStale('#health-result'); });
$('#health-form').addEventListener('submit', event => {
  event.preventDefault(); const data = new FormData(event.currentTarget); const answers = questions.map((_, i) => data.get(`q${i}`));
  if (answers.some(a => !a)) { $('#health-error').textContent = 'Responde las cuatro preguntas para generar el diagnóstico.'; return; }
  $('#health-error').textContent = '';
  const risks = [answers[0] === 'no', answers[1] === 'no', answers[2] === 'yes', answers[3] === 'yes'];
  const count = risks.filter(Boolean).length;
  const critical = risks[0] || risks[1] || risks[2];
  const title = count === 0 ? 'Una base favorable.' : critical ? 'Primero, estabilizar.' : 'Atención al inventario.';
  const advice = [
    'Ordena las fechas de pago y revisa el efectivo disponible para cubrir las obligaciones.',
    'Prepara un presupuesto de caja y revisa cobros, gastos y necesidades de capital de trabajo.',
    'Revisa las cuotas y el costo de la deuda antes de asumir nuevas obligaciones.',
    'Revisa la rotación del inventario y ajusta las compras para liberar efectivo.'
  ].filter((_, i) => risks[i]);
  if (!count) advice.push('Contrasta esta evaluación con las razones financieras y el flujo de caja.', 'Antes de evaluar un préstamo, compara su costo con el rendimiento esperado y verifica la capacidad de pago.');
  $('#health-result').innerHTML = `<p class="eyebrow">TU DIAGNÓSTICO</p><div><span class="status ${count === 0 ? 'good' : critical ? 'danger' : 'caution'}">${count} de 4 señales de riesgo</span></div><h2 class="diagnosis-heading">${title}</h2><p class="diagnosis-intro">${critical ? 'En este escenario, conviene resolver las presiones de caja o deuda antes de considerar mayor apalancamiento.' : count ? 'La acumulación de inventario puede inmovilizar efectivo. Revisa su rotación antes de ampliar el financiamiento.' : 'Las respuestas no muestran las señales de riesgo evaluadas. Es un punto de partida para estudiar la viabilidad de financiamiento.'}</p><ul class="advice">${advice.map(a => `<li>${a}</li>`).join('')}</ul><p class="score-note">Árbol didáctico: problemas de pagos, caja o deuda tienen prioridad; después se evalúa el inventario. Este cuestionario no determina por sí solo la capacidad de endeudamiento.</p>`;
  healthGenerated = true;
  document.dispatchEvent(new CustomEvent('health:calculated'));
});
const accounts = [
  { key: 'cash', label: 'Efectivo y bancos', group: 'ACTIVOS' },
  { key: 'receivables', label: 'Cuentas por cobrar' },
  { key: 'inventory', label: 'Inventarios' },
  { key: 'fixed', label: 'Activos no corrientes netos' },
  { key: 'payables', label: 'Cuentas por pagar', group: 'PASIVOS Y PATRIMONIO' },
  { key: 'debt', label: 'Otros pasivos' },
  { key: 'equity', label: 'Patrimonio' }
];
$('#account-inputs').innerHTML = accounts.map(a => `${a.group ? `<tr class="section-row"><td colspan="3">${a.group}</td></tr>` : ''}<tr><th scope="row">${a.label}</th>${[0, 1].map(year => `<td><input type="number" step="any" ${a.key === 'equity' ? '' : 'min="0"'} name="${a.key}${year}" aria-label="${a.label}, ${year === 0 ? 'año inicial' : 'año siguiente'}" placeholder="0.00" required></td>`).join('')}</tr>`).join('');
function years() { const y = Number($('#base-year').value); $('#next-year').textContent = y + 1; document.querySelectorAll('.year-a').forEach(el => el.textContent = y); document.querySelectorAll('.year-b').forEach(el => el.textContent = y + 1); }
$('#base-year').addEventListener('input', years);
$('#analysis-form').addEventListener('input', () => { if (analysisGenerated) markStale('#analysis-result'); });
$('#profit-form').addEventListener('input', () => { if (profitGenerated) markStale('#profit-result'); });
const read = (form, name) => Number(form.elements.namedItem(name).value);
function horizontal(before, after) { return before > 0 ? (after - before) / before * 100 : null; }
function analysisRow(label, before, after, bases, key = '') {
  const delta = after - before, variation = horizontal(before, after);
  const danger = (key === 'payables' || key === 'debt') && variation !== null && variation >= 30;
  const vertical = [before / bases[0] * 100, after / bases[1] * 100];
  return `<tr class="${key === 'total' ? 'total' : ''}"><th scope="row">${label}</th><td>${fmt(before)}</td><td>${fmt(after)}</td>${vertical.map(v => `<td>${pct(v)}<div class="bar-track" aria-hidden="true"><div class="bar-fill" style="width:${Math.max(0, Math.min(v, 100))}%"></div></div></td>`).join('')}<td>${delta > 0 ? '+' : ''}${fmt(delta)}</td><td class="${danger ? 'negative' : 'neutral'}">${variation === null ? 'N/C¹' : `${variation > 0 ? '+' : ''}${pct(variation)}`}${danger ? '<br><span class="status danger">Revisar crecimiento</span>' : ''}</td></tr>`;
}
$('#analysis-form').addEventListener('submit', event => {
  event.preventDefault(); const form = event.currentTarget;
  const values = accounts.map(a => [read(form, `${a.key}0`), read(form, `${a.key}1`)]);
  if (values.flat().some(v => !Number.isFinite(v) || Math.abs(v) > 1e15)) { $('#analysis-error').textContent = 'Ingresa importes válidos de hasta 1 000 000 000 000 000.'; return; }
  const assets = [0, 1].map(i => values.slice(0, 4).reduce((sum, v) => sum + v[i], 0));
  const liabilities = [0, 1].map(i => values.slice(4, 6).reduce((sum, v) => sum + v[i], 0));
  const funding = [0, 1].map(i => liabilities[i] + values[6][i]);
  if (assets.some(v => v <= 0)) { $('#analysis-error').textContent = 'El total de activos debe ser mayor que cero en ambos años.'; return; }
  const mismatch = [0, 1].filter(i => Math.abs(assets[i] - funding[i]) > 0.01);
  if (mismatch.length) { $('#analysis-error').textContent = `El balance no cuadra: activos = pasivos + patrimonio. Diferencia ${mismatch.map(i => `en ${Number($('#base-year').value) + i}: ${fmt(assets[i] - funding[i])}`).join('; ')}. Revisa los importes antes de analizar.`; return; }
  $('#analysis-error').textContent = ''; const y = Number($('#base-year').value);
  let rows = accounts.map((a, i) => analysisRow(a.label, ...values[i], assets, a.key));
  rows.splice(4, 0, analysisRow('Total de activos', ...assets, assets, 'total'));
  rows.push(analysisRow('Total pasivos + patrimonio', ...funding, assets, 'total'));
  const payablesChange = horizontal(...values[4]);
  $('#analysis-result').innerHTML = `<div class="panel analysis-output"><p class="eyebrow">RESULTADO / ${y} → ${y + 1}</p><h2>Estructura y variación del balance</h2><div class="table-scroll"><table><thead><tr><th scope="col">Cuenta</th><th scope="col">${y}</th><th scope="col">${y + 1}</th><th scope="col">Vertical ${y}</th><th scope="col">Vertical ${y + 1}</th><th scope="col">Δ absoluto</th><th scope="col">Δ horizontal</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>${payablesChange !== null && payablesChange >= 30 ? `<div class="warning">Las cuentas por pagar crecieron ${pct(payablesChange)}. Revisa los plazos con proveedores y el efectivo disponible; el crecimiento por sí solo no demuestra un problema de liquidez.</div>` : ''}<details class="method"><summary>Cómo leer estos resultados</summary><p>Vertical = cuenta ÷ activos totales del mismo año × 100. En pasivos y patrimonio la base equivalente es el total de pasivos + patrimonio. Horizontal = (año siguiente − año inicial) ÷ año inicial × 100. Δ absoluto = año siguiente − año inicial.</p><p>¹ N/C: no se calcula la variación porcentual cuando la base es cero o negativa; se conserva la diferencia absoluta. El rojo marca crecimientos de pasivos ≥ 30 % como señal didáctica de revisión. Aumentar o disminuir una cuenta no es necesariamente favorable o desfavorable.</p></details></div>`;
  analysisGenerated = true;
  document.dispatchEvent(new CustomEvent('analysis:calculated', { detail: { values, assets, funding, year: y } }));
});
$('#example-analysis').addEventListener('click', () => {
  const example = [[20000,25000],[25000,30000],[30000,35000],[75000,80000],[25000,40000],[50000,45000],[75000,85000]];
  accounts.forEach((a,i) => example[i].forEach((v,j) => $('#analysis-form').elements.namedItem(`${a.key}${j}`).value = v));
  $('#base-year').value = 2024; years(); $('#analysis-form').requestSubmit();
});
function classify(value, healthy) { return value < 5 ? ['danger', 'Alerta'] : value < healthy ? ['caution', 'Aceptable'] : ['good', 'Saludable']; }
$('#profit-form').addEventListener('submit', event => {
  event.preventDefault(); const form = event.currentTarget;
  const [profit, sales, assets, equity] = ['profit','sales','assets','equity'].map(key => read(form,key));
  if ([profit,sales,assets,equity].some(v => !Number.isFinite(v) || Math.abs(v) > 1e15) || sales <= 0 || assets <= 0 || equity <= 0) { $('#profit-error').textContent = 'Ingresa cifras válidas. Ventas, activos y patrimonio deben ser mayores que cero y todos los importes deben ser de hasta 1 000 000 000 000 000.'; return; }
  if (equity > assets) { $('#profit-error').textContent = 'El patrimonio no debe superar los activos totales en este ejercicio. Revisa los datos.'; return; }
  $('#profit-error').textContent = '';
  const metrics = [
    { label: 'ROA · Rendimiento de activos', value: profit / assets * 100, healthy: 10, advice: ['La utilidad generada por los activos es baja. Revisa su uso y los costos operativos.', 'Los activos generan un rendimiento intermedio según la escala del ejercicio.', 'Los activos generan un rendimiento favorable según la escala del ejercicio.'] },
    { label: 'ROE · Retorno del patrimonio', value: profit / equity * 100, healthy: 15, advice: ['El retorno para los accionistas es bajo. Revisa costos, utilidad y estructura de financiamiento.', 'El capital propio obtiene un retorno intermedio según la escala del ejercicio.', 'El retorno del capital propio es favorable en esta escala. Contrástalo con el nivel de deuda.'] },
    { label: 'Margen neto · Utilidad sobre ventas', value: profit / sales * 100, healthy: 10, advice: ['Una proporción reducida de las ventas se convierte en utilidad. Revisa gastos, costos y precios.', 'La proporción de utilidad sobre ventas se ubica en el rango intermedio del ejercicio.', 'La proporción de utilidad sobre ventas es favorable según la escala del ejercicio.'] }
  ];
  $('#profit-result').innerHTML = `<p class="eyebrow">RENDIMIENTO DEL PERÍODO</p>${metrics.map(m => { const [type,label] = classify(m.value,m.healthy); return `<div class="metric"><h3>${m.label}</h3><div class="metric-top"><strong class="metric-value">${pct(m.value)}</strong><span class="status ${type}">${label}</span></div><p>${m.value < 0 ? 'La empresa registra pérdidas en este período. ' : ''}${m.advice[type === 'danger' ? 0 : type === 'caution' ? 1 : 2]}</p></div>`; }).join('')}<p class="score-note">Interpretación con umbrales didácticos. Consulta las fórmulas y los criterios debajo.</p>`;
  profitGenerated = true;
  document.dispatchEvent(new CustomEvent('profit:calculated', { detail: { profit, sales, assets, equity } }));
});
$('#example-profit').addEventListener('click', () => { Object.entries({profit:15000,sales:200000,assets:150000,equity:75000}).forEach(([key,value]) => $('#profit-form').elements.namedItem(key).value = value); $('#profit-form').requestSubmit(); });

// Reutiliza el formulario visible en navegadores compatibles con WebMCP.
if (document.modelContext?.registerTool) {
  const lifecycle = new AbortController();
  const keys = ['profit', 'sales', 'assets', 'equity'];
  try {
    Promise.resolve(document.modelContext.registerTool({
      name: 'calculate_profitability', title: 'Calcular rentabilidad',
      description: 'Completa el formulario de rentabilidad y genera ROA, ROE y margen neto en la página.',
      inputSchema: { type: 'object', properties: Object.fromEntries(keys.map(key => [key, { type: 'number', ...(key !== 'profit' ? { exclusiveMinimum: 0 } : {}), maximum: 1e15, minimum: key === 'profit' ? -1e15 : 0 }])), required: keys, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (!input || typeof input !== 'object' || Object.keys(input).length !== 4 || keys.some(key => typeof input[key] !== 'number' || !Number.isFinite(input[key]) || Math.abs(input[key]) > 1e15) || input.sales < 0.01 || input.assets < 0.01 || input.equity < 0.01 || input.equity > input.assets) throw new Error('Cifras inválidas: bases positivas de al menos 0.01 y patrimonio no mayor que activos.');
        keys.forEach(key => $('#profit-form').elements.namedItem(key).value = input[key]);
        location.hash = 'rentabilidad'; navigate(); $('#profit-form').requestSubmit();
        return { roa: input.profit / input.assets * 100, roe: input.profit / input.equity * 100, margin: input.profit / input.sales * 100 };
      }
    }, { signal: lifecycle.signal })).catch(() => {});
    window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
  } catch { /* El formulario funciona también sin esta API opcional. */ }
}
