/**
 * 学员/老师联想门面（带短缓存，减少重复云调用）
 */

const { callFunction } = require('../utils/request')
const { CLOUD_FUNCTIONS } = require('../utils/constants')
const {
  getNameListsCache,
  setNameListsCache,
  clearNameListsCache
} = require('../utils/cache')

const MEMORY_TTL_MS = 5 * 60 * 1000

let memoryPayload = null
let memoryAt = 0

function readMemory() {
  if (memoryPayload && Date.now() - memoryAt < MEMORY_TTL_MS) {
    return memoryPayload
  }
  return null
}

function writeMemory(payload) {
  memoryPayload = payload || { teachers: [], students: [] }
  memoryAt = Date.now()
  setNameListsCache(memoryPayload)
}

function invalidateNameListCache() {
  memoryPayload = null
  memoryAt = 0
  clearNameListsCache()
}

/**
 * @param {{ silent?: boolean, title?: string, force?: boolean }} [options]
 * @returns {Promise<{ teachers: Array, students: string[] }>}
 */
function fetchNameList(options) {
  const opts = options || {}
  if (!opts.force) {
    const mem = readMemory()
    if (mem) return Promise.resolve(mem)
    const stored = getNameListsCache(MEMORY_TTL_MS)
    if (stored) {
      writeMemory(stored)
      return Promise.resolve(stored)
    }
  }

  return callFunction(CLOUD_FUNCTIONS.nameList, {}, opts).then((res) => {
    writeMemory(res)
    return res
  })
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
  ).then((res) => {
    writeMemory(res)
    return res
  })
}

module.exports = {
  fetchNameList,
  appendName,
  invalidateNameListCache
}
