/**
 * 理财持仓云函数门面 — 页面调这里，不直接拼云函数名
 */

const { callFunction } = require('../utils/request')
const { CLOUD_FUNCTIONS } = require('../utils/constants')

function listHoldings(query, options) {
  return callFunction(CLOUD_FUNCTIONS.holdingList, query || {}, options || {})
}

function getHolding(_id, options) {
  return callFunction(
    CLOUD_FUNCTIONS.holdingList,
    { _id },
    options || {}
  )
}

function upsertHolding(input) {
  return callFunction(CLOUD_FUNCTIONS.holdingUpsert, input || {}, {
    title: '保存中'
  })
}

function deleteHolding(_id) {
  return callFunction(
    CLOUD_FUNCTIONS.holdingDelete,
    { _id },
    { title: '删除中' }
  )
}

function setHoldingStatus(input) {
  return callFunction(CLOUD_FUNCTIONS.holdingStatus, input || {}, {
    title: '处理中'
  })
}

function upsertDaily(input) {
  return callFunction(
    CLOUD_FUNCTIONS.holdingFlow,
    Object.assign({ action: 'dailyUpsert' }, input || {}),
    { title: '保存中' }
  )
}

function removeDaily(input) {
  return callFunction(
    CLOUD_FUNCTIONS.holdingFlow,
    Object.assign({ action: 'dailyRemove' }, input || {}),
    { title: '删除中' }
  )
}

function batchCashflow(input) {
  return callFunction(
    CLOUD_FUNCTIONS.holdingFlow,
    Object.assign({ action: 'cashflowBatch' }, input || {}),
    { title: '保存中' }
  )
}

function removeCashflow(input) {
  return callFunction(
    CLOUD_FUNCTIONS.holdingFlow,
    Object.assign({ action: 'cashflowRemove' }, input || {}),
    { title: '删除中' }
  )
}

function listCatalog(options) {
  return callFunction(
    CLOUD_FUNCTIONS.financeCatalog,
    { action: 'list' },
    options || {}
  )
}

function catalogAdd(field, value) {
  return callFunction(
    CLOUD_FUNCTIONS.financeCatalog,
    { action: 'add', field, value },
    { title: '保存中' }
  )
}

function catalogUpdate(field, index, value) {
  return callFunction(
    CLOUD_FUNCTIONS.financeCatalog,
    { action: 'update', field, index, value },
    { title: '保存中' }
  )
}

function catalogRemove(field, index) {
  return callFunction(
    CLOUD_FUNCTIONS.financeCatalog,
    { action: 'remove', field, index },
    { title: '删除中' }
  )
}

module.exports = {
  listHoldings,
  getHolding,
  upsertHolding,
  deleteHolding,
  setHoldingStatus,
  upsertDaily,
  removeDaily,
  batchCashflow,
  removeCashflow,
  listCatalog,
  catalogAdd,
  catalogUpdate,
  catalogRemove
}
