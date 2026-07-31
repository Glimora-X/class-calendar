/**
 * 通用格式化（被 date-utils / quick-parse 等复用）
 */

/**
 * @param {number|string} n
 * @param {number} [width=2]
 * @returns {string}
 */
function pad(n, width = 2) {
  const s = String(n)
  if (s.length >= width) return s
  return '0'.repeat(width - s.length) + s
}

/**
 * @param {Date} d
 * @returns {string} YYYY-MM-DD
 */
function formatDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * @param {number} year
 * @param {number} month 1-12
 * @returns {string} YYYY-MM
 */
function formatMonthKey(year, month) {
  return `${year}-${pad(month)}`
}

/**
 * @param {string} monthKey YYYY-MM
 * @returns {{ year: number, month: number }}
 */
function parseMonthKey(monthKey) {
  const [y, m] = monthKey.split('-').map(Number)
  return { year: y, month: m }
}

/**
 * 当月起止（含）
 * @param {number} year
 * @param {number} month 1-12
 * @returns {{ start: string, end: string }}
 */
function monthRange(year, month) {
  const start = `${year}-${pad(month)}-01`
  const last = new Date(year, month, 0).getDate()
  const end = `${year}-${pad(month)}-${pad(last)}`
  return { start, end }
}

module.exports = {
  pad,
  formatDate,
  formatMonthKey,
  parseMonthKey,
  monthRange
}
