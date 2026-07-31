const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 入参: { _id }
 * 出参: { code: 'OK', _id } | 错误 code
 */
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const _id = event && event._id
  if (!_id) {
    return { code: 'INVALID_PARAM', message: '缺少 _id' }
  }

  try {
    const doc = await db.collection('bookings').doc(_id).get().catch(() => null)
    if (!doc || !doc.data) {
      return { code: 'NOT_FOUND', message: '记录不存在' }
    }
    if (doc.data._openid !== OPENID) {
      return { code: 'FORBIDDEN', message: '无权操作' }
    }
    await db.collection('bookings').doc(_id).remove()
    return { code: 'OK', _id }
  } catch (e) {
    console.error('bookingDelete', e)
    return { code: 'SYNC_FAILED', message: '同步失败，请重试' }
  }
}
