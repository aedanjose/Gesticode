const assert = require('node:assert/strict');
const {dupont,simulate}=require('./dist/finance.js');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const base={sales:200000,profit:15000,cash:25000,receivables:30000,inventory:35000,fixed:80000,payables:40000,otherCurrent:15000,longDebt:30000};
const d=dupont({profit:15000,sales:200000,assets:150000,equity:75000});
close(d.margin,.075);close(d.turnover,4/3);close(d.leverage,2);close(d.roe,.2);
close(dupont({profit:-15000,sales:200000,assets:150000,equity:75000}).roe,-.2);
assert.throws(()=>dupont({profit:10,sales:0,assets:100,equity:50}));
assert.throws(()=>dupont({profit:10,sales:100,assets:100,equity:0}));
const unchanged=simulate(base);assert.deepEqual(unchanged.base,unchanged.scenario);
const adjusted=simulate(base,15,10);
close(adjusted.scenario.profit,17250);close(adjusted.scenario.sales,230000);
close(adjusted.payment,4000);close(adjusted.scenario.cash,23250);
close(adjusted.scenario.assets,168250);close(adjusted.scenario.equity,87250);
close(adjusted.scenario.currentLiabilities,51000);close(adjusted.scenario.liquidity,88250/51000);
close(adjusted.scenario.assets,adjusted.scenario.currentLiabilities+base.longDebt+adjusted.scenario.equity);
close(adjusted.scenario.roa,17250/168250);close(adjusted.scenario.roe,17250/87250);
assert.throws(()=>simulate(base,0,100),/efectivo/);
assert.throws(()=>simulate({...base,otherCurrent:200000}),/patrimonio/);
assert.throws(()=>simulate(base,51,0));assert.throws(()=>simulate(base,0,-1));
assert.throws(()=>simulate({...base,sales:NaN}));
const noDebt=simulate({...base,payables:0,otherCurrent:0,longDebt:0});assert.equal(noDebt.scenario.liquidity,null);
const losses=simulate({...base,profit:-10000},15,0);close(losses.scenario.profit,-11500);close(losses.scenario.cash,23500);
for(let growth=-50;growth<=50;growth+=10)for(let payment=0;payment<=40;payment+=10){const s=simulate(base,growth,payment);close(s.scenario.assets,s.scenario.currentLiabilities+base.longDebt+s.scenario.equity);close(s.scenario.profit/s.scenario.sales,base.profit/base.sales);}
console.log('Pruebas aprobadas: Du Pont, pérdidas, escenario 15%/10%, conservación del balance, liquidez y errores de dominio.');

const test=require('node:test');
const F=require('./dist/finance.js');
// Estados originales de Bartlett aportados por el usuario. Campos no informados: null.
const bartlettBalance=(year)=>year===2012?{cash:363000,receivables:503000,inventory:289000,otherCurrentAssets:68000,fixed:2374000,otherNonCurrentAssets:0,payables:382000,otherCurrentLiabilities:238000,longDebt:1023000,otherNonCurrentLiabilities:0,equity:1954000}:{cash:288000,receivables:365000,inventory:300000,otherCurrentAssets:51000,fixed:2266000,otherNonCurrentAssets:0,payables:270000,otherCurrentLiabilities:213000,longDebt:967000,otherNonCurrentLiabilities:0,equity:1820000};
const bartlettIncome=(year)=>year===2012?{sales:3074000,creditSales:null,costSales:2088000,operatingExpenses:568000,fixedCosts:null,interest:93000,taxes:94000,preferredDividends:10000,shares:null,creditPurchases:null}:{sales:2567000,creditSales:null,costSales:1711000,operatingExpenses:553000,fixedCosts:null,interest:91000,taxes:64000,preferredDividends:10000,shares:null,creditPurchases:null};
const bartlett={year:2012,current:{year:2012,balance:bartlettBalance(2012),income:bartlettIncome(2012)},previous:{year:2011,balance:bartlettBalance(2011),income:bartlettIncome(2011)},params:{days:365,purchaseRate:.7,returnMethod:'average'}};
test('Bartlett: balance, resultados, liquidez, inventarios y cobertura con datos originales',()=>{
 const a=F.analyzeModel(bartlett);assert.deepEqual(a.errors,{});close(a.currentBalance.assets,3597000);close(a.currentIncome.ebit,418000);close(a.currentIncome.netProfit,231000);close(a.currentIncome.commonProfit,221000);
 close(a.liquidity.workingCapital.value,603000);assert.equal(a.liquidity.currentRatio.value.toFixed(2),'1.97');assert.equal(a.liquidity.quickRatio.value.toFixed(2),'1.51');
 assert.equal(a.activity.metrics.inventoryTurnover.value.toFixed(2),'7.09');assert.equal(a.activity.metrics.inventoryDays.value.toFixed(2),'51.48');assert.equal((a.debt.debtRatio.value*100).toFixed(1),'45.7');assert.equal(a.debt.interestCoverage.value.toFixed(1),'4.5');
 assert.equal(a.activity.metrics.collectionDays.value,null);assert.equal(a.activity.purchasesEstimated,true);close(a.profitability.dupont.roe.value,a.profitability.metrics.roe.value);
});
test('Bartlett: PPP con el supuesto explícito del prompt de compras a crédito = 70 % del costo',()=>{assert.equal(F.analyzeModel(bartlett).activity.metrics.paymentDays.value.toFixed(2),'81.41');});
test('Bartlett PPC 51.53: pendiente de confirmar que todas las ventas son a crédito',{todo:'Falta confirmar el supuesto de ventas a crédito del ejercicio'},()=>{});
test('La Grandiosa: pendiente de estados originales',{todo:'Solo se recibieron resultados esperados, no datos de entrada'},()=>{});
test('Ejercicio académico GAO 1.20 / GAF 5 / GAT 6: pendiente de entradas originales',{todo:'Faltan cantidad, costos, intereses, impuestos, dividendos y acciones'},()=>{});
test('Punto de equilibrio: CF 2500, P 10, CV 5',()=>{const c=F.calculateCVU({price:10,quantity:1000,variableCost:5,fixedCosts:2500,taxRate:0,interest:0,preferredDividends:0,shares:1});close(c.breakEvenUnits,500);close(c.breakEvenSales,5000);});
const cvu={price:10,quantity:3000,variableCost:5,fixedCosts:2500,taxRate:.25,interest:10000,preferredDividends:0,shares:1000};
test('Caso sintético de validación matemática: cascada, GAO/GAF/GAT y variaciones',()=>{const c=F.calculateCVU(cvu),s=F.calculateCVU({...cvu,quantity:3300}),v=F.leverageChanges(c,s);close(c.gao.value,1.2);close(c.gaf.value,5);close(c.gat.value,6);close(c.afterTax,1875);close(c.eps.value,1.875);close(v.gao.value,c.gao.value);close(v.gaf.value,c.gaf.value);close(v.gat.value,c.gat.value);});
test('CVU: ceros, contribución no positiva, impuestos y números inválidos',()=>{
 for(const variableCost of [10,11])assert.throws(()=>F.calculateCVU({...cvu,variableCost}),{message:'El Precio de Venta debe ser mayor al Costo Variable Unitario para generar Margen de Contribución'});
 for(const patch of [{taxRate:1},{taxRate:-.1},{quantity:-1},{price:NaN},{shares:1.5}])assert.throws(()=>F.calculateCVU({...cvu,...patch}));
 assert.equal(F.calculateCVU({...cvu,shares:0}).eps.value,null);assert.equal(F.calculateCVU({...cvu,quantity:500}).gao.value,null);assert.equal(F.calculateCVU({...cvu,quantity:2500}).gaf.value,null);
 const c=F.calculateCVU(cvu);assert.equal(F.leverageChanges(c,c).gat.value,null);
});
test('Liquidez y razones: bases cero, pérdidas, datos faltantes y balances inválidos',()=>{
 const z=Object.fromEntries(F.balanceKeys.map(k=>[k,0])),b=F.calculateBalance(z),i=F.calculateIncome({...bartlettIncome(2012),sales:0,costSales:0,operatingExpenses:0,interest:0,taxes:0});
 assert.equal(F.calculateLiquidity(b).currentRatio.value,null);assert.equal(F.calculateDebt(b,i).interestCoverage.value,null);assert.equal(F.calculateProfitability(b,i).metrics.roe.value,null);assert.equal(F.calculateProfitability(b,i).metrics.netMargin.value,null);
 assert.throws(()=>F.calculateBalance({...z,inventory:-1}));assert.throws(()=>F.calculateBalance({...z,cash:null}));assert.throws(()=>F.calculateBalance({...z,cash:1}));assert.throws(()=>F.calculateIncome({...bartlettIncome(2012),creditSales:1e10}));
 assert.equal(F.compareValues(0,100,0,100).relative,null);assert.equal(F.compareValues(-10,20,100,100).relative,null);close(F.compareValues(50,60,100,200).relative,.2);
});
test('Periodos, promedios, compras reales y parametrización',()=>{
 const average=F.analyzeModel(bartlett),single=F.analyzeModel({...bartlett,previous:null});assert.equal(average.activity.method,'average');assert.equal(single.activity.method,'closing');close(average.profitability.bases.assets,3433500);close(single.profitability.bases.assets,3597000);
 const i=F.calculateIncome({...bartlettIncome(2012),creditSales:3074000,creditPurchases:1000000}),b=F.calculateBalance(bartlettBalance(2012)),p=F.calculateBalance(bartlettBalance(2011));const a=F.calculateActivity(b,i,p,{days:360});close(a.metrics.collectionDays.value,434000*360/3074000);assert.equal(a.purchasesEstimated,false);
 assert.throws(()=>F.analyzeModel({...bartlett,previous:{...bartlett.previous,year:2010}}));assert.throws(()=>F.parameters({days:364}));assert.throws(()=>F.parameters({purchaseRate:1.1}));
 const invalid=F.analyzeModel({...bartlett,previous:{...bartlett.previous,balance:{}}});assert.equal(invalid.activity,null);assert.equal(invalid.profitability,null);
});
test('Escenario integrado: independencia, conservación y recálculo de razones',()=>{
 const model=JSON.parse(JSON.stringify(bartlett));model.current.income.fixedCosts=300000; // Caso sintético: clasificación operativa elegida para probar el motor.
 const before=JSON.stringify(model),s=F.simulateModel(model,15,10);assert.equal(JSON.stringify(model),before);close(s.result.currentBalance.assets,s.result.currentBalance.liabilities+s.result.currentBalance.equity);assert.notEqual(s.result.profitability.metrics.roe.value,s.base.profitability.metrics.roe.value);assert.ok(s.result.liquidity&&s.result.activity&&s.result.debt);
 assert.throws(()=>F.simulateModel(bartlett,15,10),/costos fijos/);assert.throws(()=>F.simulateModel(model,-50,100),/efectivo/);
});

test('CVU: dividendos preferentes y comparación con estructura modificada',()=>{
 const c=F.calculateCVU({...cvu,preferredDividends:750});
 close(c.commonProfit,1125);close(c.eps.value,1.125);close(c.gaf.value,12500/1500);close(c.gat.value,10);
 const different=F.leverageChanges(c,F.calculateCVU({...cvu,preferredDividends:750,price:11}));
 assert.equal(different.sameStructure,false);
});
test('Escenario neutro, pérdida y crédito fiscal: conserva base y acota tasa',()=>{
 const m=JSON.parse(JSON.stringify(bartlett));m.current.income.fixedCosts=300000;
 const neutral=F.simulateModel(m,0,0);assert.deepEqual(neutral.base,neutral.result);
 m.current.income.taxes=-1000;const credited=F.simulateModel(m,10,0);close(credited.taxRate,0);close(credited.result.currentIncome.taxes,-1000);
 m.current.income.operatingExpenses=1400000;m.current.income.taxes=0;
 const loss=F.simulateModel(m,0,0);assert.ok(loss.result.currentIncome.netProfit<0);assert.deepEqual(loss.base,loss.result);
 const checkFinite=v=>{if(typeof v==='number')assert.ok(Number.isFinite(v));else if(v&&typeof v==='object')Object.values(v).forEach(checkFinite);};
 [neutral,credited,loss].forEach(checkFinite);
});

// ---------- Balance por cuentas: pocas o muchas cuentas, cuentas que restan y totales sin desglose ----------
const acc=(name,section,term,role,amount,extra={})=>({name,section,term,role,sign:1,memo:false,amount,...extra});
// Bartlett 2012 con el detalle del libro (17 cuentas). Terrenos, edificios, maquinaria, depreciación y el desglose del
// patrimonio son una partición sintética que suma exactamente las cifras aportadas por el usuario.
const detailed2012=()=>[
 acc('Efectivo','asset','current','cash',363000),acc('Valores negociables','asset','current',null,68000),acc('Cuentas por cobrar','asset','current','receivables',503000),
 acc('Materia prima','asset','current','inventory',100000),acc('Producto terminado','asset','current','inventory',189000),
 acc('Terrenos y edificios','asset','noncurrent','fixed',1700000),acc('Maquinaria y equipo','asset','noncurrent','fixed',1900000),acc('Depreciación acumulada','asset','noncurrent','fixed',1226000,{sign:-1}),
 acc('Cuentas por pagar','liability','current','payables',382000),acc('Documentos por pagar','liability','current',null,100000),acc('Deudas acumuladas','liability','current',null,138000),
 acc('Deuda a largo plazo','liability','noncurrent','longDebt',1023000),
 acc('Acciones preferentes','equity',null,null,200000),acc('Acciones comunes','equity',null,null,300000),acc('Capital pagado en exceso','equity',null,null,800000),acc('Utilidades retenidas','equity',null,null,754000),acc('Acciones en tesorería','equity',null,null,100000,{sign:-1}),
];
const compact=(year)=>({accounts:F.accountsForPeriod(F.accountsFromBalances({previous:bartlettBalance(2011),current:bartlettBalance(2012)}),year===2012?'current':'previous')});
const withBalances=(cur,prev)=>({...bartlett,current:{...bartlett.current,balance:cur},previous:{...bartlett.previous,balance:prev}});
const sameMetrics=(a,b)=>{for(const k of ['liquidity','debt','activity','profitability'])assert.deepEqual(a[k],b[k],k);close(a.currentBalance.assets,b.currentBalance.assets);close(a.currentBalance.equity,b.currentBalance.equity);};

