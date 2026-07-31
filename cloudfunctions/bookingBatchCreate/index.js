const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

/**
 * 入参: { batchId, items: BookingCreateInput[] }
 * 出参: { created, skipped, failed, failedItems? }
 */
exports.main = async (event) => {
  if (!event || !event.batchId || !Array.isArray(event.items)) {
    return { code: 'INVALID_PARAM', message: '缺少 batchId/items' }
  }
  return { created: 0, skipped: 0, failed: 0, failedItems: [] }
}
