/**
 * 现金流契约
 */

const CASHFLOW_TYPE = {
  buy: 'buy',
  redeem: 'redeem'
}

/**
 * @param {object} raw
 * @returns {{ date: string, type: string, amount: number, remark: string }|null}
 */
function normalizeCashflow(raw) {
  if (!raw) return null
  const date = String(raw.date || '').trim()
  const amount = Number(raw.amount)
  if (!date || !Number.isFinite(amount) || amount <= 0) return null
  const type =
    raw.type === CASHFLOW_TYPE.redeem || raw.type === '赎回'
      ? CASHFLOW_TYPE.redeem
      : CASHFLOW_TYPE.buy
  return {
    date,
    type,
    amount: round2(amount),
    remark: String(raw.remark || '').trim()
  }
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100
}

/**
 * @param {Array} list
 * @returns {Array}
 */
function normalizeCashflows(list) {
  if (!Array.isArray(list)) return []
  return list.map(normalizeCashflow).filter(Boolean)
}

module.exports = {
  CASHFLOW_TYPE,
  normalizeCashflow,
  normalizeCashflows,
  round2
}
