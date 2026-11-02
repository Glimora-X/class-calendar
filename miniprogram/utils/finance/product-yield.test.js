/**
 * product-yield 单元测试
 * 运行: node miniprogram/utils/finance/product-yield.test.js
 */

const assert = require('assert')
const { round2 } = require('./money')
const { rebuildLedger } = require('./ledger')
const { getStable } = require('./metrics')
const { classifyByReturn, calcProductYieldMetrics } = require('./product-yield')

// —— 分类 ——
assert.strictEqual(classifyByReturn(null), 'MISSING')
assert.strictEqual(classifyByReturn(9.87), 'POSITIVE')
assert.strictEqual(classifyByReturn(-0.01), 'NEGATIVE')
assert.strictEqual(classifyByReturn(0), 'ZERO')
assert.strictEqual(classifyByReturn(NaN), 'INVALID')
assert.strictEqual(classifyByReturn(Infinity), 'INVALID')

// ZERO 无前序 EOD：仍为 ZERO，计入自然日日均
{
  const m = calcProductYieldMetrics({
    dailyEntries: [{ date: '2026-10-14', dailyReturn: 0, eodBalance: 100000 }]
  })
  assert.strictEqual(m.days[0].yieldDayType, 'ZERO')
  assert.strictEqual(m.zeroYieldDayCount, 1)
  assert.strictEqual(m.averagePer10k, null)
  assert.strictEqual(m.annualizedYield, null)
  assert.strictEqual(m.averagePer10kOnCalendarDays, 0)
  assert.strictEqual(m.period.startDate, '2026-10-14')
  assert.strictEqual(m.period.recordedDayCount, 1)
}

// 非零收益 + 无前序 → INVALID（BASE_INVALID）
{
  const m = calcProductYieldMetrics({
    dailyEntries: [{ date: '2026-10-14', dailyReturn: 10, eodBalance: 100010 }]
  })
  assert.strictEqual(m.days[0].yieldDayType, 'INVALID')
  assert.strictEqual(m.invalidDayCount, 1)
  assert.strictEqual(m.yieldDayCount, 0)
  assert.strictEqual(m.totalReturnOnYieldDays, 0)
}

// 前序 EOD <=0：不向前跳过
{
  const m = calcProductYieldMetrics({
    dailyEntries: [
      { date: '2026-10-14', dailyReturn: 0, eodBalance: 0 },
      { date: '2026-10-15', dailyReturn: 5, eodBalance: 5 }
    ]
  })
  assert.strictEqual(m.days[1].yieldDayType, 'INVALID')
  assert.strictEqual(m.days[1].previousEodBalance, 0)
}

// 前序 EOD null
{
  const m = calcProductYieldMetrics({
    dailyEntries: [
      { date: '2026-10-14', dailyReturn: 0, eodBalance: null },
      { date: '2026-10-15', dailyReturn: 5, eodBalance: 5 }
    ]
  })
  assert.strictEqual(m.days[1].yieldDayType, 'INVALID')
}

// 加仓日：previousEod 必须是前序 EOD
{
  const m = calcProductYieldMetrics({
    dailyEntries: [
      { date: '2026-10-21', dailyReturn: 9.88, eodBalance: 100049.36 },
      { date: '2026-10-22', dailyReturn: 9.87, eodBalance: 107359.23 }
    ]
  })
  const d22 = m.days.find((d) => d.date === '2026-10-22')
  assert.strictEqual(d22.previousEodBalance, 100049.36)
  assert.strictEqual(
    d22.estimatedPer10k,
    round2((9.87 / 100049.36) * 10000)
  )
}

// 不修改原数组
{
  const entries = [
    { date: '2026-10-16', dailyReturn: 1, eodBalance: 100001 },
    { date: '2026-10-15', dailyReturn: 0, eodBalance: 100000 }
  ]
  const freeze = JSON.stringify(entries)
  calcProductYieldMetrics({ dailyEntries: entries })
  assert.strictEqual(JSON.stringify(entries), freeze)
}

// 输入顺序无关
{
  const a = calcProductYieldMetrics({
    dailyEntries: [
      { date: '2026-10-15', dailyReturn: 0, eodBalance: 100000 },
      { date: '2026-10-16', dailyReturn: 10, eodBalance: 100010 }
    ]
  })
  const b = calcProductYieldMetrics({
    dailyEntries: [
      { date: '2026-10-16', dailyReturn: 10, eodBalance: 100010 },
      { date: '2026-10-15', dailyReturn: 0, eodBalance: 100000 }
    ]
  })
  assert.strictEqual(a.averagePer10k, b.averagePer10k)
  assert.strictEqual(a.yieldDayCount, b.yieldDayCount)
}

