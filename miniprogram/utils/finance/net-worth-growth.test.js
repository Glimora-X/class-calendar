/**
 * 运行: node miniprogram/utils/finance/net-worth-growth.test.js
 */
const assert = require('assert')
const {
  sumInvestReturns,
  buildNetWorthGrowthSeries
} = require('./net-worth-growth')

function holding(partial) {
  return Object.assign(
    {
      _id: 'h1',
      status: 'active',
      currency: 'CNY',
      dailyEntries: []
    },
    partial
  )
}

{
  const holdings = [
    holding({
      dailyEntries: [
        { date: '2026-07-14', dailyReturn: 1 },
        { date: '2026-07-15', dailyReturn: 10 },
        { date: '2026-07-16', dailyReturn: 2 },
        { date: '2026-07-20', dailyReturn: 99 }
      ]
    })
  ]
  // (07-14, 07-16] → 15+16
  assert.strictEqual(sumInvestReturns(holdings, '2026-07-14', '2026-07-16'), 12)
  // 左边界不计入
  assert.strictEqual(sumInvestReturns(holdings, '2026-07-15', '2026-07-16'), 2)
}

{
  const holdings = [
    holding({
      currency: 'USD',
      dailyEntries: [{ date: '2026-07-15', dailyReturn: 100 }]
    }),
    holding({
      _id: 'cny',
      dailyEntries: [{ date: '2026-07-15', dailyReturn: 5 }]
    })
  ]
  assert.strictEqual(sumInvestReturns(holdings, '2026-07-01', '2026-07-31'), 5)
}

{
  const holdings = [
    holding({
      dailyEntries: [
        { date: '2026-07-15', dailyReturn: 10 },
        { date: '2026-07-16', dailyReturn: 50, source: 'late' },
        { date: '2026-07-17', dailyReturn: 8, kind: 'cumulative' },
        { date: '2026-07-18', dailyReturn: 3 }
      ]
    })
  ]
  assert.strictEqual(sumInvestReturns(holdings, '2026-07-01', '2026-07-31'), 13)
}

{
  const holdings = [
    holding({
      status: 'closed',
      dailyEntries: [{ date: '2026-07-15', dailyReturn: 7 }]
    }),
    holding({
      _id: 'elim',
      status: 'eliminated',
      dailyEntries: [{ date: '2026-07-15', dailyReturn: 100 }]
    })
  ]
  assert.strictEqual(sumInvestReturns(holdings, '2026-07-01', '2026-07-31'), 7)
}

{
  const snapshots = [
    { date: '2026-07-01', totalNetWorth: 100000 },
    { date: '2026-07-15', totalNetWorth: 101000 },
    { date: '2026-07-31', totalNetWorth: 100500 }
  ]
  const holdings = [
    holding({
      dailyEntries: [
        { date: '2026-07-10', dailyReturn: 200 },
        { date: '2026-07-15', dailyReturn: 100 },
        { date: '2026-07-20', dailyReturn: 50 },
        { date: '2026-07-20', dailyReturn: 999, source: 'late' }
      ]
    })
  ]
  const series = buildNetWorthGrowthSeries(snapshots, holdings)
  assert.strictEqual(series.length, 3)

  assert.strictEqual(series[0].hasDelta, false)
  assert.strictEqual(series[0].net, 100000)
  assert.strictEqual(series[0].deltaNet, null)

  assert.strictEqual(series[1].hasDelta, true)
  assert.strictEqual(series[1].deltaNet, 1000)
  assert.strictEqual(series[1].investProfit, 300)
  assert.strictEqual(series[1].other, 700)

  // delta 负：other 可为负
  assert.strictEqual(series[2].deltaNet, -500)
  assert.strictEqual(series[2].investProfit, 50)
  assert.strictEqual(series[2].other, -550)
}

{
  assert.deepStrictEqual(buildNetWorthGrowthSeries([], []), [])
  assert.strictEqual(buildNetWorthGrowthSeries([{ date: '2026-01-01', totalNetWorth: 1 }], []).length, 1)
}

console.log('net-worth-growth ok')
