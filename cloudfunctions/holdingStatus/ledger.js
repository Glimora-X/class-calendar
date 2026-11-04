/** 与 miniprogram/utils/finance/ledger.js 保持同构 */
function round2(n) {
  return Math.round(Number(n) * 100) / 100
}

function netCashflowByDate(cashflows) {
  const map = {}
  ;(cashflows || []).forEach((cf) => {
    if (!cf || !cf.date || !cf.amount) return
    const signed = cf.type === 'redeem' ? -Number(cf.amount) : Number(cf.amount)
    map[cf.date] = round2((map[cf.date] || 0) + signed)
  })
  return map
}

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

function rebuildLedger(holding) {
  const principal = round2(Number(holding.principal) || 0)
  const cashflows = holding.cashflows || []
  const cfMap = netCashflowByDate(cashflows)
  const byDate = {}
  ;(holding.dailyEntries || []).forEach((e) => {
    if (!e || !e.date) return
    const row = {
      date: e.date,
      dailyReturn: round2(Number(e.dailyReturn) || 0),
      eodBalance: 0
    }
    if (e.source) row.source = e.source
    if (e.kind) row.kind = e.kind
    byDate[e.date] = row
  })
  Object.keys(cfMap).forEach((date) => {
    if (!byDate[date]) byDate[date] = { date, dailyReturn: 0, eodBalance: 0 }
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
        eodBalance: round2(principal + lateReturn),
        source: 'late'
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

module.exports = {
  round2,
  rebuildLedger,
  seedOpeningLedger,
  getEffectivePrincipal
}
