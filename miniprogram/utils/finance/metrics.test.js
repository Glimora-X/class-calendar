/**
 * metrics / advice 冒烟
 * 运行: node miniprogram/utils/finance/metrics.test.js
 */

const assert = require('assert')
const { seedOpeningLedger, rebuildLedger } = require('./ledger')
const { calcAllMetrics, getCumProfit } = require('./metrics')
const { calcAdvice } = require('./advice')

const seeded = seedOpeningLedger({ principal: 100000, startDate: '2026-01-01' })
const holding = Object.assign(
  {
    startDate: '2026-01-01',
    principal: 100000,
    expectedAnnual: 3.5,
    endDate: '2026-01-05'
  },
  seeded
)

// 不足 7 天
{
  const m = calcAllMetrics(holding, '2026-01-03')
  const a = calcAdvice(holding, '2026-01-03')
  assert.strictEqual(m.showAnnualized, false)
  assert.strictEqual(a.advice, 'WATCH')
  assert.strictEqual(a.score, 30)
  assert.strictEqual(m.distToMaturity, 2)
}

// 补满收益后累计收益正确
{
  const h = Object.assign({}, holding, {
    dailyEntries: [
      { date: '2026-01-01', dailyReturn: 0 },
      { date: '2026-01-02', dailyReturn: 10 },
      { date: '2026-01-03', dailyReturn: 20 }
    ],
    cashflows: holding.cashflows
  })
  const r = rebuildLedger(h)
  h.dailyEntries = r.dailyEntries
  assert.strictEqual(getCumProfit(h), 30)
  assert.strictEqual(h.dailyEntries[2].eodBalance, 100030)
}

console.log('metrics.test.js OK')