test('Balance por cuentas: 11 cuentas, 17 cuentas y el balance plano dan los mismos resultados',()=>{
 const flat=F.analyzeModel(bartlett),many=F.analyzeModel(withBalances({accounts:detailed2012()},compact(2011))),few=F.analyzeModel(withBalances(compact(2012),compact(2011)));
 assert.deepEqual(many.errors,{});sameMetrics(flat,many);sameMetrics(flat,few);
 const b=many.currentBalance;close(b.fixed,2374000);close(b.inventory,289000);close(b.otherCurrentAssets,68000);close(b.otherCurrentLiabilities,238000);close(b.equity,1954000);close(b.assets,b.liabilities+b.equity);
});
test('Cuentas de valuación: la depreciación acumulada y las acciones en tesorería restan',()=>{
 const b=F.calculateBalance({accounts:detailed2012()});close(b.fixed,1700000+1900000-1226000);close(b.equity,200000+300000+800000+754000-100000);
});
test('Totales sin desglose: «de los cuales» toma el rol sin sumar dos veces',()=>{
 const b=F.calculateBalance({accounts:[acc('Total activos corrientes','asset','current',null,1223000),acc('Inventarios','asset','current','inventory',289000,{memo:true}),acc('Total activos no corrientes','asset','noncurrent',null,2374000),
  acc('Total pasivos corrientes','liability','current',null,620000),acc('Cuentas por pagar','liability','current','payables',382000,{memo:true}),acc('Deuda a largo plazo','liability','noncurrent','longDebt',1023000),acc('Patrimonio total','equity',null,null,1954000)]});
 close(b.currentAssets,1223000);close(b.inventory,289000);close(b.otherCurrentAssets,934000);close(b.assets,3597000);close(b.currentLiabilities,620000);close(b.payables,382000);close(b.otherCurrentLiabilities,238000);
 const l=F.calculateLiquidity(b);assert.equal(l.currentRatio.value.toFixed(2),'1.97');assert.equal(l.quickRatio.value.toFixed(2),'1.51');close(l.workingCapital.value,603000);
 assert.equal(b.provided.cash,false);assert.equal(b.provided.inventory,true);
});
test('Cuenta no informada ≠ cero: la razón queda sin calcular con su motivo',()=>{
 const noInventory=F.calculateBalance({accounts:[acc('Total activos corrientes','asset','current',null,1223000),acc('Total activos no corrientes','asset','noncurrent',null,2374000),acc('Total pasivos corrientes','liability','current',null,620000),acc('Deuda a largo plazo','liability','noncurrent','longDebt',1023000),acc('Patrimonio','equity',null,null,1954000)]});
 const l=F.calculateLiquidity(noInventory);assert.equal(l.quickRatio.value,null);assert.match(l.quickRatio.reason,/Inventarios no informados/);assert.equal(l.currentRatio.value.toFixed(2),'1.97');
 const a=F.calculateActivity(noInventory,F.calculateIncome(bartlettIncome(2012)),null,{});assert.equal(a.metrics.inventoryTurnover.value,null);assert.match(a.metrics.inventoryDays.reason,/Inventarios no informados/);assert.notEqual(a.metrics.assetTurnover.value,null);
 const zero=F.calculateBalance({accounts:[acc('Efectivo','asset','current','cash',1000),acc('Inventarios','asset','current','inventory',0),acc('Patrimonio','equity',null,null,1000)]});
 assert.equal(zero.provided.inventory,true);assert.doesNotMatch(F.calculateLiquidity(zero).quickRatio.reason,/no informados/);
 const blank=F.calculateBalance({accounts:[acc('Efectivo','asset','current','cash',1000),acc('Inventarios','asset','current','inventory',null),acc('Patrimonio','equity',null,null,1000)]});assert.equal(blank.provided.inventory,false);
});
test('Cuentas con el mismo rol se suman y el número de cuentas no cambia el resultado (200 particiones aleatorias)',()=>{
 let seed=7;const rnd=()=>(seed=(seed*1664525+1013904223)%4294967296)/4294967296;
 const base=F.analyzeModel(bartlett);
 const split=(name,section,term,role,total)=>{const parts=1+Math.floor(rnd()*6),cuts=[...Array(parts-1)].map(()=>Math.round(rnd()*total)).sort((a,b)=>a-b),bounds=[0,...cuts,total];return bounds.slice(1).map((v,i)=>acc(`${name} ${i+1}`,section,term,role,v-bounds[i]));};
 for(let n=0;n<200;n++){
  const b=bartlettBalance(2012);
  const list=[...split('Efectivo','asset','current','cash',b.cash),...split('CxC','asset','current','receivables',b.receivables),...split('Inv','asset','current','inventory',b.inventory),...split('OAC','asset','current',null,b.otherCurrentAssets),...split('AF','asset','noncurrent','fixed',b.fixed),...split('CxP','liability','current','payables',b.payables),...split('OPC','liability','current',null,b.otherCurrentLiabilities),...split('DLP','liability','noncurrent','longDebt',b.longDebt),...split('Pat','equity',null,null,b.equity)];
  for(let i=list.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[list[i],list[j]]=[list[j],list[i]];} // el orden de las cuentas no importa
  const got=F.analyzeModel(withBalances({accounts:list},bartlett.previous.balance));assert.deepEqual(got.errors,{});sameMetrics(base,got);
 }
});
test('Balance por cuentas: validaciones',()=>{
 const ok=[acc('Efectivo','asset','current','cash',100),acc('Patrimonio','equity',null,null,100)];assert.doesNotThrow(()=>F.calculateBalance({accounts:ok}));
 assert.throws(()=>F.calculateBalance({accounts:[]}),/al menos una cuenta/);
 assert.throws(()=>F.calculateBalance({accounts:[acc('Efectivo','asset','current','cash',null)]}),/al menos una cuenta/);
 assert.throws(()=>F.calculateBalance({accounts:[acc('Caja','asset','current','cash',50),acc('Patrimonio','equity',null,null,100)]}),/no cuadra/);
 assert.throws(()=>F.calculateBalance({accounts:[acc('X','otra','current',null,1)]}),/activo, pasivo o patrimonio/);
 assert.throws(()=>F.calculateBalance({accounts:[acc('X','asset',null,null,1)]}),/corriente o no corriente/);
 assert.throws(()=>F.calculateBalance({accounts:[acc('Inventario','liability','current','inventory',1)]}),/rol «Inventarios» solo aplica a activos corrientes/);
 assert.throws(()=>F.calculateBalance({accounts:[acc('X','asset','current','magia',1)]}),/rol desconocido/);
 assert.throws(()=>F.calculateBalance({accounts:[acc('X','asset','current',null,1,{memo:true})]}),/necesita un rol/);
 assert.throws(()=>F.calculateBalance({accounts:[acc('X','asset','current','cash',1,{sign:2})]}),/suma o resta/);
 assert.throws(()=>F.calculateBalance({accounts:[acc('Caja','asset','current','cash',-5)]}),/no negativo/);
 assert.throws(()=>F.calculateBalance({accounts:[acc('Caja','asset','current','cash',NaN)]}),/no negativo/);
 assert.throws(()=>F.calculateBalance({accounts:[acc('Efectivo','asset','current','cash',500,{memo:true}),acc('Total corriente','asset','current',null,100),acc('Patrimonio','equity',null,null,100)]}),/suman más que el total/);
 assert.throws(()=>F.calculateBalance({accounts:[acc('Efectivo','asset','current','cash',100),acc('Menos: provisión','asset','current','cash',300,{sign:-1}),acc('Patrimonio','equity',null,null,-200)]}),/Efectivo: las cuentas que restan superan a las que suman/);
});
test('Patrimonio negativo (déficit) sigue permitido por cuentas y se refleja en deuda/patrimonio',()=>{
 const b=F.calculateBalance({accounts:[acc('Activos','asset','current','cash',100),acc('Pasivos','liability','current',null,150),acc('Déficit acumulado','equity',null,null,-50)]});
 close(b.equity,-50);assert.equal(F.calculateDebt(b).debtEquity.value,null);
 const c=F.calculateBalance({accounts:[acc('Activos','asset','current','cash',100),acc('Pasivos','liability','current',null,150),acc('Déficit acumulado','equity',null,null,50,{sign:-1})]});close(c.equity,-50);
});
test('Escenario integrado con balance por cuentas: igual que con balance plano y sin alterar el modelo',()=>{
 const a=JSON.parse(JSON.stringify(withBalances({accounts:detailed2012()},compact(2011)))),f=JSON.parse(JSON.stringify(bartlett));a.current.income.fixedCosts=300000;f.current.income.fixedCosts=300000;
 const before=JSON.stringify(a),s=F.simulateModel(a,15,10),t=F.simulateModel(f,15,10);assert.equal(JSON.stringify(a),before);
 close(s.result.currentBalance.assets,s.result.currentBalance.liabilities+s.result.currentBalance.equity);
 close(s.result.currentBalance.cash,t.result.currentBalance.cash);close(s.result.profitability.metrics.roe.value,t.result.profitability.metrics.roe.value);close(s.result.liquidity.currentRatio.value,t.result.liquidity.currentRatio.value);
});
test('Plantilla básica y conversión de saldos planos a cuentas conservan cada cifra',()=>{
 const rows=F.accountsFromBalances({previous:bartlettBalance(2011),current:bartlettBalance(2012)});assert.equal(rows.length,F.balanceKeys.length);
 for(const side of ['current','previous']){const flat=side==='current'?bartlettBalance(2012):bartlettBalance(2011),b=F.calculateBalance({accounts:F.accountsForPeriod(rows,side)});for(const k of F.balanceKeys)close(b[k],flat[k]);}
 assert.equal(F.calculateBalance({accounts:F.accountsForPeriod(F.accountsFromBalances({current:{cash:10,equity:10}}),'current')}).provided.inventory,false);
 assert.notEqual(F.defaultAccounts()[0],F.defaultAccounts()[0]); // filas independientes: editar una no altera la plantilla
});

// ---------- Balance parcial: el ejercicio da solo algunas partes del balance ----------
const PARTS=['currentAssets','nonCurrentAssets','currentLiabilities','nonCurrentLiabilities','equity'];
const flagsOf=(list)=>Object.fromEntries(PARTS.map(p=>[p,list.includes(p)]));
const partialModel=(flags)=>withBalances({accounts:detailed2012(),complete:flags},{accounts:compact(2011).accounts,complete:flags});

test('Balance parcial: solo liquidez, con totales corrientes y un «de los cuales»',()=>{
 const accounts=[acc('Total activos corrientes','asset','current',null,1223000),acc('Inventarios','asset','current','inventory',289000,{memo:true}),acc('Total pasivos corrientes','liability','current',null,620000)];
 assert.throws(()=>F.calculateBalance({accounts}),/no cuadra/); // sin declarar parcial, el balance sigue exigiendo cuadrar
 const b=F.calculateBalance({accounts,complete:flagsOf(['currentAssets','currentLiabilities'])});
 assert.equal(b.partial,true);close(b.currentAssets,1223000);close(b.currentLiabilities,620000);assert.equal(b.assets,null);assert.equal(b.liabilities,null);assert.equal(b.equity,null);assert.equal(b.funding,null);assert.equal(b.nonCurrentAssets,null);
 const l=F.calculateLiquidity(b);close(l.workingCapital.value,603000);assert.equal(l.currentRatio.value.toFixed(2),'1.97');assert.equal(l.quickRatio.value.toFixed(2),'1.51');
 const d=F.calculateDebt(b,F.calculateIncome(bartlettIncome(2012)));assert.equal(d.debtRatio.value,null);assert.match(d.debtRatio.reason,/Balance parcial.*activos no corrientes.*pasivos no corrientes/);assert.equal(d.debtEquity.value,null);assert.equal(d.interestCoverage.value.toFixed(1),'4.5');
 const p=F.calculateProfitability(b,F.calculateIncome(bartlettIncome(2012)),null,{returnMethod:'closing'});assert.equal(p.metrics.roa.value,null);assert.equal(p.metrics.roe.value,null);assert.equal(p.dupont.roe.value,null);assert.notEqual(p.metrics.netMargin.value,null);
});
test('Balance parcial: nunca inventa; toda razón calculada coincide con la del balance completo (32 combinaciones de partes)',()=>{
 const full=F.analyzeModel(bartlett);
 const deps={
  'liquidity.workingCapital':['currentAssets','currentLiabilities'],'liquidity.currentRatio':['currentAssets','currentLiabilities'],'liquidity.quickRatio':['currentAssets','currentLiabilities'],
  'debt.debtRatio':['currentAssets','nonCurrentAssets','currentLiabilities','nonCurrentLiabilities'],'debt.debtEquity':['currentLiabilities','nonCurrentLiabilities','equity'],'debt.interestCoverage':[],
  'activity.metrics.assetTurnover':['currentAssets','nonCurrentAssets'],'activity.metrics.inventoryTurnover':[],'activity.metrics.paymentDays':[],
  'profitability.metrics.roa':['currentAssets','nonCurrentAssets'],'profitability.metrics.roe':['equity'],'profitability.metrics.netMargin':[],
  'profitability.dupont.turnover':['currentAssets','nonCurrentAssets'],'profitability.dupont.leverage':['currentAssets','nonCurrentAssets','equity'],'profitability.dupont.roe':['currentAssets','nonCurrentAssets','equity'],
 };
 const at=(o,path)=>path.split('.').reduce((x,k)=>x?.[k],o);
 for(let mask=0;mask<32;mask++){
  const on=PARTS.filter((_,i)=>mask>>i&1),a=F.analyzeModel(partialModel(flagsOf(on)));assert.deepEqual(a.errors,{});
  for(const [path,need] of Object.entries(deps)){
   const got=at(a,path),ref=at(full,path);
   if(need.every(p=>on.includes(p))){assert.notEqual(ref.value,null,path);close(got.value,ref.value);}
   else{assert.equal(got.value,null,`${path} con ${on}`);assert.match(got.reason,/Balance parcial/,path);}
  }
  if(on.length===5)assert.deepEqual(a.liquidity,full.liquidity);
 }
});
test('Balance parcial: las cinco partes completas equivalen a un balance completo y vuelven a exigir que cuadre',()=>{
 const all=flagsOf(PARTS),a=F.analyzeModel(partialModel(all)),full=F.analyzeModel(bartlett);
 assert.equal(a.currentBalance.partial,false);sameMetrics(full,a);
 assert.throws(()=>F.calculateBalance({accounts:[acc('Caja','asset','current','cash',50),acc('Patrimonio','equity',null,null,100)],complete:all}),/no cuadra/);
});
test('Balance parcial: un período parcial no contamina promedios (sin null tratado como 0)',()=>{
 const flags=flagsOf(['currentAssets','currentLiabilities','equity']),cur={accounts:detailed2012()},prev={accounts:compact(2011).accounts,complete:flags};
 const a=F.analyzeModel(withBalances(cur,prev));
 assert.equal(a.activity.averages.assets,null);assert.equal(a.activity.metrics.assetTurnover.value,null);assert.match(a.activity.metrics.assetTurnover.reason,/Balance parcial/);
 assert.notEqual(a.activity.metrics.inventoryTurnover.value,null); // depende solo de la cuenta con rol, que sí está informada
 assert.equal(a.profitability.metrics.roa.value,null);assert.equal(a.profitability.bases.assets,null);
 assert.notEqual(a.profitability.metrics.roe.value,null); // ROE promedio: patrimonio T1 completo y T2 completo
 const both=F.analyzeModel(withBalances({accounts:detailed2012(),complete:flags},prev));close(both.profitability.metrics.roe.value,a.profitability.metrics.roe.value);
});
test('Balance parcial: validaciones y escenario integrado bloqueado',()=>{
 const accounts=[acc('Total activos corrientes','asset','current',null,100)];
 assert.throws(()=>F.calculateBalance({accounts,complete:{currentAssets:true}}),/qué partes del balance están completas/);
 assert.throws(()=>F.calculateBalance({accounts,complete:{...flagsOf(PARTS),equity:'sí'}}),/qué partes del balance están completas/);
 const parcial=JSON.parse(JSON.stringify(withBalances({accounts:detailed2012(),complete:flagsOf(['currentAssets','currentLiabilities'])},compact(2011))));parcial.current.income.fixedCosts=300000;
 assert.throws(()=>F.simulateModel(parcial,10,0),/balance completo/);
 // efectivo + inventarios mayores que el total corriente solo se verifica si esa parte está declarada completa
 const excede=[acc('Efectivo','asset','current','cash',500,{memo:true}),acc('Total corriente','asset','current',null,100)];
 assert.doesNotThrow(()=>F.calculateBalance({accounts:excede,complete:flagsOf(['currentLiabilities'])}));
 assert.throws(()=>F.calculateBalance({accounts:excede,complete:flagsOf(['currentAssets'])}),/suman más que el total/);
});

// ---------- Estado de resultados por cuentas ----------
const ia=(name,category,amount,extra={})=>({name,category,sign:1,amount,...extra});
// Bartlett 2012 con el detalle del libro. Las particiones (productos, componentes del costo, gastos, impuestos) son sintéticas y
// suman exactamente las cifras aportadas por el usuario; costos fijos y acciones se agregan para ejercitar las cuentas de detalle.
const detailedIncome2012=()=>[
 ia('Ventas producto A','sales',2000000),ia('Ventas producto B','sales',1200000),ia('Devoluciones y rebajas','sales',126000,{sign:-1}),
 ia('Materiales','costSales',1300000),ia('Mano de obra','costSales',500000),ia('Costos indirectos','costSales',288000),
 ia('Gastos de venta','opex',200000),ia('Gastos administrativos','opex',250000),ia('Arrendamiento','opex',40000),ia('Depreciación','opex',78000),
 ia('De los gastos: arrendamiento','fixedCosts',40000),ia('De los gastos: depreciación','fixedCosts',78000),
 ia('Gastos por intereses','interest',93000),ia('Impuesto corriente','taxes',100000),ia('Beneficio fiscal diferido','taxes',6000,{sign:-1}),ia('Dividendos preferentes','preferred',10000),
 ia('Acciones comunes emitidas','shares',60000),ia('Acciones comunes emitidas (serie B)','shares',40000),
];
const flatIncomeOf=(year)=>({...bartlettIncome(year),fixedCostSales:null,otherIncome:null,taxRate:null,...(year===2012?{fixedCosts:118000,shares:100000}:{})});
const compactIncome=(year)=>({accounts:F.incomeAccountsForPeriod(F.incomeAccountsFromStatements({previous:flatIncomeOf(2011),current:flatIncomeOf(2012)}),year===2012?'current':'previous')});
const withIncomes=(cur,prev)=>({...bartlett,current:{...bartlett.current,income:cur},previous:{...bartlett.previous,income:prev}});
const sameIncome=(a,b)=>{assert.deepEqual(a.currentIncome,b.currentIncome);assert.deepEqual(a.previousIncome,b.previousIncome);for(const k of ['liquidity','debt','activity','profitability'])assert.deepEqual(a[k],b[k],k);};

