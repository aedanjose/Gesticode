/* Extensiones de análisis. Los casos solo se guardan en este navegador. */
(() => {
  'use strict';
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ratio = value => value === null ? 'Sin pasivo corriente' : `${fmt(value)} ×`;
  const storageKey = 'gesticode.cases.v1';
  let analysisData = null, profitData = null, scenarioData = null;
  let charts = [], restoring = false, storageBlocked = false, library = null, lastStored = null;
  const initialResults = Object.fromEntries(['health','profit','analysis'].map(key => [key, $(`#${key}-result`).innerHTML]));
  const assumptions = 'Escenario pro forma del mismo período, con saldos al cierre. Se mantiene el margen neto: utilidad nueva = utilidad base × (1 + variación de ventas). Solo la diferencia de utilidad se suma al efectivo y al patrimonio, sin dividendos. El pago de proveedores reduce efectivo y cuentas por pagar por igual. Cuentas por cobrar, inventarios, activos no corrientes y los demás pasivos no cambian. No se modelan cambios en impuestos, intereses, precios ni capital de trabajo adicional. No es una proyección de flujo de caja.';

  $('.page-heading').insertAdjacentHTML('beforebegin', `<div class="case-toolbar" aria-label="Casos de estudio"><label>Caso guardado<select id="case-select" aria-label="Caso guardado"></select></label><label>Empresa o ejercicio<input id="case-name" maxlength="80" placeholder="Nombre del caso"></label><button class="secondary" id="save-case">Guardar nombre</button><button class="secondary" id="new-case">Nuevo caso</button><button class="primary report-button" id="prepare-report">Reporte / PDF ↗</button><p class="case-status" id="case-status" role="status">Los casos se guardan solo en este navegador.</p></div>`);
  $('.nav').insertAdjacentHTML('beforeend', '<a href="#escenarios"><span>04</span> Simulador de escenarios</a>');
  views.escenarios = ['Explora decisiones antes de tomarlas.', 'Compara una base financiera con cambios en ventas y pagos a proveedores.'];
  $('#rentabilidad').insertAdjacentHTML('beforeend', '<div id="dupont-result" aria-live="polite"></div>');
  $('#analisis').insertAdjacentHTML('beforeend', `<div id="analysis-charts" hidden><div class="chart-grid"><article class="chart-card"><div class="panel-heading"><h3>Composición del balance</h3><label><span class="visually-hidden">Grupo del gráfico</span><select id="chart-group"><option value="assets">Activos</option><option value="funding">Pasivos y patrimonio</option></select></label></div><p class="chart-note">Participación sobre el total de cada año.</p><div class="chart-wrap"><canvas id="vertical-chart" role="img" aria-label="Gráfico de composición vertical de los dos años. Valores disponibles en la tabla de análisis."></canvas></div></article><article class="chart-card"><h3>Evolución de las cuentas</h3><p class="chart-note">Importes de ambos años, en la moneda de tu caso.</p><div class="chart-wrap"><canvas id="horizontal-chart" role="img" aria-label="Gráfico de barras comparativo por cuenta. Valores disponibles en la tabla de análisis."></canvas></div></article></div><p id="chart-status" class="chart-note" role="status"></p></div>`);
  $('footer').insertAdjacentHTML('beforebegin', `<section id="escenarios" class="module" hidden aria-labelledby="scenario-title"><div class="panel"><div class="panel-heading"><div><p class="eyebrow">04 / ESCENARIOS PRO FORMA</p><h2 id="scenario-title">¿Qué pasaría si…?</h2></div><div class="inline-actions"><button class="secondary" id="import-scenario">Usar último balance</button><button class="secondary" id="example-scenario">Cargar ejemplo</button></div></div><p class="muted">Completa la base con cifras del mismo período. El patrimonio se calcula como activos menos pasivos. Todos los cambios se recalculan al instante.</p><form id="scenario-form"><div class="scenario-inputs" id="scenario-inputs"></div></form><p id="scenario-import-note" class="muted" role="status"></p></div><div class="scenario-controls"><div><label for="sales-change">Variación de ventas<output id="sales-change-value" for="sales-change">0 %</output></label><input id="sales-change" type="range" min="-50" max="50" value="0" step="1"><div class="range-limits"><span>−50 %</span><span>+50 %</span></div></div><div><label for="payables-change">Pago de cuentas por pagar<output id="payables-change-value" for="payables-change">0 %</output></label><input id="payables-change" type="range" min="0" max="100" value="0" step="1"><div class="range-limits"><span>Sin pago adicional</span><span>Pago total</span></div></div></div><div class="form-footer"><span class="muted">La base permanece intacta mientras exploras.</span><button class="secondary" id="reset-scenario">Restablecer cambios a 0 %</button></div><div id="scenario-result" class="scenario-results" aria-live="polite"></div><details class="method"><summary>Supuestos, fórmulas y límites del simulador</summary><p>${assumptions}</p><p>Liquidez corriente = (efectivo + cuentas por cobrar + inventarios) ÷ (cuentas por pagar + otros pasivos corrientes). Capital de trabajo = activos corrientes − pasivos corrientes. Si no hay pasivos corrientes, la razón se muestra como no aplicable. ROA y ROE usan los saldos ajustados del escenario.</p><p>Si la empresa tiene pérdidas, incrementar ventas a margen negativo incrementa la pérdida. Un mayor ROE por reducción de activos o uso de deuda no equivale, por sí solo, a mejor salud.</p></details></section><section id="report-preview" class="report-preview" hidden aria-label="Vista previa del reporte"><div class="report-actions"><div><h2>Reporte ejecutivo</h2><p class="muted">En la ventana de impresión, elige «Guardar como PDF».</p></div><div class="inline-actions"><button class="primary" id="print-report">Imprimir / Guardar PDF</button><button class="secondary" id="close-report">Cerrar reporte</button></div></div><div id="report-document" class="report-document"></div></section>`);
  const scenarioLabels = { sales:'Ventas netas', profit:'Utilidad neta', cash:'Efectivo y bancos', receivables:'Cuentas por cobrar', inventory:'Inventarios', fixed:'Activos no corrientes netos', payables:'Cuentas por pagar (corrientes)', otherCurrent:'Otros pasivos corrientes', longDebt:'Pasivos a largo plazo' };
  $('#scenario-inputs').innerHTML = Finance.scenarioKeys.map(key => `<label>${scenarioLabels[key]}<input name="${key}" type="number" step="any" ${key === 'profit' ? '' : `min="${key === 'sales' ? '0.01' : '0'}"`} max="1000000000000000" required placeholder="0.00"></label>`).join('');
  navigate();

  function renderDuPont(data) {
    const d = Finance.dupont(data);
    $('#dupont-result').innerHTML = `<article class="panel advanced-panel"><p class="eyebrow">MODELO DU PONT / DESGLOSE DEL ROE</p><h2>Tres palancas detrás del rendimiento.</h2><div class="dupont-grid"><div class="factor"><h3>Margen neto</h3><strong>${pct(d.margin * 100)}</strong><small>Utilidad neta / ventas<br>Eficiencia en costos</small></div><span class="operator" aria-hidden="true">×</span><div class="factor"><h3>Rotación de activos</h3><strong>${fmt(d.turnover)} ×</strong><small>Ventas / activos<br>Eficiencia comercial</small></div><span class="operator" aria-hidden="true">×</span><div class="factor"><h3>Apalancamiento</h3><strong>${fmt(d.leverage)} ×</strong><small>Activos / patrimonio<br>Multiplicador del capital</small></div><span class="operator" aria-hidden="true">=</span><div class="factor final-factor"><h3>ROE Du Pont</h3><strong>${pct(d.roe * 100)}</strong><small>Coincide con utilidad / patrimonio</small></div></div><p class="muted">ROE = margen neto × rotación de activos × multiplicador del patrimonio. Se calcula sin redondear los factores; las cifras visibles se redondean a dos decimales. Se utilizan saldos al cierre, igual que en las razones anteriores.</p><p class="muted">El apalancamiento amplifica el resultado para el capital propio, también cuando hay pérdidas. Evalúa sus componentes en conjunto y compara empresas del mismo sector.</p><p class="chart-note sources">Referencia metodológica: <a href="https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/financial-analysis-techniques" target="_blank" rel="noopener">CFA Institute · Financial Analysis Techniques</a>.</p></article>`;
  }
  document.addEventListener('profit:calculated', event => { profitData = event.detail; renderDuPont(profitData); invalidateReport(); });
  document.addEventListener('analysis:calculated', event => { analysisData = event.detail; $('#analysis-charts').hidden = false; renderCharts(); invalidateReport(); });
  document.addEventListener('health:calculated', invalidateReport);
  $('#profit-form').addEventListener('input', () => { profitData = null; $('#dupont-result').innerHTML = ''; });
  $('#analysis-form').addEventListener('input', () => { analysisData = null; destroyCharts(); $('#analysis-charts').hidden = true; });

  function destroyCharts() { charts.forEach(chart => chart.destroy()); charts = []; }
  function renderCharts() {
    destroyCharts(); if (!analysisData) return;
    if (!window.Chart) { $('#chart-status').textContent = 'Los gráficos requieren conexión para cargar Chart.js. Todos los valores siguen disponibles en la tabla.'; return; }
    const { values, assets, year } = analysisData;
    const indices = $('#chart-group').value === 'funding' ? [4,5,6] : [0,1,2,3];
    const palette = ['#174d42','#528c70','#92bc78','#c4d988'];
    const common = { responsive:true, maintainAspectRatio:false, animation:false, plugins:{legend:{position:'bottom',labels:{boxWidth:12,font:{size:12}}}} };
    try {
      charts.push(new Chart($('#vertical-chart'), { type:'bar', data:{labels:[String(year),String(year+1)],datasets:indices.map((i,j) => ({label:accounts[i].label,data:[values[i][0]/assets[0]*100,values[i][1]/assets[1]*100],backgroundColor:palette[j]}))}, options:{...common,plugins:{...common.plugins,tooltip:{callbacks:{label:context => `${context.dataset.label}: ${pct(context.parsed.y)}`}}},scales:{x:{stacked:true,grid:{display:false}},y:{stacked:true,title:{display:true,text:'% del total'},ticks:{callback:v => `${v} %`}}}} }));
      charts.push(new Chart($('#horizontal-chart'), { type:'bar',data:{labels:accounts.map(a=>a.label),datasets:[0,1].map(i=>({label:String(year+i),data:values.map(v=>v[i]),backgroundColor:i ? '#84b85d' : '#174d42',borderRadius:3}))}, options:{...common,indexAxis:'y',scales:{x:{ticks:{callback:v=>fmt(v)}},y:{grid:{display:false},ticks:{font:{size:11}}}}} }));
      $('#chart-status').textContent = 'Pasa el cursor sobre una barra para ver su valor. Pulsa una leyenda para ocultar o mostrar esa serie. La tabla conserva todos los datos.';
    } catch { destroyCharts(); $('#chart-status').textContent = 'No se pudieron dibujar los gráficos. Consulta los mismos datos en la tabla.'; }
  }
  $('#chart-group').addEventListener('change', () => {renderCharts(); invalidateReport();});
  const chartScript = document.createElement('script');
  chartScript.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js';
  chartScript.async = true; chartScript.onload = renderCharts;
  chartScript.onerror = () => { if (analysisData) $('#chart-status').textContent = 'Chart.js no está disponible sin conexión. La tabla y los cálculos siguen funcionando.'; };
  document.head.append(chartScript);

  function scenarioBase() { return Object.fromEntries(Finance.scenarioKeys.map(key => [key, read($('#scenario-form'),key)])); }
  function renderScenario() {
    const growth = Number($('#sales-change').value), repayment = Number($('#payables-change').value);
    $('#sales-change-value').textContent = `${growth > 0 ? '+' : ''}${growth} %`;
    $('#payables-change-value').textContent = `${repayment} %`;
    scenarioData = null;
    if (!$('#scenario-form').checkValidity()) { $('#scenario-result').innerHTML = '<p class="scenario-empty">Completa todos los datos de la base, incluidos los ceros. También puedes cargar el ejemplo para explorar los controles.</p>'; return; }
    try {
      scenarioData = Finance.simulate(scenarioBase(),growth,repayment);
      const {base,scenario:s} = scenarioData;
      const metrics = [['ROA',pct(base.roa*100),pct(s.roa*100)],['ROE',pct(base.roe*100),pct(s.roe*100)],['Liquidez corriente',ratio(base.liquidity),ratio(s.liquidity)]];
      const rows = [['Ventas',base.sales,s.sales],['Utilidad neta',base.profit,s.profit],['Efectivo',base.cash,s.cash],['Activos totales',base.assets,s.assets],['Pasivos corrientes',base.currentLiabilities,s.currentLiabilities],['Patrimonio',base.equity,s.equity],['Capital de trabajo',base.workingCapital,s.workingCapital]];
      $('#scenario-result').innerHTML = `<div class="scenario-kpis">${metrics.map(([label,b,v])=>`<article><h3>${label}</h3><strong>${v}</strong><small>Base: ${b}</small></article>`).join('')}</div><div class="panel"><h3>De la base al escenario</h3><div class="table-scroll"><table><thead><tr><th>Concepto</th><th>Base</th><th>Escenario</th><th>Diferencia</th></tr></thead><tbody>${rows.map(([label,b,v])=>`<tr><th scope="row">${label}</th><td>${fmt(b)}</td><td>${fmt(v)}</td><td>${v-b>0?'+':''}${fmt(v-b)}</td></tr>`).join('')}</tbody></table></div><p class="muted">Pago a proveedores: ${fmt(scenarioData.payment)}. Cambio en utilidad retenida: ${fmt(scenarioData.retainedChange)}. El balance ajustado conserva activos = pasivos + patrimonio.</p></div>`;
    } catch (error) { $('#scenario-result').innerHTML = `<p class="warning" role="status">${escape(error.message)}</p>`; }
  }
  $('#scenario-form').addEventListener('submit', e=>e.preventDefault());
  $('#scenario-form').addEventListener('input', renderScenario);
  ['sales-change','payables-change'].forEach(id => $(`#${id}`).addEventListener('input',renderScenario));
  $('#reset-scenario').addEventListener('click', () => { $('#sales-change').value=0; $('#payables-change').value=0; renderScenario(); changed(); });
  $('#example-scenario').addEventListener('click', () => {
    const example={sales:200000,profit:15000,cash:25000,receivables:30000,inventory:35000,fixed:80000,payables:40000,otherCurrent:15000,longDebt:30000};
    Object.entries(example).forEach(([k,v])=>$('#scenario-form').elements.namedItem(k).value=v);
    $('#sales-change').value=0; $('#payables-change').value=0; $('#scenario-import-note').textContent='Ejemplo: patrimonio base 85,000; pasivos corrientes 55,000.'; renderScenario(); changed();
  });
  $('#import-scenario').addEventListener('click', () => {
    if (!analysisData || !profitData) { $('#scenario-import-note').textContent='Genera primero un análisis y una rentabilidad válidos, sin cambios pendientes.'; return; }
    const {values,assets,year}=analysisData;
    if (Math.abs(assets[1]-profitData.assets)>0.01 || Math.abs(values[6][1]-profitData.equity)>0.01) { $('#scenario-import-note').textContent='Los activos y el patrimonio de rentabilidad no coinciden con el último año del balance. Corrige los datos para evitar mezclar casos.'; return; }
    const valuesByKey={sales:profitData.sales,profit:profitData.profit,...Object.fromEntries(accounts.slice(0,5).map((a,i)=>[a.key,values[i][1]])),otherCurrent:'',longDebt:''};
    Object.entries(valuesByKey).forEach(([k,v])=>$('#scenario-form').elements.namedItem(k).value=v);
    $('#sales-change').value=0; $('#payables-change').value=0;
    $('#scenario-import-note').textContent=`Base de ${year+1} copiada. Distribuye los otros pasivos (${fmt(values[5][1])}) entre corrientes y largo plazo; comprueba que la suma coincida. La clasificación no se puede inferir del balance resumido.`;
    renderScenario(); changed();
  });
  renderScenario();

  function invalidateReport() { $('#report-preview').hidden=true; }
  const formIds=['health-form','analysis-form','profit-form','scenario-form'];
  function capture() {
    return { forms:Object.fromEntries(formIds.map(id=>[id,Object.fromEntries(new FormData($(`#${id}`)))])), year:$('#base-year').value, growth:$('#sales-change').value, repayment:$('#payables-change').value, hash:location.hash, importNote:$('#scenario-import-note').textContent };
  }
  function isValidData(data) {
    return data && typeof data==='object' && data.forms && typeof data.forms==='object' && formIds.every(id=>data.forms[id] && typeof data.forms[id]==='object' && !Array.isArray(data.forms[id]) && Object.values(data.forms[id]).every(v=>typeof v==='string' && v.length<=100)) && ['year','growth','repayment'].every(k=>typeof data[k]==='string' && data[k].length<=20);
  }
  function validLibrary(value) { return value && value.version===1 && typeof value.activeId==='string' && Array.isArray(value.cases) && value.cases.length>0 && value.cases.length<=50 && value.cases.every(c=>typeof c.id==='string' && typeof c.name==='string' && c.name.length<=80 && isValidData(c.data)) && value.cases.some(c=>c.id===value.activeId) && new Set(value.cases.map(c=>c.id)).size===value.cases.length; }
  function message(text,failed=false) { $('#case-status').textContent=text; $('#case-status').classList.toggle('failure',failed); }
  function activeCase(){return library.cases.find(c=>c.id===library.activeId);}
  function persist() {
    if(storageBlocked) return false;
    try {
      const existing=localStorage.getItem(storageKey);
      if(existing!==lastStored) {storageBlocked=true; message('El almacenamiento cambió en otra pestaña. Tus cambios siguen aquí; genera un reporte y recarga antes de seguir guardando.',true); return false;}
      const serialized=JSON.stringify(library); localStorage.setItem(storageKey,serialized);lastStored=serialized;return true;
    } catch {storageBlocked=true;message('No se pudo guardar en este navegador (permiso o espacio). Conserva esta pestaña o genera un reporte antes de cerrarla.',true);return false;}
  }
  function saveDraft() {
    if(restoring || !library) return;
    activeCase().data=capture(); activeCase().updatedAt=new Date().toISOString();
    if(persist()) message('Cambios guardados automáticamente en este navegador · '+new Date().toLocaleTimeString('es-NI',{hour:'2-digit',minute:'2-digit'})+'. No se sincronizan entre dispositivos.');
  }
  function changed(){invalidateReport();saveDraft();}
  function refreshCases(){
    $('#case-select').replaceChildren(...library.cases.map(c=>{const o=document.createElement('option');o.value=c.id;o.textContent=c.name;return o;}));
    $('#case-select').value=library.activeId;$('#case-name').value=activeCase().name;
  }
  function restore(data){
    restoring=true; destroyCharts(); analysisData=null;profitData=null;scenarioData=null;
    healthGenerated=false;analysisGenerated=false;profitGenerated=false;
    for(const id of formIds){const form=$(`#${id}`);form.reset();for(const el of form.elements){if(!el.name)continue;const v=data.forms[id][el.name];if(el.type==='radio')el.checked=el.value===v;else el.value=typeof v==='string'?v:'';}}
    $('#base-year').value=data.year; years();$('#sales-change').value=data.growth;$('#payables-change').value=data.repayment;
    $('#scenario-import-note').textContent=typeof data.importNote==='string'?data.importNote.slice(0,500):'';
    for(const key of ['health','profit','analysis']){$(`#${key}-result`).innerHTML=initialResults[key];$(`#${key}-error`).textContent='';}
    $('#dupont-result').innerHTML='';$('#analysis-charts').hidden=true;
    const answered=document.querySelectorAll('#health-form input:checked').length;$('#health-progress').textContent=`${answered} de 4 respuestas`;
    if(answered===4)$('#health-form').requestSubmit();
    for(const id of ['analysis-form','profit-form'])if($(`#${id}`).checkValidity())$(`#${id}`).requestSubmit();
    renderScenario();invalidateReport();location.hash=typeof data.hash==='string' && Object.hasOwn(views,data.hash.slice(1)) ? data.hash : '#salud';navigate();
    restoring=false;
  }
  try {
    lastStored=localStorage.getItem(storageKey);
    if(lastStored){const parsed=JSON.parse(lastStored);if(!validLibrary(parsed))throw new Error('invalid');library=parsed;}
  }catch{storageBlocked=true;message('No se pudieron leer los casos guardados. No se sobrescribirán. Puedes trabajar temporalmente y generar un reporte.',true);}
  if(!library){const id=crypto.randomUUID ? crypto.randomUUID() : String(Date.now());library={version:1,activeId:id,cases:[{id,name:'Caso sin nombre',data:capture(),updatedAt:new Date().toISOString()}]};if(!storageBlocked)persist();}
  refreshCases();restore(activeCase().data);
  if(!storageBlocked)message('Caso restaurado. Los cambios se guardan automáticamente solo en este navegador; borrar sus datos elimina los casos.');
  document.addEventListener('input',event=>{if(event.target.closest('form') || ['sales-change','payables-change'].includes(event.target.id))changed();});
  ['example-analysis','example-profit'].forEach(id=>$(`#${id}`).addEventListener('click',changed));
  document.addEventListener('profit:calculated',saveDraft);
  window.addEventListener('hashchange',saveDraft);
  $('#save-case').addEventListener('click',()=>{const name=$('#case-name').value.trim();if(!name){message('Escribe un nombre para el caso.',true);return;}activeCase().name=name;changed();refreshCases();});
  $('#case-select').addEventListener('change',()=>{const next=$('#case-select').value;saveDraft();if(storageBlocked){$('#case-select').value=library.activeId;return;}library.activeId=next;refreshCases();restore(activeCase().data);persist();if(!storageBlocked)message('Caso cargado: '+activeCase().name+'. Los cambios se guardan automáticamente.');});
  $('#new-case').addEventListener('click',()=>{saveDraft();if(storageBlocked)return;if(library.cases.length>=50){message('Se alcanzó el límite de 50 casos en este navegador.',true);return;}const id=crypto.randomUUID ? crypto.randomUUID() : String(Date.now());const data={forms:Object.fromEntries(formIds.map(k=>[k,{}])),year:'2024',growth:'0',repayment:'0',hash:'#salud'};library.cases.push({id,name:`Caso ${library.cases.length+1}`,data,updatedAt:new Date().toISOString()});library.activeId=id;refreshCases();restore(data);persist();$('#case-name').focus();if(!storageBlocked)message('Nuevo caso listo. Escribe un nombre y completa sus datos.');});
  window.addEventListener('storage',event=>{if(event.key===storageKey || event.key===null){storageBlocked=true;message('Otra pestaña modificó los casos. Para evitar sobrescribirlos, genera un reporte de tu trabajo y recarga esta página.',true);}});

  function reportSection(title,content){return `<section><h2>${title}</h2>${content}</section>`;}
  function cloneContent(selector){const node=$(selector).cloneNode(true);node.querySelectorAll('details').forEach(d=>d.open=true);node.querySelectorAll('button, .stale').forEach(n=>n.remove());return node.innerHTML;}
  function prepareReport(){
    // Generar siempre a partir de los inputs actuales, nunca de resultados obsoletos.
    healthGenerated=false;analysisData=null;profitData=null;
    if(document.querySelectorAll('#health-form input:checked').length===4)$('#health-form').requestSubmit();
    for(const id of ['analysis-form','profit-form'])if($(`#${id}`).checkValidity())$(`#${id}`).requestSubmit();
    renderScenario();
    const missing=text=>`<p class="report-placeholder">${text}</p>`;
    const sources=`<p class="sources">Metodología Du Pont: <a href="https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/financial-analysis-techniques">CFA Institute · Financial Analysis Techniques</a>. Gráficos: Chart.js 4.5.1. Umbrales de evaluación didácticos; deben adaptarse al sector.</p>`;
    let report=`<header class="report-cover"><p class="eyebrow">GESTICODE / INFORME FINANCIERO ACADÉMICO</p><h1>${escape(activeCase().name)}</h1><p>Emitido: ${escape(new Date().toLocaleString('es-NI'))}. Importes expresados en la misma unidad monetaria ingresada.</p><p>Informe de los datos actuales. Los módulos incompletos se indican expresamente; los escenarios son hipotéticos.</p></header>`;
    report+=reportSection('01 · Diagnóstico de salud',healthGenerated?`<table><tbody>${questions.map((q,i)=>`<tr><th>${q}</th><td>${$('#health-form').elements.namedItem(`q${i}`).value==='yes'?'Sí':'No'}</td></tr>`).join('')}</tbody></table>`+cloneContent('#health-result'):missing('No incluido: cuestionario incompleto.'));
    let chartImages='';
    if(analysisData && charts.length){chartImages='<p class="chart-note">Las gráficas incluyen todas las series; los valores numéricos se conservan en la tabla.</p>';for(const chart of charts){chart.data.datasets.forEach((_,i)=>chart.setDatasetVisibility(i,true));chart.resize(800,360);chart.update('none');chartImages+=`<img class="report-chart" src="${chart.toBase64Image()}" alt="${escape(chart.canvas.getAttribute('aria-label'))}">`;chart.resize();}}
    report+=reportSection('02 · Análisis vertical y horizontal',analysisData?cloneContent('#analysis-result')+chartImages:missing('No incluido: balance incompleto o inválido. '+escape($('#analysis-error').textContent)));
    if(profitData){const inputs=`<table><tbody>${[['Utilidad neta',profitData.profit],['Ventas netas',profitData.sales],['Activos totales',profitData.assets],['Patrimonio',profitData.equity]].map(([label,v])=>`<tr><th>${label}</th><td>${fmt(v)}</td></tr>`).join('')}</tbody></table>`;report+=reportSection('03 · Rentabilidad y modelo Du Pont',inputs+cloneContent('#profit-result')+cloneContent('#dupont-result')+cloneContent('#rentabilidad > .method'));}
    else report+=reportSection('03 · Rentabilidad y modelo Du Pont',missing('No incluido: cifras incompletas o inválidas. '+escape($('#profit-error').textContent)));
    if(analysisData && profitData && (Math.abs(analysisData.assets[1]-profitData.assets)>0.01 || Math.abs(analysisData.values[6][1]-profitData.equity)>0.01))report+='<p class="warning">Advertencia de consistencia: los activos o el patrimonio de rentabilidad no coinciden con el último balance. Se presentan como entradas independientes; no se deben interpretar como un único estado financiero conciliado.</p>';
    report+=reportSection('04 · Simulador de escenarios',scenarioData?`<p>Variación de ventas: ${pct(scenarioData.growth)}. Pago adicional de proveedores: ${pct(scenarioData.repayment)}.</p><table><thead><tr><th>Base del escenario</th><th>Importe</th></tr></thead><tbody>${Object.entries(scenarioBase()).map(([key,v])=>`<tr><th>${scenarioLabels[key]}</th><td>${fmt(v)}</td></tr>`).join('')}</tbody></table>`+cloneContent('#scenario-result')+`<h3>Supuestos del modelo</h3><p>${assumptions}</p><p>Liquidez corriente = activos corrientes / pasivos corrientes. Capital de trabajo = activos corrientes − pasivos corrientes. El simulador tiene su propia base, que puede diferir de los otros módulos.</p>`:missing('No incluido: base incompleta o escenario no viable. '+escape($('#scenario-result').innerText)));
    report+=reportSection('Criterios y alcance',sources+'<p>Los cálculos se realizan en el navegador. ROA = utilidad / activos; ROE = utilidad / patrimonio; margen neto = utilidad / ventas. No se utilizan saldos promedio. Este reporte apoya un ejercicio académico y no determina por sí solo una decisión de financiamiento.</p>');
    $('#report-document').innerHTML=report;$('#report-preview').hidden=false;
    $('#report-preview').scrollIntoView({behavior:'smooth',block:'start'});
    saveDraft();
  }
  $('#prepare-report').addEventListener('click',prepareReport);
  $('#print-report').addEventListener('click',()=>window.print());
  $('#close-report').addEventListener('click',()=>$('#report-preview').hidden=true);
  window.addEventListener('beforeprint',()=>{if($('#report-preview').hidden)prepareReport();});
})();
