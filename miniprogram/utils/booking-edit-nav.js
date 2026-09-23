/**
 * 新增/编辑课程页跳转
 */

const BOOKING_EDIT_PATH = '/pages/booking-edit/index'
const CALENDAR_ROUTE = 'pages/calendar/index'

/**
 * @param {{ id?: string, date?: string, studentName?: string }} [query]
 * @returns {string}
 */
function buildBookingEditUrl(query) {
  const q = query || {}
  const parts = []
  if (q.id) parts.push(`id=${encodeURIComponent(q.id)}`)
  if (q.date) parts.push(`date=${encodeURIComponent(q.date)}`)
  if (!q.id && q.studentName) {
    parts.push(`studentName=${encodeURIComponent(q.studentName)}`)
  }
  return parts.length ? `${BOOKING_EDIT_PATH}?${parts.join('&')}` : BOOKING_EDIT_PATH
}

/**
 * 仅日历页把当前选中日预填到新增表单；其它页返回空，由新增页回落到当天。
 * @param {{ route?: string, __route__?: string, data?: { selectedDate?: string } } | null} page
 * @returns {string} YYYY-MM-DD 或空
 */
function resolveCreateBookingDate(page) {
  if (!page) return ''
  const route = String(page.route || page.__route__ || '')
  if (route !== CALENDAR_ROUTE) return ''
  const date = page.data && page.data.selectedDate
  return date ? String(date).trim() : ''
}

module.exports = {
  buildBookingEditUrl,
  resolveCreateBookingDate
}