test('Estado de resultados por cuentas: 11 cuentas, 18 cuentas y el estado plano dan los mismos resultados',()=>{
 const flat=F.analyzeModel(withIncomes(flatIncomeOf(2012),flatIncomeOf(2011))),many=F.analyzeModel(withIncomes({accounts:detailedIncome2012()},compactIncome(2011))),few=F.analyzeModel(withIncomes(compactIncome(2012),compactIncome(2011)));
 assert.deepEqual(many.errors,{});sameIncome(flat,many);sameIncome(flat,few);
 const i=many.currentIncome;close(i.sales,3074000);close(i.costSales,2088000);close(i.operatingExpenses,568000);close(i.taxes,94000);close(i.fixedCosts,118000);close(i.shares,100000);
 close(i.grossProfit,986000);close(i.ebit,418000);close(i.ebt,325000);close(i.netProfit,231000);close(i.commonProfit,221000);close(i.eps.value,2.21);
 assert.equal(i.creditSales,null);assert.equal(i.creditPurchases,null); // el detalle opcional que nadie informó sigue sin informar
 assert.deepEqual(F.calculateOperatingModel(i),F.calculateOperatingModel(F.calculateIncome(flatIncomeOf(2012))));
});
test('Estado de resultados: el número de cuentas y su orden no cambian el resultado (200 particiones aleatorias)',()=>{
 let seed=11;const rnd=()=>(seed=(seed*1664525+1013904223)%4294967296)/4294967296;
 const split=(name,category,total)=>{const parts=1+Math.floor(rnd()*6),cuts=[...Array(parts-1)].map(()=>Math.round(rnd()*total)).sort((a,b)=>a-b),bounds=[0,...cuts,total];return bounds.slice(1).map((v,i)=>ia(`${name} ${i+1}`,category,v-bounds[i]));};
 const base=F.analyzeModel(withIncomes(flatIncomeOf(2012),flatIncomeOf(2011))),f=flatIncomeOf(2012);
 for(let n=0;n<200;n++){
  const list=[...split('V','sales',f.sales),...split('C','costSales',f.costSales),...split('O','opex',f.operatingExpenses),...split('F','fixedCosts',f.fixedCosts),...split('I','interest',f.interest),...split('T','taxes',f.taxes),...split('P','preferred',f.preferredDividends),...split('A','shares',f.shares)];
  for(let i=list.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[list[i],list[j]]=[list[j],list[i]];}
  const got=F.analyzeModel(withIncomes({accounts:list},flatIncomeOf(2011)));assert.deepEqual(got.errors,{});assert.deepEqual(got.currentIncome,base.currentIncome);sameIncome({...base,previousIncome:got.previousIncome},got);
 }
});
test('Estado de resultados por cuentas: falta de categorías obligatorias, cero explícito y filas en blanco',()=>{
 const full=()=>[ia('Ventas','sales',1000),ia('Costo','costSales',600),ia('Gastos','opex',200),ia('Intereses','interest',50),ia('Impuestos','taxes',30),ia('Dividendos preferentes','preferred',0)];
 assert.doesNotThrow(()=>F.calculateIncome({accounts:full()}));
 assert.throws(()=>F.calculateIncome({accounts:[]}),/Falta informar: ventas, costo de ventas, gastos operativos, gastos por intereses, impuestos, dividendos preferentes\. Escribe 0/);
 assert.throws(()=>F.calculateIncome({accounts:full().filter(a=>a.category!=='interest')}),/Falta informar: gastos por intereses\. Escribe 0 si la cuenta no existe/);
 assert.throws(()=>F.calculateIncome({accounts:full().map(a=>a.category==='interest'?{...a,amount:null}:a)}),/Falta informar: gastos por intereses/); // en blanco ≠ 0
 const withBlanks=[...full(),ia('Fila vacía','opex',null),ia('','sales',null)];assert.deepEqual(F.calculateIncome({accounts:withBlanks}),F.calculateIncome({accounts:full()}));
 const i=F.calculateIncome({accounts:full()});assert.equal(i.creditSales,null);assert.equal(i.fixedCosts,null);assert.equal(i.shares,null);close(i.netProfit,120);
});
test('Estado de resultados por cuentas: validaciones',()=>{
 const full=(extra=[])=>[ia('Ventas','sales',1000),ia('Costo','costSales',600),ia('Gastos','opex',200),ia('Intereses','interest',50),ia('Impuestos','taxes',30),ia('Div','preferred',0),...extra];
 assert.throws(()=>F.calculateIncome({accounts:[...full(),ia('X','magia',1)]}),/elige la categoría/);
 assert.throws(()=>F.calculateIncome({accounts:[...full(),ia('X','opex',1,{sign:2})]}),/suma o resta/);
 assert.throws(()=>F.calculateIncome({accounts:full([ia('Ventas a crédito','creditSales',10,{sign:-1})])}),/no admite «resta»/);
 assert.throws(()=>F.calculateIncome({accounts:full([ia('X','opex',-5)])}),/no negativo/);
 assert.throws(()=>F.calculateIncome({accounts:full([ia('Devoluciones','sales',2000,{sign:-1})])}),/Ventas: ingresa un número no negativo/);
 assert.throws(()=>F.calculateIncome({accounts:full([ia('Fijos','fixedCosts',300)])}),/costos fijos operativos/);
 assert.throws(()=>F.calculateIncome({accounts:full([ia('A crédito','creditSales',2000)])}),/ventas a crédito/);
 assert.throws(()=>F.calculateIncome({accounts:full([ia('Acciones','shares',10.5)])}),/entero/);
 assert.throws(()=>F.calculateIncome({accounts:full([ia('Compras','creditPurchases',NaN)])}),/no negativo/);
 const credit=F.calculateIncome({accounts:[...full().filter(a=>a.category!=='taxes'),ia('Beneficio fiscal','taxes',20,{sign:-1})]});close(credit.taxes,-20);close(credit.netProfit,170);
 const negativeTax=F.calculateIncome({accounts:[...full().filter(a=>a.category!=='taxes'),ia('Crédito fiscal','taxes',-20)]});close(negativeTax.taxes,-20);
});
test('Estado de resultados por cuentas: el escenario integrado da igual que con el estado plano y no altera el modelo',()=>{
 const a=JSON.parse(JSON.stringify(withIncomes({accounts:detailedIncome2012()},compactIncome(2011)))),f=JSON.parse(JSON.stringify(withIncomes(flatIncomeOf(2012),flatIncomeOf(2011))));
 const before=JSON.stringify(a),s=F.simulateModel(a,15,10),t=F.simulateModel(f,15,10);assert.equal(JSON.stringify(a),before);
 assert.deepEqual(s.result.currentIncome,t.result.currentIncome);close(s.result.currentBalance.assets,s.result.currentBalance.liabilities+s.result.currentBalance.equity);close(s.result.profitability.metrics.roe.value,t.result.profitability.metrics.roe.value);
});
test('Plantilla del estado de resultados y conversión de saldos planos conservan cada cifra',()=>{
 const rows=F.incomeAccountsFromStatements({previous:flatIncomeOf(2011),current:flatIncomeOf(2012)});assert.equal(rows.length,13);
 for(const side of ['current','previous']){const flat=flatIncomeOf(side==='current'?2012:2011),got=F.calculateIncome({accounts:F.incomeAccountsForPeriod(rows,side)});for(const k of F.incomeKeys)assert.equal(got[k],flat[k]??null,k);}
 assert.notEqual(F.defaultIncomeAccounts()[0],F.defaultIncomeAccounts()[0]);
 assert.equal(F.incomeCategories.fixedCosts.memo,true);assert.equal(F.incomeCategories.sales.memo,false);
});
test('Balance por cuentas y estado de resultados por cuentas funcionan juntos con la misma respuesta que el modelo plano',()=>{
 const flat=F.analyzeModel(bartlett),both=F.analyzeModel(withBalances({accounts:detailed2012()},compact(2011)));
 const mixed=F.analyzeModel({...withIncomes({accounts:detailedIncome2012()},compactIncome(2011)),current:{...bartlett.current,balance:{accounts:detailed2012()},income:{accounts:detailedIncome2012()}},previous:{...bartlett.previous,balance:compact(2011),income:compactIncome(2011)}});
 assert.deepEqual(mixed.errors,{});sameMetrics(flat,mixed);sameMetrics(both,mixed);close(mixed.profitability.metrics.roe.value,flat.profitability.metrics.roe.value);
});

// ---------- Estado de resultados parcial: el ejercicio da solo algunas categorías ----------
const ICATS=['sales','costSales','opex','interest','taxes','preferred'];
const iflags=(list)=>Object.fromEntries(ICATS.map(c=>[c,list.includes(c)]));
const income2012Accounts=(extra=[])=>[...F.incomeAccountsForPeriod(F.incomeAccountsFromStatements({current:flatIncomeOf(2012)}),'current'),...extra];
const partialIncomeModel=(flags,extra=[])=>withIncomes({accounts:income2012Accounts(extra),complete:flags},flatIncomeOf(2011));
const val=(o)=>o&&typeof o==='object'?o.value:o;

test('Estado de resultados parcial: solo ventas y costo de ventas dan el margen bruto',()=>{
 const accounts=[ia('Ventas','sales',1000),ia('Costo de ventas','costSales',600)];
 assert.throws(()=>F.calculateIncome({accounts}),/Falta informar: gastos operativos, gastos por intereses, impuestos, dividendos preferentes/); // sin declarar parcial, sigue exigiendo todo
 const i=F.calculateIncome({accounts,complete:iflags(['sales','costSales'])});
 assert.equal(i.partial,true);close(i.grossProfit,400);assert.equal(i.ebit,null);assert.equal(i.ebt,null);assert.equal(i.netProfit,null);assert.equal(i.commonProfit,null);assert.equal(i.operatingExpenses,null);assert.equal(i.eps.value,null);
 const bal=F.calculateBalance({accounts:detailed2012()}),p=F.calculateProfitability(bal,i,null,{returnMethod:'closing'});
 close(p.metrics.grossMargin.value,.4);assert.equal(p.metrics.operatingMargin.value,null);assert.match(p.metrics.operatingMargin.reason,/gastos operativos/);assert.doesNotMatch(p.metrics.operatingMargin.reason,/ventas|costo de ventas/);
 for(const k of ['netMargin','roa','roe'])assert.equal(p.metrics[k].value,null,k);assert.equal(p.dupont.roe.value,null);
});
test('Estado de resultados parcial: nunca inventa; toda cifra calculada coincide con el estado completo (64 combinaciones)',()=>{
 const full=F.analyzeModel(withIncomes(flatIncomeOf(2012),flatIncomeOf(2011)));
 const NET=['sales','costSales','opex','interest','taxes'],EBIT=['sales','costSales','opex'];
 const deps={
  'currentIncome.grossProfit':['sales','costSales'],'currentIncome.ebit':EBIT,'currentIncome.ebt':[...EBIT,'interest'],'currentIncome.netProfit':NET,'currentIncome.commonProfit':ICATS,'currentIncome.eps':ICATS,
  'debt.interestCoverage':[...EBIT,'interest'],
  'activity.metrics.inventoryTurnover':['costSales'],'activity.metrics.inventoryDays':['costSales'],'activity.metrics.payableTurnover':['costSales'],'activity.metrics.paymentDays':['costSales'],'activity.metrics.fixedTurnover':['sales'],'activity.metrics.assetTurnover':['sales'],
  'profitability.metrics.grossMargin':['sales','costSales'],'profitability.metrics.operatingMargin':EBIT,'profitability.metrics.netMargin':NET,'profitability.metrics.roa':NET,'profitability.metrics.roe':NET,
  'profitability.dupont.turnover':['sales'],'profitability.dupont.margin':NET,'profitability.dupont.roe':NET,
  'liquidity.currentRatio':[],'debt.debtRatio':[],
 };
 const at=(o,path)=>path.split('.').reduce((x,k)=>x?.[k],o);
 for(let mask=0;mask<64;mask++){
  const on=ICATS.filter((_,i)=>mask>>i&1),a=F.analyzeModel(partialIncomeModel(iflags(on)));assert.deepEqual(a.errors,{});
  for(const [path,need] of Object.entries(deps)){
   const got=val(at(a,path)),ref=val(at(full,path));
   if(need.every(c=>on.includes(c))){assert.notEqual(ref,null,path);close(got,ref);}
   else{assert.equal(got,null,`${path} con ${on}`);const m=at(a,path);if(m&&typeof m==='object')assert.match(m.reason,/Estado de resultados parcial/,path);}
  }
  if(on.length===6)assert.deepEqual(a.currentIncome,full.currentIncome);
 }
});
test('Estado de resultados parcial: las compras reales a crédito no dependen del costo de ventas',()=>{
 const noCost=iflags(['sales']);
 const est=F.analyzeModel(partialIncomeModel(noCost)).activity;assert.equal(est.purchases,null);assert.equal(est.metrics.paymentDays.value,null);assert.equal(est.metrics.payableTurnover.value,null); // null × 70 % no puede leerse como 0
 const real=F.analyzeModel(partialIncomeModel(noCost,[ia('Compras a crédito reales','creditPurchases',1000000)])).activity;
 assert.equal(real.purchasesEstimated,false);close(real.metrics.paymentDays.value,F.analyzeModel(withIncomes({...flatIncomeOf(2012),creditPurchases:1000000},flatIncomeOf(2011))).activity.metrics.paymentDays.value);
});
test('Estado de resultados parcial: validaciones y categorías sin marcar se ignoran',()=>{
 const base=[ia('Ventas','sales',1000),ia('Costo','costSales',600)];
 assert.throws(()=>F.calculateIncome({accounts:base,complete:{sales:true}}),/qué categorías del estado de resultados están completas/);
 assert.throws(()=>F.calculateIncome({accounts:base,complete:{...iflags(ICATS),taxes:'sí'}}),/qué categorías/);
 assert.throws(()=>F.calculateIncome({accounts:base,complete:iflags(['sales','costSales','interest'])}),/Falta informar: gastos por intereses\. Escribe 0/); // marcada como completa pero sin cuentas
 assert.equal(F.calculateIncome({accounts:[...base,ia('Impuestos','taxes',50)],complete:iflags(['sales','costSales'])}).taxes,null); // lo escrito en una categoría sin marcar no cuenta
 assert.doesNotThrow(()=>F.calculateIncome({accounts:[...base,ia('Ventas a crédito','creditSales',5000),ia('Fijos','fixedCosts',5000)],complete:iflags(['costSales'])})); // detalle > total desconocido no se puede contrastar
 assert.throws(()=>F.calculateIncome({accounts:[...base,ia('Ventas a crédito','creditSales',5000)],complete:iflags(['sales','costSales'])}),/ventas a crédito/);
 assert.throws(()=>F.calculateIncome({accounts:[...base,ia('Ajuste','opex',-1)],complete:iflags(['sales'])}),/no negativo/); // los importes escritos se validan aunque la categoría no esté marcada
 const all=F.calculateIncome({accounts:income2012Accounts(),complete:iflags(ICATS)});assert.equal(all.partial,false);close(all.netProfit,231000);
});
test('Estado de resultados parcial: GAO/GAF, escenario integrado y combinación con balance parcial',()=>{
 const parcial=F.calculateIncome({accounts:income2012Accounts([ia('Fijos','fixedCosts',118000)]),complete:iflags(['sales','costSales','opex'])});
 const op=F.calculateOperatingModel(parcial);assert.equal(op.gao.value,null);assert.equal(op.gaf.value,null);assert.equal(op.gat.value,null);assert.equal(op.breakEvenSales.value,null);assert.match(op.gao.reason,/Estado de resultados parcial.*gastos por intereses/);
 const completo=F.calculateOperatingModel(F.calculateIncome({accounts:income2012Accounts([ia('Fijos','fixedCosts',118000)])}));assert.notEqual(completo.gao.value,null);
 const m=JSON.parse(JSON.stringify(partialIncomeModel(iflags(['sales','costSales','opex']),[ia('Fijos','fixedCosts',118000)])));
 assert.throws(()=>F.simulateModel(m,10,0),/estado de resultados completo/);
 // balance parcial + estado de resultados parcial: los dos motivos aparecen juntos y nada se calcula de más
 const flagsB=Object.fromEntries(['currentAssets','nonCurrentAssets','currentLiabilities','nonCurrentLiabilities','equity'].map(p=>[p,['currentAssets','currentLiabilities'].includes(p)]));
 const both=F.analyzeModel({...partialIncomeModel(iflags(['sales'])),current:{...bartlett.current,balance:{accounts:detailed2012(),complete:flagsB},income:{accounts:income2012Accounts(),complete:iflags(['sales'])}},previous:{...bartlett.previous,balance:{accounts:compact(2011).accounts,complete:flagsB},income:flatIncomeOf(2011)}});
 assert.deepEqual(both.errors,{});assert.equal(both.profitability.metrics.roa.value,null);assert.match(both.profitability.metrics.roa.reason,/Balance parcial.*Estado de resultados parcial/);
 assert.notEqual(both.liquidity.currentRatio.value,null);assert.equal(both.profitability.metrics.grossMargin.value,null); // el costo de ventas no está marcado
});

