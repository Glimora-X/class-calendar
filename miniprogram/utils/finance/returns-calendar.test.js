/**
 * 运行: node miniprogram/utils/finance/returns-calendar.test.js
 */
const assert = require('assert')
const {
  aggregateMonthReturns,
  formatDayReturnSummary
} = require('./returns-calendar')

{
  assert.strictEqual(formatDayReturnSummary(12.5), '+12.50')
  assert.strictEqual(formatDayReturnSummary(-3.1), '-3.10')
  assert.strictEqual(formatDayReturnSummary(0), '0.00')
}

// 单产品：普通日收益
{
  const holdings = [
    {
      _id: 'a',
      name: '产品A',
      status: 'active',
      dailyEntries: [
        { date: '2026-07-14', dailyReturn: 0 },
        { date: '2026-07-15', dailyReturn: 10.5 },
        { date: '2026-07-16', dailyReturn: -2 },
        { date: '2026-08-01', dailyReturn: 99 }
      ]
    }
  ]
  const r = aggregateMonthReturns(holdings, {
    year: 2026,
    month: 7,
    holdingId: 'a'
  })
  assert.strictEqual(r.monthTotal, 8.5)
  assert.strictEqual(r.dayCount, 3)
  assert.strictEqual(r.dayMap['2026-07-15'], 10.5)
  assert.strictEqual(r.dayMap['2026-07-16'], -2)
  assert.ok(!r.dayMap['2026-08-01'])
  const m15 = r.marks.find((m) => m.date === '2026-07-15')
  assert.strictEqual(m15.summary, '+10.50')
  assert.strictEqual(m15.summaryTone, 'pos')
  assert.strictEqual(!!m15.isCumulative, false)
}

// 全部：多产品同日求和
{
  const holdings = [
    {
      _id: 'a',
      status: 'active',
      dailyEntries: [{ date: '2026-07-15', dailyReturn: 10 }]
    },
    {
      _id: 'b',
      status: 'active',
      dailyEntries: [{ date: '2026-07-15', dailyReturn: 5.5 }]
    },
    {
      _id: 'c',
      status: 'eliminated',
      dailyEntries: [{ date: '2026-07-15', dailyReturn: 100 }]
    }
  ]
  const r = aggregateMonthReturns(holdings, { year: 2026, month: 7 })
  assert.strictEqual(r.monthTotal, 15.5)
  assert.strictEqual(r.dayMap['2026-07-15'], 15.5)
}

// 迟录入：截至日保留金额 + 累计角标，不平摊
{
  const holdings = [
    {
      _id: 'a',
      status: 'active',
      dailyEntries: [
        { date: '2026-07-01', dailyReturn: 0 },
        {
          date: '2026-07-20',
          dailyReturn: 526.3,
          source: 'late'
        }
      ]
    }
  ]
  const r = aggregateMonthReturns(holdings, { year: 2026, month: 7 })
  assert.strictEqual(r.monthTotal, 526.3)
  assert.strictEqual(r.dayMap['2026-07-20'], 526.3)
  assert.ok(!r.dayMap['2026-07-10'])
  const m = r.marks.find((x) => x.date === '2026-07-20')
  assert.strictEqual(m.isCumulative, true)
  assert.strictEqual(m.badge, '累计')
  assert.strictEqual(m.summary, '+526.30')
}

console.log('returns-calendar.test.js OK')
