/* Presentación, semáforos, gráficos, escenarios y reporte sobre el estado central. */
'use strict';
const metricNames={workingCapital:'Capital de trabajo neto',currentRatio:'Razón corriente',quickRatio:'Prueba ácida',inventoryTurnover:'Rotación de inventarios',inventoryDays:'Días de inventario',receivableTurnover:'Rotación de cuentas por cobrar',collectionDays:'Período promedio de cobro',payableTurnover:'Rotación de cuentas por pagar',paymentDays:'Período promedio de pago',fixedTurnover:'Rotación de activos fijos',assetTurnover:'Rotación de activos totales',debtRatio:'Índice de deuda',debtEquity:'Deuda / patrimonio',interestCoverage:'Cobertura de intereses',grossMargin:'Margen bruto',operatingMargin:'Margen operativo',netMargin:'Margen neto',roa:'ROA · rendimiento de activos',roe:'ROE · retorno del patrimonio',gao:'Apalancamiento operativo · GAO',gaf:'Apalancamiento financiero · GAF',gat:'Apalancamiento total · GAT',breakEvenSales:'Equilibrio operativo monetario'};
const unitLabel={percent:'%',money:'importe',times:'veces',days:'días','money/share':'por acción'};
const valueOf=m=>!m||m.value===null?esc(m?.reason||'Datos pendientes'):m.unit==='percent'?pct(m.value):fmt(m.value)+(m.unit==='times'?' ×':m.unit==='days'?' días':m.unit==='money/share'?' / acción':'');
let result=null,cvuBase=null,cvuAlt=null,financialScenario=null,engineError='',cvuError='',alternativeError='',scenarioError='';
let chartInstances={};let chartsLoaded=false;
const empty=message=>'<div class="empty-state">'+esc(message)+' <a href="#estados">Revisar datos ↗</a></div>';
function thresholds(){
 const t=state.thresholds,valid=Object.keys(thresholdDefaults).every(k=>typeof t[k]==='number'&&Number.isFinite(t[k])&&(k==='workingCapital'||t[k]>=0))&&t.currentMin<=t.currentMax&&['debtRatio','roe','netMargin'].every(k=>t[k]<=1);
 $('#threshold-error').textContent=valid?'':'Umbrales inválidos. Se usan las referencias por defecto hasta corregirlos (porcentajes 0–100 y rango corriente ordenado).';
 return valid?t:thresholdDefaults;
}
function signal(key,m){
 const t=thresholds();if(!m||m.value===null)return {type:'neutral',label:'Sin referencia calculable',text:m?.reason||'Completa los datos requeridos.'};
 const v=m.value;
 if((key==='quickRatio'&&v<t.quickRatio)||(key==='workingCapital'&&v<t.workingCapital)||(key==='interestCoverage'&&v<t.interestCoverage)||(key==='debtRatio'&&v>t.debtRatio))return {type:'critical',label:'Crítico',text:({quickRatio:'La cobertura sin inventarios podría ser insuficiente para las obligaciones corrientes.',workingCapital:'El pasivo corriente supera el activo corriente; revisa la programación de caja.',interestCoverage:'La utilidad operativa ofrece una cobertura reducida frente a los intereses.',debtRatio:'Una proporción elevada de los activos se financia con pasivos; revisa plazos y capacidad de pago.'})[key]};
 if((key==='inventoryDays'&&v>t.inventoryDays)||(key==='collectionDays'&&v>t.collectionDays)||(key==='gat'&&v>t.gat))return {type:'attention',label:'Atención',text:({inventoryDays:'La permanencia del inventario supera la referencia; podría inmovilizar recursos.',collectionDays:'El plazo de cobro supera la referencia; contrasta con la política comercial.',gat:'El resultado por acción presenta alta sensibilidad a cambios en ventas bajo estos supuestos.'})[key]};
 if((key==='currentRatio'&&v>=t.currentMin&&v<=t.currentMax)||(key==='roe'&&v>t.roe)||(key==='netMargin'&&v>t.netMargin))return {type:'favorable',label:'Referencia favorable',text:'El indicador supera o se ubica dentro de la referencia didáctica configurada. No sustituye la evaluación de los demás indicadores.'};
 return {type:'neutral',label:'Lectura contextual',text:'Interpreta este resultado según el sector, la tendencia y los otros indicadores; no tiene una señal activada con las reglas actuales.'};
}
const badge=s=>'<span class="badge '+s.type+'">'+(s.type==='critical'?'! ':s.type==='attention'?'△ ':s.type==='favorable'?'✓ ':'')+s.label+'</span>';
function card(key,m,source=''){
 const trace=source||('Fuente: estados del caso activo; T2 '+state.year+'. '+$('#method-note').textContent);
 const s=signal(key,m);return '<article class="indicator"><div class="indicator-header"><h3>'+metricNames[key]+'</h3>'+badge(s)+'</div><strong class="indicator-value '+(m?.value===null?'unavailable':'')+'">'+valueOf(m)+'</strong><p class="formula">'+esc(m?.formula||'')+'</p><details><summary>Interpretación y trazabilidad</summary><p><b>Resultado matemático:</b> '+valueOf(m)+'.</p><p><b>Interpretación:</b> '+esc(s.text)+'</p><p class="muted">'+esc(trace)+'</p></details></article>';
}
function group(title,metrics,note='',source=''){return '<section class="ratio-group"><div class="section-title"><h2>'+title+'</h2>'+(note?'<p>'+esc(note)+'</p>':'')+'</div><div class="indicator-grid">'+Object.entries(metrics).map(([k,m])=>card(k,m,source)).join('')+'</div></section>';}
function table(headers,rows){return '<div class="table-scroll"><table><thead><tr>'+headers.map(h=>'<th scope="col">'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map((c,i)=>i?'<td>'+c+'</td>':'<th scope="row">'+c+'</th>').join('')+'</tr>').join('')+'</tbody></table></div>';}
function healthHTML(){
 const answered=state.health.filter(v=>v!==null).length;
 if(answered<4)return '<p class="eyebrow">DIAGNÓSTICO CUALITATIVO</p><h2>Primero, observar.</h2><p>'+answered+' de 4 respuestas. Completa el cuestionario para interpretar señales operativas sin reemplazar las razones financieras.</p>';
 const risk=[state.health[0]==='no',state.health[1]==='no',state.health[2]==='yes',state.health[3]==='yes'],critical=risk.slice(0,3).some(Boolean);
 const messages=['Ordena las fechas de pago y revisa el efectivo disponible.','Prepara un presupuesto de caja y revisa cobros y gastos operativos.','Revisa las cuotas y el costo de la deuda antes de asumir nuevas obligaciones.','Evalúa la rotación del inventario y las compras para liberar efectivo.'];
 return '<p class="eyebrow">LECTURA CUALITATIVA · '+risk.filter(Boolean).length+' SEÑALES</p><h2>'+(critical?'Primero, estabilizar.':risk[3]?'Atención al inventario.':'Una base favorable.')+'</h2><p>'+(critical?'Las respuestas son consistentes con presiones operativas. Conviene estudiarlas antes de ampliar el financiamiento.':'Contrasta estas respuestas con los indicadores, los flujos de caja y el costo de financiamiento.')+'</p><ul>'+messages.filter((_,i)=>risk[i]).map(t=>'<li>'+t+'</li>').join('')+'</ul><p class="muted">El árbol prioriza pagos, cobertura operativa y deuda; después inventario. Este cuestionario no constituye un semáforo global ni determina capacidad de endeudamiento.</p>';
}
function analysisTable(type){
 const b=type==='balance'?result?.currentBalance:result?.currentIncome,p=type==='balance'?result?.previousBalance:result?.previousIncome;
 const title=type==='balance'?'Balance general':'Estado de resultados';
 if(!b)return '<article class="panel"><h2>'+title+'</h2>'+empty(result?.errors[type==='balance'?'balance':'income']||engineError||'Completa los estados financieros.')+'</article>';
 const keys=type==='balance'?[...F.balanceKeys.slice(0,6),'currentAssets','assets',...F.balanceKeys.slice(6,10),'currentLiabilities','liabilities','equity','funding']:['sales','costSales','grossProfit','operatingExpenses','ebit','interest','ebt','taxes','netProfit','preferredDividends','commonProfit'];
 const labels={...balanceLabels,...incomeLabels,currentAssets:'Total activos corrientes',assets:'Total activos',currentLiabilities:'Total pasivos corrientes',liabilities:'Total pasivos',funding:'Total pasivos + patrimonio'};
 const rows=keys.map(k=>{
  const v=F.compareValues(p?p[k]:null,b[k],p?(type==='balance'?p.assets:p.sales):null,type==='balance'?b.assets:b.sales);
  const unknown='<span class="muted">Sin informar</span>';
  return [labels[k],p?(v.before===null?unknown:fmt(v.before)):'—',v.after===null?unknown:fmt(v.after),v.verticalBefore===null?'—':pct(v.verticalBefore),v.after===null?'—':v.verticalAfter===null?((type==='balance'?b.assets:b.sales)===null?'<span class="muted">Total sin informar</span>':'Base cero'):pct(v.verticalAfter),v.absolute===null?'—':fmt(v.absolute),v.relative===null?'<span class="muted">'+esc(v.after===null?'Sin informar en T2':p&&v.before===null?'Sin informar en T1':v.relativeReason)+'</span>':pct(v.relative)];
 });
 return '<article class="panel"><p class="eyebrow">ANÁLISIS VERTICAL + HORIZONTAL</p><h2>'+title+'</h2>'+table(['Cuenta','T1 · '+(state.year-1),'T2 · '+state.year,'Vertical T1','Vertical T2','Δ absoluto','Δ relativo'],rows)+'</article>';
}
function accountsAnalysis(){
 const two=state.hasPrevious,title='<p class="eyebrow">ANÁLISIS POR CUENTA</p><h2>Balance general, cuenta por cuenta</h2>';
 const accounts=state.accounts.map(a=>two?a:{...a,amounts:{previous:null,current:a.amounts.current}});
 if(!accounts.some(a=>a.amounts.current!=null||a.amounts.previous!=null))return '';
 let cmp;
 try{cmp=F.compareBalanceAccounts(accounts,state.partial?.enabled?{complete:{previous:state.partial.complete,current:state.partial.complete}}:{});}
 catch(e){return '<article class="panel section-space">'+title+empty(e.message)+'</article>';}
 const cell=v=>v===null||v===undefined?'—':fmt(v),share=v=>v===null||v===undefined?'—':pct(v);
 const rel=r=>r.relative===null?'<span class="muted">'+esc(r.relativeReason||'—')+'</span>':pct(r.relative);
 const cols=two?['Cuenta','T1 · '+(state.year-1),'T2 · '+state.year,'Vertical T1','Vertical T2','Δ absoluto','Δ relativo']:['Cuenta','T2 · '+state.year,'Vertical T2'];
 const line=(label,r,cls)=>'<tr'+(cls?' class="'+cls+'"':'')+'><th scope="row">'+label+'</th>'+(two?'<td>'+cell(r.before)+'</td>':'')+'<td>'+cell(r.after)+'</td>'+(two?'<td>'+share(r.verticalBefore)+'</td>':'')+'<td>'+share(r.verticalAfter)+'</td>'+(two?'<td>'+cell(r.absolute)+'</td><td>'+rel(r)+'</td>':'')+'</tr>';
 const groupRows=Object.fromEntries(cmp.groups.map(g=>[g.key,g]));
 let body='';
 for(const g of balanceGroups){
  if(g.sum){body+=line(esc(g.title),groupRows[g.total],'grp-sum');continue;}
  const rows=cmp.accounts.map((r,i)=>[r,state.accounts[i]]).filter(([r,a])=>classOf(a)===g.key&&(r.before!==null||r.after!==null));
  if(!rows.length)continue;
  body+='<tr class="grp-head"><td colspan="'+cols.length+'"><span class="grp-title">'+esc(g.title)+'</span></td></tr>'+rows.map(([r])=>line(esc(r.name)+(r.sign===-1?' <span class="muted">(resta)</span>':'')+(r.memo?' <span class="muted">(de los cuales)</span>':''),r)).join('')+line('Subtotal · '+esc(g.title),groupRows[g.total],'grp-total');
 }
 const bal=cmp.balanced,bad=[bal.previous===false?'T1':'',bal.current===false?'T2':''].filter(Boolean),note=bad.length?'<p class="warning">El balance no cuadra en '+bad.join(' y ')+': las bases de activo y de financiamiento difieren.</p>':'';
 return '<article class="panel section-space">'+title+'<div class="table-scroll"><table class="ledger-table analysis-table"><thead><tr>'+cols.map(c=>'<th scope="col">'+c+'</th>').join('')+'</tr></thead><tbody>'+body+'</tbody></table></div>'+note+'<p class="muted">Vertical: cuenta / total de activos (activo) o / total de pasivo + patrimonio (financiamiento). Horizontal: (T2 − T1) / T1; con base cero no hay porcentaje. Las cuentas «resta» se muestran con su importe registrado.</p></article>';
}
function duPontHTML(p){
 if(!p)return empty('Du Pont requiere estados válidos y la metodología seleccionada completa.');
 const d=p.dupont;
 return '<article class="panel section-space"><p class="eyebrow">MODELO DU PONT</p><h2>Tres factores. Un mismo retorno.</h2><div class="dupont-grid">'+[['Margen neto',d.margin,'Utilidad / ventas'],['Rotación de activos',d.turnover,'Ventas / activos base'],['Multiplicador',d.leverage,'Activos base / patrimonio base'],['ROE Du Pont',d.roe,'Producto de los tres factores']].map(([l,m,f],i)=>'<div class="factor '+(i===3?'factor-final':'')+'"><span>'+l+'</span><strong>'+valueOf(m)+'</strong><small>'+f+'</small></div>').join('<span class="operator" aria-hidden="true">×</span>')+'</div><p class="muted">Método: '+(p.method==='average'?'activos y patrimonio promedio T1/T2':'saldos al cierre T2')+'. Activos base: '+fmt(p.bases.assets)+'; patrimonio base: '+fmt(p.bases.equity)+'. Diferencia frente al ROE directo: '+(d.difference===null?'no calculable':Math.abs(d.difference)<1e-10?'0.00 puntos porcentuales (identidad verificada)':fmt(d.difference*100)+' puntos porcentuales')+'. Los factores se multiplican antes de redondear.</p></article>';
}
function cvuHTML(c){
 const rows=[['Ventas',c.sales],['− Costos variables',c.variableCosts],['= Margen de contribución',c.contribution],['− Costos fijos',c.fixedCosts],['= UAII',c.ebit],['− Intereses',c.interest],['= UAI',c.ebt],['− Impuestos / crédito teórico',c.taxes],['= Utilidad después de impuestos',c.afterTax],['− Dividendos preferentes',c.preferredDividends],['= Utilidad común',c.commonProfit]];
 return '<div class="cvu-layout"><article class="panel"><p class="eyebrow">CASCADA DE RESULTADOS</p><h2>Del ingreso a la acción.</h2>'+table(['Etapa','Importe'],rows.map(([l,v])=>[l,fmt(v)]))+'<div class="eps"><span>UPA · utilidad por acción</span><strong>'+valueOf(c.eps)+'</strong></div></article><div><article class="equilibrium panel"><p class="eyebrow">PUNTO DE EQUILIBRIO OPERATIVO</p><h2>'+fmt(c.breakEvenUnits)+' <span>unidades</span></h2><strong>'+fmt(c.breakEvenSales)+'</strong><p class="muted">CF / (P − CVu). Mínimo entero: '+fmt(c.minimumWholeUnits)+' unidades. Contribución por unidad: '+fmt(c.contributionUnit)+'.</p></article>'+group('Apalancamiento · método directo',{gao:c.gao,gaf:c.gaf,gat:c.gat},'Sensibilidad en el nivel de operación de esta base.','Fuente: CVU base independiente. Método directo; todos los factores usan cantidad, costos, financiamiento e impuestos de la misma base.')+'</div></div>';
}
function renderRatios(){
 const text='Actividad: '+(result?.activity?.method==='average'?'promedios T1/T2':state.hasPrevious?'requiere balances T1 y T2 válidos':'saldos al cierre T2')+'. Rentabilidad: '+(result?.profitability?.method==='average'?'promedios de activos y patrimonio T1/T2':'saldos al cierre o datos pendientes')+'. Base de tiempo: '+state.params.days+' días.'+(result?.activity?.creditSalesAssumed?' Ventas a crédito supuestas = ventas totales (opción activada; infórmalas para usar el dato real).':'')+(result?.activity?.purchasesMethod==='inventory'&&result?.activity?.purchasesEstimated?' Compras = costo de ventas + inventario final − inventario inicial.':'');
 $('#method-note').textContent=text;
 const a=result?.activity;
 $('#ratio-groups').innerHTML=(result?.liquidity?group('01 / Liquidez',result.liquidity,'Capacidad de cobertura de las obligaciones corrientes.'):empty('Completa un balance T2 conciliado.'))+
 (a?group('02 / Actividad y eficiencia',a.metrics,(a.purchasesEstimated?(a.purchasesMethod==='inventory'?'Compras estimadas = costo de ventas + inventario final − inventario inicial: ':'Compras a crédito estimadas = '+fmt(state.params.purchaseRate*100)+' % del costo de ventas: '):'Compras a crédito reales: ')+fmt(a.purchases)+'. '+(a.method==='average'?'Bases promedio T1/T2.':'Bases al cierre T2.')):empty('Actividad requiere resultados y las bases de los períodos seleccionados.'))+
 (result?.debt?group('03 / Endeudamiento y cobertura',result.debt):'')+(result?.profitability?group('04 / Rentabilidad',result.profitability.metrics):empty('Rentabilidad requiere estados válidos; un T1 incompleto no se sustituye por cierre silenciosamente.'));
 $('#dupont-result').innerHTML=duPontHTML(result?.profitability);
 const periods=[['T1 · '+(state.year-1),result?.previousBalance,result?.previousIncome],['T2 · '+state.year,result?.currentBalance,result?.currentIncome]];
 $('#profit-trend-table').innerHTML=table(['Ejercicio','Margen neto','ROA al cierre','ROE al cierre'],periods.map(([label,b,i])=>{const p=b&&i?F.calculateProfitability(b,i,null,{returnMethod:'closing'}):null;return [label,p?valueOf(p.metrics.netMargin):'Sin datos',p?valueOf(p.metrics.roa):'Sin datos',p?valueOf(p.metrics.roe):'Sin datos'];}));
 try{const q=F.dupont(state.quick);$('#quick-result').innerHTML=table(['ROA al cierre','ROE al cierre','Margen neto','Rotación','Multiplicador'],[[pct(q.roa),pct(q.roe),pct(q.margin),fmt(q.turnover)+' ×',fmt(q.leverage)+' ×']]);}catch{$('#quick-result').innerHTML='<p class="muted">Completa los cuatro valores. Las bases deben ser positivas y patrimonio no mayor que activos.</p>';}
}
function renderTAccount(){
 const box=$('#t-account');if(!box)return;
 const {balance}=window.ledgerSummaries(),sides=state.hasPrevious?['previous','current']:['current'];
 const head='<thead><tr><th></th>'+sides.map(s=>'<th>'+(s==='current'?'T2 · '+state.year:'T1 · '+(state.year-1))+'</th>').join('')+'</tr></thead>';
 const body=(list,total)=>'<tbody>'+list.map(([label,key])=>'<tr><td>'+label+'</td>'+sides.map(s=>'<td>'+numCell(balance[s].v?.[key])+'</td>').join('')+'</tr>').join('')+'<tr class="t-total"><td>'+total[0]+'</td>'+sides.map(s=>'<td>'+numCell(balance[s].v?.[total[1]])+'</td>').join('')+'</tr></tbody>';
 box.innerHTML='<div class="t-grid"><div class="t-side"><h3>Activo</h3><table>'+head+body([['Activos corrientes','currentAssets'],['Activos no corrientes','nonCurrentAssets']],['Total activo','assets'])+'</table></div><div class="t-side"><h3>Pasivo y patrimonio</h3><table>'+head+body([['Pasivos corrientes','currentLiabilities'],['Pasivos no corrientes','nonCurrentLiabilities'],['Patrimonio','equity']],['Total pasivo + patrimonio','funding'])+'</table></div></div>';
 const cur=balance.current,stamp=!cur.v?(cur.e&&!/al menos una cuenta/.test(cur.e)?['bad','REVISAR']:['wait','SIN DATOS']):cur.v.partial?['wait','PARCIAL']:cur.v.balanced?['ok','CUADRA']:['bad','NO CUADRA'];
 $('#t-stamp').innerHTML='<span class="stamp '+stamp[0]+'">'+stamp[1]+'</span>';
}
function overview(){
 const metrics=[['workingCapital',result?.liquidity?.workingCapital],['currentRatio',result?.liquidity?.currentRatio],['debtRatio',result?.debt?.debtRatio],['roe',result?.profitability?.metrics.roe]];
 $('#overview-kpis').innerHTML=metrics.map(([k,m])=>'<article class="kpi"><span class="label">'+metricNames[k]+'</span><strong>'+(!m?'—':m.value===null?'N/C':valueOf(m))+'</strong>'+badge(signal(k,m))+'<p>'+(!m?'Completa los estados del caso.':esc(m.formula))+'</p></article>').join('');
 const all={...result?.liquidity,...result?.debt,...result?.profitability?.metrics,...result?.activity?.metrics};
 const signals=Object.entries(all).filter(([k,m])=>signal(k,m).type!=='neutral').slice(0,3);
 $('#overview-signals').innerHTML=signals.length?signals.map(([k,m])=>'<div class="signal">'+badge(signal(k,m))+'<br><b>'+metricNames[k]+' · '+valueOf(m)+'</b><br>'+signal(k,m).text+'</div>').join(''):'<p>Completa tus estados o carga un ejemplo. Aquí aparecerán lecturas individuales; no una calificación única de la empresa.</p>';
 const b=result?.currentBalance;
 $('#overview-structure').innerHTML=b?[['Activos',b.assets],['Pasivos',b.liabilities],['Patrimonio',b.equity]].map(([l,v])=>'<span>'+l+'<strong>'+fmt(v)+'</strong></span>').join(''):'<span>La estructura se muestra cuando el balance T2 está completo y conciliado.</span>';
}
function renderScenarios(){
 try{const c=state.classic;if(F.scenarioKeys.some(k=>c[k]===null))throw new Error('Completa la base independiente.');const s=F.simulate(c,c.growth,c.repayment);$('#classic-result').innerHTML=table(['Indicador','Base','Escenario'],[['ROA',pct(s.base.roa),pct(s.scenario.roa)],['ROE',pct(s.base.roe),pct(s.scenario.roe)],['Liquidez',s.base.liquidity===null?'Sin pasivo corriente':fmt(s.base.liquidity)+' ×',s.scenario.liquidity===null?'Sin pasivo corriente':fmt(s.scenario.liquidity)+' ×'],['Efectivo',fmt(s.base.cash),fmt(s.scenario.cash)],['Activos',fmt(s.base.assets),fmt(s.scenario.assets)],['Patrimonio',fmt(s.base.equity),fmt(s.scenario.equity)]]);}catch(e){$('#classic-result').innerHTML='<p class="muted">'+esc(e.message)+'</p>';}
 $('#growth-output').textContent=pct(state.scenario.growth/100);$('#payment-output').textContent=pct(state.scenario.repayment/100);
 financialScenario=null;scenarioError='';
 try{financialScenario=F.simulateModel(model(),state.scenario.growth,state.scenario.repayment);}catch(e){scenarioError=e.message;}
 if(financialScenario){
  const s=financialScenario,a=s.base,b=s.result,rows=[];
  for(const [label,k]of [['Activos corrientes','currentAssets'],['Activos totales','assets'],['Pasivos corrientes','currentLiabilities'],['Pasivos totales','liabilities'],['Patrimonio','equity'],['Efectivo','cash'],['Cuentas por pagar','payables']])rows.push([label,fmt(a.currentBalance[k]),fmt(b.currentBalance[k])]);
  for(const [l,k]of [['Ventas','sales'],['UAII','ebit'],['Utilidad neta','netProfit']])rows.push([l,fmt(a.currentIncome[k]),fmt(b.currentIncome[k])]);
  const before={...a.liquidity,...a.debt,...a.profitability?.metrics,...a.activity?.metrics},after={...b.liquidity,...b.debt,...b.profitability?.metrics,...b.activity?.metrics};
  const oldOp=F.calculateOperatingModel(a.currentIncome),newOp=F.calculateOperatingModel(b.currentIncome);
  if(oldOp&&newOp)for(const k of ['gao','gaf','gat','breakEvenSales']){before[k]=oldOp[k];after[k]=newOp[k];}
  const comparisons=Object.entries(after).map(([k,m])=>[metricNames[k],valueOf(before[k]),valueOf(m),badge(signal(k,m))]);
  $('#integrated-scenario-result').innerHTML='<article class="panel"><p class="eyebrow">BASE T2 → ESCENARIO INDEPENDIENTE</p><h2>Los cambios, conectados.</h2>'+table(['Estado afectado','Base','Escenario'],rows)+'<h3 class="section-space">Indicadores recalculados</h3>'+table(['Indicador','Base','Escenario','Referencia del escenario'],comparisons)+'<p class="muted">'+esc(s.assumptions)+'</p>'+(newOp?'<p class="'+(newOp.costSalesFullyVariable?'warning':'muted')+'"><b>Apalancamiento:</b> margen de contribución = ventas − costos variables (costo de ventas y gastos operativos sin sus partes fijas). '+esc(newOp.assumption)+'</p>':'')+'<p class="muted">Para equilibrio en unidades, utiliza CVU con precio unitario. Método de rentabilidad: '+(b.profitability?.method==='average'?'promedio T1/escenario':'cierre del escenario')+'.</p></article>';
 }else $('#integrated-scenario-result').innerHTML=empty(scenarioError);
 if(cvuBase&&cvuAlt){
  const changes=F.leverageChanges(cvuBase,cvuAlt);
  const rows=['sales','variableCosts','contribution','ebit','ebt','afterTax','commonProfit','breakEvenUnits','breakEvenSales'].map(k=>[({sales:'Ventas',variableCosts:'Costos variables',contribution:'Contribución',ebit:'UAII',ebt:'UAI',afterTax:'Utilidad después de impuestos',commonProfit:'Utilidad común',breakEvenUnits:'Equilibrio (unidades)',breakEvenSales:'Equilibrio (importe)'})[k],fmt(cvuBase[k]),fmt(cvuAlt[k])]);
  rows.push(['UPA',valueOf(cvuBase.eps),valueOf(cvuAlt.eps)]);
  $('#cvu-comparison').innerHTML='<article class="panel"><h2>Base CVU frente a alternativa</h2>'+table(['Concepto','Base','Alternativa'],rows)+table(['Grado','Directo base','Directo alternativa','Por variaciones base → alternativa'],['gao','gaf','gat'].map(k=>[k.toUpperCase(),valueOf(cvuBase[k]),valueOf(cvuAlt[k]),valueOf(changes[k])]))+'<p class="muted">'+(changes.sameStructure?'Solo cambia el volumen: las elasticidades por variaciones son comparables con los grados directos de la base.':'Cambió la estructura de precio, costos o financiamiento: los cocientes por variaciones son cambios observados, no sensibilidades aisladas del volumen.')+' Las variaciones con base cero se muestran como no definidas.</p></article>';
 }else $('#cvu-comparison').innerHTML=empty(alternativeError||cvuError||'Completa la base y la alternativa CVU.');
}
function legacy(){
 $('#legacy-details').hidden=!state.legacy;
 if(!state.legacy){$('#legacy-content').innerHTML='';return;}
 const raw=state.legacy.forms||{},b=raw['analysis-form']||{},keys=['cash','receivables','inventory','fixed','payables','debt','equity'];
 const names={...balanceLabels,fixed:'Activos no corrientes netos (sin desglose)',debt:'Otros pasivos (sin clasificación)'};
 const numeric=(key,j)=>b[key+j]!==''&&b[key+j]!=null?Number(b[key+j]):null;
 const totals=[0,1].map(j=>keys.slice(0,4).every(k=>numeric(k,j)!==null)?keys.slice(0,4).reduce((a,k)=>a+numeric(k,j),0):null);
 let html='<p class="muted">Se preservan los originales. Otros pasivos requieren separación entre corriente y largo plazo; activos no corrientes requieren clasificación antes de usar rotación de activos fijos.</p>'+table(['Cuenta original','T1','T2','Vertical T1','Vertical T2','Δ relativo'],keys.map(k=>{const a=numeric(k,0),b=numeric(k,1),v=F.compareValues(a,b,totals[0],totals[1]);return [names[k],a===null?'—':fmt(a),b===null?'—':fmt(b),v.verticalBefore===null?'—':pct(v.verticalBefore),v.verticalAfter===null?'—':pct(v.verticalAfter),v.relative===null?esc(v.relativeReason):pct(v.relative)];}));
 const scenario=raw['scenario-form'];if(scenario){
  const data=Object.fromEntries(F.scenarioKeys.map(k=>[k,scenario[k]===''?null:Number(scenario[k])]));
  html+='<h3>Simulador original · margen constante</h3><p class="muted">Se conserva el escenario guardado, con su propia base y la metodología anterior. No alimenta los nuevos estados.</p>';
  try{const s=F.simulate(data,Number(state.legacy.growth||0),Number(state.legacy.repayment||0));html+=table(['Indicador','Base anterior','Escenario anterior'],[['ROA',pct(s.base.roa),pct(s.scenario.roa)],['ROE',pct(s.base.roe),pct(s.scenario.roe)],['Liquidez',fmt(s.base.liquidity),fmt(s.scenario.liquidity)]]);}catch(e){html+='<p>'+esc(e.message)+'</p>';}
  html+=table(['Entrada original','Valor'],Object.entries(scenario).map(([k,v])=>[esc(k),esc(v)]));
 }
 $('#legacy-content').innerHTML=html;
}
function refresh(){
 result=null;engineError='';try{result=F.analyzeModel(model());}catch(e){engineError=e.message;}
 cvuBase=null;cvuAlt=null;cvuError='';alternativeError='';
 try{cvuBase=F.calculateCVU(state.cvu.base);}catch(e){cvuError=e.message;}
 try{cvuAlt=F.calculateCVU(state.cvu.alternative);}catch(e){alternativeError=e.message;}
 const note=state.note||'';$('#source-note').textContent=note;$('#source-note').hidden=!note;
 for(const type of ['balance','income']){
  const messages=[];if(engineError)messages.push(engineError);
  else{const errKey=type==='balance'?'balance':'income',prevKey=type==='balance'?'previousBalance':'previousIncome';messages.push(result.errors[errKey]?'T2: '+result.errors[errKey]:'T2: datos válidos'+(type==='balance'?(result.currentBalance?.partial?' · balance parcial: no se exige que cuadre.':' · balance conciliado.'):(result.currentIncome?.partial?' · estado de resultados parcial: solo se calculan los indicadores de las categorías marcadas.':'.')));if(state.hasPrevious)messages.push(result.errors[prevKey]?'T1: '+result.errors[prevKey]:'T1: datos válidos.');}
  $('#'+type+'-validation').innerHTML=messages.map(m=>'<p class="validation '+(m.includes('válidos')?'ok':'')+'">'+esc(m)+'</p>').join('');
 }
 $('#analysis-balance').innerHTML=accountsAnalysis()+analysisTable('balance');$('#analysis-income').innerHTML=analysisTable('income');
 renderRatios();overview();renderTAccount();$('#health-result').innerHTML=healthHTML();legacy();
 $('#cvu-result').innerHTML=cvuBase?cvuHTML(cvuBase):'<p class="warning" role="status">'+esc(cvuError)+'</p>';
 renderScenarios();renderCharts();window.updateLedgerTotals?.();
 if(location.hash==='#reporte')renderReport();
}
window.refresh=refresh;
function chart(id,type,data,options={}){
 const canvas=$('#'+id);if(!canvas)return;
 if(!window.Chart||!data){if(chartInstances[id]){chartInstances[id].destroy();delete chartInstances[id];}return;}
 const shared={responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{position:'bottom',labels:{usePointStyle:true,boxWidth:8,font:{family:'IBM Plex Mono',size:11},color:'#5d6a80'}},tooltip:{backgroundColor:'#13233f',padding:12,titleFont:{family:'IBM Plex Mono'},bodyFont:{family:'IBM Plex Mono'},cornerRadius:2}},scales:{x:{grid:{display:false},ticks:{color:'#5d6a80',font:{family:'IBM Plex Mono',size:11}}},y:{grid:{color:'#c9d7e6'},ticks:{color:'#5d6a80',font:{family:'IBM Plex Mono',size:11}}}}};
 const merged={...shared,...options,plugins:{...shared.plugins,...options.plugins}};
 try{if(chartInstances[id]){chartInstances[id].data=data;chartInstances[id].options=merged;chartInstances[id].update('none');}else chartInstances[id]=new Chart(canvas,{type,data,options:merged});}
 catch{if(chartInstances[id])chartInstances[id].destroy();delete chartInstances[id];}
}
function renderCharts(){
 const b=result?.currentBalance,p=result?.previousBalance,i=result?.currentIncome,pi=result?.previousIncome;
 const labels=p?[String(state.year-1),String(state.year)]:[String(state.year)];
 const balances=p?[p,b]:[b],colors=['#13233f','#1f6b47','#d8ad50','#93a9c3','#c2453a','#5d6a80'];
 const overview=b?{labels,datasets:[['Activos','assets','#13233f'],['Pasivos','liabilities','#c2453a'],['Patrimonio','equity','#1f6b47']].map(([label,key,color])=>({label,data:balances.map(r=>r[key]),backgroundColor:color,borderRadius:4,maxBarThickness:45}))}:null;
 chart('overview-chart','bar',overview);
 $('#overview-chart-note').textContent=!b?'Completa el balance o carga un ejemplo.':!window.Chart?'Sin conexión con Chart.js. Los valores están debajo.':'';
 const group=$('#chart-group').value==='funding'?['payables','otherCurrentLiabilities','longDebt','otherNonCurrentLiabilities','equity']:['cash','receivables','inventory','otherCurrentAssets','fixed','otherNonCurrentAssets'];
 chart('vertical-chart','bar',b?{labels,datasets:group.map((key,j)=>({label:balanceLabels[key],data:balances.map(r=>r.assets>0?r[key]/r.assets*100:null),backgroundColor:colors[j]}))}:null,{scales:{x:{stacked:true,grid:{display:false}},y:{stacked:true,ticks:{callback:v=>v+' %'},grid:{color:'#c9d7e6'}}}});
 chart('horizontal-chart','bar',b?{labels:F.balanceKeys.map(k=>balanceLabels[k]),datasets:balances.map((r,j)=>({label:labels[j],data:F.balanceKeys.map(k=>r[k]),backgroundColor:j?'#13233f':'#93a9c3',borderRadius:2}))}:null,{indexAxis:'y',scales:{x:{grid:{color:'#c9d7e6'}},y:{grid:{display:false},ticks:{font:{size:10}}}}});
 const previousProfit=p&&pi?F.calculateProfitability(p,pi,null,{returnMethod:'closing'}):null,currentProfit=b&&i?F.calculateProfitability(b,i,null,{returnMethod:'closing'}):null;
 chart('profit-chart','bar',currentProfit?{labels:['Margen neto','ROA','ROE'],datasets:[...(previousProfit?[{label:String(state.year-1),data:['netMargin','roa','roe'].map(k=>previousProfit.metrics[k].value===null?null:previousProfit.metrics[k].value*100),backgroundColor:'#93a9c3'}]:[]),{label:String(state.year),data:['netMargin','roa','roe'].map(k=>currentProfit.metrics[k].value===null?null:currentProfit.metrics[k].value*100),backgroundColor:'#13233f'}]}:null,{scales:{x:{grid:{display:false}},y:{ticks:{callback:v=>v+' %'},grid:{color:'#c9d7e6'}}}});
 const c=cvuBase;
 if(c){const max=Math.max(c.quantity*1.3,c.breakEvenUnits*1.5,1),xs=[0,max*.25,max*.5,max*.75,max,c.breakEvenUnits].sort((a,b)=>a-b);
 chart('breakeven-chart','line',{datasets:[{label:'Ingresos',data:xs.map(x=>({x,y:x*c.price})),borderColor:'#1f6b47',backgroundColor:'#1f6b47',pointRadius:0},{label:'Costos totales',data:xs.map(x=>({x,y:c.fixedCosts+x*c.variableCost})),borderColor:'#c2453a',pointRadius:0},{label:'Costos fijos',data:xs.map(x=>({x,y:c.fixedCosts})),borderColor:'#5d6a80',borderDash:[5,5],pointRadius:0},{label:'Punto de equilibrio',data:[{x:c.breakEvenUnits,y:c.breakEvenSales}],borderColor:'#13233f',backgroundColor:'#fff',pointBorderWidth:3,pointRadius:7,showLine:false}]},{scales:{x:{type:'linear',title:{display:true,text:'Unidades'},grid:{display:false}},y:{title:{display:true,text:'Importe'},grid:{color:'#c9d7e6'}}}});}else chart('breakeven-chart','line',null);
 document.querySelectorAll('.chart-library-note').forEach(el=>el.textContent=window.Chart?'Gráficos interactivos: pasa el cursor para ver valores y pulsa las leyendas para alternar series.':'Chart.js no está disponible. Los cálculos, tablas y reportes de datos siguen funcionando.');
}
window.resizeCharts=()=>Object.values(chartInstances).forEach(c=>c.resize());
$('#chart-group').addEventListener('change',renderCharts);
const chartScript=document.createElement('script');chartScript.src='https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js';chartScript.async=true;chartScript.onload=()=>{chartsLoaded=true;renderCharts();};chartScript.onerror=renderCharts;document.head.append(chartScript);
function reportClone(id){const node=$('#'+id).cloneNode(true);node.querySelectorAll('details').forEach(d=>d.open=true);node.querySelectorAll('input,select,button,canvas').forEach(n=>n.remove());return node.innerHTML;}
function reportSection(title,html){return '<section class="report-section"><h2>'+title+'</h2>'+html+'</section>';}
function reportIncomeInputs(){
 const sides=state.hasPrevious?['previous','current']:['current'];
 return '<h3>Cuentas del estado de resultados</h3>'+table(['Cuenta',...sides.map(s=>s==='current'?'T2 · '+state.year:'T1 · '+(state.year-1))],state.incomeAccounts.map((a,i)=>[esc(a.name||'Cuenta '+(i+1))+'<small> · '+esc(incomeCategoryLabels[a.category]||'Sin clasificar')+(a.sign===-1?' · resta':'')+'</small>',...sides.map(s=>a.amounts[s]==null?'No informado':fmt(a.amounts[s]))]));
}
function renderReport(){
 let html='<header class="report-cover"><p class="eyebrow">GESTICODE / INFORME EJECUTIVO ACADÉMICO</p><h1>'+esc(active.name)+'</h1><p>'+esc(state.hasPrevious?(state.year-1)+' — '+state.year:state.year)+' · '+new Date().toLocaleString('es-NI')+'</p><p>'+esc(state.note||'Caso creado por el usuario.')+'</p></header>';
 html+=reportSection('01 · Fuentes, períodos y métodos','<p>'+esc($('#method-note').textContent)+'</p><p>Compras estimadas: '+fmt(state.params.purchaseRate*100)+' % del costo de ventas si no se informan compras reales a crédito. Las ventas a crédito faltantes no se sustituyen por ventas totales. Las cifras no se redondean antes de calcular.</p>');
 html+=reportSection('02 · Estados y análisis',reportClone('analysis-balance')+reportClone('analysis-income')+reportIncomeInputs());
 html+=reportSection('03 · Indicadores y Du Pont',reportClone('ratio-groups')+reportClone('dupont-result')+reportClone('profit-trend-table'));
 const thresholdsRows=Object.entries(state.thresholds).map(([k,v])=>[esc(k),typeof v==='number'?fmt(['debtRatio','roe','netMargin'].includes(k)?v*100:v):'Inválido; se usa referencia predeterminada']);
 html+=reportSection('Referencias didácticas configuradas',table(['Regla','Umbral (% en deuda, ROE y margen)'],thresholdsRows)+'<p>Cada semáforo corresponde a su indicador. No existe una calificación global. Si la configuración es inválida se usan todas las referencias predeterminadas, tal como se avisa en Razones.</p>');
 html+=reportSection('04 · CVU y apalancamiento',table(['Entrada CVU base','Valor'],F.cvuKeys.map(k=>[cvuLabels[k],state.cvu.base[k]===null?'No informado':fmt(state.cvu.base[k]*(k==='taxRate'?100:1))]))+reportClone('cvu-result')+'<p>GAO y GAF usan el método directo; GAT es su producto. Impuesto académico: UAI × tasa, incluyendo un beneficio fiscal teórico en pérdidas. Equilibrio: CF / (P − CVu). UPA = utilidad común / acciones.</p>');
 html+=reportSection('05 · Escenarios', '<p>Variación de ventas: '+fmt(state.scenario.growth)+' %. Pago de proveedores: '+fmt(state.scenario.repayment)+' %.</p>'+reportClone('integrated-scenario-result')+table(['Entrada CVU alternativa','Valor'],F.cvuKeys.map(k=>[cvuLabels[k],state.cvu.alternative[k]===null?'No informado':fmt(state.cvu.alternative[k]*(k==='taxRate'?100:1))]))+reportClone('cvu-comparison'));
 html+=reportSection('06 · Evaluación cualitativa',table(['Pregunta','Respuesta'],questions.map((q,i)=>[q,state.health[i]===null?'No respondida':state.health[i]==='yes'?'Sí':'No']))+healthHTML());
 if(state.legacy)html+=reportSection('Anexo · Datos anteriores conservados',reportClone('legacy-content'));
 if(state.classic&&F.scenarioKeys.some(k=>state.classic[k]!==null))html+=reportSection('Anexo · Simulador original independiente',table(['Entrada','Valor'],Object.entries(state.classic).map(([k,v])=>[esc(k),fmt(v)]))+reportClone('classic-result')+'<p>Modelo anterior de margen constante, con saldos al cierre e independiente de los estados integrados.</p>');
 if(Object.values(state.quick).some(v=>v!==null))html+=reportSection('Anexo · Cálculo rápido independiente',table(['Entrada','Importe'],Object.entries(state.quick).map(([k,v])=>[esc(k),fmt(v)]))+reportClone('quick-result')+'<p>Estas cifras usan saldos al cierre y no forman parte de los estados integrados.</p>');
 let images='';for(const [id,c]of Object.entries(chartInstances)){try{c.data.datasets.forEach((_,i)=>c.setDatasetVisibility(i,true));c.resize(850,340);c.update('none');images+='<figure><img src="'+c.toBase64Image()+'" alt="'+esc(c.canvas.getAttribute('aria-label'))+'"><figcaption>'+esc(c.canvas.getAttribute('aria-label'))+'</figcaption></figure>';c.resize();}catch{/* La tabla permanece como fuente accesible. */}}
 if(images)html+=reportSection('Anexo gráfico',images);
 html+=reportSection('Alcance','<p>Simulador educativo. Los resultados matemáticos se distinguen de interpretaciones prudentes. Las decisiones requieren contexto sectorial y análisis de caja. Los módulos incompletos se señalan expresamente y no conservan resultados anteriores.</p><p>Referencia: CFA Institute, Financial Analysis Techniques. Fórmulas CVU y umbrales según el enunciado académico aportado. Los ejemplos sintéticos se identifican en la fuente del caso.</p>');
 $('#report-document').innerHTML=html;
}
window.renderReport=renderReport;
$('#print-report').addEventListener('click',()=>{refresh();renderReport();window.print();});
window.addEventListener('beforeprint',renderReport);
refresh();navigate();
// Herramienta de lectura: devuelve el mismo estado calculado que muestra el tablero.
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'read_financial_analysis',title:'Leer análisis financiero',description:'Lee indicadores y metodología del caso activo sin modificar sus datos.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute(){return {caseName:active.name,result,cvu:cvuBase,scenario:financialScenario?.result??null};}})).catch(()=>{});}catch{}}


