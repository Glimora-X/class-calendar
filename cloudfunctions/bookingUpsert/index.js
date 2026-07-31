const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function pickFields(event) {
  return {
    studentName: String(event.studentName || '').trim(),
    teacherName: String(event.teacherName || '').trim(),
    subjectId: String(event.subjectId || '').trim(),
    subjectName: String(event.subjectName || '').trim(),
    date: String(event.date || '').trim(),
    startTime: String(event.startTime || '').trim(),
    endTime: String(event.endTime || '').trim(),
    note: event.note == null || event.note === '' ? null : String(event.note).trim(),
    batchId: event.batchId == null || event.batchId === '' ? null : event.batchId
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

  try {
    if (payload._id) {
      const doc = await db.collection('bookings').doc(payload._id).get().catch(() => null)
      if (!doc || !doc.data) {
        return { code: 'NOT_FOUND', message: '记录不存在' }
      }
      if (doc.data._openid !== OPENID) {
        return { code: 'FORBIDDEN', message: '无权操作' }
      }

      await db.collection('bookings').doc(payload._id).update({
        data: {
          studentName: fields.studentName,
          teacherName: fields.teacherName,
          subjectId: fields.subjectId,
          subjectName: fields.subjectName,
          date: fields.date,
          startTime: fields.startTime,
          endTime: fields.endTime,
          note: fields.note,
          batchId: fields.batchId,
          updatedAt: now
        }
      })
      return { code: 'OK', _id: payload._id }
    }

    const res = await db.collection('bookings').add({
      data: {
        studentName: fields.studentName,
        teacherName: fields.teacherName,
        subjectId: fields.subjectId,
        subjectName: fields.subjectName,
        date: fields.date,
        startTime: fields.startTime,
        endTime: fields.endTime,
        note: fields.note,
        batchId: fields.batchId,
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
