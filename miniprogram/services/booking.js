/**
 * 约课相关云函数门面 — 页面调这里，不直接拼云函数名
 */

const { callFunction } = require('../utils/request')
const { CLOUD_FUNCTIONS } = require('../utils/constants')
const { markBookingsDirty } = require('../utils/sync-flags')

/**
 * @param {{ start?: string, end?: string, _id?: string }} query
 * @param {{ silent?: boolean, title?: string }} [options]
 * @returns {Promise<{ list: Array }>}
 */
function listBookings(query, options) {
  return callFunction(CLOUD_FUNCTIONS.bookingList, query, options || {})
}

/**
 * @param {object} input BookingUpsertInput
 * @returns {Promise<{ code: string, _id: string }>}
 */
function upsertBooking(input) {
  return callFunction(CLOUD_FUNCTIONS.bookingUpsert, input, {
    title: '保存中'
  }).then((res) => {
    markBookingsDirty()
    return res
  })
}

/**
 * @param {string} _id
 * @returns {Promise<{ code: string, _id: string }>}
 */
function deleteBooking(_id) {
  return callFunction(CLOUD_FUNCTIONS.bookingDelete, { _id }, {
    title: '删除中'
  }).then((res) => {
    markBookingsDirty()
    return res
  })
}

/**
 * @param {{ batchId: string, items: Array }} payload
 * @returns {Promise<{ created: number, skipped: number, failed: number, failedItems?: Array }>}
 */
function batchCreateBookings(payload) {
  return callFunction(CLOUD_FUNCTIONS.bookingBatchCreate, payload, {
    title: '创建中'
  }).then((res) => {
    markBookingsDirty()
    return res
  })
}

/**
 * 清空当前用户云端全部约课
 * @returns {Promise<{ deleted: number }>}
 */
function clearAllBookings() {
  return callFunction(
    CLOUD_FUNCTIONS.bookingClearAll,
    { confirm: true },
    { title: '清空中' }
  ).then((res) => {
    markBookingsDirty()
    return res
  })
}

module.exports = {
  listBookings,
  upsertBooking,
  deleteBooking,
  batchCreateBookings,
  clearAllBookings
}
