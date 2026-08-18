/**
 * 编辑课程表单回填：规范化云端行，避免新建默认值（今天/19:30/英语）残留
 */

const { pad } = require('./format')
const { formatPriceInput, resolveBookingPrice } = require('./price')

const NOTE_MAX_LEN = 100

/**
 * @param {unknown} raw
 * @returns {string} YYYY-MM-DD 或空
 */
function normalizeDate(raw) {
  if (raw == null || raw === '') return ''
  const s = String(raw).trim()
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const slash = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/)
  if (slash) return `${slash[1]}-${pad(slash[2])}-${pad(slash[3])}`
  return ''
}

/**
 * @param {unknown} raw
 * @returns {string} HH:mm 或空（picker 不接受 HH:mm:ss）
 */
function normalizeTime(raw) {
  if (raw == null || raw === '') return ''
  const s = String(raw).trim()
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return ''
  return `${pad(m[1])}:${m[2]}`
}

/**
 * 按 _id 取行，避免误用列表第一条
 * @param {Array} list
 * @param {string} id
 * @returns {object|null}
 */
function pickBookingFromList(list, id) {
  const rows = list || []
  const key = String(id || '').trim()
  if (key) {
    const hit = rows.find((r) => r && String(r._id) === key)
    if (hit) return hit
  }
  if (rows.length === 1) return rows[0]
  return null
}

/**
 * @param {object} row
 * @param {{ subjects?: Array, teachers?: Array }} [options]
 */
function bookingToEditForm(row, options) {
  const booking = row || {}
  const opts = options || {}
  const subjects = opts.subjects || []
  const teachers = opts.teachers || []
  const subjectId = String(booking.subjectId || '').trim()
  const matched = subjects.find((s) => s && s._id === subjectId)
  const subjectName = String(
    (matched && matched.name) || booking.subjectName || ''
  ).trim()
  const note = booking.note == null ? '' : String(booking.note)
  const price = resolveBookingPrice(booking, teachers)

  return {
    _id: booking._id || '',
    studentName: String(booking.studentName || '').trim(),
    teacherName: String(booking.teacherName || '').trim(),
    subjectId,
    subjectName,
    date: normalizeDate(booking.date),
    startTime: normalizeTime(booking.startTime),
    endTime: normalizeTime(booking.endTime),
    note,
    noteLen: Math.min(note.length, NOTE_MAX_LEN),
    price,
    priceText: formatPriceInput(price)
  }
}

module.exports = {
  NOTE_MAX_LEN,
  normalizeDate,
  normalizeTime,
  pickBookingFromList,
  bookingToEditForm
}
