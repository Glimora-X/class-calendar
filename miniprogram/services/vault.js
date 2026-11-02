/**
 * 秘密基地云函数门面
 */

const { callFunction } = require('../utils/request')
const { CLOUD_FUNCTIONS } = require('../utils/constants')

function call(data, options) {
  return callFunction(CLOUD_FUNCTIONS.accountVault, data, options || { silent: true })
}

function loadVault() {
  return call({ action: 'load' }, { silent: true })
}

function saveAccount(input) {
  return call(Object.assign({ action: 'saveAccount' }, input || {}), { title: '保存中' })
}

function setAccountActive(id, isActive) {
  return call({ action: 'setActive', id, isActive }, { title: '处理中' })
}

function softDeleteAccount(id) {
  return call({ action: 'softDelete', id }, { title: '删除中' })
}

function undoDeleteAccount(id) {
  return call({ action: 'undoDelete', id }, { silent: true })
}

function reorderAccounts(type, orderedIds) {
  return call({ action: 'reorder', type, orderedIds }, { title: '保存中' })
}

function mergeAccounts(input) {
  return call(Object.assign({ action: 'merge' }, input || {}), { title: '合并中' })
}

function saveSnapshot(input) {
  return call(Object.assign({ action: 'saveSnapshot' }, input || {}), { title: '保存中' })
}

module.exports = {
  loadVault,
  saveAccount,
  setAccountActive,
  softDeleteAccount,
  undoDeleteAccount,
  reorderAccounts,
  mergeAccounts,
  saveSnapshot
}
