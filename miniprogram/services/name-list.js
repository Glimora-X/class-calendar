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
 * 将学员列表规范为姓名字符串（兼容旧 string[] 与对象数组）
 * @param {Array} list
 * @returns {string[]}
 */
function studentNames(list) {
  return (list || [])
    .map((s) => (typeof s === 'string' ? s : s && s.name))
    .map((n) => String(n || '').trim())
    .filter(Boolean)
}

/**
 * @param {{ silent?: boolean, title?: string, force?: boolean }} [options]
 * @returns {Promise<{ teachers: Array, students: Array }>}
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
 * @returns {Promise<{ teachers: Array, students: Array }>}
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

/**
 * 新增或更新老师档案
 * @param {{ fromName?: string, teacher: object }} payload
 * @returns {Promise<{ teachers: Array, students: Array }>}
 */
function updateTeacher(payload) {
  const body = payload || {}
  return callFunction(
    CLOUD_FUNCTIONS.nameList,
    {
      action: 'updateTeacher',
      fromName: body.fromName || '',
      teacher: body.teacher || {}
    },
    { title: '保存中' }
  ).then((res) => {
    writeMemory(res)
    return res
  })
}

/**
 * @param {string} name
 * @returns {Promise<{ teachers: Array, students: Array }>}
 */
function removeTeacher(name) {
  return callFunction(
    CLOUD_FUNCTIONS.nameList,
    { action: 'removeTeacher', name },
    { title: '删除中' }
  ).then((res) => {
    writeMemory(res)
    return res
  })
}

/**
 * 新增或更新学员档案
 * @param {{ fromName?: string, student: object }} payload
 * @returns {Promise<{ teachers: Array, students: Array }>}
 */
function updateStudent(payload) {
  const body = payload || {}
  return callFunction(
    CLOUD_FUNCTIONS.nameList,
    {
      action: 'updateStudent',
      fromName: body.fromName || '',
      student: body.student || {}
    },
    { title: '保存中' }
  ).then((res) => {
    writeMemory(res)
    return res
  })
}

/**
 * @param {string} name
 * @returns {Promise<{ teachers: Array, students: Array }>}
 */
function removeStudent(name) {
  return callFunction(
    CLOUD_FUNCTIONS.nameList,
    { action: 'removeStudent', name },
    { title: '删除中' }
  ).then((res) => {
    writeMemory(res)
    return res
  })
}

module.exports = {
  fetchNameList,
  appendName,
  updateTeacher,
  removeTeacher,
  updateStudent,
  removeStudent,
  studentNames,
  invalidateNameListCache
}
