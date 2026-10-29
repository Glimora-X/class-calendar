/**
 * 金额 / 百分比 / 日期展示
 */

function round2(n) {
  return Math.round(Number(n) * 100) / 100
}

/**
 * @param {number|null|undefined} n
 * @returns {string}
 */
function fmtMoney(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  const v = Number(n)
  if (Math.abs(v) >= 10000) return (v / 10000).toFixed(2) + '万'
  return round2(v).toFixed(2)
}

/**
 * @param {number|null|undefined} n 百分数，如 3.5 表示 3.5%
 * @returns {string}
 */
function fmtPct(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  const v = Number(n)
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'
}

/**
 * @param {string} s YYYY-MM-DD
 * @returns {string}
 */
function fmtDateShort(s) {
  if (!s) return '—'
  return String(s).substring(5).replace('-', '/')
}

/**
 * 日历日差（本地日期字符串）
 * @param {string} from
 * @param {string} to
 * @returns {number}
 */
function daysBetween(from, to) {
  if (!from || !to) return 0
  const a = parseLocalDate(from)
  const b = parseLocalDate(to)
  if (!a || !b) return 0
  return Math.floor((b.getTime() - a.getTime()) / 864e5)
}

/**
 * @param {string} s
 * @returns {Date|null}
 */
function parseLocalDate(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

/**
 * @param {Date} [d]
 * @returns {string}
 */
function todayStr(d) {
  const x = d || new Date()
  const y = x.getFullYear()
  const m = String(x.getMonth() + 1).padStart(2, '0')
  const day = String(x.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * @param {string} date
 * @param {number} deltaDays
 * @returns {string}
 */
function addDays(date, deltaDays) {
  const d = parseLocalDate(date)
  if (!d) return date
  d.setDate(d.getDate() + deltaDays)
  return todayStr(d)
}

module.exports = {
  round2,
  fmtMoney,
  fmtPct,
  fmtDateShort,
  daysBetween,
  parseLocalDate,
  todayStr,
  addDays
}
