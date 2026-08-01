/**
 * 云函数调用封装（契约 §1.3 — 已拍板）
 * code 存在且 !== 'OK' → reject；无 code → resolve
 * 默认带全局 loading；options.silent 可关闭
 */

const { ApiCode } = require('./errors')

let loadingCount = 0

function beginLoading(title) {
  loadingCount += 1
  if (loadingCount === 1) {
    wx.showLoading({
      title: title || '加载中',
      mask: true
    })
  }
}

function endLoading() {
  if (loadingCount <= 0) return
  loadingCount -= 1
  if (loadingCount === 0) {
    wx.hideLoading()
  }
}

/**
 * @param {string} name 云函数名
 * @param {object} [data]
 * @param {{ silent?: boolean, title?: string }} [options]
 * @returns {Promise<object>}
 */
function callFunction(name, data = {}, options = {}) {
  const silent = !!(options && options.silent)
  const title = (options && options.title) || '加载中'

  if (!silent) beginLoading(title)

  const wrap = new Promise((resolve, reject) => {
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

  return wrap.then(
    (value) => {
      if (!silent) endLoading()
      return value
    },
    (err) => {
      if (!silent) endLoading()
      return Promise.reject(err)
    }
  )
}

module.exports = {
  callFunction
}
