const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const DEFAULT_SUBJECT = '英语'

/**
 * 入参: {}
 * 出参: { list }
 * 档案为空时自动创建「英语」
 */
exports.main = async () => {
  const { OPENID } = cloud.getWXContext()

  try {
    const res = await db.collection('subjects').where({ _openid: OPENID }).limit(100).get()
    if (res.data && res.data.length > 0) {
      return {
        list: res.data.map((s) => ({
          _id: s._id,
          name: s.name,
          createdAt: s.createdAt
        }))
      }
    }

    const now = new Date().toISOString()
    const add = await db.collection('subjects').add({
      data: { _openid: OPENID, name: DEFAULT_SUBJECT, createdAt: now }
    })
    return {
      list: [{ _id: add._id, name: DEFAULT_SUBJECT, createdAt: now }]
    }
  } catch (e) {
    console.error('subjectList', e)
    return { code: 'SYNC_FAILED', message: '同步失败，请重试' }
  }
}
