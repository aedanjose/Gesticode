/* Estado central, entradas, persistencia y compatibilidad de casos. */
'use strict';
const $ = s => document.querySelector(s);
const F = FinancialEngine;
const number = new Intl.NumberFormat('es-NI',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmt = n => Number.isFinite(n)?number.format(n):'No calculable';
const pct = n => Number.isFinite(n)?fmt(n*100)+' %':'No calculable';
const esc = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const balanceLabels={cash:'Efectivo y bancos',receivables:'Cuentas por cobrar',inventory:'Inventarios',otherCurrentAssets:'Otros activos corrientes',fixed:'Activos fijos netos',otherNonCurrentAssets:'Otros activos no corrientes',payables:'Cuentas por pagar',otherCurrentLiabilities:'Otros pasivos corrientes',longDebt:'Deuda a largo plazo',otherNonCurrentLiabilities:'Otros pasivos no corrientes',equity:'Patrimonio'};
const incomeLabels={sales:'Ventas totales',creditSales:'Ventas a crédito',costSales:'Costo de ventas',grossProfit:'Utilidad bruta',operatingExpenses:'Gastos operativos totales',fixedCosts:'De los gastos: costos fijos operativos',ebit:'UAII / utilidad operativa',interest:'Gastos por intereses',ebt:'UAI / antes de impuestos',taxes:'Impuestos',netProfit:'Utilidad neta',preferredDividends:'Dividendos preferentes',commonProfit:'Utilidad para accionistas comunes',shares:'Número de acciones',creditPurchases:'Compras reales a crédito'};
const cvuLabels={price:'Precio unitario',quantity:'Cantidad de unidades',variableCost:'Costo variable unitario',fixedCosts:'Costos fijos operativos',taxRate:'Tasa de impuesto (%)',interest:'Intereses',preferredDividends:'Dividendos preferentes',shares:'Número de acciones'};
const questions=['¿La empresa paga sus obligaciones a tiempo?','¿Los cobros habituales cubren los gastos operativos?','¿Las deudas actuales dificultan la operación?','¿Hay inventario acumulado que tarda en venderse?'];
const thresholdDefaults={quickRatio:1,workingCapital:0,interestCoverage:1.5,debtRatio:.7,inventoryDays:180,collectionDays:90,gat:8,currentMin:1.5,currentMax:2.5,roe:.15,netMargin:.10};
const emptyRecord=keys=>Object.fromEntries(keys.map(k=>[k,null]));
const blankPartial=()=>({enabled:false,complete:Object.fromEntries(Object.keys(F.balanceParts).map(k=>[k,false]))});
const blankIncomePartial=()=>({enabled:false,complete:Object.fromEntries(Object.keys(F.incomeParts).map(k=>[k,false]))});
const blankData=()=>({year:2025,hasPrevious:true,partial:blankPartial(),incomePartial:blankIncomePartial(),params:{days:365,purchaseRate:.7,returnMethod:'average',purchasesMethod:'percent',allSalesCredit:false},accounts:F.defaultAccounts(),incomeAccounts:F.defaultIncomeAccounts(),current:{},previous:{},health:[null,null,null,null],cvu:{base:emptyRecord(F.cvuKeys),alternative:emptyRecord(F.cvuKeys)},scenario:{growth:0,repayment:0},thresholds:{...thresholdDefaults},quick:{profit:null,sales:null,assets:null,equity:null}});
const uid=()=>crypto.randomUUID?.()??String(Date.now())+Math.random().toString(36).slice(2);
function ensureCompatibility(data){
 data.classic??={...emptyRecord(F.scenarioKeys),growth:0,repayment:0};
 const source=data.legacy?.forms?.['scenario-form'];
 if(source&&!data.classicMigrated){for(const k of F.scenarioKeys)data.classic[k]=source[k]!==''&&source[k]!=null?Number(source[k]):null;data.classic.growth=Number(data.legacy.growth||0);data.classic.repayment=Number(data.legacy.repayment||0);data.classicMigrated=true;}
}
function migrateLegacy(data){
 const next=blankData();next.legacy=JSON.parse(JSON.stringify(data));next.year=Number(data.year||2024)+1;
 const forms=data.forms||{},b=forms['analysis-form']||{},p=forms['profit-form']||{};
 for(const [side,suffix] of [['previous','0'],['current','1']]){
  for(const key of ['cash','receivables','inventory','payables','equity']){const v=b[key+suffix];next.accounts.find(a=>a.id===key).amounts[side]=v!==undefined&&v!==''?Number(v):null;}
 }
 for(const k of ['profit','sales','assets','equity'])next.quick[k]=p[k]!==undefined&&p[k]!==''?Number(p[k]):null;
 for(let i=0;i<4;i++)next.health[i]=forms['health-form']?.['q'+i]??null;
 return next;
}
function ensureAccounts(data){
 if(!F.validYear(data.year))data.year=2025;
 data.params={purchasesMethod:'percent',allSalesCredit:false,...data.params};
 data.partial??=blankPartial();data.incomePartial??=blankIncomePartial();
 if(!Array.isArray(data.incomeAccounts)){data.incomeAccounts=F.incomeAccountsFromStatements({previous:data.previous?.income,current:data.current?.income});delete data.previous?.income;delete data.current?.income;}
 if(!data.incomeAccounts.some(a=>a.category==='fixedCostSales')){const at=data.incomeAccounts.findIndex(a=>a.category==='fixedCosts');data.incomeAccounts.splice(at<0?data.incomeAccounts.length:at+1,0,{id:'fixedCostSales',name:'De los costos de ventas: costos fijos',category:'fixedCostSales',sign:1,amounts:{previous:null,current:null}});}
 for(const [category,name,before,after] of [['otherIncome','Otros ingresos','interest',false],['taxRate','Tasa de impuestos','taxes',true]])if(!data.incomeAccounts.some(x=>x.category===category)){const at=data.incomeAccounts.findIndex(x=>x.category===before);data.incomeAccounts.splice(at<0?data.incomeAccounts.length:at+(after?1:0),0,{id:category,name,category,sign:1,amounts:{previous:null,current:null}});}
 if(Array.isArray(data.accounts))return;
 data.accounts=F.accountsFromBalances({previous:data.previous?.balance,current:data.current?.balance});
 delete data.previous?.balance;delete data.current?.balance;
}
const validAccounts=list=>Array.isArray(list)&&list.length<=80&&list.every(a=>a&&typeof a==='object'&&typeof a.name==='string'&&a.name.length<=80&&(a.section===null||['asset','liability','equity'].includes(a.section)&&(a.section==='equity'||['current','noncurrent'].includes(a.term)))&&(a.role==null||Object.hasOwn(F.accountRoles,a.role))&&(a.sign===1||a.sign===-1)&&typeof a.memo==='boolean'&&a.amounts&&['previous','current'].every(s=>a.amounts[s]===null||typeof a.amounts[s]==='number'&&Number.isFinite(a.amounts[s])));
const validIncomeAccounts=list=>Array.isArray(list)&&list.length<=80&&list.every(a=>a&&typeof a==='object'&&typeof a.name==='string'&&a.name.length<=80&&(a.category===null||Object.hasOwn(F.incomeCategories,a.category))&&(a.sign===1||a.sign===-1)&&a.amounts&&['previous','current'].every(s=>a.amounts[s]===null||typeof a.amounts[s]==='number'&&Number.isFinite(a.amounts[s])));
function validData(data){
 if(!data||typeof data!=='object'||typeof data.year!=='number'||!Number.isFinite(data.year)||typeof data.hasPrevious!=='boolean')return false;
 const hasAccounts=Array.isArray(data.accounts),hasIncome=Array.isArray(data.incomeAccounts);if(hasAccounts&&!validAccounts(data.accounts))return false;if(hasIncome&&!validIncomeAccounts(data.incomeAccounts))return false;
 for(const side of ['current','previous'])for(const type of ['balance','income']){
  if(type==='balance'&&hasAccounts||type==='income'&&hasIncome)continue;
  const record=data[side]?.[type];if(!record||typeof record!=='object')return false;
  if(!Object.values(record).every(v=>v===null||typeof v==='number'&&Number.isFinite(v)))return false;
 }
 if(!Array.isArray(data.health)||data.health.length!==4||!data.health.every(v=>v===null||v==='yes'||v==='no'))return false;
 if(!data.cvu?.base||!data.cvu?.alternative||!data.scenario||!data.params)return false;
 for(const rec of [data.cvu.base,data.cvu.alternative,data.scenario])if(!Object.values(rec).every(v=>v===null||typeof v==='number'&&Number.isFinite(v)))return false;
 return true;
}
const storageKey='gesticode.cases.v2';let storageBlocked=false,lastStored=null;
let library;
function status(text,error=false){$('#case-status').textContent=text;$('#case-status').classList.toggle('failure',error);}
try{
 lastStored=localStorage.getItem(storageKey);
 if(lastStored){
  library=JSON.parse(lastStored);
  if(library.version!==2||!Array.isArray(library.cases)||!library.cases.length||library.cases.length>50||!library.cases.every(c=>typeof c.name==='string'&&c.name.length<=80&&typeof c.id==='string'&&validData(c.data))||!library.cases.some(c=>c.id===library.activeId))throw new Error('Formato no reconocido');
 }else{
  const old=localStorage.getItem('gesticode.cases.v1');
  if(old){
   const parsed=JSON.parse(old);
   if(!Array.isArray(parsed.cases)||!parsed.cases.length||parsed.cases.length>50)throw new Error('Formato anterior no reconocido');
   library={version:2,activeId:parsed.activeId,cases:parsed.cases.map(c=>({id:c.id,name:c.name,data:migrateLegacy(c.data)}))};
   if(!library.cases.some(c=>c.id===library.activeId))library.activeId=library.cases[0].id;
  }
 }
}catch{library=null;storageBlocked=true;}
if(!library){const id=uid();library={version:2,activeId:id,cases:[{id,name:'Mi primer caso',data:blankData()}]};}
for(const c of library.cases)ensureAccounts(c.data);
let active=library.cases.find(c=>c.id===library.activeId);
let state=active.data;state.thresholds={...thresholdDefaults,...state.thresholds};state.quick??=blankData().quick;
function persist(){
 if(storageBlocked)return false;
 try{
  if(localStorage.getItem(storageKey)!==lastStored){storageBlocked=true;status('Otro cambio de almacenamiento fue detectado. Recarga antes de guardar; puedes generar tu reporte.',true);return false;}
  active.data=state;active.updatedAt=new Date().toISOString();const data=JSON.stringify(library);localStorage.setItem(storageKey,data);lastStored=data;
  status('Guardado en este navegador · '+new Date().toLocaleTimeString('es-NI',{hour:'2-digit',minute:'2-digit'}));return true;
 }catch{storageBlocked=true;status('No se pudo guardar. Conserva la pestaña o genera un reporte; los datos anteriores no se sobrescriben.',true);return false;}
}
function model(){const period=side=>({...state[side],year:side==='current'?state.year:state.year-1,income:{accounts:F.incomeAccountsForPeriod(state.incomeAccounts,side),...(state.incomePartial?.enabled?{complete:state.incomePartial.complete}:{})},balance:{accounts:F.accountsForPeriod(state.accounts,side),...(state.partial?.enabled?{complete:state.partial.complete}:{})}});return {year:state.year,params:state.params,current:period('current'),previous:state.hasPrevious?period('previous'):null};}
function getPath(path){return path.split('.').reduce((o,k)=>o?.[k],state);}
function setPath(path,value){const parts=path.split('.'),key=parts.pop();let target=state;for(const p of parts)target=target[p];target[key]=value;}
function input(path,label,options={}){
 const v=getPath(path),percent=options.percent;
 return '<label class="field">'+esc(label)+'<input data-path="'+path+'" '+(percent?'data-percent="true" ':'')+'type="number" step="'+(options.integer?'1':'any')+'" '+(options.negative?'':'min="0" ')+'max="1000000000000000" value="'+(v===null||v===undefined?'':percent?v*100:v)+'" placeholder="'+(options.optional?'No informado':'0.00')+'" aria-label="'+esc(label)+'"></label>';
}
const accountClasses={'asset.current':'Activo corriente','asset.noncurrent':'Activo no corriente','liability.current':'Pasivo corriente','liability.noncurrent':'Pasivo no corriente',equity:'Patrimonio'};
const accountModes={add:'Suma',sub:'Resta (valuación)',memo:'De los cuales'};
const incomeCategoryLabels={sales:'Ventas',costSales:'Costo de ventas',opex:'Gasto operativo',interest:'Gasto por intereses',taxes:'Impuestos',preferred:'Dividendos preferentes',creditSales:'De las ventas: a crédito',fixedCosts:'De los gastos: costos fijos',fixedCostSales:'De los costos de ventas: costos fijos',creditPurchases:'Compras a crédito reales',shares:'Número de acciones',otherIncome:'Otros ingresos (o gastos, con «Resta»)',taxRate:'Tasa de impuestos (fracción, 0.35 = 35 %)'};
const incomeModes={add:'Suma',sub:'Resta'};
const classOf=a=>!a.section?'':a.section==='equity'?'equity':a.section+'.'+a.term;
const modeOf=a=>a.memo?'memo':a.sign===-1?'sub':'add';
const options=(map,value)=>Object.entries(map).map(([k,l])=>'<option value="'+k+'"'+(k===value?' selected':'')+'>'+esc(l)+'</option>').join('');
const rowKinds={
 balance:{attr:'acct',list:()=>state.accounts,path:'accounts',remove:'data-remove-account',catalog:'account-catalog',add:'add-account',limit:'Máximo 80 cuentas por balance.'},
 income:{attr:'iacct',list:()=>state.incomeAccounts,path:'incomeAccounts',remove:'data-remove-income-account',catalog:'income-catalog',add:'add-income-account',limit:'Máximo 80 cuentas por estado de resultados.'}
};
const openAccounts=new Set(); // filas con las opciones avanzadas abiertas (solo de la interfaz, no se guarda)
const rolesFor=cls=>({'':'Sin rol',...Object.fromEntries(Object.entries(F.accountRoles).filter(([,r])=>(r.section==='equity'?'equity':r.section+'.'+r.term)===cls).map(([k,r])=>[k,r.label]))});
const isClassified=(kind,a)=>kind==='balance'?!!classOf(a):!!a.category;
const isOpen=(kind,a)=>!isClassified(kind,a)||openAccounts.has(kind+':'+a.id);
function rowSummary(kind,a){
 if(kind==='balance')return [a.role&&F.accountRoles[a.role].label,a.memo?'De los cuales':a.sign===-1?'Resta':null].filter(Boolean).join(' · ');
 return [a.category&&F.incomeCategories[a.category].memo?incomeCategoryLabels[a.category]:null,a.sign===-1?'Resta':null].filter(Boolean).join(' · ');
}
function chipHTML(kind,a,i){
 const ok=isClassified(kind,a),extra=ok?rowSummary(kind,a):'';
 return '<button type="button" class="acct-chip'+(ok?(extra?'':' quiet'):' needs')+'" data-toggle-account="'+i+'" data-kind="'+kind+'" aria-expanded="'+isOpen(kind,a)+'">'+esc(ok?extra||'Ajustes':'Elegir clasificación')+' ▾</button>';
}
function advFieldsHTML(kind,a,i){
 const k=rowKinds[kind],name=a.name||'Cuenta '+(i+1);
 const select=(field,label,map,value)=>'<label class="small-field">'+label+'<select data-'+k.attr+'="'+i+'" data-field="'+field+'" aria-label="'+label+' de '+esc(name)+'">'+options(map,value)+'</select></label>';
 if(kind==='balance'){const cls=classOf(a);return select('class','Clasificación',{'':'Elegir…',...accountClasses},cls)+select('role','Rol en las razones',rolesFor(cls),a.role||'')+select('mode','Tratamiento',accountModes,modeOf(a));}
 const memo=a.category&&F.incomeCategories[a.category].memo;
 return select('category','Categoría',{'':'Elegir…',...incomeCategoryLabels},a.category||'')+(memo?'<span class="small-field">Tratamiento<b>De los cuales</b></span>':select('mode','Tratamiento',incomeModes,a.sign===-1?'sub':'add'));
}
const advRowHTML=(kind,a,i,cols)=>'<tr class="acct-adv" data-kind="'+kind+'" data-adv="'+i+'"><td colspan="'+cols+'"><div class="acct-adv-fields">'+advFieldsHTML(kind,a,i)+'</div></td></tr>';
const allowsNegative=(kind,a)=>kind==='balance'?a.section==='equity':a.category==='taxes';
function rowHTML(kind,a,i,sides){
 const k=rowKinds[kind],name=a.name||'Cuenta '+(i+1);
 const amounts=sides.map(s=>'<td>'+input(k.path+'.'+i+'.amounts.'+s,name+' · '+(s==='current'?state.year:state.year-1),{negative:allowsNegative(kind,a),integer:kind==='income'&&a.category==='shares',optional:true}).replace('<label class="field">','<label class="field compact-field">')+'</td>').join('');
 return '<tr class="acct-row" data-kind="'+kind+'" data-row="'+i+'"><td class="acct-main"><input class="acct-name" type="text" list="'+k.catalog+'" data-'+k.attr+'="'+i+'" data-field="name" maxlength="80" value="'+esc(a.name)+'" placeholder="Nombre: elige uno de la lista o escribe el tuyo" aria-label="Nombre de la cuenta '+(i+1)+'" autocomplete="off">'+chipHTML(kind,a,i)+'</td>'+amounts+'<td><button type="button" class="icon-button" '+k.remove+'="'+i+'" aria-label="Quitar '+esc(name)+'">✕</button></td></tr>'
  +(isOpen(kind,a)?advRowHTML(kind,a,i,sides.length+2):'');
}
const balanceGroups=[
 {key:'asset.current',title:'Activos corrientes',total:'currentAssets'},{key:'asset.noncurrent',title:'Activos no corrientes',total:'nonCurrentAssets'},{sum:true,title:'Total activos',total:'assets'},
 {key:'liability.current',title:'Pasivos corrientes',total:'currentLiabilities'},{key:'liability.noncurrent',title:'Pasivos no corrientes',total:'nonCurrentLiabilities'},{sum:true,title:'Total pasivos',total:'liabilities'},
 {key:'equity',title:'Patrimonio',total:'equity'},{sum:true,title:'Total pasivos + patrimonio',total:'funding'}];
const incomeGroups=[
 {key:'sales',title:'Ventas',total:'sales'},{key:'costSales',title:'Costo de ventas',total:'costSales'},{sum:true,title:'Utilidad bruta',total:'grossProfit'},
 {key:'opex',title:'Gastos operativos',total:'operatingExpenses'},{sum:true,title:'Utilidad operativa (UAII)',total:'ebit'},
 {key:'otherIncome',title:'Otros ingresos',total:'otherIncome'},{key:'interest',title:'Gastos por intereses',total:'interest'},{sum:true,title:'Utilidad antes de impuestos (UAI)',total:'ebt'},
 {key:'taxes',title:'Impuestos',total:'taxes'},{sum:true,title:'Utilidad neta',total:'netProfit'},
 {key:'preferred',title:'Dividendos preferentes',total:'preferredDividends'},{sum:true,title:'Utilidad para accionistas comunes',total:'commonProfit'},
 {detail:true,title:'Datos complementarios · no suman al resultado',keys:['creditSales','fixedCosts','fixedCostSales','creditPurchases','shares','taxRate']}];
const pendingRegroup=new Set(); // tablas cuyas filas cambiaron de sección al escribir un nombre; se reordenan al salir de la tabla
function accountTable(kind,box){
 const k=rowKinds[kind],sides=state.hasPrevious?['previous','current']:['current'],list=k.list(),cols=sides.length+2;
 const head='<tr><th scope="col">Cuenta</th>'+sides.map(s=>'<th scope="col">'+(s==='current'?'T2 · '+state.year:'T1 · '+(state.year-1))+'</th>').join('')+'<th scope="col"><span class="sr-only">Quitar</span></th></tr>';
 const catalog='<datalist id="'+k.catalog+'">'+(kind==='balance'?F.accountCatalog:F.incomeCatalog).map(e=>'<option value="'+esc(e.name)+'"></option>').join('')+'</datalist>';
 const totalRow=(title,total,cls)=>'<tr class="'+cls+'"><td>'+esc(title)+'</td>'+sides.map(s=>'<td data-total="'+total+'" data-side="'+s+'">—</td>').join('')+'<td></td></tr>';
 const inGroup=(a,g)=>kind==='balance'?classOf(a)===g.key:g.detail?g.keys.includes(a.category):a.category===g.key;
 const shown=new Set(),indexed=list.map((a,i)=>[a,i]);
 let body='';
 for(const g of (kind==='balance'?balanceGroups:incomeGroups)){
  if(g.sum){body+=totalRow(g.title,g.total,'grp-sum');continue;}
  const rows=indexed.filter(([a])=>inGroup(a,g));rows.forEach(([,i])=>shown.add(i));
  body+='<tr class="grp-head"><td colspan="'+cols+'"><span class="grp-title">'+esc(g.title)+'</span><button type="button" class="grp-add" data-add-group="'+(g.detail?'':g.key)+'" data-kind="'+kind+'">＋ agregar cuenta</button></td></tr>'
   +rows.map(([a,i])=>rowHTML(kind,a,i,sides)).join('')+(g.detail?'':totalRow('Subtotal · '+g.title,g.total,'grp-total'));
 }
 const rest=indexed.filter(([,i])=>!shown.has(i));
 if(rest.length)body+='<tr class="grp-head pending"><td colspan="'+cols+'"><span class="grp-title">Por clasificar</span></td></tr>'+rest.map(([a,i])=>rowHTML(kind,a,i,sides)).join('');
 return box+catalog+'<table class="entry-table account-table ledger-table'+(kind==='income'?' income-table':'')+'"><thead>'+head+'</thead><tbody>'+body+'</tbody></table>'+(kind==='balance'?'<div class="cuadre" id="balance-cuadre" aria-live="polite"></div>':'');
}
// Resúmenes en vivo desde el motor: nada se calcula en la interfaz.
function ledgerSummaries(){
 const m=model(),run=(fn,p)=>{if(!p)return {v:null,e:null};try{return {v:fn(p),e:null};}catch(err){return {v:null,e:err.message};}};
 return {balance:{previous:run(p=>F.summarizeBalance(p.balance),m.previous),current:run(p=>F.summarizeBalance(p.balance),m.current)},income:{previous:run(p=>F.summarizeIncome(p.income),m.previous),current:run(p=>F.summarizeIncome(p.income),m.current)}};
}
const numCell=v=>Number.isFinite(v)?fmt(v):'—';
function updateLedgerTotals(){
 const sums=ledgerSummaries();
 for(const [root,data] of [['#balance-inputs',sums.balance],['#income-inputs',sums.income]])
  document.querySelectorAll(root+' [data-total]').forEach(td=>{const v=data[td.dataset.side]?.v?.[td.dataset.total];td.textContent=numCell(v);td.classList.toggle('negative',Number.isFinite(v)&&v<0);});
 const box=$('#balance-cuadre');if(!box)return;
 box.innerHTML=['previous','current'].filter(s=>s==='current'||state.hasPrevious).map(s=>{
  const {v,e}=sums.balance[s],stamp=!v?(e&&!/al menos una cuenta/.test(e)?['bad','REVISAR']:['wait','SIN DATOS']):v.partial?['wait','PARCIAL']:v.balanced?['ok','CUADRA']:['bad','NO CUADRA'];
  return '<div class="cuadre-line"><span class="cuadre-period">'+(s==='current'?'T2 · '+state.year:'T1 · '+(state.year-1))+'</span><span>Activos <b>'+numCell(v?.assets)+'</b></span><span>Pasivos + patrimonio <b>'+numCell(v?.funding)+'</b></span><span>Diferencia <b class="'+(v&&v.balanced===false?'negative':'')+'">'+numCell(v?.difference)+'</b></span><span class="stamp '+stamp[0]+'">'+stamp[1]+'</span></div>';
 }).join('');
}
function renderAccounts(){
 const partial=state.partial||blankPartial();
 const partialBox='<div class="partial-box"><label class="check"><input type="checkbox" id="partial-toggle"'+(partial.enabled?' checked':'')+'><span><b>Balance parcial</b> · el ejercicio no da el balance completo</span></label>'+(partial.enabled?'<fieldset><legend>Marca las partes que escribiste completas. Solo se calculan las razones cuyas partes estén marcadas, y no se exige que el balance cuadre.</legend>'+Object.entries(F.balanceParts).map(([k,l])=>'<label class="check"><input type="checkbox" data-complete="'+k+'"'+(partial.complete[k]?' checked':'')+'>'+esc(l.charAt(0).toUpperCase()+l.slice(1))+'</label>').join('')+'</fieldset>':'')+'</div>';
 $('#balance-inputs').innerHTML=accountTable('balance',(window.importBarHTML?.('balance')||'')+partialBox);updateLedgerTotals();
}
function renderIncomeAccounts(){
 const ip=state.incomePartial||blankIncomePartial();
 const incomeBox='<div class="partial-box"><label class="check"><input type="checkbox" id="income-partial-toggle"'+(ip.enabled?' checked':'')+'><span><b>Estado de resultados parcial</b> · el ejercicio no da todas las categorías</span></label>'+(ip.enabled?'<fieldset><legend>Marca las categorías que escribiste completas. Solo se calculan los indicadores cuyas categorías estén marcadas. Cada categoría marcada necesita al menos una cuenta con importe (0 si no existe).</legend>'+Object.entries(F.incomeParts).map(([k,l])=>'<label class="check"><input type="checkbox" data-icomplete="'+k+'"'+(ip.complete[k]?' checked':'')+'>'+esc(l)+'</label>').join('')+'</fieldset>':'')+'</div>';
 $('#income-inputs').innerHTML=accountTable('income',(window.importBarHTML?.('income')||'')+incomeBox);updateLedgerTotals();
}
// Actualiza una fila en el sitio (sin redibujar la tabla) para no perder el foco de quien está escribiendo.
function refreshRow(kind,i){
 const a=rowKinds[kind].list()[i],tr=document.querySelector('tr[data-kind="'+kind+'"][data-row="'+i+'"]');if(!a||!tr)return;
 tr.querySelector('.acct-chip').outerHTML=chipHTML(kind,a,i);
 const adv=document.querySelector('tr[data-kind="'+kind+'"][data-adv="'+i+'"]');
 if(isOpen(kind,a)){if(adv)adv.querySelector('.acct-adv-fields').innerHTML=advFieldsHTML(kind,a,i);else tr.insertAdjacentHTML('afterend',advRowHTML(kind,a,i,tr.children.length));}else if(adv)adv.remove();
 tr.querySelectorAll('input[type=number]').forEach(n=>{if(allowsNegative(kind,a))n.removeAttribute('min');else n.setAttribute('min','0');n.step=kind==='income'&&a.category==='shares'?'1':'any';});
}
function applyCatalog(kind,a){
 const hit=kind==='balance'?F.matchAccount(a.name):F.matchIncomeAccount(a.name);if(!hit)return false;
 if(kind==='balance'){a.section=hit.section;a.term=hit.term;a.role=hit.role;a.sign=hit.sign;a.memo=hit.memo;}else{a.category=hit.category;a.sign=hit.sign;}
 return true;
}
function editAccount(i,field,value){
 const a=state.accounts[i];if(!a)return false;
 if(field==='name')a.name=value;
 else if(field==='class'){
  if(value===''){a.section=null;a.term=null;a.role=null;}
  else{if(value==='equity'){a.section='equity';a.term=null;}else[a.section,a.term]=value.split('.');const r=a.role&&F.accountRoles[a.role];if(r&&!(r.section===a.section&&r.term===a.term))a.role=null;}
  if(!a.role)a.memo=false;
 }
 else if(field==='role'){a.role=value||null;if(!a.role)a.memo=false;}
 else if(field==='mode'){a.memo=value==='memo';a.sign=value==='sub'?-1:1;}
 return field!=='name';
}
function editIncomeAccount(i,field,value){
 const a=state.incomeAccounts[i];if(!a)return false;
 if(field==='name')a.name=value;
 else if(field==='category'){a.category=value||null;if(a.category&&F.incomeCategories[a.category].memo)a.sign=1;}
 else if(field==='mode')a.sign=value==='sub'?-1:1;
 return field!=='name';
}
function setCurrentIncome(values){
 for(const row of state.incomeAccounts)row.amounts.current=null;
 for(const [category,value] of Object.entries(values)){
  let row=state.incomeAccounts.find(a=>a.category===category&&a.sign===1);
  if(!row){row={id:uid(),name:F.incomeCategories[category].label,category,sign:1,amounts:{previous:null,current:null}};state.incomeAccounts.push(row);}
  row.amounts.current=value;
 }
}
function fillForms(){
 ensureCompatibility(state);
 $('#current-year').value=state.year;$('#period-mode').value=state.hasPrevious?'two':'one';$('#days-base').value=state.params.days;$('#return-method').value=state.params.returnMethod;$('#purchase-rate').value=state.params.purchaseRate*100;$('#purchases-method').value=state.params.purchasesMethod;$('#all-sales-credit').checked=!!state.params.allSalesCredit;$('#purchase-rate').disabled=state.params.purchasesMethod==='inventory';
 document.querySelectorAll('.year-current').forEach(el=>el.textContent=state.year);document.querySelectorAll('.year-previous').forEach(el=>el.textContent=state.year-1);
 renderAccounts();
 renderIncomeAccounts();
 for(const side of ['base','alternative'])$('#cvu-'+side+'-inputs').innerHTML=F.cvuKeys.map(k=>input('cvu.'+side+'.'+k,cvuLabels[k],{percent:k==='taxRate',integer:k==='shares'})).join('');
 $('#quick-inputs').innerHTML=Object.entries({profit:'Utilidad neta',sales:'Ventas',assets:'Activos',equity:'Patrimonio'}).map(([k,label])=>input('quick.'+k,label,{negative:k==='profit'})).join('');
 const classicLabels={sales:'Ventas',profit:'Utilidad neta',cash:'Efectivo',receivables:'Cuentas por cobrar',inventory:'Inventarios',fixed:'Activos no corrientes',payables:'Cuentas por pagar',otherCurrent:'Otros pasivos corrientes',longDebt:'Pasivos a largo plazo',growth:'Variación de ventas (−50 a +50 %)',repayment:'Pago de proveedores (0 a 100 %)'};
 $('#classic-inputs').innerHTML=Object.entries(classicLabels).map(([k,l])=>input('classic.'+k,l,{negative:k==='profit'||k==='growth'})).join('');
 $('#questions').innerHTML=questions.map((q,i)=>'<fieldset class="question"><legend><span>0'+(i+1)+'</span>'+q+'</legend><div class="choices">'+[['yes','Sí'],['no','No']].map(([v,l])=>'<label><input type="radio" name="health'+i+'" data-health="'+i+'" value="'+v+'" '+(state.health[i]===v?'checked':'')+'><span>'+l+'</span></label>').join('')+'</div></fieldset>').join('');
 $('#sales-change').value=state.scenario.growth;$('#payables-change').value=state.scenario.repayment;
 $('#case-select').replaceChildren(...library.cases.map(c=>{const o=document.createElement('option');o.value=c.id;o.textContent=c.name;return o;}));$('#case-select').value=active.id;$('#case-name').value=active.name;
 $('#legacy-note').hidden=!state.legacy;
 const thresholds={quickRatio:'Prueba ácida: crítico por debajo de',workingCapital:'Capital de trabajo: crítico por debajo de',interestCoverage:'Cobertura: crítico por debajo de',debtRatio:'Deuda: crítico por encima de (%)',inventoryDays:'Inventario: atención por encima de (días)',collectionDays:'Cobro: atención por encima de (días)',gat:'GAT: atención por encima de',currentMin:'Razón corriente favorable: desde',currentMax:'Razón corriente favorable: hasta',roe:'ROE favorable por encima de (%)',netMargin:'Margen neto favorable por encima de (%)'};
 $('#threshold-inputs').innerHTML=Object.entries(thresholds).map(([k,l])=>input('thresholds.'+k,l,{percent:['debtRatio','roe','netMargin'].includes(k),negative:k==='workingCapital'})).join('');
}
const pageMeta={resumen:['Tu empresa, en perspectiva.','Un mismo caso. Una lectura financiera conectada.'],estados:['El punto de partida: tus estados.','Ingresa datos conciliados. Todos los análisis se actualizan a partir de esta base.'],analisis:['Entiende la estructura y el cambio.','Composición vertical y evolución entre ejercicios, con las mismas fuentes.'],razones:['De las cifras a la interpretación.','Cada indicador conserva su fórmula, su método y su propia referencia.'],cvu:['Encuentra tu punto de equilibrio.','Costo, volumen y utilidad: una cascada completa del mismo escenario.'],escenarios:['Explora una decisión antes de tomarla.','Una copia de la base permite comparar cambios sin alterar los datos originales.'],salud:['Las preguntas detrás de los números.','Complementa el análisis cuantitativo con una lectura de la operación.'],reporte:['Una lectura lista para compartir.','Datos, métodos, resultados y supuestos reunidos en un reporte ejecutivo.']};
function navigate(){
 const aliases={rentabilidad:'razones'},key=aliases[location.hash.slice(1)]||location.hash.slice(1);
 const id=Object.hasOwn(pageMeta,key)?key:'resumen';
 document.querySelectorAll('.module').forEach(s=>s.hidden=s.id!==id);
 document.querySelectorAll('.nav a').forEach(a=>{const selected=a.hash==='#'+id;a.classList.toggle('active',selected);if(selected)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 $('#page-title').textContent=pageMeta[id][0];$('#page-description').textContent=pageMeta[id][1];$('#period-label').textContent=state.hasPrevious?(state.year-1)+' — '+state.year:String(state.year);
 if(id==='reporte'&&window.renderReport)window.renderReport();
 requestAnimationFrame(()=>window.resizeCharts?.());
}
window.addEventListener('hashchange',navigate);
document.addEventListener('input',event=>{
 const el=event.target;
 const kind=el.dataset.acct!==undefined?'balance':el.dataset.iacct!==undefined?'income':null;
 if(kind){
  const i=Number(el.dataset.acct??el.dataset.iacct),field=el.dataset.field,a=rowKinds[kind].list()[i];
  if(a){
   const meta=(kind==='balance'?editAccount:editIncomeAccount)(i,field,el.value);
   const picked=field==='name'&&(!event.inputType||event.inputType==='insertReplacementText')&&applyCatalog(kind,a); // elegir una sugerencia de la lista
   if(meta)openAccounts.add(kind+':'+a.id); // una vez que se usa el panel avanzado, se queda abierto
   const moves=picked||(meta&&(field==='class'||field==='category')),draw=kind==='balance'?renderAccounts:renderIncomeAccounts;
   if(moves){draw();const target=document.querySelector('[data-'+rowKinds[kind].attr+'="'+i+'"][data-field="'+field+'"]');target?.focus();if(picked)target?.setSelectionRange?.(target.value.length,target.value.length);}
   else if(meta){refreshRow(kind,i);document.querySelector('[data-'+rowKinds[kind].attr+'="'+i+'"][data-field="'+field+'"]')?.focus();}
   persist();window.refresh?.();
  }
 }else if(el.dataset.path){
  let v=el.value===''?null:Number(el.value);if(v!==null&&el.dataset.percent)v/=100;setPath(el.dataset.path,v);persist();window.refresh?.();
 }else if(el.dataset.health){state.health[Number(el.dataset.health)]=el.value;persist();window.refresh?.();}
});
document.addEventListener('click',event=>{
 const t=event.target,toggle=t.closest('[data-toggle-account]');
 if(toggle){
  const kind=toggle.dataset.kind,i=Number(toggle.dataset.toggleAccount),a=rowKinds[kind].list()[i];
  if(a){const key=kind+':'+a.id;if(openAccounts.has(key))openAccounts.delete(key);else openAccounts.add(key);refreshRow(kind,i);}
  return;
 }
 const group=t.closest('[data-add-group]');
 if(group){
  const kind=group.dataset.kind,k=rowKinds[kind],list=k.list(),key=group.dataset.addGroup;
  if(list.length>=80){status(k.limit,true);return;}
  const blank={previous:null,current:null};
  if(kind==='balance'){const [section,term]=key?(key==='equity'?['equity',null]:key.split('.')):[null,null];list.push({id:uid(),name:'',section,term,role:null,sign:1,memo:false,amounts:blank});}
  else list.push({id:uid(),name:'',category:key||null,sign:1,amounts:blank});
  (kind==='balance'?renderAccounts:renderIncomeAccounts)();persist();window.refresh?.();
  document.querySelector('[data-'+k.attr+'="'+(list.length-1)+'"][data-field="name"]')?.focus();return;
 }
 for(const kind of ['balance','income']){
  const k=rowKinds[kind],list=k.list(),render=kind==='balance'?renderAccounts:renderIncomeAccounts;
  if(t.closest('#'+k.add)){
   if(list.length>=80){status(k.limit,true);return;}
   list.push(kind==='balance'?{id:uid(),name:'',section:null,term:null,role:null,sign:1,memo:false,amounts:{previous:null,current:null}}:{id:uid(),name:'',category:null,sign:1,amounts:{previous:null,current:null}});
   render();persist();window.refresh?.();document.querySelector('[data-'+k.attr+'="'+(list.length-1)+'"][data-field="name"]')?.focus();return;
  }
  const remove=t.closest('['+k.remove+']');
  if(remove){list.splice(Number(remove.getAttribute(k.remove)),1);render();persist();window.refresh?.();return;}
 }
});
document.addEventListener('change',event=>{
 const el=event.target;
 const nameKind=el.dataset.field==='name'?(el.dataset.acct!==undefined?'balance':el.dataset.iacct!==undefined?'income':null):null;
 if(nameKind){const i=Number(el.dataset.acct??el.dataset.iacct),a=rowKinds[nameKind].list()[i];if(a&&applyCatalog(nameKind,a)){refreshRow(nameKind,i);pendingRegroup.add(nameKind);persist();window.refresh?.();}}
 else if(el.id==='partial-toggle'){state.partial.enabled=el.checked;renderAccounts();persist();window.refresh?.();}
 else if(el.dataset.complete){state.partial.complete[el.dataset.complete]=el.checked;persist();window.refresh?.();}
 else if(el.id==='income-partial-toggle'){state.incomePartial.enabled=el.checked;renderIncomeAccounts();persist();window.refresh?.();}
 else if(el.dataset.icomplete){state.incomePartial.complete[el.dataset.icomplete]=el.checked;persist();window.refresh?.();}
});
document.addEventListener('focusout',event=>{
 if(!pendingRegroup.size)return;
 for(const kind of [...pendingRegroup]){
  const root=document.querySelector(kind==='balance'?'#balance-inputs':'#income-inputs');
  if(!event.relatedTarget||!root.contains(event.relatedTarget)){pendingRegroup.delete(kind);(kind==='balance'?renderAccounts:renderIncomeAccounts)();}
 }
});
document.addEventListener('submit',event=>event.preventDefault());
$('#current-year').addEventListener('change',e=>{
 const value=e.target.value.trim()===''?NaN:Number(e.target.value);
 if(!F.validYear(value)){e.target.value=state.year;status('El año debe ser un entero entre 1901 y 9999; se conservó '+state.year+'.',true);return;}
 state.year=value;fillForms();persist();window.refresh?.();navigate();
});
$('#period-mode').addEventListener('change',e=>{state.hasPrevious=e.target.value==='two';fillForms();persist();window.refresh?.();navigate();});
$('#days-base').addEventListener('change',e=>{state.params.days=Number(e.target.value);persist();window.refresh?.();});
$('#return-method').addEventListener('change',e=>{state.params.returnMethod=e.target.value;persist();window.refresh?.();});
$('#purchases-method').addEventListener('change',e=>{state.params.purchasesMethod=e.target.value;$('#purchase-rate').disabled=e.target.value==='inventory';persist();window.refresh?.();});
$('#all-sales-credit').addEventListener('change',e=>{state.params.allSalesCredit=e.target.checked;persist();window.refresh?.();});
$('#purchase-rate').addEventListener('input',e=>{state.params.purchaseRate=e.target.value===''?null:Number(e.target.value)/100;persist();window.refresh?.();});
$('#case-name').addEventListener('change',e=>{const name=e.target.value.trim();if(!name){e.target.value=active.name;return;}active.name=name.slice(0,80);persist();fillForms();window.refresh?.();});
$('#case-select').addEventListener('change',e=>{if(!persist()){e.target.value=active.id;return;}active=library.cases.find(c=>c.id===e.target.value);library.activeId=active.id;state=active.data;state.thresholds={...thresholdDefaults,...state.thresholds};state.quick??=blankData().quick;fillForms();persist();window.refresh?.();navigate();});
function addCase(name,data){
 if(!persist()||library.cases.length>=50){if(library.cases.length>=50)status('Límite de 50 casos alcanzado.',true);return;}
 active={id:uid(),name,data};library.cases.push(active);library.activeId=active.id;state=data;fillForms();persist();window.refresh?.();navigate();
 $('.example-menu').open=false;
}
$('#new-case').addEventListener('click',()=>addCase('Caso '+(library.cases.length+1),blankData()));
$('#example-case').addEventListener('click',()=>{
 const data=blankData();data.note='Caso sintético de validación matemática. No corresponde a una empresa real.';
 data.accounts=F.accountsFromBalances({current:{cash:25000,receivables:30000,inventory:35000,otherCurrentAssets:0,fixed:80000,otherNonCurrentAssets:0,payables:40000,otherCurrentLiabilities:15000,longDebt:30000,otherNonCurrentLiabilities:0,equity:85000},previous:{cash:20000,receivables:25000,inventory:30000,otherCurrentAssets:0,fixed:75000,otherNonCurrentAssets:0,payables:25000,otherCurrentLiabilities:20000,longDebt:30000,otherNonCurrentLiabilities:0,equity:75000}});
 data.incomeAccounts=F.incomeAccountsFromStatements({current:{sales:200000,creditSales:150000,costSales:120000,operatingExpenses:50000,fixedCosts:30000,interest:10000,taxes:5000,preferredDividends:0,shares:1000,creditPurchases:null},previous:{sales:180000,creditSales:130000,costSales:110000,operatingExpenses:45000,fixedCosts:27000,interest:9000,taxes:4000,preferredDividends:0,shares:1000,creditPurchases:null}});
 data.cvu.base={price:10,quantity:3000,variableCost:5,fixedCosts:2500,taxRate:.25,interest:10000,preferredDividends:0,shares:1000};data.cvu.alternative={...data.cvu.base,quantity:3300};data.health=['yes','yes','no','no'];
 addCase('Aurora · ejemplo sintético',data);
});
$('#reset-thresholds').addEventListener('click',()=>{state.thresholds={...thresholdDefaults};fillForms();persist();window.refresh?.();});
for(const [id,key]of [['sales-change','growth'],['payables-change','repayment']])$('#'+id).addEventListener('input',e=>{state.scenario[key]=Number(e.target.value);persist();window.refresh?.();});
$('#reset-scenario').addEventListener('click',()=>{state.scenario={growth:0,repayment:0};fillForms();persist();window.refresh?.();});
$('#copy-cvu').addEventListener('click',()=>{state.cvu.alternative=JSON.parse(JSON.stringify(state.cvu.base));fillForms();persist();window.refresh?.();});
$('#use-cvu').addEventListener('click',()=>{
 try{const c=F.calculateCVU(state.cvu.base);setCurrentIncome({sales:c.sales,creditSales:null,costSales:c.variableCosts,opex:c.fixedCosts,fixedCosts:c.fixedCosts,interest:c.interest,taxes:c.taxes,preferred:c.preferredDividends,shares:c.shares,creditPurchases:null});state.note='Resultados T2 derivados del CVU base. Ventas a crédito y compras requieren clasificación. Se conserva el balance ingresado.';fillForms();persist();window.refresh?.();location.hash='estados';}catch(e){status(e.message,true);}
});
window.addEventListener('storage',event=>{if(event.key===storageKey||event.key===null){storageBlocked=true;status('Los casos cambiaron en otra pestaña. Genera un reporte y recarga antes de continuar guardando.',true);}});
fillForms();navigate();
if(storageBlocked)status('No se pudo leer el almacenamiento. Tus datos anteriores se conservan; esta sesión es temporal.',true);else persist();
window.updateLedgerTotals=updateLedgerTotals;window.ledgerSummaries=ledgerSummaries;
window.GestiCode={model,get state(){return state;},get active(){return active;},persist,fillForms,navigate,addCase};