// TINY_RETURN 仍计入平均
{
  const m = calcProductYieldMetrics({
    dailyEntries: [
      { date: '2026-10-15', dailyReturn: 0, eodBalance: 100000 },
      { date: '2026-10-16', dailyReturn: -0.01, eodBalance: 99999.99 }
    ]
  })
  assert.strictEqual(m.days[1].yieldDayType, 'NEGATIVE')
  assert.deepStrictEqual(m.days[1].anomalyFlags, ['TINY_RETURN'])
  assert.strictEqual(m.yieldDayCount, 1)
  assert.strictEqual(m.hasAnomalies, true)
}

// 非有限收益：INVALID，不跑 abs 异常
{
  const m = calcProductYieldMetrics({
    dailyEntries: [{ date: '2026-10-14', dailyReturn: NaN, eodBalance: 1 }]
  })
  assert.strictEqual(m.days[0].yieldDayType, 'INVALID')
  assert.deepStrictEqual(m.days[0].anomalyFlags, [])
}

// Infinity 前序不得污染平均
{
  const m = calcProductYieldMetrics({
    dailyEntries: [
      { date: '2026-10-14', dailyReturn: 0, eodBalance: Infinity },
      { date: '2026-10-15', dailyReturn: 10, eodBalance: 10 }
    ]
  })
  assert.strictEqual(m.days[1].yieldDayType, 'INVALID')
  assert.strictEqual(m.yieldDayCount, 0)
  assert.strictEqual(m.averagePer10k, null)
}

function buildWenxiangHolding() {
  const holding = {
    startDate: '2026-10-14',
    principal: 100000,
    cashflows: [
      { date: '2026-10-14', type: 'buy', amount: 100000 },
      { date: '2026-10-22', type: 'buy', amount: 7300 },
      { date: '2026-10-28', type: 'buy', amount: 80000 }
    ],
    dailyEntries: [
      { date: '2026-10-14', dailyReturn: 0 },
      { date: '2026-10-15', dailyReturn: 0 },
      { date: '2026-10-16', dailyReturn: 19.74 },
      { date: '2026-10-19', dailyReturn: 9.87 },
      { date: '2026-10-20', dailyReturn: 9.87 },
      { date: '2026-10-21', dailyReturn: 9.88 },
      { date: '2026-10-22', dailyReturn: 9.87 },
      { date: '2026-10-23', dailyReturn: -0.01 },
      { date: '2026-10-26', dailyReturn: 10.6 },
      { date: '2026-10-27', dailyReturn: 0 },
      { date: '2026-10-28', dailyReturn: 10.59 },
      { date: '2026-10-29', dailyReturn: 10.59 },
      { date: '2026-10-30', dailyReturn: 36.96 },
      { date: '2026-11-02', dailyReturn: 0 }
    ]
  }
  const rebuilt = rebuildLedger(holding)
  return Object.assign({}, holding, { dailyEntries: rebuilt.dailyEntries })
}

{
  const h = buildWenxiangHolding()
  const m = calcProductYieldMetrics(h)
  assert.strictEqual(m.calculationQuality, 'ESTIMATED')
  assert.strictEqual(m.yieldDayCount, 10)
  assert.strictEqual(m.positiveDayCount, 9)
  assert.strictEqual(m.negativeDayCount, 1)
  assert.strictEqual(m.zeroYieldDayCount, 4)
  assert.strictEqual(m.yieldDayCount, m.positiveDayCount + m.negativeDayCount)
  assert.strictEqual(m.averagePer10k, 1.04)
  assert.strictEqual(m.annualizedYield, 3.81)
  assert.strictEqual(m.averagePer10kOnCalendarDays, 0.75)
  assert.strictEqual(m.totalReturnOnYieldDays, 127.96)
  assert.strictEqual(m.period.startDate, '2026-10-14')
  assert.strictEqual(m.period.endDate, '2026-11-02')
  assert.strictEqual(m.period.recordedDayCount, 14)

  const d22 = m.days.find((d) => d.date === '2026-10-22')
  assert.strictEqual(d22.previousEodBalance, 100049.36)
  const d28 = m.days.find((d) => d.date === '2026-10-28')
  assert.strictEqual(d28.previousEodBalance, 107369.82)

  const s = getStable(h, '2026-11-02')
  assert.strictEqual(s.per10kPerDay, 0.51)
  assert.strictEqual(s.stableDays, 5)
}

console.log('product-yield.test.js OK')
