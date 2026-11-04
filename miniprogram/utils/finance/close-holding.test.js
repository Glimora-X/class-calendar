/**
 * 运行: node miniprogram/utils/finance/close-holding.test.js
 */
const assert = require('assert')
const {
  buildClosePatch,
  buildReopenPatch,
  getReportedProfit,
  isPositionStatus,
  CLOSE_CF_SOURCE
} = require('./close-holding')
const { getCumProfit } = require('./metrics')

const holding = {
  _id: 'h1',
  status: 'active',
  principal: 3000,
  currency: 'CNY',
  cashflows: [{ date: '2026-10-01', type: 'buy', amount: 3000 }],
  dailyEntries: [
    { date: '2026-10-01', dailyReturn: 0, eodBalance: 3000 },
    { date: '2026-10-20', dailyReturn: -2.94, eodBalance: 2997.06 }
  ]
}

assert.strictEqual(isPositionStatus('active'), true)
assert.strictEqual(isPositionStatus('closed'), false)
assert.strictEqual(isPositionStatus('eliminated'), false)

const before = getCumProfit(holding)
assert.strictEqual(before, -2.94)

const closed = buildClosePatch(holding, '2026-11-05')
assert.strictEqual(closed.status, 'closed')
assert.strictEqual(closed.realizedProfit, -2.94)
assert.strictEqual(closed.closedDate, '2026-11-05')
const closeCf = closed.cashflows.find((c) => c.source === CLOSE_CF_SOURCE)
assert.ok(closeCf)
assert.strictEqual(closeCf.type, 'redeem')
assert.strictEqual(closeCf.amount, 3000)
assert.strictEqual(getReportedProfit(closed), -2.94)

// 已清仓一律读冻结值（不依赖清仓后余额−本金）
assert.strictEqual(
  getReportedProfit(
    Object.assign({}, holding, {
      status: 'closed',
      realizedProfit: closed.realizedProfit,
      cashflows: closed.cashflows,
      dailyEntries: closed.dailyEntries
    })
  ),
  -2.94
)
assert.strictEqual(
  getReportedProfit({ status: 'closed', realizedProfit: -2.94, dailyEntries: [] }),
  -2.94
)

const reopened = buildReopenPatch(
  Object.assign({}, holding, {
    status: 'closed',
    realizedProfit: closed.realizedProfit,
    closedDate: closed.closedDate,
    cashflows: closed.cashflows,
    dailyEntries: closed.dailyEntries
  })
)
assert.strictEqual(reopened.status, 'active')
assert.strictEqual(reopened.realizedProfit, null)
assert.strictEqual(reopened.closedDate, '')
assert.strictEqual(
  reopened.cashflows.some((c) => c.source === CLOSE_CF_SOURCE),
  false
)
assert.strictEqual(getCumProfit(Object.assign({}, holding, reopened)), -2.94)

console.log('close-holding.test.js OK')
