const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

/**
 * 入参: BookingUpsertInput
 * 出参: { code: 'OK', _id } | { code: ... }
 */
exports.main = async (event) => {
  return { code: 'NOT_IMPLEMENTED', message: 'bookingUpsert 待实现' }
}
