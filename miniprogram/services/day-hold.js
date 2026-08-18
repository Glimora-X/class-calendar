/**
 * 其他安排（占用日）云函数门面
 */

const { callFunction } = require('../utils/request')
const { CLOUD_FUNCTIONS } = require('../utils/constants')

/**
 * @param {{ start: string, end: string }} query
 * @param {{ silent?: boolean, title?: string }} [options]
 * @returns {Promise<{ list: Array<{ _id: string, date: string, reason: string }> }>}
 */
function listDayHolds(query, options) {
  return callFunction(
    CLOUD_FUNCTIONS.dayHold,
    Object.assign({ action: 'list' }, query || {}),
    options || {}
  )
}

/**
 * @param {{ date: string, reason: string }} input
 * @returns {Promise<{ code: string, _id: string, date: string, reason: string }>}
 */
function upsertDayHold(input) {
  return callFunction(
    CLOUD_FUNCTIONS.dayHold,
    Object.assign({ action: 'upsert' }, input || {}),
    { title: '保存中' }
  )
}

/**
 * @param {{ date?: string, _id?: string }} input
 * @returns {Promise<object>}
 */
function removeDayHold(input) {
  return callFunction(
    CLOUD_FUNCTIONS.dayHold,
    Object.assign({ action: 'remove' }, input || {}),
    { title: '取消中' }
  )
}

module.exports = {
  listDayHolds,
  upsertDayHold,
  removeDayHold
}
