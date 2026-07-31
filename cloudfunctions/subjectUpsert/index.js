const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 入参: { name }
 * 出参: { _id } | 错误 code
 */
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const name = String((event && event.name) || '').trim()
  if (!name) {
    return { code: 'INVALID_PARAM', message: '科目名不能为空' }
  }

  try {
    const exists = await db
      .collection('subjects')
      .where({ _openid: OPENID, name })
      .limit(1)
      .get()
    if (exists.data && exists.data.length > 0) {
      return { _id: exists.data[0]._id }
    }

    const res = await db.collection('subjects').add({
      data: { name, createdAt: new Date().toISOString() }
    })
    return { _id: res._id }
  } catch (e) {
    console.error('subjectUpsert', e)
    return { code: 'SYNC_FAILED', message: '同步失败，请重试' }
  }
}
