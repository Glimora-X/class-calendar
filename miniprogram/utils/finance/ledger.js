/**
 * 账本重算 — 有效本金 / 日终余额的唯一来源
 *
 * 有效本金 = 全部申购 − 全部赎回；无现金流时 = 建档本金
 * 日终 = 前日日终 + 当日收益 + 当日净现金流
 */

const { round2 } = require('./money')

/**
 * @param {Array<{date:string,type:string,amount:number}>} cashflows
 * @returns {Record<string, number>}
 */
function netCashflowByDate(cashflows) {
  const map = {}
  ;(cashflows || []).forEach((cf) => {
    if (!cf || !cf.date || !cf.amount) return
    const signed = cf.type === 'redeem' ? -Number(cf.amount) : Number(cf.amount)
    map[cf.date] = round2((map[cf.date] || 0) + signed)
  })
  return map
}

/**
 * @param {{ principal: number, cashflows?: Array }} holding
 * @returns {number}
 */
function getEffectivePrincipal(holding) {
  const cfs = holding.cashflows || []
  if (!cfs.length) return round2(Number(holding.principal) || 0)
  let sum = 0
  cfs.forEach((cf) => {
    if (!cf || !cf.amount) return
    sum += cf.type === 'redeem' ? -Number(cf.amount) : Number(cf.amount)
  })
  return round2(sum)
}

/**
 * 重算全部日终余额（按日期升序）
 * @param {{ principal: number, cashflows?: Array, dailyEntries?: Array }} holding
 * @returns {{ dailyEntries: Array, effectivePrincipal: number }}
 */
function rebuildLedger(holding) {
  const principal = round2(Number(holding.principal) || 0)
  const cashflows = holding.cashflows || []
  const cfMap = netCashflowByDate(cashflows)
  const byDate = {}

  ;(holding.dailyEntries || []).forEach((e) => {
    if (!e || !e.date) return
    byDate[e.date] = {
      date: e.date,
      dailyReturn: round2(Number(e.dailyReturn) || 0),
      eodBalance: 0
    }
  })

  Object.keys(cfMap).forEach((date) => {
    if (!byDate[date]) {
      byDate[date] = { date, dailyReturn: 0, eodBalance: 0 }
    }
  })

  const dates = Object.keys(byDate).sort()
  let prev = 0
  dates.forEach((date, idx) => {
    const row = byDate[date]
    const net = cfMap[date] || 0
    if (idx === 0) {
      row.eodBalance = cashflows.length
        ? round2(net + row.dailyReturn)
        : round2(principal + row.dailyReturn)
    } else {
      row.eodBalance = round2(prev + row.dailyReturn + net)
    }
    prev = row.eodBalance
  })

  return {
    dailyEntries: dates.map((d) => byDate[d]),
    effectivePrincipal: getEffectivePrincipal({ principal, cashflows })
  }
}

/**
 * 新建默认：一笔起息日申购 + 一条日流水（可选迟录入锚点）
 * @param {{ principal: number, startDate: string, cashflows?: Array, dailyEntries?: Array, lateDate?: string, lateReturn?: number }} input
 */
function seedOpeningLedger(input) {
  const principal = round2(Number(input.principal) || 0)
  const startDate = String(input.startDate || '').trim()
  let cashflows = Array.isArray(input.cashflows) ? input.cashflows.slice() : []
  let dailyEntries = Array.isArray(input.dailyEntries)
    ? input.dailyEntries.slice()
    : []

  if (!cashflows.length && startDate && principal > 0) {
    cashflows = [
      { date: startDate, type: 'buy', amount: principal, remark: '初始申购' }
    ]
  }

  const lateDate = String(input.lateDate || '').trim()
  const lateReturn = Number(input.lateReturn)
  if (lateDate && Number.isFinite(lateReturn) && startDate) {
    dailyEntries = [
      { date: startDate, dailyReturn: 0, eodBalance: principal },
      {
        date: lateDate,
        dailyReturn: round2(lateReturn),
        eodBalance: round2(principal + lateReturn)
      }
    ]
  } else if (!dailyEntries.length && startDate) {
    dailyEntries = [{ date: startDate, dailyReturn: 0, eodBalance: principal }]
  }

  const rebuilt = rebuildLedger({ principal, cashflows, dailyEntries })
  return {
    cashflows,
    dailyEntries: rebuilt.dailyEntries,
    effectivePrincipal: rebuilt.effectivePrincipal
  }
}

/**
 * @param {object} holding
 * @param {string} date
 * @param {number} dailyReturn
 * @returns {Array}
 */
function upsertDailyReturn(holding, date, dailyReturn) {
  const entries = (holding.dailyEntries || []).slice()
  const idx = entries.findIndex((e) => e.date === date)
  const row = { date, dailyReturn: round2(dailyReturn), eodBalance: 0 }
  if (idx >= 0) entries[idx] = row
  else entries.push(row)
  return rebuildLedger({
    principal: holding.principal,
    cashflows: holding.cashflows,
    dailyEntries: entries
  }).dailyEntries
}

module.exports = {
  netCashflowByDate,
  getEffectivePrincipal,
  rebuildLedger,
  seedOpeningLedger,
  upsertDailyReturn
}
