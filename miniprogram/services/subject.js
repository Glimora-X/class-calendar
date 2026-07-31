/**
 * 科目档案云函数门面
 */

const { callFunction } = require('../utils/request')
const { CLOUD_FUNCTIONS } = require('../utils/constants')

/**
 * @returns {Promise<{ list: Array }>}
 */
function listSubjects() {
  return callFunction(CLOUD_FUNCTIONS.subjectList, {})
}

/**
 * @param {string} name
 * @returns {Promise<{ _id: string }>}
 */
function upsertSubject(name) {
  return callFunction(CLOUD_FUNCTIONS.subjectUpsert, { name })
}

module.exports = {
  listSubjects,
  upsertSubject
}
