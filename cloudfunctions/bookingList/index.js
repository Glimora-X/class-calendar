const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

/**
 * 入参: { start, end }
 * 出参: { list: BookingResponse[] }
 * 脚手架: 返回空列表（无 code = 成功）
 */
exports.main = async (event) => {
  // const { OPENID } = cloud.getWXContext()
  // TODO: where _openid + date range, orderBy date/startTime
  if (!event || !event.start || !event.end) {
    return { code: 'INVALID_PARAM', message: '缺少 start/end' }
  }
  return { list: [] }
}
