const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/** where().remove 单次上限 */
const BATCH = 20
/** 安全上限，防止异常死循环 */
const MAX_ROUNDS = 500

/**
 * 清空当前用户全部约课（仅 bookings，不动 subjects / name_lists）
 * 入参: { confirm: true }
 * 出参: { code: 'OK', deleted: number }
 */
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) {
    return { code: 'FORBIDDEN', message: '未识别用户' }
  }
  if (!event || event.confirm !== true) {
    return { code: 'INVALID_PARAM', message: '请确认清空（confirm: true）' }
  }

  let deleted = 0
  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const res = await db
        .collection('bookings')
        .where({ _openid: OPENID })
        .limit(BATCH)
        .remove()
      const n = (res && res.stats && res.stats.removed) || 0
      deleted += n
      if (n < BATCH) break
    }
    return { code: 'OK', deleted }
  } catch (e) {
    console.error('bookingClearAll', e)
    return {
      code: 'SYNC_FAILED',
      message: '清空失败，请重试',
      deleted
    }
  }
}
