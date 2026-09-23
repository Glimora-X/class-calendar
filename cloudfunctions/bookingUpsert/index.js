const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const DEFAULT_REMIND_MINUTES = 10

function normalizeRemindMinutes(raw) {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n)) return DEFAULT_REMIND_MINUTES
  return Math.min(120, Math.max(1, n))
}

/** 约课 date+time 按北京时间解释（云函数主机多为 UTC，勿用无时区 Date 解析） */
function chinaLocalMs(date, time) {
  if (!date || !time) return NaN
  const t = String(time).trim()
  const withSec = t.length === 5 ? `${t}:00` : t
  return new Date(`${String(date).trim()}T${withSec}+08:00`).getTime()
}

function computeRemindAt(date, startTime, minutesBefore) {
  const before = normalizeRemindMinutes(minutesBefore)
  const start = chinaLocalMs(date, startTime)
  if (!Number.isFinite(start)) return null
  if (start <= Date.now()) return null
  return new Date(start - before * 60 * 1000).toISOString()
}

function pickFields(event) {
  const status = String(event.status || '').trim()
  const statusManual = !!event.statusManual
  let price = null
  if (event.price != null && event.price !== '') {
    const n = Math.round(Number(event.price) * 10) / 10
    if (Number.isFinite(n) && n >= 0) price = n
  }
  return {
    studentName: String(event.studentName || '').trim(),
    teacherName: String(event.teacherName || '').trim(),
    subjectId: String(event.subjectId || '').trim(),
    subjectName: String(event.subjectName || '').trim(),
    date: String(event.date || '').trim(),
    startTime: String(event.startTime || '').trim(),
    endTime: String(event.endTime || '').trim(),
    note: event.note == null || event.note === '' ? null : String(event.note).trim(),
    batchId: event.batchId == null || event.batchId === '' ? null : event.batchId,
    status: status || 'pending',
    statusManual,
    price
  }
}

function validate(fields) {
  if (
    !fields.studentName ||
    !fields.teacherName ||
    !fields.subjectId ||
    !fields.subjectName ||
    !fields.date ||
    !fields.startTime ||
    !fields.endTime
  ) {
    return false
  }
  return true
}

function shouldRemind(fields) {
  if (fields.statusManual && (fields.status === 'transferred' || fields.status === 'refunded' || fields.status === 'missed')) {
    return false
  }
  return true
}

/**
 * 入参: BookingUpsertInput
 * 出参: { code: 'OK', _id } | 错误 code
 */
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const payload = event || {}
  const fields = pickFields(payload)

  if (!validate(fields)) {
    return { code: 'INVALID_PARAM', message: '请完善必填项' }
  }

  const now = new Date().toISOString()
  const remindMinutes = normalizeRemindMinutes(payload.remindMinutesBefore)
  const remindAt = shouldRemind(fields)
    ? computeRemindAt(fields.date, fields.startTime, remindMinutes)
    : null

  try {
    if (payload._id) {
      const doc = await db.collection('bookings').doc(payload._id).get().catch(() => null)
      if (!doc || !doc.data) {
        return { code: 'NOT_FOUND', message: '记录不存在' }
      }
      if (doc.data._openid !== OPENID) {
        return { code: 'FORBIDDEN', message: '无权操作' }
      }

      const prev = doc.data
      const timeChanged =
        prev.date !== fields.date ||
        prev.startTime !== fields.startTime ||
        prev.remindAt !== remindAt
      const patch = {
        studentName: fields.studentName,
        teacherName: fields.teacherName,
        subjectId: fields.subjectId,
        subjectName: fields.subjectName,
        date: fields.date,
        startTime: fields.startTime,
        endTime: fields.endTime,
        note: fields.note,
        batchId: fields.batchId,
        status: fields.status,
        statusManual: fields.statusManual,
        price: fields.price,
        remindAt,
        updatedAt: now
      }
      if (timeChanged || !remindAt) {
        patch.remindSentAt = null
      }

      await db.collection('bookings').doc(payload._id).update({ data: patch })
      return { code: 'OK', _id: payload._id }
    }

    const res = await db.collection('bookings').add({
      data: {
        _openid: OPENID,
        studentName: fields.studentName,
        teacherName: fields.teacherName,
        subjectId: fields.subjectId,
        subjectName: fields.subjectName,
        date: fields.date,
        startTime: fields.startTime,
        endTime: fields.endTime,
        note: fields.note,
        batchId: fields.batchId,
        status: fields.status,
        statusManual: fields.statusManual,
        price: fields.price,
        remindAt,
        remindSentAt: null,
        createdAt: now,
        updatedAt: now
      }
    })
    return { code: 'OK', _id: res._id }
  } catch (e) {
    console.error('bookingUpsert', e)
    return { code: 'SYNC_FAILED', message: '同步失败，请重试' }
  }
}
