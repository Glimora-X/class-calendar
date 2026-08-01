const { SUBSCRIBE_TMPL_ID } = require('./constants')

/**
 * 读取本地 env 配置（可选）
 */
function loadEnv() {
  try {
    return require('../config/env.js')
  } catch (e) {
    return {}
  }
}

function getSubscribeTmplId() {
  const env = loadEnv()
  return String((env && env.subscribeTmplId) || SUBSCRIBE_TMPL_ID || '').trim()
}

module.exports = {
  loadEnv,
  getSubscribeTmplId
}
