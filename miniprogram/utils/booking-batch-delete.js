/**
 * 批量删除：id 规范化与按周几筛选
 */

const MAX_DELETE_IDS = 100

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
function normalizeDeleteIds(raw) {
  const out = []
  ;(Array.isArray(raw) ? raw : []).forEach((id) => {
    const s = String(id == null ? '' : id).trim()
    if (!s) return
    if (out.indexOf(s) === -1) out.push(s)
  })
  return out.slice(0, MAX_DELETE_IDS)
}

/**
 * @param {Record<string, boolean>|null|undefined} selected
 * @param {string} id
 * @returns {Record<string, boolean>}
 */
function toggleSelectedId(selected, id) {
  const key = String(id || '').trim()
  const next = Object.assign({}, selected || {})
  if (!key) return next
  if (next[key]) delete next[key]
  else next[key] = true
  return next
}

/**
 * @param {Record<string, boolean>|null|undefined} selected
 * @returns {string[]}
 */
function selectedIdList(selected) {
  return Object.keys(selected || {}).filter((k) => selected[k])
}

/**
 * @param {string} dateStr YYYY-MM-DD
 * @returns {number} 0-6，无效则 -1
 */
function weekdayOfDate(dateStr) {
  const s = String(dateStr || '')
  const d = new Date(s.replace(/-/g, '/'))
  if (Number.isNaN(d.getTime())) return -1
  return d.getDay()
}

/**
 * @param {Array<{ date?: string }>} list
 * @param {number} weekday 0=周日；-1=全部（不过滤）
 */
function filterBookingsByWeekday(list, weekday) {
  const rows = list || []
  const w = Number(weekday)
  if (!Number.isFinite(w)) return []
  if (w === -1) return rows.slice()
  return rows.filter((b) => weekdayOfDate(b && b.date) === w)
}

module.exports = {
  MAX_DELETE_IDS,
  normalizeDeleteIds,
  toggleSelectedId,
  selectedIdList,
  weekdayOfDate,
  filterBookingsByWeekday
}
