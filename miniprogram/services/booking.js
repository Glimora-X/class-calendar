/**
 * 约课相关云函数门面 — 页面调这里，不直接拼云函数名
 */

const { callFunction } = require('../utils/request')
const { CLOUD_FUNCTIONS } = require('../utils/constants')

/**
 * @param {{ start: string, end: string }} range
 * @returns {Promise<{ list: Array }>}
 */
function listBookings(range) {
  return callFunction(CLOUD_FUNCTIONS.bookingList, range)
}

/**
 * @param {object} input BookingUpsertInput
 * @returns {Promise<{ code: string, _id: string }>}
 */
function upsertBooking(input) {
  return callFunction(CLOUD_FUNCTIONS.bookingUpsert, input)
}

/**
 * @param {string} _id
 * @returns {Promise<{ code: string, _id: string }>}
 */
function deleteBooking(_id) {
  return callFunction(CLOUD_FUNCTIONS.bookingDelete, { _id })
}

/**
 * @param {{ batchId: string, items: Array }} payload
 * @returns {Promise<{ created: number, skipped: number, failed: number, failedItems?: Array }>}
 */
function batchCreateBookings(payload) {
  return callFunction(CLOUD_FUNCTIONS.bookingBatchCreate, payload)
}

module.exports = {
  listBookings,
  upsertBooking,
  deleteBooking,
  batchCreateBookings
}
