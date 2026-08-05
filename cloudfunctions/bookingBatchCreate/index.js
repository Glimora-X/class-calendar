const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const DEFAULT_REMIND_MINUTES = 10

function normalizeRemindMinutes(raw) {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n)) return DEFAULT_REMIND_MINUTES
  return Math.min(120, Math.max(1, n))
}

/** 约课 date+time 按北京时间解释（云函数主机多为 UTC） */
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

/**
 * 入参: { batchId, items: BookingCreateInput[] }
 * 出参: { created, skipped, failed, failedItems }
 */
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const payload = event || {}
  const batchId = payload.batchId
  const items = payload.items
  const remindMinutes = normalizeRemindMinutes(payload.remindMinutesBefore)

  if (!batchId || !Array.isArray(items)) {
    return { code: 'INVALID_PARAM', message: '缺少 batchId/items' }
  }

  let created = 0
  let skipped = 0
  let failed = 0
  const failedItems = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i] || {}
    const row = {
      studentName: String(item.studentName || '').trim(),
      teacherName: String(item.teacherName || '').trim(),
      subjectId: String(item.subjectId || '').trim(),
      subjectName: String(item.subjectName || '').trim(),
      date: String(item.date || '').trim(),
      startTime: String(item.startTime || '').trim(),
      endTime: String(item.endTime || '').trim(),
      note: item.note == null || item.note === '' ? null : String(item.note).trim(),
      price: null
    }
    if (item.price != null && item.price !== '') {
      const n = Math.round(Number(item.price) * 10) / 10
      if (Number.isFinite(n) && n >= 0) row.price = n
    }

    if (
      !row.studentName ||
      !row.teacherName ||
      !row.subjectId ||
      !row.subjectName ||
      !row.date ||
      !row.startTime ||
      !row.endTime
    ) {
      failed++
      failedItems.push({ item: row, reason: '必填缺失' })
      continue
    }

    try {
      const exists = await db
        .collection('bookings')
        .where({
          _openid: OPENID,
          date: row.date,
          studentName: row.studentName,
          teacherName: row.teacherName,
          startTime: row.startTime
        })
        .count()
      if (exists.total > 0) {
        skipped++
        continue
      }

      const now = new Date().toISOString()
      const remindAt = computeRemindAt(row.date, row.startTime, remindMinutes)
      await db.collection('bookings').add({
        data: {
          _openid: OPENID,
          ...row,
          status: 'pending',
          statusManual: false,
          remindAt,
          remindSentAt: null,
          batchId,
          createdAt: now,
          updatedAt: now
        }
      })
      created++
    } catch (e) {
      failed++
      failedItems.push({
        item: row,
        reason: (e && e.message) || '写库失败'
      })
    }
  }

  return { created, skipped, failed, failedItems }
}
