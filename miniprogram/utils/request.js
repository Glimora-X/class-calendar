/**
 * 云函数调用封装（契约 §1.3 — 已拍板）
 * code 存在且 !== 'OK' → reject；无 code → resolve
 */

const { ApiCode } = require('./errors')

/**
 * @param {string} name 云函数名
 * @param {object} [data]
 * @returns {Promise<object>}
 */
function callFunction(name, data = {}) {
  return new Promise((resolve, reject) => {
    if (!wx.cloud || typeof wx.cloud.callFunction !== 'function') {
      reject({
        code: ApiCode.SYNC_FAILED,
        message: '同步失败，请重试'
      })
      return
    }

    wx.cloud.callFunction({
      name,
      data,
      success(res) {
        const result = res && res.result
        if (result == null) {
          reject({
            code: ApiCode.SYNC_FAILED,
            message: '同步失败，请重试'
          })
          return
        }
        if (
          Object.prototype.hasOwnProperty.call(result, 'code') &&
          result.code !== ApiCode.OK
        ) {
          reject({
            code: result.code,
            message: result.message,
            result
          })
          return
        }
        resolve(result)
      },
      fail() {
        reject({
          code: ApiCode.SYNC_FAILED,
          message: '同步失败，请重试'
        })
      }
    })
  })
}

module.exports = {
  callFunction
}
