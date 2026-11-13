/**
 * 净资产快照走势：净值序列 + 区间增长拆分（理财 / 其他）
 * 理财口径：仅 CNY；排除迟录入(source=late / kind=cumulative)；区间 (prev, curr]
 */

const { round2 } = require('./money')
const { isLateEntry } = require('./returns-calendar')

function isCnyHolding(holding) {
  const c = String((holding && holding.currency) || 'CNY').trim() || 'CNY'
  return c === 'CNY'
}

/**
 * @param {Array<object>} holdings
 * @param {string} fromExclusive YYYY-MM-DD
 * @param {string} toInclusive YYYY-MM-DD
 * @returns {number}
 */
function sumInvestReturns(holdings, fromExclusive, toInclusive) {
  const from = String(fromExclusive || '')
  const to = String(toInclusive || '')
  if (!to) return 0
  let sum = 0
  ;(holdings || []).forEach((h) => {
    if (!h || h.status === 'eliminated') return
    if (!isCnyHolding(h)) return
    ;(h.dailyEntries || []).forEach((e) => {
      if (!e || !e.date) return
      if (from && !(e.date > from)) return
      if (!(e.date <= to)) return
      if (isLateEntry(e)) return
      sum = round2(sum + (Number(e.dailyReturn) || 0))
    })
  })
  return sum
}

function sortedByDate(snapshots) {
  return (snapshots || [])
    .filter((s) => s && s.date)
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

/**
 * @param {Array<object>} snapshots
 * @param {Array<object>} holdings
 * @returns {Array<{
 *   date: string,
 *   net: number,
 *   deltaNet: number|null,
 *   investProfit: number|null,
 *   other: number|null,
 *   hasDelta: boolean
 * }>}
 */
function buildNetWorthGrowthSeries(snapshots, holdings) {
  const sorted = sortedByDate(snapshots)
  return sorted.map((snap, i) => {
    const net = round2(Number(snap.totalNetWorth) || 0)
    if (i === 0) {
      return {
        date: snap.date,
        net,
        deltaNet: null,
        investProfit: null,
        other: null,
        hasDelta: false
      }
    }
    const prev = sorted[i - 1]
    const prevNet = round2(Number(prev.totalNetWorth) || 0)
    const deltaNet = round2(net - prevNet)
    const investProfit = sumInvestReturns(holdings, prev.date, snap.date)
    const other = round2(deltaNet - investProfit)
    return {
      date: snap.date,
      net,
      deltaNet,
      investProfit,
      other,
      hasDelta: true
    }
  })
}

module.exports = {
  sumInvestReturns,
  buildNetWorthGrowthSeries,
  isCnyHolding
}
