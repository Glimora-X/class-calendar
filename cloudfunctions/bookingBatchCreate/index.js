const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 入参: { batchId, items: BookingCreateInput[] }
 * 出参: { created, skipped, failed, failedItems }
 */
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const payload = event || {}
  const batchId = payload.batchId
  const items = payload.items

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
      note: item.note == null || item.note === '' ? null : String(item.note).trim()
    }

    if (
      !row.studentName ||
      !row.teacherName ||
      !row.subjectId ||
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
      await db.collection('bookings').add({
        data: {
          ...row,
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
