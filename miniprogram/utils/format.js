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
 * @param {Date} d
 * @returns {string} HH:mm
 */
function formatTime(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
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

/**
 * HH:mm 加减分钟，跨日按 24h 回绕
 * @param {string} hhmm
 * @param {number} minutes
 * @returns {string}
 */
function addMinutesToTime(hhmm, minutes) {
  const parts = String(hhmm || '').split(':').map(Number)
  const h = parts[0]
  const m = parts[1]
  if (!Number.isFinite(h) || !Number.isFinite(m)) return ''
  let total = h * 60 + m + Number(minutes || 0)
  total = ((total % (24 * 60)) + 24 * 60) % (24 * 60)
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
}

/**
 * 两段 HH:mm 的间隔分钟（结束早于开始则视为无效，返回 NaN）
 * @param {string} startHhmm
 * @param {string} endHhmm
 * @returns {number}
 */
function minutesBetweenTimes(startHhmm, endHhmm) {
  const sp = String(startHhmm || '').split(':').map(Number)
  const ep = String(endHhmm || '').split(':').map(Number)
  if (
    !Number.isFinite(sp[0]) ||
    !Number.isFinite(sp[1]) ||
    !Number.isFinite(ep[0]) ||
    !Number.isFinite(ep[1])
  ) {
    return NaN
  }
  const diff = ep[0] * 60 + ep[1] - (sp[0] * 60 + sp[1])
  return diff > 0 ? diff : NaN
}

module.exports = {
  pad,
  formatDate,
  formatTime,
  formatMonthKey,
  parseMonthKey,
  monthRange,
  addMinutesToTime,
  minutesBetweenTimes
}
