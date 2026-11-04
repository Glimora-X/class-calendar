/**
 * 与 miniprogram/utils/finance/close-holding.js 同构（云端自包含）
 */

const { round2, getEffectivePrincipal, rebuildLedger } = require('./ledger')

const CLOSE_CF_SOURCE = 'close'
const CLOSE_CF_REMARK = '清仓赎回'

function getLatestEOD(holding) {
  const e = (holding && holding.dailyEntries) || []
  if (!e.length) return getEffectivePrincipal(holding || {})
  return round2(Number(e[e.length - 1].eodBalance) || 0)
}

function getCumProfit(holding) {
  return round2(getLatestEOD(holding) - getEffectivePrincipal(holding || {}))
}

function buildClosePatch(holding, today) {
  const realizedProfit = getCumProfit(holding)
  const ep = getEffectivePrincipal(holding || {})
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
  buildClosePatch,
  buildReopenPatch,
  getCumProfit
}
