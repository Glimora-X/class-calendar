/** 月历日标记与图例（纯函数，供日历页与单测） */

function normalizeTone(tone) {
  const t = tone || 'primary'
  return t === 'surface' ? 'primary' : t
}

/**
 * @param {Array<{ cardTone?: string }>} items
 * @param {number} [max=3]
 * @returns {string[]}
 */
function tonesFromDayBookings(items, max) {
  const limit = max == null ? 3 : max
  const out = []
  ;(items || []).forEach((b) => {
    const tone = normalizeTone(b && b.cardTone)
    if (out.indexOf(tone) === -1) out.push(tone)
  })
  return out.slice(0, limit)
}

/**
 * @param {Array<{ date: string, cardTone?: string }>} bookings 已按筛选过滤、已 decorate
 * @param {number} summaryThreshold 超过则显示「N节」且 tones 为空
 * @returns {Array<{ date: string, tone: string, count: number, summary: string, tones: string[] }>}
 */
function buildMarks(bookings, summaryThreshold) {
  const byDate = {}
  ;(bookings || []).forEach((b) => {
    if (!b || !b.date) return
    if (!byDate[b.date]) byDate[b.date] = []
    byDate[b.date].push(b)
  })
  return Object.keys(byDate).map((date) => {
    const items = byDate[date]
    const count = items.length
    const tonesAll = tonesFromDayBookings(items)
    const tone = tonesAll[0] || 'primary'
    const useSummary = count > summaryThreshold
    return {
      date,
      tone,
      count,
      summary: useSummary ? `${count}节` : '',
      tones: useSummary ? [] : tonesAll
    }
  })
}

/**
 * @param {string[]} teacherNames
 * @param {Record<string, string>} teacherColorMap
 */
function buildLegend(teacherNames, teacherColorMap) {
  const map = teacherColorMap || {}
  return (teacherNames || []).map((name) => ({
    name,
    tone: normalizeTone(map[name])
  }))
}

module.exports = {
  normalizeTone,
  tonesFromDayBookings,
  buildMarks,
  buildLegend
}
