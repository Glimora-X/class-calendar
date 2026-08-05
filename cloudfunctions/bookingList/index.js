const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

/**
 * 入参: { start, end } | { _id }
 * 出参: { list: BookingResponse[] }
 */
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const payload = event || {}

  try {
    if (payload._id) {
      const doc = await db.collection('bookings').doc(payload._id).get()
      const data = doc && doc.data
      if (!data) return { code: 'NOT_FOUND', message: '记录不存在' }
      if (data._openid !== OPENID) return { code: 'FORBIDDEN', message: '无权操作' }
      return { list: [data] }
    }

    const { start, end } = payload
    if (!start || !end) {
      return { code: 'INVALID_PARAM', message: '缺少 start/end' }
    }

    const res = await db
      .collection('bookings')
      .where({
        _openid: OPENID,
        date: _.gte(start).and(_.lte(end))
      })
      .orderBy('date', 'asc')
      .orderBy('startTime', 'asc')
      .limit(1000)
      .get()

    return { list: res.data || [] }
  } catch (e) {
    console.error('bookingList', e)
    return { code: 'SYNC_FAILED', message: '同步失败，请重试' }
  }
}