// ---------- Costos fijos dentro del costo de ventas: el apalancamiento integrado debe coincidir con el CVU independiente ----------
const rel=(a,b,msg='')=>assert.ok(Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(a),Math.abs(b)),`${msg} ${a} != ${b}`);
const cvuRef={price:10,quantity:3000,variableCost:5,fixedCosts:2500,taxRate:.25,interest:10000,preferredDividends:0,shares:1000};
// El mismo negocio del CVU expresado como estado de resultados; `fixedInCost` de sus costos fijos se clasifica dentro del costo de ventas.
const incomeOfCvu=(d,fixedInCost,declare=true,variableInCost=d.variableCost*d.quantity)=>{
 const sales=d.price*d.quantity,variable=d.variableCost*d.quantity,ebit=sales-variable-d.fixedCosts,ebt=ebit-d.interest,taxes=ebt*d.taxRate,fixedInOpex=d.fixedCosts-fixedInCost;
 return [ia('Ventas','sales',sales),ia('Costo de ventas','costSales',variableInCost+fixedInCost),...(declare?[ia('Costos fijos dentro del costo de ventas','fixedCostSales',fixedInCost)]:[]),
  ia('Gastos operativos','opex',variable-variableInCost+fixedInOpex),ia('De los gastos: costos fijos','fixedCosts',fixedInOpex),ia('Intereses','interest',d.interest),ia('Impuestos','taxes',taxes),ia('Dividendos preferentes','preferred',d.preferredDividends),ia('Acciones','shares',d.shares)];
};

test('Costos fijos dentro del costo de ventas: el modelo integrado coincide con el CVU (GAO 1.20, GAF 5, GAT 6, equilibrio 5000)',()=>{
 const c=F.calculateCVU(cvuRef),op=F.calculateOperatingModel(F.calculateIncome({accounts:incomeOfCvu(cvuRef,1000)}));
 close(op.gao.value,1.2);close(op.gaf.value,5);close(op.gat.value,6);close(op.breakEvenSales.value,5000);
 rel(op.gao.value,c.gao.value);rel(op.gaf.value,c.gaf.value);rel(op.gat.value,c.gat.value);rel(op.breakEvenSales.value,c.breakEvenSales);rel(op.contribution,c.contribution);
 assert.equal(op.costSalesFullyVariable,false);assert.match(op.assumption,/se separan de la contribución/);
});
test('Costos fijos dentro del costo de ventas: sin declararlos el modelo lo avisa y el resultado se distorsiona',()=>{
 const op=F.calculateOperatingModel(F.calculateIncome({accounts:incomeOfCvu(cvuRef,1000,false)})); // los 1000 están dentro del costo de ventas pero no se declaran
 assert.equal(op.costSalesFullyVariable,true);assert.match(op.assumption,/todo el costo de ventas es variable/);close(op.gao.value,14000/12500); // 1.12, no 1.20
 assert.notEqual(op.breakEvenSales.value.toFixed(2),'5000.00');
 assert.equal(F.calculateOperatingModel(F.calculateIncome({accounts:incomeOfCvu(cvuRef,0,false)})).costSalesFullyVariable,true);
 assert.equal(F.calculateOperatingModel(F.calculateIncome({accounts:incomeOfCvu(cvuRef,0,true)})).costSalesFullyVariable,false); // declarar 0 es una decisión explícita
});
test('Costos fijos dentro del costo de ventas: 300 estructuras aleatorias dan lo mismo que el CVU independiente',()=>{
 let seed=99;const rnd=()=>(seed=(seed*1664525+1013904223)%4294967296)/4294967296;let checked=0;
 for(let n=0;n<300;n++){
  const price=5+rnd()*95,d={price,quantity:500+Math.round(rnd()*20000),variableCost:1+rnd()*(price-2),fixedCosts:100+Math.round(rnd()*30000),taxRate:rnd()*.5,interest:Math.round(rnd()*5000),preferredDividends:Math.round(rnd()*2000),shares:1+Math.round(rnd()*5000)};
  const c=F.calculateCVU(d);if(c.ebt<=0||c.ebit<=0)continue;
  const fixedInCost=Math.round(rnd()*d.fixedCosts),variableInCost=rnd()*d.variableCost*d.quantity;
  const list=incomeOfCvu(d,fixedInCost,true,variableInCost);for(let i=list.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[list[i],list[j]]=[list[j],list[i]];}
  const op=F.calculateOperatingModel(F.calculateIncome({accounts:list}));
  rel(op.contribution,c.contribution,'contribución');rel(op.gao.value,c.gao.value,'GAO');rel(op.gaf.value,c.gaf.value,'GAF');rel(op.gat.value,c.gat.value,'GAT');rel(op.breakEvenSales.value,c.breakEvenSales,'equilibrio');checked++;
 }
 assert.ok(checked>250,`solo se compararon ${checked}`);
});
test('Costos fijos dentro del costo de ventas: el escenario integrado no los escala y coincide con el CVU a mayor volumen',()=>{
 const m={...bartlett,current:{...bartlett.current,income:{accounts:incomeOfCvu(cvuRef,1000)}},previous:{...bartlett.previous,income:flatIncomeOf(2011)}};
 const before=JSON.stringify(m),s=F.simulateModel(m,10,0),alt=F.calculateCVU({...cvuRef,quantity:3300}),i=s.result.currentIncome;assert.equal(JSON.stringify(m),before);
 close(i.sales,alt.sales);close(i.costSales,alt.variableCosts+1000);close(i.fixedCostSales,1000);close(i.ebit,alt.ebit);close(i.netProfit,alt.afterTax);close(i.commonProfit,alt.commonProfit);close(i.eps.value,alt.eps.value);
 const op0=F.calculateOperatingModel(s.base.currentIncome),op1=F.calculateOperatingModel(i);close(op0.gao.value,F.calculateCVU(cvuRef).gao.value);close(op1.gao.value,alt.gao.value);close(op1.gat.value,alt.gat.value);
 close(s.result.currentBalance.assets,s.result.currentBalance.liabilities+s.result.currentBalance.equity);
});
test('Costos fijos dentro del costo de ventas: validaciones, plantilla y estado parcial',()=>{
 const full=()=>[ia('Ventas','sales',1000),ia('Costo','costSales',600),ia('Gastos','opex',200),ia('Intereses','interest',50),ia('Impuestos','taxes',30),ia('Div','preferred',0)];
 assert.throws(()=>F.calculateIncome({accounts:[...full(),ia('Fijos','fixedCostSales',700)]}),/costos fijos dentro del costo de ventas no pueden superar el costo de ventas/);
 assert.throws(()=>F.calculateIncome({accounts:[...full(),ia('Fijos','fixedCostSales',10,{sign:-1})]}),/no admite «resta»/);
 assert.equal(F.calculateIncome({accounts:full()}).fixedCostSales,null); // sin informar no es 0
 assert.equal(F.calculateIncome({accounts:[...full(),ia('A','fixedCostSales',100),ia('B','fixedCostSales',50)]}).fixedCostSales,150);
 assert.doesNotThrow(()=>F.calculateIncome({accounts:[ia('Fijos','fixedCostSales',700),ia('Ventas','sales',1)],complete:iflags(['sales'])})); // costo de ventas desconocido: no se puede contrastar
 assert.equal(F.defaultIncomeAccounts().length,13);assert.equal(F.defaultIncomeAccounts().some(a=>a.category==='fixedCostSales'),true);assert.equal(F.incomeCategories.fixedCostSales.memo,true);
});

// ---------- Impuestos del CVU: los calcula el motor, no la interfaz ----------
test('CVU: impuestos = UAI − utilidad después de impuestos, con crédito teórico cuando hay pérdida',()=>{
 const c=F.calculateCVU(cvuRef);close(c.ebt,2500);close(c.taxes,625);close(c.ebt-c.taxes,c.afterTax);
 const loss=F.calculateCVU({...cvuRef,quantity:1000}); // UAI negativa: el CVU reconoce un beneficio fiscal teórico
 assert.ok(loss.ebt<0);assert.ok(loss.taxes<0);close(loss.taxes,loss.ebt*cvuRef.taxRate);close(loss.ebt-loss.taxes,loss.afterTax);
 assert.equal(F.calculateCVU({...cvuRef,taxRate:0}).taxes,0);
});
test('CVU → estado de resultados (lo que hace «usar CVU como T2»): la utilidad neta y la común coinciden con las del CVU',()=>{
 let seed=5;const rnd=()=>(seed=(seed*1664525+1013904223)%4294967296)/4294967296;
 for(let n=0;n<200;n++){
  const price=5+rnd()*95,d={price,quantity:Math.round(rnd()*20000),variableCost:1+rnd()*(price-2),fixedCosts:100+Math.round(rnd()*30000),taxRate:rnd()*.6,interest:Math.round(rnd()*8000),preferredDividends:Math.round(rnd()*2000),shares:1+Math.round(rnd()*5000)};
  const c=F.calculateCVU(d);
  const i=F.calculateIncome({accounts:[ia('Ventas','sales',c.sales),ia('Costo variable','costSales',c.variableCosts),ia('Costos fijos','opex',c.fixedCosts),ia('Costos fijos','fixedCosts',c.fixedCosts),ia('Intereses','interest',c.interest),ia('Impuestos','taxes',c.taxes),ia('Dividendos preferentes','preferred',c.preferredDividends),ia('Acciones','shares',c.shares)]});
  rel(i.ebit,c.ebit,'UAII');rel(i.ebt,c.ebt,'UAI');rel(i.netProfit,c.afterTax,'utilidad neta');rel(i.commonProfit,c.commonProfit,'utilidad común');if(c.eps.value!==null)rel(i.eps.value,c.eps.value,'UPA');
 }
});

// ---------- Calculadoras rápidas sobre el motor central ----------
// Oráculo: las fórmulas cerradas de las calculadoras anteriores (dupont y margen constante), copiadas tal como eran,
// para demostrar que la reimplementación sobre el motor central produce las mismas cifras y los mismos rechazos.
const legacyDupont=({profit,sales,assets,equity})=>{const margin=profit/sales,turnover=sales/assets,leverage=assets/equity;return {margin,turnover,leverage,roe:margin*turnover*leverage,roa:profit/assets};};
const legacySimulate=(base,growth,repayment)=>{
 const assets=base.cash+base.receivables+base.inventory+base.fixed,currentLiabilities=base.payables+base.otherCurrent,equity=assets-currentLiabilities-base.longDebt;
 if(equity<=0||assets<=0)throw new Error('base');
 const profit=base.profit*(1+growth/100),retainedChange=profit-base.profit,payment=base.payables*repayment/100,cash=base.cash+retainedChange-payment;
 if(cash<-1e-8)throw new Error('efectivo');
 const currentAssets=Math.max(0,cash)+base.receivables+base.inventory,newAssets=currentAssets+base.fixed,newEquity=equity+retainedChange;
 if(newEquity<=0||newAssets<=0)throw new Error('patrimonio');
 const d=(p,s,a,e,ca,cl,c)=>({profit:p,sales:s,assets:a,equity:e,cash:c,currentAssets:ca,currentLiabilities:cl,roa:p/a,roe:p/e,liquidity:cl>0?ca/cl:null,workingCapital:ca-cl});
 return {base:d(base.profit,base.sales,assets,equity,base.cash+base.receivables+base.inventory,currentLiabilities,base.cash),scenario:d(profit,base.sales*(1+growth/100),newAssets,newEquity,currentAssets,currentLiabilities-payment,Math.max(0,cash)),retainedChange,payment};
};
const sameView=(a,b,msg)=>{for(const k of Object.keys(a)){if(a[k]===null||b[k]===null)assert.equal(a[k],b[k],`${msg} ${k}`);else rel(a[k],b[k],`${msg} ${k}`);}};

test('Cálculo rápido Du Pont: mismas cifras y mismos rechazos que la calculadora anterior (400 casos)',()=>{
 let seed=21;const rnd=()=>(seed=(seed*1664525+1013904223)%4294967296)/4294967296;let valid=0,rejected=0;
 for(let n=0;n<400;n++){
  const sales=Math.round(rnd()*1e6)-1000,assets=Math.round(rnd()*2e6)-1000,q={profit:Math.round((rnd()-.4)*4e5),sales,assets,equity:Math.round(rnd()*2.2e6)-1000};
  const domain=q.sales>0&&q.assets>0&&q.equity>0&&q.equity<=q.assets;
  if(!domain){assert.throws(()=>F.dupont(q));rejected++;continue;}
  sameView(F.dupont(q),legacyDupont(q),'dupont');valid++;
 }
 assert.ok(valid>100&&rejected>50,`válidos ${valid}, rechazados ${rejected}`);
});
test('Cálculo rápido Du Pont: da las mismas cifras que el módulo Razones con los mismos números (una sola fuente de fórmulas)',()=>{
 let seed=3;const rnd=()=>(seed=(seed*1664525+1013904223)%4294967296)/4294967296;
 for(let n=0;n<200;n++){
  const sales=1000+Math.round(rnd()*1e6),assets=1000+Math.round(rnd()*2e6),equity=1+Math.round(rnd()*(assets-1)),profit=Math.round((rnd()*1.2-.3)*sales*.5),q={profit,sales,assets,equity};
  const quick=F.dupont(q);
  const a=F.analyzeModel({year:2000,params:{days:365,purchaseRate:.7,returnMethod:'closing'},previous:null,current:{year:2000,
   balance:{accounts:[acc('Activos','asset','current','cash',assets),acc('Pasivos','liability','current',null,assets-equity),acc('Patrimonio','equity',null,null,equity)]},
   income:{accounts:[ia('Ventas','sales',sales),ia('Costo','costSales',sales-profit),ia('Gastos','opex',0),ia('Intereses','interest',0),ia('Impuestos','taxes',0),ia('Div','preferred',0)]}}});
  assert.deepEqual(a.errors,{});const p=a.profitability;
  rel(quick.margin,p.metrics.netMargin.value);rel(quick.roa,p.metrics.roa.value);rel(quick.roe,p.metrics.roe.value);rel(quick.turnover,p.dupont.turnover.value);rel(quick.leverage,p.dupont.leverage.value);rel(quick.roe,p.dupont.roe.value);
 }
});
test('Calculadora de margen constante: mismas cifras y mismos rechazos que la calculadora anterior (500 casos)',()=>{
 let seed=8;const rnd=()=>(seed=(seed*1664525+1013904223)%4294967296)/4294967296;let ok=0,both=0;
 for(let n=0;n<500;n++){
  const sales=1000+Math.round(rnd()*1e6),base={sales,profit:Math.round((rnd()-.25)*sales*.4),cash:Math.round(rnd()*3e5),receivables:Math.round(rnd()*3e5),inventory:Math.round(rnd()*3e5),fixed:Math.round(rnd()*8e5),payables:Math.round(rnd()*3e5),otherCurrent:Math.round(rnd()*2e5),longDebt:Math.round(rnd()*4e5)};
  const growth=Math.round((rnd()*100-50)*100)/100,repayment=Math.round(rnd()*10000)/100;
  let expected=null,failed=false;try{expected=legacySimulate(base,growth,repayment);}catch{failed=true;}
  if(failed){assert.throws(()=>F.simulate(base,growth,repayment),`debía rechazar ${JSON.stringify(base)} ${growth} ${repayment}`);both++;continue;}
  const got=F.simulate(base,growth,repayment);
  sameView(got.base,expected.base,'base');sameView(got.scenario,expected.scenario,'escenario');rel(got.retainedChange,expected.retainedChange);rel(got.payment,expected.payment);ok++;
 }
 assert.ok(ok>150&&both>50,`iguales ${ok}, rechazos coincidentes ${both}`);
});
test('Calculadora de margen constante: es el escenario integrado con todo el costo variable, y rechaza una utilidad mayor que las ventas',()=>{
 const base={sales:200000,profit:15000,cash:25000,receivables:30000,inventory:35000,fixed:80000,payables:40000,otherCurrent:15000,longDebt:30000};
 const s=F.simulate(base,15,10);close(s.scenario.profit/s.scenario.sales,base.profit/base.sales);close(s.scenario.sales,230000);close(s.scenario.profit,17250);
 assert.throws(()=>F.simulate({...base,profit:250000},0,0),/utilidad no puede superar las ventas/);
 assert.equal(F.simulate({...base,profit:200000},0,0).base.profit,200000); // margen del 100 %: costo cero, es válido
});

// ---------- Año del caso: una sola regla para el análisis y para el campo de la interfaz ----------
test('Año del caso: solo enteros entre 1901 y 9999 (un campo vacío no puede convertirse en 0)',()=>{
 for(const ok of [1901,2012,2025,9999])assert.equal(F.validYear(ok),true,String(ok));
 for(const bad of [0,-1,20,1900,10000,2020.5,NaN,Infinity,null,undefined,'2020','',Number(''),Number(' ')])assert.equal(F.validYear(bad),false,String(bad));
 for(const y of [0,20,2020.5])assert.throws(()=>F.analyzeModel({...bartlett,year:y,current:{...bartlett.current,year:y},previous:null}),/entero entre 1901 y 9999/); // el análisis usa la misma regla
});

