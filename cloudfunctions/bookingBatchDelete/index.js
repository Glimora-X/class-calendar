const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const MAX_IDS = 100

/**
 * 批量删除当前用户约课（不动 day_holds）
 * 入参: { ids: string[] }
 * 出参: { code: 'OK', deleted, skipped, failed }
 */
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) {
    return { code: 'FORBIDDEN', message: '未识别用户' }
  }

  const raw = event && event.ids
  const ids = []
  ;(Array.isArray(raw) ? raw : []).forEach((id) => {
    const s = String(id == null ? '' : id).trim()
    if (s && ids.indexOf(s) === -1) ids.push(s)
  })
  if (!ids.length) {
    return { code: 'INVALID_PARAM', message: '请选择要删除的课程' }
  }
  if (ids.length > MAX_IDS) {
    return { code: 'INVALID_PARAM', message: `一次最多删除${MAX_IDS}节` }
  }

  let deleted = 0
  let skipped = 0
  let failed = 0
  try {
    for (let i = 0; i < ids.length; i++) {
      const _id = ids[i]
      try {
        const doc = await db.collection('bookings').doc(_id).get().catch(() => null)
        if (!doc || !doc.data) {
          skipped++
          continue
        }
        if (doc.data._openid !== OPENID) {
          skipped++
          continue
        }
        await db.collection('bookings').doc(_id).remove()
        deleted++
      } catch (e) {
        failed++
      }
    }
    return { code: 'OK', deleted, skipped, failed }
  } catch (e) {
    console.error('bookingBatchDelete', e)
    return {
      code: 'SYNC_FAILED',
      message: '删除失败，请重试',
      deleted,
      skipped,
      failed
    }
  }
}
