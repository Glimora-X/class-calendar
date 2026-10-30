/**
 * 收益月历聚合（纯函数）
 * 口径：日付 = Σ dailyReturn；迟录入(source=late)只标在截至日，不平摊
 */

const { round2 } = require('./money')

/**
 * @param {number} n
 * @returns {string}
 */
function formatDayReturnSummary(n) {
  const v = round2(Number(n) || 0)
  if (v > 0) return '+' + v.toFixed(2)
  if (v < 0) return v.toFixed(2)
  return '0.00'
}

/**
 * @param {number} year
 * @param {number} month 1-12
 * @returns {{ start: string, end: string }}
 */
function monthRange(year, month) {
  const y = Number(year)
  const m = Number(month)
  const start = `${y}-${pad(m)}-01`
  const last = new Date(y, m, 0).getDate()
  const end = `${y}-${pad(m)}-${pad(last)}`
  return { start, end }
}

function pad(n) {
  return n < 10 ? `0${n}` : String(n)
}

function isLateEntry(entry) {
  if (!entry) return false
  return entry.source === 'late' || entry.kind === 'cumulative'
}

/**
 * @param {Array<object>} holdings
 * @param {{ year: number, month: number, holdingId?: string }} opts
 * @returns {{
 *   dayMap: Record<string, number>,
 *   monthTotal: number,
 *   dayCount: number,
 *   cumulativeDates: Record<string, boolean>,
 *   marks: Array<{ date: string, summary: string, tone: string, isCumulative: boolean, badge: string }>
 * }}
 */
function aggregateMonthReturns(holdings, opts) {
  const year = opts && opts.year
  const month = opts && opts.month
  const holdingId = (opts && opts.holdingId) || ''
  const { start, end } = monthRange(year, month)

  const list = (holdings || []).filter((h) => {
    if (!h) return false
    if (h.status === 'eliminated') return false
    if (holdingId && h._id !== holdingId) return false
    return true
  })

  const dayMap = {}
  const cumulativeDates = {}

  list.forEach((h) => {
    ;(h.dailyEntries || []).forEach((e) => {
      if (!e || !e.date) return
      if (e.date < start || e.date > end) return
      const ret = round2(Number(e.dailyReturn) || 0)
      dayMap[e.date] = round2((dayMap[e.date] || 0) + ret)
      if (isLateEntry(e)) cumulativeDates[e.date] = true
    })
  })

  const dates = Object.keys(dayMap).sort()
  let monthTotal = 0
  dates.forEach((d) => {
    monthTotal = round2(monthTotal + dayMap[d])
  })

  const marks = dates.map((date) => {
    const amount = dayMap[date]
    const isCumulative = !!cumulativeDates[date]
    // tone 留空，避免污染约课日历日格着色；金额颜色用 summaryTone
    return {
      date,
      summary: formatDayReturnSummary(amount),
      tone: '',
      summaryTone: amount > 0 ? 'pos' : amount < 0 ? 'neg' : 'neutral',
      isCumulative,
      badge: isCumulative ? '累计' : ''
    }
  })

  return {
    dayMap,
    monthTotal,
    dayCount: dates.length,
    cumulativeDates,
    marks
  }
}

module.exports = {
  formatDayReturnSummary,
  monthRange,
  aggregateMonthReturns,
  isLateEntry
}
