const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 入参: {} | { _id } | { status }
 * 出参: { list } | { holding }
 */
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const payload = event || {}
  const col = db.collection('finance_holdings')

  try {
    if (payload._id) {
      const doc = await col.doc(payload._id).get().catch(() => null)
      const data = doc && doc.data
      if (!data) return { code: 'NOT_FOUND', message: '记录不存在' }
      if (data._openid !== OPENID) return { code: 'FORBIDDEN', message: '无权操作' }
      return { holding: data }
    }

    const where = { _openid: OPENID }
    if (payload.status) where.status = String(payload.status)

    const res = await col.where(where).limit(200).get()
    const list = (res.data || []).slice().sort((a, b) => {
      const ta = a.updatedAt || a.createdAt || ''
      const tb = b.updatedAt || b.createdAt || ''
      return ta < tb ? 1 : ta > tb ? -1 : 0
    })
    return { list }
  } catch (e) {
    console.error('holdingList', e)
    return { code: 'SYNC_FAILED', message: '同步失败，请重试' }
  }
}
