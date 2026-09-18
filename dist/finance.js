/* Motor independiente del DOM: saldos al cierre y escenarios pro forma del mismo período. */
(function (root) {
  'use strict';
  const keys = ['sales', 'profit', 'cash', 'receivables', 'inventory', 'fixed', 'payables', 'otherCurrent', 'longDebt'];
  function dupont({ profit, sales, assets, equity }) {
    if (![profit, sales, assets, equity].every(Number.isFinite) || sales <= 0 || assets <= 0 || equity <= 0 || equity > assets) throw new Error('Ventas, activos y patrimonio deben ser positivos; patrimonio no mayor que activos.');
    const margin = profit / sales, turnover = sales / assets, leverage = assets / equity;
    return { margin, turnover, leverage, roe: margin * turnover * leverage, roa: profit / assets };
  }
  function simulate(base, growth = 0, repayment = 0) {
    if (keys.some(k => !Number.isFinite(base[k]) || Math.abs(base[k]) > 1e15 || (k !== 'profit' && base[k] < 0)) || base.sales <= 0) throw new Error('Completa la base con importes válidos; ventas mayores que cero y solo la utilidad puede ser negativa.');
    if (!Number.isFinite(growth) || growth < -50 || growth > 50 || !Number.isFinite(repayment) || repayment < 0 || repayment > 100) throw new Error('Los cambios deben estar dentro del rango de los controles.');
    const assets = base.cash + base.receivables + base.inventory + base.fixed;
    const currentLiabilities = base.payables + base.otherCurrent;
    const equity = assets - currentLiabilities - base.longDebt;
    if (equity <= 0 || assets <= 0) throw new Error('La base necesita activos y patrimonio positivos. El patrimonio se obtiene restando todos los pasivos a los activos.');
    const profit = base.profit * (1 + growth / 100);
    const retainedChange = profit - base.profit;
    const payment = base.payables * repayment / 100;
    const cash = base.cash + retainedChange - payment;
    if (cash < -1e-8) throw new Error('Escenario no viable con el efectivo disponible: el pago y el cambio en utilidad dejarían caja negativa. Reduce el pago o revisa la base.');
    const currentAssets = Math.max(0, cash) + base.receivables + base.inventory;
    const newAssets = currentAssets + base.fixed;
    const newEquity = equity + retainedChange;
    if (newEquity <= 0 || newAssets <= 0) throw new Error('El escenario deja activos o patrimonio no positivos; no se interpretan ROA ni ROE.');
    const newCurrentLiabilities = currentLiabilities - payment;
    const describe = (p, s, a, e, ca, cl, c) => ({ profit: p, sales: s, assets: a, equity: e, cash: c, currentAssets: ca, currentLiabilities: cl, roa: p / a, roe: p / e, liquidity: cl > 0 ? ca / cl : null, workingCapital: ca - cl });
    return { base: describe(base.profit, base.sales, assets, equity, base.cash + base.receivables + base.inventory, currentLiabilities, base.cash), scenario: describe(profit, base.sales * (1 + growth / 100), newAssets, newEquity, currentAssets, newCurrentLiabilities, Math.max(0, cash)), retainedChange, payment, growth, repayment };
  }
  const api = { dupont, simulate, scenarioKeys: keys };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Finance = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
