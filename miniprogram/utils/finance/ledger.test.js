/**
 * ledger 单元测试
 * 运行: node miniprogram/utils/finance/ledger.test.js
 */

const assert = require('assert')
const {
  getEffectivePrincipal,
  rebuildLedger,
  seedOpeningLedger
} = require('./ledger')

// 无流水：有效本金 = 建档本金
assert.strictEqual(
  getEffectivePrincipal({ principal: 100000, cashflows: [] }),
  100000
)

// 只有开仓申购：有效本金 = 申购额（不再加建档本金）
{
  const h = {
    principal: 100000,
    cashflows: [{ date: '2026-07-14', type: 'buy', amount: 100000 }],
    dailyEntries: [{ date: '2026-07-14', dailyReturn: 0 }]
  }
  assert.strictEqual(getEffectivePrincipal(h), 100000)
  const r = rebuildLedger(h)
  assert.strictEqual(r.dailyEntries[0].eodBalance, 100000)
  assert.strictEqual(r.effectivePrincipal, 100000)
}

// 申购后再赎回
{
  const h = {
    principal: 100000,
    cashflows: [
      { date: '2026-07-14', type: 'buy', amount: 100000 },
      { date: '2026-08-01', type: 'redeem', amount: 20000 }
    ],
    dailyEntries: [
      { date: '2026-07-14', dailyReturn: 0 },
      { date: '2026-07-15', dailyReturn: 10 },
      { date: '2026-08-01', dailyReturn: 5 }
    ]
  }
  assert.strictEqual(getEffectivePrincipal(h), 80000)
  const r = rebuildLedger(h)
  assert.strictEqual(r.dailyEntries[0].eodBalance, 100000)
  assert.strictEqual(r.dailyEntries[1].eodBalance, 100010)
  // 8/1: 100010 + 5 - 20000
  assert.strictEqual(r.dailyEntries[2].eodBalance, 80015)
}

// seedOpeningLedger 默认开仓
{
  const s = seedOpeningLedger({ principal: 50000, startDate: '2026-08-01' })
  assert.strictEqual(s.cashflows.length, 1)
  assert.strictEqual(s.cashflows[0].amount, 50000)
  assert.strictEqual(s.dailyEntries[0].eodBalance, 50000)
  assert.strictEqual(s.effectivePrincipal, 50000)
}

// 迟录入两锚点
{
  const s = seedOpeningLedger({
    principal: 100000,
    startDate: '2026-07-01',
    lateDate: '2026-07-20',
    lateReturn: 526.3
  })
  assert.strictEqual(s.dailyEntries.length, 2)
  assert.strictEqual(s.dailyEntries[1].eodBalance, 100526.3)
}

console.log('ledger.test.js OK')
