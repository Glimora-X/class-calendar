/**
 * 持仓指标（纯函数，asOf 由调用方传入）
 */

const { daysBetween, round2 } = require('./money')
const { getEffectivePrincipal, netCashflowByDate } = require('./ledger')

function getLatestEOD(holding) {
  const e = holding.dailyEntries || []
  if (!e.length) return getEffectivePrincipal(holding)
  return round2(Number(e[e.length - 1].eodBalance) || 0)
}

function getHoldingDays(holding, asOf) {
  return daysBetween(holding.startDate, asOf)
}

function getCumProfit(holding) {
  return round2(getLatestEOD(holding) - getEffectivePrincipal(holding))
}

function getCumReturnRate(holding) {
  const ep = getEffectivePrincipal(holding)
  if (!ep) return 0
  return getCumProfit(holding) / ep
}

function getSimpleAnnualized(holding, asOf) {
  const d = getHoldingDays(holding, asOf)
  if (d < 7) return null
  return getCumReturnRate(holding) * 365 / d * 100
}

/** TWR 小数（非百分数） */
function calcTWR(holding) {
  const e = holding.dailyEntries || []
  const cfs = holding.cashflows || []
  if (e.length < 2) return null
  const cm = netCashflowByDate(cfs)
  let growth = 1
  let prev = e[0].eodBalance
  for (let i = 1; i < e.length; i++) {
    const nc = cm[e[i].date] || 0
    if (prev > 0) {
      growth *= 1 + (e[i].eodBalance - prev - nc) / prev
    }
    prev = e[i].eodBalance
  }
  return growth - 1
}

function getTWRAnnualized(holding, asOf) {
  const twr = calcTWR(holding)
  if (twr === null) return null
  const d = getHoldingDays(holding, asOf)
  if (d < 7) return null
  return (Math.pow(1 + twr, 365 / d) - 1) * 100
}

function getCompoundAnnualized(holding, asOf) {
  const d = getHoldingDays(holding, asOf)
  if (d < 7) return null
  const hasCf = (holding.cashflows || []).some(
    (cf) => cf.amount && cf.date !== holding.startDate
  )
  if (hasCf) {
    const twr = calcTWR(holding)
    if (twr === null) return null
    return (Math.pow(1 + twr, 365 / d) - 1) * 100
  }
  const principal = Number(holding.principal) || 0
  if (!principal) return null
  const ratio = getLatestEOD(holding) / principal
  return (Math.pow(ratio, 365 / d) - 1) * 100
}

function calcIRR(holding, asOf) {
  const cfs = (holding.cashflows || []).filter((cf) => cf.amount)
  if (!cfs.length) return null
  const latest = getLatestEOD(holding)
  const arr = cfs.map((cf) => ({
    date: cf.date,
    amount: cf.type === 'buy' ? -cf.amount : cf.amount
  }))
  arr.push({ date: asOf, amount: latest })
  arr.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  if (arr.length < 2) return null
  const base = arr[0].date

  function npv(rate) {
    let s = 0
    for (let i = 0; i < arr.length; i++) {
      const d = daysBetween(base, arr[i].date)
      s += arr[i].amount / Math.pow(1 + rate, d / 365)
    }
    return s
  }

  let lo = -0.99
  let hi = 10
  let mid = 0
  for (let it = 0; it < 200; it++) {
    mid = (lo + hi) / 2
    const v = npv(mid)
    if (Math.abs(v) < 0.01) break
    if (v > 0) lo = mid
    else hi = mid
  }
  return mid * 100
}

/** 近 7 个日历日涨跌（百分数） */
function getRecent7Day(holding) {
  const e = holding.dailyEntries || []
  if (e.length < 2) return null
  const latest = e[e.length - 1]
  const target = addCalendarDays(latest.date, -7)
  let base = null
  for (let i = e.length - 1; i >= 0; i--) {
    if (e[i].date <= target) {
      base = e[i]
      break
    }
  }
  if (!base) base = e[0]
  let nc = 0
  ;(holding.cashflows || []).forEach((cf) => {
    if (cf.date > base.date && cf.date <= latest.date) {
      nc += cf.type === 'buy' ? cf.amount : -cf.amount
    }
  })
  if (!base.eodBalance) return null
  return ((latest.eodBalance - base.eodBalance - nc) / base.eodBalance) * 100
}

