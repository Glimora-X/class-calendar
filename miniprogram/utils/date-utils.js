/**
 * 日期工具（契约 §4.2）
 * 复制上月映射：无对应第 N 个星期几则跳过并返回 skippedReason
 */

const { WEEKDAY_CN } = require('./constants')
const { pad, formatDate } = require('./format')

/**
 * @param {number} year
 * @param {number} month 1-12
 * @param {number} weekday 0=周日
 * @returns {string[]}
 */
function datesByWeekday(year, month, weekday) {
  const dates = []
  const d = new Date(year, month - 1, 1)
  while (d.getMonth() === month - 1) {
    if (d.getDay() === weekday) dates.push(formatDate(d))
    d.setDate(d.getDate() + 1)
  }
  return dates
}

/**
 * @param {string} sourceDateStr YYYY-MM-DD
 * @param {number} targetYear
 * @param {number} targetMonth 1-12
 * @returns {{ date: string, skippedReason: null } | { date: null, skippedReason: string }}
 */
function shiftToNextMonth(sourceDateStr, targetYear, targetMonth) {
  const parts = sourceDateStr.split('-').map(Number)
  const src = new Date(parts[0], parts[1] - 1, parts[2])
  const weekday = src.getDay()
  const weekIndex = Math.floor((src.getDate() - 1) / 7)
  const candidates = datesByWeekday(targetYear, targetMonth, weekday)

  if (candidates[weekIndex]) {
    return { date: candidates[weekIndex], skippedReason: null }
  }
  return {
    date: null,
    skippedReason: `目标月没有第 ${weekIndex + 1} 个星期${WEEKDAY_CN[weekday]}`
  }
}

/**
 * 复制上月预览分组（页面可直接用）
 * @param {Array<{ date: string }>} sourceBookings
 * @param {number} targetYear
 * @param {number} targetMonth
 * @returns {{ previewCreate: Array, previewSkipped: Array }}
 */
function buildCopyMonthPreview(sourceBookings, targetYear, targetMonth) {
  const previewCreate = []
  const previewSkipped = []
  ;(sourceBookings || []).forEach((b) => {
    const { date, skippedReason } = shiftToNextMonth(
      b.date,
      targetYear,
      targetMonth
    )
    if (date) {
      previewCreate.push(
        Object.assign({}, b, { date, _sourceDate: b.date })
      )
    } else {
      previewSkipped.push(Object.assign({}, b, { skippedReason }))
    }
  })
  return { previewCreate, previewSkipped }
}

/**
 * @param {number} year
 * @param {number} month 1-12
 * @returns {{ year: number, month: number }}
 */
function addMonths(year, month, delta) {
  const d = new Date(year, month - 1 + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

module.exports = {
  pad,
  formatDate,
  datesByWeekday,
  shiftToNextMonth,
  buildCopyMonthPreview,
  addMonths
}