// ---------- Catálogo estándar: elegir un nombre asigna clasificación, rol y tratamiento ----------
const noneComplete=Object.fromEntries(['currentAssets','nonCurrentAssets','currentLiabilities','nonCurrentLiabilities','equity'].map(p=>[p,false]));
const noneCompleteIncome=Object.fromEntries(['sales','costSales','opex','interest','taxes','preferred'].map(c=>[c,false]));
const nameKey=t=>t.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim();

test('Catálogo: cada entrada del balance y del estado de resultados es una configuración válida para el motor',()=>{
 assert.ok(F.accountCatalog.length>=35&&F.incomeCatalog.length>=15);
 for(const e of F.accountCatalog){const plus=e.sign===-1?[{name:'Base',section:e.section,term:e.term,role:e.role,sign:1,memo:false,amount:50}]:[];assert.doesNotThrow(()=>F.calculateBalance({accounts:[...plus,{name:e.name,section:e.section,term:e.term,role:e.role,sign:e.sign,memo:e.memo,amount:5}],complete:noneComplete}),e.name);}
 for(const e of F.incomeCatalog)assert.doesNotThrow(()=>F.calculateIncome({accounts:[{name:e.name,category:e.category,sign:e.sign,amount:e.category==='taxRate'?0.2:5}],complete:noneCompleteIncome}),e.name);
 assert.equal(new Set(F.accountCatalog.map(e=>nameKey(e.name))).size,F.accountCatalog.length); // sin nombres repetidos
 assert.equal(new Set(F.incomeCatalog.map(e=>nameKey(e.name))).size,F.incomeCatalog.length);
});
test('Catálogo: reconoce nombres sin importar mayúsculas, tildes ni espacios, y devuelve una copia',()=>{
 const dep=F.matchAccount('  DEPRECIACION   acumulada ');assert.deepEqual(dep,{name:'Depreciación acumulada',section:'asset',term:'noncurrent',role:'fixed',sign:-1,memo:false});
 assert.deepEqual([F.matchAccount('inventarios').role,F.matchAccount('CUENTAS POR PAGAR').role,F.matchAccount('deuda a largo plazo').role],['inventory','payables','longDebt']);
 assert.equal(F.matchAccount('De los cuales: inventarios').memo,true);assert.equal(F.matchAccount('Acciones en tesorería').sign,-1);assert.equal(F.matchAccount('Patrimonio').section,'equity');
 for(const bad of ['','   ','Cuenta inventada',null,undefined])assert.equal(F.matchAccount(bad),null);
 dep.role='inventory';assert.equal(F.matchAccount('Depreciación acumulada').role,'fixed'); // modificar el resultado no altera el catálogo
 assert.deepEqual(F.matchIncomeAccount('devoluciones y rebajas sobre VENTAS'),{name:'Devoluciones y rebajas sobre ventas',category:'sales',sign:-1});
 assert.equal(F.matchIncomeAccount('Gastos Administrativos').category,'opex');assert.equal(F.matchIncomeAccount('De los costos de ventas: costos fijos').category,'fixedCostSales');assert.equal(F.matchIncomeAccount('otra cosa'),null);
});
test('Catálogo: coincide con las configuraciones que ya validaban las pruebas anteriores y con la plantilla',()=>{
 for(const a of detailed2012()){const hit=F.matchAccount(a.name);if(!hit)continue;assert.deepEqual([hit.section,hit.term,hit.role,hit.sign,hit.memo],[a.section,a.term,a.role,a.sign,a.memo],a.name);}
 for(const a of detailedIncome2012()){const hit=F.matchIncomeAccount(a.name);if(!hit)continue;assert.deepEqual([hit.category,hit.sign],[a.category,a.sign],a.name);}
 for(const row of F.defaultAccounts()){const hit=F.matchAccount(row.name);assert.ok(hit,row.name);assert.deepEqual([hit.section,hit.term,hit.role],[row.section,row.term,row.role],row.name);}
 for(const row of F.defaultIncomeAccounts()){const hit=F.matchIncomeAccount(row.name);assert.ok(hit,row.name);assert.equal(hit.category,row.category,row.name);}
 // un balance armado solo con nombres del catálogo (configuración tomada del catálogo) da lo mismo que el explícito
 const viaCatalog=detailed2012().map(a=>{const h=F.matchAccount(a.name);return h?{...a,section:h.section,term:h.term,role:h.role,sign:h.sign,memo:h.memo}:a;});
 assert.deepEqual(F.calculateBalance({accounts:viaCatalog}),F.calculateBalance({accounts:detailed2012()}));
});
test('Cuentas en blanco o sin clasificar todavía: se ignoran; con importe piden clasificación con un mensaje claro',()=>{
 const ok=[acc('Efectivo','asset','current','cash',100),acc('Patrimonio','equity',null,null,100)];
 const base=F.calculateBalance({accounts:ok});
 assert.deepEqual(F.calculateBalance({accounts:[...ok,{name:'',section:null,term:null,role:null,sign:1,memo:false,amount:null}]}),base);
 assert.deepEqual(F.calculateBalance({accounts:[...ok,acc('X','asset','current',null,null,{memo:true})]}),base); // «de los cuales» sin rol, pero en blanco: no estorba
 assert.throws(()=>F.calculateBalance({accounts:[...ok,{name:'Cuenta nueva',section:null,term:null,role:null,sign:1,memo:false,amount:5}]}),/Cuenta nueva: indica si es activo, pasivo o patrimonio/);
 assert.throws(()=>F.calculateBalance({accounts:[...ok,acc('X','asset','current',null,1,{memo:true})]}),/necesita un rol/); // con importe sigue validándose
 const full=[ia('Ventas','sales',1000),ia('Costo','costSales',600),ia('Gastos','opex',200),ia('Intereses','interest',50),ia('Impuestos','taxes',30),ia('Div','preferred',0)];
 const baseI=F.calculateIncome({accounts:full});
 assert.deepEqual(F.calculateIncome({accounts:[...full,{name:'',category:null,sign:1,amount:null}]}),baseI);
 assert.deepEqual(F.calculateIncome({accounts:[...full,ia('Detalle','creditSales',null,{sign:-1})]}),baseI); // configuración inválida pero en blanco
 assert.throws(()=>F.calculateIncome({accounts:[...full,{name:'Cuenta nueva',category:null,sign:1,amount:5}]}),/Cuenta nueva: elige la categoría/);
});

// ---------- Resúmenes en vivo: subtotales y cuadre mientras se escribe ----------
test('Resumen del balance: muestra totales y la diferencia aunque no cuadre; el análisis sigue exigiendo cuadre',()=>{
 const off=[acc('Efectivo','asset','current','cash',100),acc('Cuentas por pagar','liability','current','payables',30),acc('Patrimonio','equity',null,null,60)];
 assert.throws(()=>F.calculateBalance({accounts:off}),/no cuadra/);
 const s=F.summarizeBalance({accounts:off});
 close(s.assets,100);close(s.currentAssets,100);close(s.nonCurrentAssets,0);close(s.liabilities,30);close(s.equity,60);close(s.funding,90);close(s.difference,10);assert.equal(s.balanced,false);
 const ok=F.summarizeBalance({accounts:[...off.slice(0,2),acc('Patrimonio','equity',null,null,70)]});close(ok.difference,0);assert.equal(ok.balanced,true);
 const strict=F.calculateBalance({accounts:[...off.slice(0,2),acc('Patrimonio','equity',null,null,70)]});assert.equal(strict.balanced,true);close(strict.difference,0); // el análisis normal también informa el cuadre
 // parcial: lo no declarado es desconocido, sin diferencia
 const part=F.summarizeBalance({accounts:off,complete:{currentAssets:true,nonCurrentAssets:false,currentLiabilities:true,nonCurrentLiabilities:false,equity:false}});
 close(part.currentAssets,100);assert.equal(part.assets,null);assert.equal(part.difference,null);assert.equal(part.balanced,null);
 // una cuenta con importe y sin clasificar sigue siendo un error de configuración, no un resumen
 assert.throws(()=>F.summarizeBalance({accounts:[...off,{name:'Nueva',section:null,term:null,role:null,sign:1,memo:false,amount:5}]}),/indica si es activo, pasivo o patrimonio/);
});
test('Resumen del balance: coincide con el análisis completo en cualquier balance que cuadre (200 particiones)',()=>{
 let seed=17;const rnd=()=>(seed=(seed*1664525+1013904223)%4294967296)/4294967296;
 for(let n=0;n<200;n++){
  const list=detailed2012().map(a=>({...a,amount:a.amount}));for(let i=list.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[list[i],list[j]]=[list[j],list[i]];}
  const s=F.summarizeBalance({accounts:list}),f=F.calculateBalance({accounts:list});assert.deepEqual(s,f);
 }
});
test('Resumen del estado de resultados: subtotales con lo que ya se escribió, sin exigir las seis categorías',()=>{
 const some=[ia('Ventas','sales',1000),ia('Costo','costSales',600)];
 assert.throws(()=>F.calculateIncome({accounts:some}),/Falta informar/);
 const s=F.summarizeIncome({accounts:some});
 close(s.sales,1000);close(s.costSales,600);close(s.grossProfit,400);assert.equal(s.operatingExpenses,null);assert.equal(s.ebit,null);assert.equal(s.netProfit,null);assert.equal(s.partial,true);
 const more=F.summarizeIncome({accounts:[...some,ia('Gastos','opex',200)]});close(more.ebit,200);assert.equal(more.ebt,null);
 const nothing=F.summarizeIncome({accounts:[]});for(const k of ['sales','grossProfit','ebit','ebt','netProfit','commonProfit'])assert.equal(nothing[k],null,k);
 // con todo informado es idéntico al análisis
 const all=[ia('Ventas','sales',1000),ia('Costo','costSales',600),ia('Gastos','opex',200),ia('Intereses','interest',50),ia('Impuestos','taxes',30),ia('Div','preferred',0)];
 assert.deepEqual(F.summarizeIncome({accounts:all}),F.calculateIncome({accounts:all}));
 assert.deepEqual(F.summarizeIncome({accounts:detailedIncome2012()}),F.calculateIncome({accounts:detailedIncome2012()}));
 // estados planos antiguos pasan tal cual
 assert.deepEqual(F.summarizeIncome(flatIncomeOf(2012)),F.calculateIncome(flatIncomeOf(2012)));
 // una categoría marcada como incompleta sigue siendo desconocida aunque tenga cuentas
 const flagged=F.summarizeIncome({accounts:all,complete:iflags(['sales','costSales'])});close(flagged.grossProfit,400);assert.equal(flagged.ebit,null);
});

// ---------- Importador de tablas pegadas (Fase 0) ----------
const I=require('./dist/importer.js');
// Bartlett 2012/2011 en formato Excel (tabuladores). Las particiones de cuentas son sintéticas y suman las cifras aportadas.
const balanceText=(over={})=>{const v={inv12:'289,000',...over};return [
 'Bartlett Company','Balance general al 31 de diciembre','Activos\t2012\t2011',
 'Efectivo\t363,000\t288,000','Valores negociables\t68,000\t51,000','Cuentas por cobrar\t503,000\t365,000',`Inventarios\t${v.inv12}\t300,000`,'Total activos corrientes\t1,223,000\t1,004,000',
 'Terrenos y edificios\t1,700,000\t1,650,000','Maquinaria y equipo\t1,900,000\t1,700,000','Menos: Depreciación acumulada\t1,226,000\t1,084,000','Activos fijos netos\t2,374,000\t2,266,000','Total activos\t3,597,000\t3,270,000',
 'Pasivos y patrimonio','Cuentas por pagar\t382,000\t270,000','Documentos por pagar\t100,000\t90,000','Deudas acumuladas\t138,000\t123,000','Total pasivos corrientes\t620,000\t483,000',
 'Deuda a largo plazo\t1,023,000\t967,000','Total pasivos\t1,643,000\t1,450,000',
 'Patrimonio de los accionistas','Acciones preferentes\t200,000\t200,000','Acciones comunes\t300,000\t300,000','Capital pagado en exceso\t800,000\t800,000','Utilidades retenidas\t754,000\t620,000','Acciones en tesorería\t(100,000)\t(100,000)',
 'Total patrimonio\t1,954,000\t1,820,000','Total pasivos y patrimonio\t3,597,000\t3,270,000'].join('\n');};
const incomeTextB=[
 'Estado de resultados','\t2012\t2011','Ventas totales\t3,074,000\t2,567,000','Menos: Costo de bienes vendidos\t2,088,000\t1,711,000','Utilidad bruta\t986,000\t856,000',
 'Gastos operativos','Gastos de venta\t200,000\t200,000','Gastos administrativos\t250,000\t235,000','Gastos de arrendamiento\t40,000\t40,000','Gasto por depreciación\t78,000\t78,000','Total de gastos operativos\t568,000\t553,000',
 'Utilidad operativa (UAII)\t418,000\t303,000','Gastos por intereses\t93,000\t91,000','Utilidad antes de impuestos\t325,000\t212,000','Impuestos\t94,000\t64,000','Utilidad neta después de impuestos\t231,000\t148,000',
 'Dividendos preferentes\t10,000\t10,000','Utilidades disponibles para los accionistas comunes\t221,000\t138,000'].join('\n');
const sideAccounts=(p,side)=>I.toStateRows(p).map(r=>p.kind==='balance'?{name:r.name,section:r.section,term:r.term,role:r.role,sign:r.sign,memo:r.memo,amount:r.amounts[side]}:{name:r.name,category:r.category,sign:r.sign,amount:r.amounts[side]});
const errorsOf=p=>p.rows.flatMap(r=>r.doubts.filter(d=>d.level==='error'));

