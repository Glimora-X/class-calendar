/**
 * 学员/老师联想门面
 */

const { callFunction } = require('../utils/request')
const { CLOUD_FUNCTIONS } = require('../utils/constants')

/**
 * @param {{ silent?: boolean, title?: string }} [options]
 * @returns {Promise<{ teachers: Array, students: string[] }>}
 */
function fetchNameList(options) {
  return callFunction(CLOUD_FUNCTIONS.nameList, {}, options || {})
}

/**
 * @param {'student'|'teacher'} type
 * @param {string} name
 * @returns {Promise<{ teachers: Array, students: string[] }>}
 */
function appendName(type, name) {
  return callFunction(
    CLOUD_FUNCTIONS.nameList,
    { type, name },
    { silent: true }
  )
}

module.exports = {
  fetchNameList,
  appendName
}
