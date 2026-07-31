/**
 * API 错误码与文案（契约 §1.2 / §1.3）
 */

const ApiCode = {
  OK: 'OK',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  INVALID_PARAM: 'INVALID_PARAM',
  SYNC_FAILED: 'SYNC_FAILED',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED'
}

const DEFAULT_MESSAGES = {
  [ApiCode.FORBIDDEN]: '无权操作',
  [ApiCode.NOT_FOUND]: '记录不存在',
  [ApiCode.INVALID_PARAM]: '参数有误',
  [ApiCode.SYNC_FAILED]: '同步失败，请重试',
  [ApiCode.NOT_IMPLEMENTED]: '功能开发中'
}

/**
 * @param {{ code?: string, message?: string }} err
 * @returns {string}
 */
function getErrorMessage(err) {
  if (!err) return DEFAULT_MESSAGES[ApiCode.SYNC_FAILED]
  if (err.message) return err.message
  if (err.code && DEFAULT_MESSAGES[err.code]) return DEFAULT_MESSAGES[err.code]
  return DEFAULT_MESSAGES[ApiCode.SYNC_FAILED]
}

/**
 * 页面层统一 toast；禁止再判断 result.code
 * @param {{ code?: string, message?: string }} err
 */
function showApiError(err) {
  wx.showToast({
    title: getErrorMessage(err),
    icon: 'none'
  })
}

module.exports = {
  ApiCode,
  getErrorMessage,
  showApiError
}
