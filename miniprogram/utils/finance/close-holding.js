/**
 * 清仓 / 重新开仓 — 纯函数
 * 清仓时冻结已实现损益，并自动记一笔赎回（source=close）
 */

const { round2 } = require('./money')
const { getEffectivePrincipal, rebuildLedger } = require('./ledger')
const { getCumProfit } = require('./metrics')

const CLOSE_CF_SOURCE = 'close'
const CLOSE_CF_REMARK = '清仓赎回'

function isPositionStatus(status) {
  return status !== 'eliminated' && status !== 'closed'
}

/**
 * 汇总用收益：已清仓读冻结值，其余现算
 * @param {object} holding
 * @returns {number}
 */
function getReportedProfit(holding) {
  if (!holding) return 0
  if (holding.status === 'closed') {
    return round2(Number(holding.realizedProfit) || 0)
  }
  return getCumProfit(holding)
}

/**
 * @param {object} holding
 * @param {string} today YYYY-MM-DD
 * @returns {{
 *   status: string,
 *   realizedProfit: number,
 *   closedDate: string,
 *   cashflows: Array,
 *   dailyEntries: Array
 * }}
 */
function buildClosePatch(holding, today) {
  const realizedProfit = getCumProfit(holding)
  const ep = getEffectivePrincipal(holding)
  const cashflows = Array.isArray(holding.cashflows) ? holding.cashflows.slice() : []
  if (ep > 0) {
    cashflows.push({
      date: String(today || '').trim(),
      type: 'redeem',
      amount: ep,
      remark: CLOSE_CF_REMARK,
      source: CLOSE_CF_SOURCE
    })
  }
  const rebuilt = rebuildLedger({
    principal: holding.principal,
    cashflows,
    dailyEntries: holding.dailyEntries
  })
  return {
    status: 'closed',
    realizedProfit,
    closedDate: String(today || '').trim(),
    cashflows,
    dailyEntries: rebuilt.dailyEntries
  }
}

/**
 * 还原清仓：去掉 source=close 的赎回，恢复 active
 * @param {object} holding
 * @returns {{
 *   status: string,
 *   realizedProfit: null,
 *   closedDate: string,
 *   cashflows: Array,
 *   dailyEntries: Array
 * }}
 */
function buildReopenPatch(holding) {
  const cashflows = (holding.cashflows || []).filter(
    (cf) => !(cf && cf.source === CLOSE_CF_SOURCE)
  )
  const rebuilt = rebuildLedger({
    principal: holding.principal,
    cashflows,
    dailyEntries: holding.dailyEntries
  })
  return {
    status: 'active',
    realizedProfit: null,
    closedDate: '',
    cashflows,
    dailyEntries: rebuilt.dailyEntries
  }
}

module.exports = {
  CLOSE_CF_SOURCE,
  CLOSE_CF_REMARK,
  isPositionStatus,
  getReportedProfit,
  buildClosePatch,
  buildReopenPatch
}
