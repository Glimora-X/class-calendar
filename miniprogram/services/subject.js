/**
 * 科目档案云函数门面（带短缓存）
 */

const { callFunction } = require('../utils/request')
const { CLOUD_FUNCTIONS } = require('../utils/constants')

const MEMORY_TTL_MS = 5 * 60 * 1000

let memoryList = null
let memoryAt = 0

function readMemory() {
  if (memoryList && Date.now() - memoryAt < MEMORY_TTL_MS) {
    return memoryList
  }
  return null
}

function writeMemory(list) {
  if (list && Array.isArray(list.list)) {
    memoryList = list
  } else if (Array.isArray(list)) {
    memoryList = { list }
  } else {
    memoryList = { list: [] }
  }
  memoryAt = Date.now()
}

function invalidateSubjectCache() {
  memoryList = null
  memoryAt = 0
}

/**
 * @param {{ force?: boolean, silent?: boolean }} [options]
 * @returns {Promise<{ list: Array }>}
 */
function listSubjects(options) {
  const opts = options || {}
  if (!opts.force) {
    const mem = readMemory()
    if (mem) return Promise.resolve(mem)
  }
  return callFunction(CLOUD_FUNCTIONS.subjectList, {}, opts).then((res) => {
    writeMemory(res)
    return res
  })
}

/**
 * @param {string} name
 * @returns {Promise<{ _id: string }>}
 */
function upsertSubject(name) {
  return callFunction(CLOUD_FUNCTIONS.subjectUpsert, { name }).then((res) => {
    invalidateSubjectCache()
    return res
  })
}

module.exports = {
  listSubjects,
  upsertSubject,
  invalidateSubjectCache
}