test('Importador: lectura de cifras (paréntesis, guiones, separadores, moneda)',()=>{
 const v=(t,d)=>I.parseAmount(t,d);
 assert.equal(v('1,234').value,1234);assert.equal(v('3,074,000').value,3074000);assert.equal(v('(1,226,000)').value,-1226000);assert.equal(v('-500').value,-500);assert.equal(v('500-').value,-500);assert.equal(v('$1,223').value,1223);assert.equal(v('C$ 5').value,5);
 assert.equal(v('1,234.56').value,1234.56);assert.equal(v('1.234,56').value,1234.56);assert.equal(v('1.234.567').value,1234567);assert.match(v('1.234.567').doubt,/separador de miles/);
 assert.equal(v('1.234').value,1.234);assert.match(v('1.234').doubt,/miles.*decimal|decimal/);assert.equal(v('12,5').value,12.5);assert.match(v('12,5').doubt,/coma decimal/);
 assert.equal(v('1.234','comma').value,1234);assert.equal(v('1,234','dot').value,1234);assert.equal(v('1.234,5','comma').value,1234.5);
 assert.deepEqual([v('—').value,v('-').value],[0,0]);assert.match(v('—').doubt,/guion/);
 for(const bad of ['abc','12abc','','$',null,'1,2,3x'])assert.equal(v(bad),null,String(bad));
});
test('Importador: balance de Bartlett pegado como tabla — clasificación, totales verificados y cuadre',()=>{
 const p=I.analyze(balanceText(),{kind:'balance'});
 assert.deepEqual(p.columns,['current','previous']);assert.deepEqual(p.years,[2012,2011]);assert.equal(p.orderAssumed,false);
 assert.equal(p.rows.length,16);assert.deepEqual(errorsOf(p),[]);
 const dep=p.rows.find(r=>/Depreciación/.test(r.name));assert.deepEqual([dep.sign,dep.role,dep.amounts.current,dep.amounts.previous],[-1,'fixed',1226000,1084000]); // «Menos:» y paréntesis no duplican el signo
 const tes=p.rows.find(r=>/tesorería/.test(r.name));assert.deepEqual([tes.sign,tes.amounts.current],[-1,100000]);
 assert.equal(p.rows.find(r=>r.name==='Inventarios').role,'inventory');
 assert.equal(p.check.totals.length,7);for(const t of p.check.totals)assert.equal(t.status,'ok',`${t.name}: ${JSON.stringify(t.diff)}`);
 assert.deepEqual([p.check.cuadre.current.state,p.check.cuadre.previous.state],['ok','ok']);assert.equal(p.check.importable,true);assert.deepEqual(p.check.blockers,[]);
});
test('Importador: lo importado da exactamente los mismos indicadores que los datos originales (ciclo completo)',()=>{
 const b=I.analyze(balanceText(),{kind:'balance'}),i=I.analyze(incomeTextB,{kind:'income'});
 assert.equal(i.rows.length,9);assert.deepEqual(errorsOf(i),[]);assert.deepEqual(i.columns,['current','previous']);
 for(const t of i.check.totals)assert.equal(t.status,'ok',`${t.name}: ${JSON.stringify(t.diff)}`);
 assert.deepEqual(i.check.totals.map(t=>t.part),['grossProfit','operatingExpenses','ebit','ebt','netProfit','commonProfit']);
 const model={...bartlett,current:{...bartlett.current,balance:{accounts:sideAccounts(b,'current')},income:{accounts:sideAccounts(i,'current')}},previous:{...bartlett.previous,balance:{accounts:sideAccounts(b,'previous')},income:{accounts:sideAccounts(i,'previous')}}};
 const got=F.analyzeModel(model),ref=F.analyzeModel(bartlett);assert.deepEqual(got.errors,{});
 sameMetrics(ref,got);close(got.currentIncome.netProfit,231000);close(got.currentIncome.ebit,418000);close(got.previousIncome.netProfit,148000);close(got.currentIncome.commonProfit,221000);
 close(got.profitability.metrics.roe.value,ref.profitability.metrics.roe.value);
});
test('Importador: un dígito mal copiado se detecta con los totales del propio documento',()=>{
 const p=I.analyze(balanceText({inv12:'298,000'}),{kind:'balance'});
 const bad=p.check.totals.filter(t=>t.status==='diff').map(t=>t.name);
 assert.ok(bad.includes('Total activos corrientes')&&bad.includes('Total activos'));
 const t=p.check.totals.find(x=>x.name==='Total activos corrientes');close(t.diff.current,-9000);assert.equal(t.diff.previous,0); // solo T2 está mal
 assert.equal(p.check.cuadre.current.state,'bad');close(p.check.cuadre.current.difference,9000);assert.equal(p.check.cuadre.previous.state,'ok');
 // corregir la cifra en la revisión resuelve todo, sin volver a pegar
 p.rows.find(r=>r.name==='Inventarios').amounts.current=289000;const again=I.verify(p);
 assert.ok(again.totals.every(x=>x.status==='ok'));assert.equal(again.cuadre.current.state,'ok');
});
test('Importador: orden de columnas por años, por elección y suposición avisada',()=>{
 const asc=I.analyze('Activos\t2011\t2012\nEfectivo\t288\t363\nPatrimonio\t288\t363',{kind:'balance'});assert.deepEqual(asc.columns,['previous','current']);assert.equal(asc.rows[0].amounts.current,363);assert.equal(asc.rows[0].amounts.previous,288);
 const none=I.analyze('Efectivo\t288\t363\nPatrimonio\t288\t363',{kind:'balance'});assert.equal(none.orderAssumed,true);assert.match(none.notes.join(' '),/primera columna es el período anterior/);assert.equal(none.rows[0].amounts.previous,288);
 const flip=I.analyze('Efectivo\t288\t363\nPatrimonio\t288\t363',{kind:'balance',order:'t2t1'});assert.equal(flip.rows[0].amounts.current,288);assert.equal(flip.orderAssumed,false);
 const one=I.analyze('Efectivo 363\nPatrimonio 363',{kind:'balance'});assert.deepEqual(one.columns,['current']);assert.equal(one.rows[0].amounts.previous,null);assert.equal(one.rows[0].amounts.current,363);
});
test('Importador: cuenta que resta, negativos y sin clasificar',()=>{
 const p=I.analyze(['Activos corrientes','Efectivo\t100','Provisión para cuentas incobrables\t(5)','Menos: Descuentos pendientes\t3','Cuentas por cobrar\t50','Patrimonio\t142'].join('\n'),{kind:'balance'});
 const prov=p.rows.find(r=>/Provisión/.test(r.name)),desc=p.rows.find(r=>/Descuentos/.test(r.name));
 assert.deepEqual([prov.sign,prov.amounts.current],[-1,5]);assert.ok(prov.doubts.some(d=>/cuenta que resta/.test(d.text)));assert.deepEqual([desc.sign,desc.amounts.current],[-1,3]);
 assert.equal(prov.section,'asset');assert.equal(prov.term,'current'); // del encabezado «Activos corrientes»
 const lost=I.analyze('Cosa rara\t100\nEfectivo\t20',{kind:'balance'});const rare=lost.rows.find(r=>r.name==='Cosa rara');
 assert.ok(rare.doubts.some(d=>d.level==='error'&&/No pude clasificarla/.test(d.text)));assert.equal(lost.check.importable,false);assert.match(lost.check.blockers.join(' '),/Cosa rara: falta la clasificación/);assert.equal(lost.check.blockers.length,1);
 rare.include=false;assert.notEqual(I.verify(lost).blockers.join(' ').includes('Cosa rara'),true); // excluida: ya no bloquea
 rare.include=true;rare.section='liability';rare.term='current';assert.equal(I.verify(lost).blockers.some(b=>/Cosa rara/.test(b)),false); // clasificada: ya no bloquea
});
test('Importador: nombre fuera del catálogo toma la clasificación del encabezado y sugiere rol con aviso',()=>{
 const p=I.analyze(['Pasivos corrientes','Anticipos de clientes\t3,000','Proveedores nacionales\t900','Pasivos no corrientes','Préstamo hipotecario a largo plazo\t5,000'].join('\n'),{kind:'balance'});
 const [anticipos,prov,hip]=p.rows;
 assert.deepEqual([anticipos.section,anticipos.term,anticipos.role],['liability','current',null]);assert.ok(anticipos.doubts.some(d=>/clasificación tomada del encabezado/.test(d.text)));
 assert.equal(prov.role,'payables');assert.ok(prov.doubts.some(d=>/Rol sugerido/.test(d.text)));
 assert.deepEqual([hip.section,hip.term,hip.role],['liability','noncurrent','longDebt']);
 // el catálogo gana al encabezado, con aviso
 const conflict=I.analyze(['Pasivos corrientes','Cuentas por cobrar\t100'].join('\n'),{kind:'balance'}).rows[0];assert.equal(conflict.section,'asset');assert.ok(conflict.doubts.some(d=>/sugiere activos/.test(d.text)));
});
test('Importador: ejercicio que solo da totales (con un detalle) se importa como total + «de los cuales»',()=>{
 const p=I.analyze(['Activos corrientes\t1,223,000','Inventarios\t289,000','Pasivos corrientes\t620,000'].join('\n'),{kind:'balance'});
 assert.equal(p.rows.length,3);const inv=p.rows.find(r=>r.name==='Inventarios'),ca=p.rows.find(r=>r.name==='Activos corrientes');
 assert.deepEqual([inv.memo,inv.role],[true,'inventory']);assert.deepEqual([ca.memo,ca.section,ca.term],[false,'asset','current']);assert.ok(inv.doubts.some(d=>/de los cuales/i.test(d.text)));
 assert.deepEqual(p.check.totals,[]); // ambos totales son datos, no verificaciones
 assert.deepEqual(p.check.partsPresent,{currentAssets:true,nonCurrentAssets:false,currentLiabilities:true,nonCurrentLiabilities:false,equity:false});
 const b=F.calculateBalance({accounts:sideAccounts(p,'current'),complete:p.check.partsPresent});
 const l=F.calculateLiquidity(b);assert.equal(l.currentRatio.value.toFixed(2),'1.97');assert.equal(l.quickRatio.value.toFixed(2),'1.51');close(l.workingCapital.value,603000);
});
test('Importador: celdas vacías no son cero, el guion sí (con aviso), y las unidades escalan las cifras',()=>{
 const p=I.analyze('Activos\t2011\t2012\nEfectivo\t\t25000\nInventarios\t-\t35000\nPatrimonio\t0\t60000',{kind:'balance'});
 const cash=p.rows.find(r=>r.name==='Efectivo'),inv=p.rows.find(r=>r.name==='Inventarios');
 assert.equal(cash.amounts.previous,null);assert.equal(cash.amounts.current,25000);   // en blanco = sin informar
 assert.equal(inv.amounts.previous,0);assert.ok(inv.doubts.some(d=>/guion/.test(d.text)));  // guion = 0, avisado
 const miles=I.analyze('Balance (en miles de dólares)\nActivos\t2012\t2011\nEfectivo\t363\t288\nPatrimonio\t363\t288',{kind:'balance'});
 assert.equal(miles.unitsHint,'miles');assert.match(miles.notes.join(' '),/en miles/);assert.equal(miles.rows[0].amounts.current,363);   // no escala sin que se elija
 const scaled=I.analyze('Balance (en miles de dólares)\nActivos\t2012\t2011\nEfectivo\t363\t288\nPatrimonio\t363\t288',{kind:'balance',multiplier:1000});assert.equal(scaled.rows[0].amounts.current,363000);assert.equal(scaled.rows[0].amounts.previous,288000);
 const eu=I.analyze('Efectivo\t1.234,50\nPatrimonio\t1.234,50',{kind:'balance',decimal:'comma'});assert.equal(eu.rows[0].amounts.current,1234.5);
});
test('Importador: separadores de texto (espacios, puntos guía, moneda) y líneas de ruido',()=>{
 const p=I.analyze(['BALANCE GENERAL','----------','Efectivo y bancos ........ C$ 25,000   C$ 20,000','Cuentas por cobrar   30,000  25,000','Patrimonio       55,000 45,000'].join('\n'),{kind:'balance'});
 assert.equal(p.rows.length,3);assert.equal(p.rows[0].name,'Efectivo y bancos');assert.equal(p.rows[0].role,'cash');assert.equal(p.rows[0].amounts.previous,25000);assert.equal(p.rows[0].amounts.current,20000); // sin años: primera columna = T1
 assert.deepEqual(I.analyze('',{kind:'balance'}).rows,[]);assert.match(I.analyze('',{kind:'balance'}).notes.join(' '),/No encontré cifras/);
 assert.equal(I.analyze('solo texto sin cifras',{kind:'balance'}).rows.length,0);
});
test('Importador: cuentas preparadas para el estado de la aplicación',()=>{
 const p=I.analyze(balanceText(),{kind:'balance'});const rows=I.toStateRows(p);
 assert.equal(rows.length,16);assert.deepEqual(Object.keys(rows[0]).sort(),['amounts','memo','name','role','section','sign','term']);
 p.rows[0].include=false;assert.equal(I.toStateRows(p).length,15);
 p.rows[1].amounts={previous:null,current:null};assert.equal(I.toStateRows(p).length,14); // sin ningún importe no se importa
 const inc=I.toStateRows(I.analyze(incomeTextB,{kind:'income'}));assert.deepEqual(Object.keys(inc[0]).sort(),['amounts','category','name','sign']);
 assert.deepEqual(inc.map(r=>r.category),['sales','costSales','opex','opex','opex','opex','interest','taxes','preferred']);
});

// ---------- Ejercicios de prueba de la carpeta /ejercicios (también sirven de regresión del importador) ----------
const fsx=require('node:fs');const ex=f=>fsx.readFileSync(`./ejercicios/${f}`,'utf8');
const accOf=(p,side)=>I.toStateRows(p).map(r=>p.kind==='balance'?{name:r.name,section:r.section,term:r.term,role:r.role,sign:r.sign,memo:r.memo,amount:r.amounts[side]}:{name:r.name,category:r.category,sign:r.sign,amount:r.amounts[side]});

test('Ejercicio 1 · Comercial Volcán: se importa completo, se verifica y da los resultados de la hoja de soluciones',()=>{
 const bal=I.analyze(ex('1-balance-comercial-volcan.txt'),{kind:'balance'}),inc=I.analyze(ex('1-resultados-comercial-volcan.txt'),{kind:'income'});
 assert.deepEqual([bal.rows.length,inc.rows.length],[19,11]);assert.deepEqual(bal.columns,['current','previous']);assert.deepEqual(bal.years,[2025,2024]);
 assert.deepEqual(bal.rows.filter(r=>r.doubts.length).map(r=>r.name).sort(),['Anticipos de clientes','Inversiones en acciones']); // fuera del catálogo: clasificación del encabezado, con aviso
 assert.deepEqual(inc.rows.filter(r=>r.doubts.length).map(r=>r.name),['Número de acciones comunes']);                                   // categoría sugerida por el nombre
 assert.equal(bal.check.totals.length,9);assert.equal(inc.check.totals.length,7);
 for(const t of [...bal.check.totals,...inc.check.totals])assert.equal(t.status,'ok',t.name);
 assert.deepEqual([bal.check.cuadre.current.state,bal.check.cuadre.previous.state],['ok','ok']);assert.equal(bal.check.importable&&inc.check.importable,true);
 assert.equal(inc.rows.find(r=>r.name==='Número de acciones comunes').category,'shares');assert.equal(inc.rows.find(r=>/Devoluciones/.test(r.name)).sign,-1);
 const model={year:2025,params:{days:365,purchaseRate:.7,returnMethod:'average'},current:{year:2025,balance:{accounts:accOf(bal,'current')},income:{accounts:accOf(inc,'current')}},previous:{year:2024,balance:{accounts:accOf(bal,'previous')},income:{accounts:accOf(inc,'previous')}}};
 const a=F.analyzeModel(model);assert.deepEqual(a.errors,{});const v=(m,d=2)=>m.value.toFixed(d),A=a.activity.metrics,P=a.profitability;
 close(a.liquidity.workingCapital.value,1097000);assert.deepEqual([v(a.liquidity.currentRatio),v(a.liquidity.quickRatio)],['2.41','1.46']);
 assert.deepEqual([v(A.inventoryTurnover),v(A.inventoryDays),v(A.collectionDays),v(A.paymentDays),v(A.assetTurnover)],['5.73','63.65','46.03','57.87','1.64']);
 assert.deepEqual([(a.debt.debtRatio.value*100).toFixed(2),v(a.debt.interestCoverage)],['41.93','7.62']);
 assert.deepEqual([(P.metrics.grossMargin.value*100).toFixed(2),(P.metrics.netMargin.value*100).toFixed(2),(P.metrics.roa.value*100).toFixed(2),(P.metrics.roe.value*100).toFixed(2)],['34.92','9.56','15.65','27.41']);
 close(P.dupont.difference,0);close(a.currentIncome.eps.value,5.62);close(a.currentIncome.netProfit,602000);close(a.currentIncome.commonProfit,562000);
});
test('Ejercicio 1 · variantes con error: un dígito mal copiado y cifras transpuestas se detectan',()=>{
 const src=ex('1-balance-comercial-volcan.txt');
 const one=I.analyze(src.replace('Cuentas por cobrar\t610,000','Cuentas por cobrar\t601,000'),{kind:'balance'});
 assert.deepEqual(one.check.totals.filter(t=>t.status==='diff').map(t=>t.name),['Total activos corrientes','Total activos']);
 close(one.check.totals[0].diff.current,9000);assert.equal(one.check.totals[0].diff.previous,0);assert.equal(one.check.cuadre.current.state,'bad');close(one.check.cuadre.current.difference,-9000);assert.equal(one.check.cuadre.previous.state,'ok');
 const swap=I.analyze(src.replace('Inventarios\t740,000','Inventarios\t470,000'),{kind:'balance'});close(swap.check.totals.find(t=>t.name==='Total activos corrientes').diff.current,270000);
});
test('Ejercicio 2 · Papelería El Roble: solo totales con un detalle → total como dato, «de los cuales» y balance parcial',()=>{
 const p=I.analyze(ex('2-solo-totales-papeleria-el-roble.txt'),{kind:'balance'});
 assert.deepEqual(p.columns,['current']);assert.equal(p.rows.find(r=>r.name==='Inventarios').memo,true);assert.deepEqual(p.check.partsPresent,{currentAssets:true,nonCurrentAssets:false,currentLiabilities:true,nonCurrentLiabilities:false,equity:false});
 const b=F.calculateBalance({accounts:accOf(p,'current'),complete:p.check.partsPresent}),l=F.calculateLiquidity(b);
 close(l.workingCapital.value,700000);assert.equal(l.currentRatio.value.toFixed(2),'2.00');assert.equal(l.quickRatio.value.toFixed(2),'1.20');
});
test('Ejercicio 3 · Industrias La Ceiba: texto de PDF en miles con puntos guía, paréntesis y encabezados',()=>{
 const p=I.analyze(ex('3-texto-de-pdf-en-miles-industrias-la-ceiba.txt'),{kind:'balance'});
 assert.equal(p.unitsHint,'miles');assert.deepEqual(p.columns,['current','previous']);assert.equal(p.rows.length,8);assert.deepEqual(errorsOf(p),[]);
 for(const t of p.check.totals)assert.equal(t.status,'ok',t.name);assert.deepEqual([p.check.cuadre.current.state,p.check.cuadre.previous.state],['ok','ok']);
 const loan=p.rows.find(r=>/Préstamos/.test(r.name));assert.deepEqual([loan.section,loan.term,loan.role],['liability','noncurrent','longDebt']);
 assert.deepEqual([p.rows.find(r=>r.name==='Efectivo').amounts.current,p.rows.find(r=>/Depreciación/.test(r.name)).amounts.current],[120,310]);   // sin escala hasta que se elige
 const scaled=I.analyze(ex('3-texto-de-pdf-en-miles-industrias-la-ceiba.txt'),{kind:'balance',multiplier:1000}),b=F.calculateBalance({accounts:accOf(scaled,'current')});
 close(F.calculateLiquidity(b).workingCapital.value,620000);assert.equal(F.calculateLiquidity(b).currentRatio.value.toFixed(2),'3.38');assert.equal((F.calculateDebt(b).debtRatio.value*100).toFixed(1),'44.9');
});