function addCalendarDays(dateStr, delta) {
  const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return dateStr
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  d.setDate(d.getDate() + delta)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

function getStable(holding, asOf) {
  const cfs = holding.cashflows || []
  let anchorDate = null
  for (let i = cfs.length - 1; i >= 0; i--) {
    if (cfs[i].amount) {
      anchorDate = cfs[i].date
      break
    }
  }
  if (!anchorDate) anchorDate = holding.startDate

  const e = holding.dailyEntries || []
  let anchorEOD = Number(holding.principal) || 0
  for (let j = 0; j < e.length; j++) {
    if (e[j].date <= anchorDate) anchorEOD = e[j].eodBalance
    else break
  }

  const after = e.filter((x) => x.date > anchorDate)
  const stableDays = daysBetween(anchorDate, asOf)
  const cfm = {}
  cfs.forEach((cf) => {
    if (cf.date > anchorDate && cf.amount) {
      cfm[cf.date] =
        (cfm[cf.date] || 0) + (cf.type === 'buy' ? cf.amount : -cf.amount)
    }
  })

  let stableTWR = 0
  if (after.length > 0 && anchorEOD > 0) {
    let growth = 1
    let prev = anchorEOD
    for (let k = 0; k < after.length; k++) {
      const nc = cfm[after[k].date] || 0
      if (prev > 0) {
        growth *= 1 + (after[k].eodBalance - prev - nc) / prev
      }
      prev = after[k].eodBalance
    }
    stableTWR = growth - 1
  }

  const stableAnnualized =
    stableDays >= 7 ? (Math.pow(1 + stableTWR, 365 / stableDays) - 1) * 100 : null
  const per10kPerDay =
    stableDays > 0 ? (stableTWR * 10000) / stableDays : null

  return {
    anchorDate,
    anchorEOD: round2(anchorEOD),
    stableDays,
    stableTWR: stableTWR * 100,
    stableAnnualized,
    per10kPerDay: per10kPerDay == null ? null : round2(per10kPerDay)
  }
}

function getExpected(holding, asOf) {
  if (holding.expectedAnnual == null || holding.expectedAnnual === '') return null
  const expectedAnnual = Number(holding.expectedAnnual)
  if (!Number.isFinite(expectedAnnual)) return null
  const s = getStable(holding, asOf)
  if (!s || s.stableAnnualized === null) return null
  const diff = s.stableAnnualized - expectedAnnual
  let status = 'miss'
  if (diff >= -0.3) status = 'target'
  else if (diff >= -1) status = 'near'
  return {
    expectedAnnual,
    stableAnnualized: s.stableAnnualized,
    per10kPerDay: s.per10kPerDay,
    expectedPer10kPerDay: round2((expectedAnnual / 365) * 100),
    diff,
    status
  }
}

function getDistToMaturity(holding, asOf) {
  if (!holding.endDate) return null
  return daysBetween(asOf, holding.endDate)
}

/**
 * @param {object} holding
 * @param {string} asOf
 */
function calcAllMetrics(holding, asOf) {
  const d = getHoldingDays(holding, asOf)
  const ep = getEffectivePrincipal(holding)
  const latest = getLatestEOD(holding)
  const cp = getCumProfit(holding)
  const cr = getCumReturnRate(holding) * 100
  return {
    latestEOD: latest,
    effectivePrincipal: ep,
    netCashflow: round2(ep - (Number(holding.principal) || 0)),
    cumulativeProfit: cp,
    cumulativeReturnRate: cr,
    holdingDays: d,
    distToMaturity: getDistToMaturity(holding, asOf),
    linearDailyAvg: d > 0 ? round2(cp / d) : 0,
    twr: calcTWR(holding) !== null ? calcTWR(holding) * 100 : null,
    twrAnnualized: getTWRAnnualized(holding, asOf),
    simpleAnnualized: getSimpleAnnualized(holding, asOf),
    complexAnnualized: getCompoundAnnualized(holding, asOf),
    irr: calcIRR(holding, asOf),
    recent7Day: getRecent7Day(holding),
    stable: getStable(holding, asOf),
    expected: getExpected(holding, asOf),
    showAnnualized: d >= 7
  }
}

module.exports = {
  getLatestEOD,
  getHoldingDays,
  getCumProfit,
  getCumReturnRate,
  getSimpleAnnualized,
  calcTWR,
  getTWRAnnualized,
  getCompoundAnnualized,
  calcIRR,
  getRecent7Day,
  getStable,
  getExpected,
  getDistToMaturity,
  calcAllMetrics,
  getEffectivePrincipal
}
