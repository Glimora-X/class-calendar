/**
 * 学员/老师联想门面
 */

const { callFunction } = require('../utils/request')
const { CLOUD_FUNCTIONS } = require('../utils/constants')

/**
 * @returns {Promise<{ teachers: Array, students: string[] }>}
 */
function fetchNameList() {
  return callFunction(CLOUD_FUNCTIONS.nameList, {})
}

/**
 * @param {'student'|'teacher'} type
 * @param {string} name
 * @returns {Promise<{ teachers: Array, students: string[] }>}
 */
function appendName(type, name) {
  return callFunction(CLOUD_FUNCTIONS.nameList, { type, name })
}

module.exports = {
  fetchNameList,
  appendName
}