// ---------- Dayton Products (ejercicio de clase): supuestos de actividad como parámetros explícitos ----------
// Cifras del archivo «Dayton-Razones_Financieros_resuelto.xlsx». Balance en formato plano de 11 cuentas.
const daytonBalance=y=>y===2012
 ?{cash:7229,receivables:21163,inventory:8068,otherCurrentAssets:1831,fixed:204960-110020,otherNonCurrentAssets:19413,payables:13792,otherCurrentLiabilities:4093+15290,longDebt:6655,otherNonCurrentLiabilities:16484+21733,equity:74597}
 :{cash:6547,receivables:19549,inventory:7904,otherCurrentAssets:1681,fixed:187519-97917,otherNonCurrentAssets:17891,payables:22862,otherCurrentLiabilities:3703+3549,longDebt:7099,otherNonCurrentLiabilities:16359+16441,equity:73161};
const daytonIncome=y=>y===2012?{sales:178909,creditSales:null,costSales:109701,operatingExpenses:58031,fixedCosts:null,interest:398,taxes:0,preferredDividends:0,shares:null,creditPurchases:null}
 :{sales:187510,creditSales:null,costSales:111631,operatingExpenses:54221,fixedCosts:null,interest:293,taxes:0,preferredDividends:0,shares:null,creditPurchases:null};
const daytonModel=(params={})=>({year:2012,params:{days:365,purchaseRate:.7,returnMethod:'average',...params},current:{year:2012,balance:daytonBalance(2012),income:daytonIncome(2012)},previous:{year:2011,balance:daytonBalance(2011),income:daytonIncome(2011)}});
const closeTo=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);

test('Dayton: con los supuestos de la hoja de clase (toda la venta a crédito; compras = costo + variación de inventario) coincide con todas las razones de actividad',()=>{
 const a=F.analyzeModel(daytonModel({purchasesMethod:'inventory',allSalesCredit:true}));assert.deepEqual(a.errors,{});const m=a.activity.metrics;
 close(a.liquidity.workingCapital.value,5116);closeTo(a.liquidity.currentRatio.value,1.15421250941974);closeTo(a.liquidity.quickRatio.value,0.911017332328561);
 closeTo(m.inventoryTurnover.value,13.736664162284);closeTo(m.inventoryDays.value,26.5712254218284);
 closeTo(m.receivableTurnover.value,8.78900569856553);closeTo(m.collectionDays.value,41.5291572810759);
 closeTo(m.payableTurnover.value,5.99470726250887);closeTo(m.paymentDays.value,60.8870431893688);
 closeTo(m.fixedTurnover.value,1.93895156658105);closeTo(m.assetTurnover.value,1.20958832795841);
 close(a.activity.purchases,109865);assert.equal(a.activity.creditSalesAssumed,true);assert.equal(a.activity.purchasesMethod,'inventory');
 close(a.activity.averages.inventory,7986);close(a.activity.averages.receivables,20356);close(a.activity.averages.payables,18327);close(a.activity.averages.fixed,92271);close(a.activity.averages.assets,147909);
});
test('Dayton: sin declarar esos supuestos no se inventa nada (cobro sin calcular; compras por el método por defecto)',()=>{
 const a=F.analyzeModel(daytonModel());const m=a.activity.metrics;
 assert.equal(m.collectionDays.value,null);assert.equal(m.receivableTurnover.value,null);assert.match(m.collectionDays.reason,/Ventas a crédito no informadas/);assert.equal(a.activity.creditSalesAssumed,false);
 close(a.activity.purchases,.7*109701);closeTo(m.paymentDays.value,18327*365/(.7*109701)); // el 70 % de siempre: distinto de la hoja de Dayton
 closeTo(m.inventoryTurnover.value,13.736664162284); // lo que no depende de los supuestos coincide igual
});
test('Compras por variación de inventario: necesita T1, rechaza valores negativos y respeta las compras reales',()=>{
 const one=F.analyzeModel({...daytonModel({purchasesMethod:'inventory'}),previous:null}).activity;assert.equal(one.metrics.paymentDays.value,null);assert.match(one.metrics.paymentDays.reason,/Requiere el inventario de T1/);
 const neg=daytonModel({purchasesMethod:'inventory'});neg.current.balance={...neg.current.balance,inventory:0};neg.previous.balance={...neg.previous.balance,inventory:900000,equity:73161+900000-7904};
 // (el balance de T1 se ajusta para seguir cuadrando)
 neg.current.balance.equity=74597-8068;const n=F.analyzeModel(neg);assert.match(n.activity.metrics.paymentDays.reason,/negativo/);
 const real=daytonModel({purchasesMethod:'inventory'});real.current.income={...real.current.income,creditPurchases:100000};const r=F.analyzeModel(real).activity;close(r.purchases,100000);assert.equal(r.purchasesEstimated,false);
 const informed=daytonModel({allSalesCredit:true});informed.current.income={...informed.current.income,creditSales:150000};const c=F.analyzeModel(informed).activity;close(c.creditSales,150000);assert.equal(c.creditSalesAssumed,false); // lo informado gana al supuesto
});
test('Parámetros de actividad: validación',()=>{
 assert.throws(()=>F.parameters({purchasesMethod:'otro'}),/Método de compras inválido/);assert.throws(()=>F.parameters({allSalesCredit:'sí'}),/sí o no/);
 assert.deepEqual([F.parameters({}).purchasesMethod,F.parameters({}).allSalesCredit],['percent',false]);
 assert.throws(()=>F.analyzeModel(daytonModel({purchasesMethod:'x'})),/Método de compras/);
});

// ---------- Otros ingresos y tasa de impuestos (Dayton Products) ----------
const dIncome=y=>y===2012
 ?[ia('Ventas','sales',178909),ia('Costo de bienes vendidos','costSales',109701),ia('Gastos de ventas, generales y admón.','opex',12356),ia('Depreciación y amortización','opex',12103),ia('Otros gastos fiscales','opex',33572),ia('Otros ingresos','otherIncome',3147),ia('Gasto por interés','interest',398),ia('Tasa de impuestos','taxRate',0.35324),ia('Dividendos preferentes','preferred',0)]
 :[ia('Ventas','sales',187510),ia('Costo de bienes vendidos','costSales',111631),ia('Gastos de ventas, generales y admón.','opex',12900),ia('Depreciación y amortización','opex',7944),ia('Otros gastos fiscales','opex',33377),ia('Otros ingresos','otherIncome',3323),ia('Gasto por interés','interest',293),ia('Tasa de impuestos','taxRate',0.37495),ia('Dividendos preferentes','preferred',0)];

test('Dayton: el estado de resultados con otros ingresos y tasa de impuestos da las utilidades de la hoja de clase',()=>{
 for(const [year,vals] of [[2012,{gross:69208,opex:58031,ebit:11177,ebt:13926,net:9006.77976}],[2011,{gross:75879,opex:54221,ebit:21658,ebt:24688,net:15431.2344}]]){
  const i=F.calculateIncome({accounts:dIncome(year)});
  close(i.grossProfit,vals.gross);close(i.operatingExpenses,vals.opex);close(i.ebit,vals.ebit);close(i.ebt,vals.ebt);close(i.netProfit,vals.net);
  close(i.taxes,vals.ebt*(year===2012?0.35324:0.37495));   // los impuestos se derivan de la tasa
 }
});
test('Impuestos por monto o por tasa: el monto gana, la tasa no puede faltar ni salirse de 0–1',()=>{
 const base=[ia('Ventas','sales',1000),ia('Costo','costSales',600),ia('Gastos','opex',200),ia('Intereses','interest',50),ia('Div','preferred',0)];
 close(F.calculateIncome({accounts:[...base,ia('Impuestos','taxes',30)]}).netProfit,120);
 close(F.calculateIncome({accounts:[...base,ia('Tasa','taxRate',0.2)]}).netProfit,150*(1-0.2));
 const both=F.calculateIncome({accounts:[...base,ia('Impuestos','taxes',30),ia('Tasa','taxRate',0.5)]});close(both.taxes,30);close(both.netProfit,120); // el monto informado manda
 assert.throws(()=>F.calculateIncome({accounts:base}),/Falta informar: impuestos/);
 for(const bad of [1,1.5])assert.throws(()=>F.calculateIncome({accounts:[...base,ia('Tasa','taxRate',bad)]}),/fracción entre 0 y 1/);
 assert.throws(()=>F.calculateIncome({accounts:[...base,ia('Tasa','taxRate',-0.1)]}),/no negativo/);
 assert.throws(()=>F.calculateIncome({accounts:[...base,ia('Tasa','taxRate',0.3,{sign:-1})]}),/no admite «resta»/);
 // pérdida: la tasa aplica un crédito teórico, igual que el CVU
 const loss=F.calculateIncome({accounts:[ia('Ventas','sales',100),ia('Costo','costSales',150),ia('Gastos','opex',0),ia('Intereses','interest',0),ia('Tasa','taxRate',0.3),ia('Div','preferred',0)]});close(loss.taxes,-15);close(loss.netProfit,-35);
 // en el resumen en vivo la tasa cuenta como impuestos informados
 const live=F.summarizeIncome({accounts:[ia('Ventas','sales',1000),ia('Costo','costSales',600),ia('Tasa','taxRate',0.2)]});close(live.grossProfit,400);assert.equal(live.ebit,null);
});
test('Otros ingresos: suman a la utilidad antes de impuestos, son opcionales y no cambian con las ventas en el escenario',()=>{
 const base=[ia('Ventas','sales',1000),ia('Costo','costSales',600),ia('Gastos','opex',200),ia('Intereses','interest',50),ia('Impuestos','taxes',30),ia('Div','preferred',0)];
 const without=F.calculateIncome({accounts:base}),withOther=F.calculateIncome({accounts:[...base,ia('Otros ingresos','otherIncome',40)]}),less=F.calculateIncome({accounts:[...base,ia('Otros gastos','otherIncome',10,{sign:-1})]});
 close(without.ebt,150);close(withOther.ebt,190);close(withOther.ebit,200);close(withOther.netProfit,160);close(less.ebt,140);assert.equal(without.otherIncome,null); // sin informar: no aporta y no se inventa un cero
 for(const k of ['sales','costSales','ebit'])assert.equal(withOther[k],without[k],k); // no altera la utilidad operativa
 const m=JSON.parse(JSON.stringify(bartlett));m.current.income={...m.current.income,fixedCosts:300000,otherIncome:50000};
 const s=F.simulateModel(m,10,0);close(s.result.currentIncome.otherIncome,50000); // constante
 const nb=F.calculateIncome(m.current.income);close(nb.ebt,418000+50000-93000);
});
test('Catálogo: nombres de los ejercicios de clase (Dayton y Mundo Moda) se reconocen',()=>{
 for(const [n,section,term,role] of [['Banco','asset','current','cash'],['Clientes','asset','current','receivables'],['Inventario','asset','current','inventory'],['Proveedores','liability','current','payables'],['Capital social','equity',null,null],['Ganancias retenidas','equity',null,null],['Deuda por pagar a largo plazo','liability','noncurrent','longDebt'],['Deuda por pagar a corto plazo','liability','current',null]]){
  const h=F.matchAccount(n);assert.deepEqual([h.section,h.term,h.role],[section,term,role],n);}
 assert.equal(F.matchIncomeAccount('Otros ingresos').category,'otherIncome');assert.equal(F.matchIncomeAccount('Tasa de impuestos').category,'taxRate');
});
const mundoLeaf=[
 ['Banco',88342,260975.2,0.1013706646777016,0.23852035692799545,172633.2,1.9541463856376358],
 ['Cliente',87400,52472,0.10028973866146476,0.047957201177452016,-34928,-0.3996338672768879],
 ['IVA x cobrar',21383,56007.05,0.02453656157663731,0.05118808820333919,34624.05,1.6192325679277932],
 ['Inventario',98350,34763,0.11285464299033249,0.03177191996744482,-63587,-0.6465378749364514],
 ['Seguro pagado x Ad.',20400,20400,0.02340858888665768,0.01864474203422818,0,0],
 ['Equipo de transporte',420000,612235,0.48194153590177574,0.5595570411434162,192235,0.45770238095238097],
 ['Depreciación acumulada Trans.',7000,16750,0.008032358931696262,0.015308795542809905,9750,1.3928571428571428],
 ['Equipo de oficina',84000,53218,0.09638830718035514,0.048639013802821346,-30782,-0.366452380952381],
 ['Depreciación acum. Equ. de ofi.',1400,1890,0.0016064717863392523,0.00172738051199467,490,0.35],
 ['Franquicias',60000,0,0.06884879084311082,0,-60000,-1],
 ['Otros activos',0,22712,0,0.020757812798107376,22712,null],
 ['Proveedor',83140,98535,0.09540147451160388,0.09005684589915068,15395,0.18516959345681983],
 ['IVA x pagar',41175,67586.25,0.047247482716084796,0.06177099001523796,26411.25,0.6414389799635701],
 ['IR x pagar',25445,45350.75,0.029197624716715914,0.04144867817690067,19905.75,0.7823049715071724],
 ['Acreedor',18900,23320,0.021687369115579908,0.021313499227362805,4420,0.23386243386243386],
 ['Préstamos',115000,95800,0.13196018244929572,0.08755717092544411,-19200,-0.16695652173913045],
 ['Capital social',500000,600000,0.5737399236925902,0.5483747657125936,100000,0.2],
 ['Utilidades',87815,163550.25,0.1007659427981296,0.1494780500433102,75735.25,0.862440926948699]];
const mundoTotals={currentAssets:['Total',315875,424617.25,0.36246019679279384,0.38808230831045964,108742.25,0.34425722200237435],assets:['TOTAL, ACTIVOS',871475,1094142.25,1,1,222667.25,0.2555061820476778],currentLiabilities:['Total',168660,234792,0.1935339510599845,0.21459001331865213,66132,0.392102454642476],liabilities:['TOTAL, PASIVO',283660,330592,0.32549413350928025,0.30214718424409626,46932,0.16545159698230275],equity:['Total, Capital',587815,763550.25,0.6745058664907198,0.6978528157559037,175735.25,0.2989635344453612],funding:['Total, pasivo y capital',871475,1094142.25,1,1,222667.25,0.2555061820476778]};
const mundoAcc=(name,section,term,role,sign=1)=>{const row=mundoLeaf.find(r=>r[0]===name);assert.ok(row,name);return {name,section,term,role,sign,memo:false,amounts:{previous:row[1],current:row[2]}};};
const mundoAccounts=()=>[mundoAcc('Banco','asset','current','cash'),mundoAcc('Cliente','asset','current','receivables'),mundoAcc('IVA x cobrar','asset','current',null),mundoAcc('Inventario','asset','current','inventory'),mundoAcc('Seguro pagado x Ad.','asset','current',null),
 mundoAcc('Equipo de transporte','asset','noncurrent','fixed'),mundoAcc('Depreciación acumulada Trans.','asset','noncurrent','fixed',-1),mundoAcc('Equipo de oficina','asset','noncurrent','fixed'),mundoAcc('Depreciación acum. Equ. de ofi.','asset','noncurrent','fixed',-1),mundoAcc('Franquicias','asset','noncurrent',null),mundoAcc('Otros activos','asset','noncurrent',null),
 mundoAcc('Proveedor','liability','current','payables'),mundoAcc('IVA x pagar','liability','current',null),mundoAcc('IR x pagar','liability','current',null),mundoAcc('Acreedor','liability','current',null),mundoAcc('Préstamos','liability','noncurrent','longDebt'),
 mundoAcc('Capital social','equity',null,null),mundoAcc('Utilidades','equity',null,null)];

test('Mundo Moda: análisis vertical y horizontal cuenta por cuenta coincide con la hoja de clase',()=>{
 const r=F.compareBalanceAccounts(mundoAccounts());assert.equal(r.accounts.length,mundoLeaf.length);
 for(const [i,[name,before,after,vBefore,vAfter,abs,rel]] of mundoLeaf.entries()){
  const row=r.accounts[i];assert.equal(row.name,name);closeTo(row.before,before);closeTo(row.after,after);closeTo(row.verticalBefore??0,vBefore);closeTo(row.verticalAfter??0,vAfter);closeTo(row.absolute,abs);
  if(rel===null){assert.equal(row.relative,null);assert.match(row.relativeReason,/cero/);} else closeTo(row.relative,rel);
 }
 assert.deepEqual(r.balanced,{previous:true,current:true});close(r.bases.previous.assets,871475);close(r.bases.current.funding,1094142.25);
});
test('Mundo Moda: totales y subtotales (base del activo = total activos; base del financiamiento = pasivo + capital)',()=>{
 const r=F.compareBalanceAccounts(mundoAccounts());const g=Object.fromEntries(r.groups.map(x=>[x.key,x]));
 for(const [key,[,before,after,vBefore,vAfter,abs,rel]] of Object.entries(mundoTotals)){const row=g[key];closeTo(row.before,before);closeTo(row.after,after);closeTo(row.verticalBefore,vBefore);closeTo(row.verticalAfter,vAfter);closeTo(row.absolute,abs);closeTo(row.relative,rel);}
 // El motor agrupa «otros activos» dentro de los no corrientes: 495,600 + 60,000 en 2018.
 close(g.nonCurrentAssets.before,555600);close(g.nonCurrentAssets.after,669525);closeTo(g.nonCurrentAssets.verticalAfter,669525/1094142.25);
 close(g.currentLiabilities.after,234792);close(g.nonCurrentLiabilities.before,115000);
 close(g.assets.verticalBefore,1);close(g.funding.verticalAfter,1);
});
test('Mundo Moda: capital de trabajo neto 147,215 → 189,825.25 (+28.94 %)',()=>{
 const wc=side=>F.calculateLiquidity(F.summarizeBalance({accounts:F.accountsForPeriod(mundoAccounts(),side)})).workingCapital.value;
 close(wc('previous'),147215);close(wc('current'),189825.25);const c=F.compareValues(wc('previous'),wc('current'));close(c.absolute,42610.25);closeTo(c.relative,0.2894423122643752);
});
test('Análisis por cuenta: base cero, datos faltantes y balance parcial no inventan porcentajes',()=>{
 const acc=[{name:'Caja',section:'asset',term:'current',role:'cash',amounts:{previous:0,current:100}},{name:'Deuda',section:'liability',term:'current',role:null,amounts:{previous:50,current:null}},{name:'Capital',section:'equity',term:null,role:null,amounts:{previous:50,current:100}}];
 const r=F.compareBalanceAccounts(acc);const [caja,deuda,cap]=r.accounts;
 assert.equal(caja.relative,null);assert.equal(caja.verticalBefore,null);   // base cero: sin % (la hoja muestra N/A) y el activo T1 es 0
 assert.equal(deuda.absolute,null);assert.equal(deuda.relative,null);assert.match(deuda.relativeReason,/Falta/);assert.equal(deuda.verticalAfter,null);
 closeTo(cap.verticalBefore,0.5);closeTo(cap.relative,1);   // T1: pasivo 50 + capital 50 = 100
 const sinT1=F.compareBalanceAccounts(acc.map(a=>({...a,amounts:{previous:null,current:a.amounts.current}})));
 assert.equal(sinT1.accounts[0].verticalBefore,null);assert.equal(sinT1.bases.previous.assets,null);
 const partial=F.compareBalanceAccounts(mundoAccounts(),{complete:{previous:{currentAssets:true,nonCurrentAssets:false,currentLiabilities:true,nonCurrentLiabilities:true,equity:true},current:{currentAssets:true,nonCurrentAssets:true,currentLiabilities:true,nonCurrentLiabilities:true,equity:true}}});
 assert.equal(partial.bases.previous.assets,null);assert.equal(partial.accounts[0].verticalBefore,null);   // sin total de activos T1 no hay base vertical
 closeTo(partial.accounts[0].verticalAfter,260975.2/1094142.25);
 assert.throws(()=>F.compareBalanceAccounts(null),/Indica las cuentas/);
});

// ---------- Ejercicios de clase pegados como texto: Dayton Products y Mundo Moda ----------
const daytonTables=()=>({b:I.analyze(ex('4-dayton-balance.txt'),{kind:'balance'}),i:I.analyze(ex('4-dayton-resultados.txt'),{kind:'income'})});
const daytonFromText=(params={})=>{const {b,i}=daytonTables();
 return {year:2012,params:{days:365,purchaseRate:.7,returnMethod:'average',...params},
  current:{year:2012,balance:{accounts:sideAccounts(b,'current')},income:{accounts:sideAccounts(i,'current')}},
  previous:{year:2011,balance:{accounts:sideAccounts(b,'previous')},income:{accounts:sideAccounts(i,'previous')}}};};

test('Dayton (texto pegado): balance de 14 cuentas con totales verificados y cuadre; «Capital» abre el patrimonio',()=>{
 const {b}=daytonTables();
 assert.deepEqual(b.columns,['current','previous']);assert.deepEqual(b.years,[2012,2011]);assert.equal(b.rows.length,14);assert.deepEqual(errorsOf(b),[]);
 const by=n=>b.rows.find(r=>r.name===n);
 assert.deepEqual([by('Ganancias retenidas').section,by('Ganancias retenidas').amounts.current],['equity',74597]);
 const dep=by('Depreciación y agotamientos acumulados');assert.deepEqual([dep.sign,dep.role,dep.term],[-1,'fixed','noncurrent']);
 assert.equal(by('Deuda por pagar a largo plazo').role,'longDebt');assert.equal(by('Impuesto sobre la renta diferido').term,'noncurrent');
 assert.deepEqual(b.check.totals.map(t=>[t.part,t.status]),[['assets','ok'],['funding','ok']]); // «Total de pasivo + capital» con signo +
 assert.deepEqual([b.check.cuadre.current.state,b.check.cuadre.previous.state],['ok','ok']);assert.equal(b.check.importable,true);
});
test('Dayton (texto pegado): estado de resultados con otros ingresos y tasa de impuestos; utilidades del documento verificadas',()=>{
 const {i}=daytonTables();
 assert.deepEqual(i.rows.map(r=>r.category),['sales','costSales','opex','opex','opex','otherIncome','interest','taxRate']);assert.deepEqual(errorsOf(i),[]);
 assert.deepEqual(i.check.totals.map(t=>[t.part,t.status]),[['grossProfit','ok'],['operatingExpenses','ok'],['ebit','ok'],['ebt','ok'],['netProfit','ok']]); // UAI y neta DI salen de la tasa
 close(i.rows.find(r=>r.category==='taxRate').amounts.current,0.35324);
});
test('Dayton: lo importado del texto reproduce la hoja de clase (liquidez, actividad con sus supuestos y utilidades)',()=>{
 const m=daytonFromText({purchasesMethod:'inventory',allSalesCredit:true});for(const side of ['current','previous'])m[side].income.accounts.push({name:'Dividendos preferentes',category:'preferred',sign:1,amount:0}); // la hoja no los trae: se declara 0
 const a=F.analyzeModel(m);assert.deepEqual(a.errors,{});
 close(a.currentIncome.ebt,13926);closeTo(a.currentIncome.netProfit,9006.77976);closeTo(a.previousIncome.netProfit,15431.2344);
 close(a.liquidity.workingCapital.value,5116);closeTo(a.liquidity.currentRatio.value,1.15421250941974);
 closeTo(a.activity.metrics.inventoryTurnover.value,13.736664162284);closeTo(a.activity.metrics.collectionDays.value,41.5291572810759);closeTo(a.activity.metrics.paymentDays.value,60.8870431893688);closeTo(a.activity.metrics.assetTurnover.value,1.20958832795841);
});
test('Importador: la tasa de impuestos no se escala, se reconoce con otros rótulos y se lee un porcentaje',()=>{
 const base=t=>['Cuenta\t2012\t2011','Ventas\t1,000\t900','Costo de ventas\t600\t500','Gastos operativos\t200\t200','Gastos por intereses\t50\t50',t,'Dividendos preferentes\t0\t0'].join('\n');
 const scaled=I.analyze(base('Tasa de impuestos\t0.35\t0.4'),{kind:'income',multiplier:1000}),tr=scaled.rows.find(r=>r.category==='taxRate');
 assert.deepEqual([tr.amounts.current,tr.amounts.previous],[0.35,0.4]);close(scaled.rows[0].amounts.current,1000000); // las cifras sí se escalan
 const bare=I.analyze(base('Impuestos\t0.35\t0.4'),{kind:'income'}),b=bare.rows.find(r=>/Impuestos/.test(r.name));
 assert.equal(b.category,'taxRate');assert.ok(b.doubts.some(d=>/tasa de impuestos/.test(d.text))); // «Impuestos» con cifras entre 0 y 1: tasa, con aviso
 const real=I.analyze(base('Impuestos\t94\t64'),{kind:'income'});assert.equal(real.rows.find(r=>/Impuestos/.test(r.name)).category,'taxes'); // un monto normal sigue siendo monto
 const pct=I.analyze(base('Tasa impositiva\t35 %\t40 %'),{kind:'income'}),p=pct.rows.find(r=>r.category==='taxRate');
 assert.deepEqual([p.amounts.current,p.amounts.previous],[0.35,0.4]);assert.ok(p.doubts.some(d=>/porcentaje/.test(d.text)));
 const net=I.analyze('Utilidad operativa\t100\nUtilidad Neta AI\t90\nUtilidad neta DI\t60',{kind:'income'});assert.deepEqual(net.docTotals.map(t=>t.part),['ebit','ebt','netProfit']);
});
test('Mundo Moda (texto pegado desde Excel): años en «Dic. 31/2018», subtotales anidados, «Total» sueltos y coma en «Total, activos»',()=>{
 const p=I.analyze(ex('5-mundo-moda-balance.txt'),{kind:'balance'});
 assert.deepEqual(p.years,[2018,2019]);assert.deepEqual(p.columns,['previous','current']);assert.equal(p.orderAssumed,false);assert.equal(p.rows.length,mundoLeaf.length);assert.deepEqual(errorsOf(p),[]);
 assert.equal(p.check.totals.length,11);for(const t of p.check.totals)assert.equal(t.status,'ok',`${t.name}: ${JSON.stringify(t.diff)}`);
 assert.deepEqual(p.check.totals.filter(t=>t.part).map(t=>t.part),['assets','liabilities','equity','funding']); // «TOTAL, ACTIVOS», «Total, Capital»…
 assert.deepEqual([p.check.cuadre.previous.state,p.check.cuadre.current.state],['ok','ok']);assert.equal(p.check.importable,true);
 const sub=p.check.totals.find(t=>t.name==='Total, equipo de oficina');close(sub.expected.previous,82600);close(sub.expected.current,51328); // resta la depreciación acumulada
 const big=p.docTotals.filter(t=>t.name.trim()==='Total').map(t=>t.members.length);assert.deepEqual(big,[5,4,2,4,1]); // el «Total» de no circulantes suma los dos subtotales (4 cuentas); el de préstamos, una sola
 const dep=p.rows.filter(r=>/Depreciación/.test(r.name));assert.equal(dep.length,2);for(const r of dep)assert.deepEqual([r.sign,r.role,r.term],[-1,'fixed','noncurrent']);
 assert.equal(p.rows.find(r=>r.name==='Préstamos').role,'longDebt');assert.equal(p.rows.find(r=>r.name==='Capital social').section,'equity');
});
test('Mundo Moda: el texto importado da el análisis vertical/horizontal y el capital de trabajo de la hoja de clase',()=>{
 const p=I.analyze(ex('5-mundo-moda-balance.txt'),{kind:'balance'}),rows=I.toStateRows(p).map((r,i)=>({id:'m'+i,...r}));
 const r=F.compareBalanceAccounts(rows);assert.equal(r.accounts.length,mundoLeaf.length);
 for(const [i,[name,before,after,vBefore,vAfter,abs]] of mundoLeaf.entries()){const row=r.accounts[i];assert.equal(row.name.replace(/\.$/,''),name.replace(/\.$/,''));closeTo(row.before,before);closeTo(row.after,after);closeTo(row.verticalBefore??0,vBefore);closeTo(row.verticalAfter??0,vAfter);closeTo(row.absolute,abs);}
 const wc=side=>F.calculateLiquidity(F.summarizeBalance({accounts:sideAccounts(p,side)})).workingCapital.value;close(wc('previous'),147215);close(wc('current'),189825.25);
});
test('Importador: un «Total» que no coincide con el bloque sale como diferencia (no como cuenta) y se avisa lo que falta en resultados',()=>{
 const bad=I.analyze(['Activos\t2019\t2018','Activos corrientes','Banco\t100\t90','Clientes\t50\t40','Total\t160\t130'].join('\n'),{kind:'balance'});
 assert.equal(bad.rows.length,2);assert.equal(bad.rows.some(r=>r.name==='Total'),false);
 const t=bad.check.totals[0];assert.equal(t.status,'diff');close(t.diff.current,10);assert.equal(t.diff.previous,0);   // solo T2 está mal
 const good=I.analyze(['Activos\t2019\t2018','Activos corrientes','Banco\t100\t90','Clientes\t50\t40','Total\t150\t130'].join('\n'),{kind:'balance'});
 assert.equal(good.rows.length,2);assert.equal(good.check.totals[0].status,'ok');
 const inc=I.analyze(ex('4-dayton-resultados.txt'),{kind:'income'});assert.ok(inc.notes.some(n=>/dividendos preferentes/.test(n)&&!/impuestos/.test(n))); // Dayton no trae dividendos preferentes
 assert.equal(I.analyze(incomeTextB,{kind:'income'}).notes.some(n=>/No encontré/.test(n)),false);
});

// ---------- Propiedades aleatorias: otros ingresos / tasa y análisis por cuenta ----------
test('Propiedad: tasa de impuestos ≡ monto equivalente y otros ingresos entran solo en la UAI (300 casos)',()=>{
 let seed=12345;const rnd=()=>(seed=(seed*1664525+1013904223)%4294967296)/4294967296,money=()=>Math.round(rnd()*1e6)/100;
 for(let n=0;n<300;n++){
  const sales=money()+1000,cost=Math.min(sales,money()),opex=money()/2,interest=money()/4,other=rnd()<.5?null:money()/3,rate=Math.round(rnd()*90)/100;
  const base=[ia('Ventas','sales',sales),ia('Costo','costSales',cost),ia('Gastos','opex',opex),ia('Intereses','interest',interest),ia('Div','preferred',0)];
  const withOther=other===null?[]:[ia('Otros ingresos','otherIncome',other)];
  const byRate=F.calculateIncome({accounts:[...base,...withOther,ia('Tasa','taxRate',rate)]});
  const ebt=sales-cost-opex+(other??0)-interest;
  closeTo(byRate.ebt,ebt,1e-9);closeTo(byRate.taxes,ebt*rate,1e-9);closeTo(byRate.netProfit,ebt*(1-rate),1e-9);
  const byAmount=F.calculateIncome({accounts:[...base,...withOther,ia('Impuestos','taxes',ebt*rate)]});
  closeTo(byAmount.netProfit,byRate.netProfit,1e-9);closeTo(byAmount.ebit,byRate.ebit,1e-9);
  closeTo(byRate.ebit,sales-cost-opex,1e-9); // los otros ingresos nunca tocan la utilidad operativa
 }
});
test('Propiedad: el vertical por cuenta suma 100 % en cada bloque y el horizontal reconstruye T2 (200 balances)',()=>{
 let seed=777;const rnd=()=>(seed=(seed*1664525+1013904223)%4294967296)/4294967296,amt=()=>1+Math.round(rnd()*1e5);
 for(let n=0;n<200;n++){
  const nA=2+Math.floor(rnd()*5),nL=1+Math.floor(rnd()*3),acc=[],periods=side=>{};
  const mk=(name,section,term,p,c)=>({name,section,term,role:null,sign:1,memo:false,amounts:{previous:p,current:c}});
  let sumA=[0,0],sumL=[0,0];
  for(let i=0;i<nA;i++){const p=amt(),c=amt();sumA[0]+=p;sumA[1]+=c;acc.push(mk('A'+i,'asset',i%2?'noncurrent':'current',p,c));}
  for(let i=0;i<nL;i++){const p=amt(),c=amt();sumL[0]+=p;sumL[1]+=c;acc.push(mk('L'+i,'liability',i%2?'noncurrent':'current',p,c));}
  acc.push(mk('Capital','equity',null,sumA[0]-sumL[0]>0?sumA[0]-sumL[0]:0,sumA[1]-sumL[1]>0?sumA[1]-sumL[1]:0));
  const eq=acc[acc.length-1].amounts;if(eq.previous+sumL[0]!==sumA[0]||eq.current+sumL[1]!==sumA[1])continue; // solo balances que cuadran
  const r=F.compareBalanceAccounts(acc),sum=(pred,k)=>r.accounts.filter(pred).reduce((t,x)=>t+x[k],0);
  closeTo(sum(x=>x.section==='asset','verticalBefore'),1,1e-9);closeTo(sum(x=>x.section==='asset','verticalAfter'),1,1e-9);
  closeTo(sum(x=>x.section!=='asset','verticalBefore'),1,1e-9);closeTo(sum(x=>x.section!=='asset','verticalAfter'),1,1e-9);
  for(const x of r.accounts)closeTo(x.before*(1+x.relative),x.after,1e-9);
 }
});
