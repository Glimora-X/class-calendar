/**
 * 课前提醒（订阅消息 + 小程序内）
 */

const { startAtMs, resolveBookingStatus, BOOKING_STATUS } = require('./booking-status')
const { REMIND_MINUTES_BEFORE } = require('./constants')

function defaultRemindMinutes() {
  try {
    const { getRemindMinutesBefore } = require('./prefs')
    return getRemindMinutesBefore()
  } catch (e) {
    return REMIND_MINUTES_BEFORE
  }
}

/**
 * @param {string} date YYYY-MM-DD
 * @param {string} startTime HH:mm
 * @param {number} [minutesBefore]
 * @param {Date|number} [now]
 * @returns {string|null} ISO 字符串；开课已过则 null
 */
function computeRemindAt(date, startTime, minutesBefore, now) {
  const before =
    minutesBefore == null ? defaultRemindMinutes() : Number(minutesBefore)
  const start = startAtMs({ date, startTime })
  if (!Number.isFinite(start)) return null
  const t = now instanceof Date ? now.getTime() : Number(now || Date.now())
  if (start <= t) return null
  return new Date(start - before * 60 * 1000).toISOString()
}

/**
 * 待上且开课时刻在 windowMinutes 内（默认用设置的提前提醒分钟）
 * @param {Array} list
 * @param {Date|number} [now]
 * @param {number} [windowMinutes]
 * @returns {Array}
 */
function findImminentBookings(list, now, windowMinutes) {
  const win =
    windowMinutes == null ? defaultRemindMinutes() : Number(windowMinutes)
  const t = now instanceof Date ? now.getTime() : Number(now || Date.now())
  const end = t + win * 60 * 1000
  return (list || []).filter((b) => {
    if (resolveBookingStatus(b, t) !== BOOKING_STATUS.pending) return false
    const start = startAtMs(b)
    if (!Number.isFinite(start)) return false
    return start > t && start <= end
  })
}

function inAppToastKey(booking) {
  const id = (booking && booking._id) || 'x'
  const date = (booking && booking.date) || ''
  const start = (booking && booking.startTime) || ''
  return `remind:toast:${id}:${date}:${start}`
}

function hasShownInAppToast(key) {
  try {
    return !!wx.getStorageSync(key)
  } catch (e) {
    return false
  }
}

function markInAppToastShown(key) {
  try {
    wx.setStorageSync(key, 1)
  } catch (e) {
    /* ignore */
  }
}

/**
 * 在用户点击回调里同步调用（不要先 await 其它异步）
 * @param {string} tmplId
 * @param {{ onDone?: (info: { result: string, errCode?: number, errMsg?: string }) => void }} [options]
 */
function requestClassRemindSubscribe(tmplId, options) {
  const id = String(tmplId || '').trim()
  const onDone = options && options.onDone
  let settled = false
  const finish = (info) => {
    if (settled) return
    settled = true
    console.log('[subscribe] done', info)
    if (typeof onDone === 'function') onDone(info)
  }

  if (!id) {
    finish({ result: 'skip', errMsg: 'tmplId empty' })
    return
  }
  if (!wx.requestSubscribeMessage) {
    finish({ result: 'skip', errMsg: 'API unsupported' })
    return
  }

  let result = 'reject'
  let errCode
  let errMsg
  wx.requestSubscribeMessage({
    tmplIds: [id],
    success(res) {
      const st = res && res[id]
      console.log('[subscribe] success', id, st, res)
      if (st === 'accept') result = 'accept'
      else if (st === 'ban') result = 'ban'
      else if (st === 'filter') result = 'filter'
      else result = 'reject'
      errMsg = res && res.errMsg
    },
    fail(err) {
      console.warn('[subscribe] fail', err)
      result = 'fail'
      errCode = err && err.errCode
      errMsg = (err && (err.errMsg || err.message)) || 'requestSubscribeMessage fail'
    },
    complete() {
      finish({ result, errCode, errMsg })
    }
  })
}

/**
 * 把订阅失败原因转成可读说明
 * @param {{ result: string, errCode?: number, errMsg?: string }} info
 */
function explainSubscribeResult(info) {
  const r = (info && info.result) || ''
  if (r === 'accept') return '已授权微信课前提醒'
  if (r === 'reject') return '你拒绝了订阅，将收不到微信提醒'
  if (r === 'ban') return '订阅被关闭，请在小程序设置里打开「通知/订阅消息」'
  if (r === 'filter') return '模板被过滤（标题重名），请在公众平台检查模板'
  if (r === 'skip') return '未配置订阅模板'
  if (r === 'fail') {
    const code = info.errCode
    const msg = String((info && info.errMsg) || '')
    if (code === 20001) return '模板 ID 无效或不存在，请核对公众平台模板'
    if (code === 20004) return '你关闭了订阅消息总开关，请在小程序设置中打开'
    if (code === 10005 || /cannot show/i.test(msg)) {
      return '无法弹出订阅框（可能被 Toast/弹层挡住，请稍后再点）'
    }
    if (/last call has not ended/i.test(msg)) {
      return '上一次授权还没结束，请先点完微信弹窗，不要连点'
    }
    if (/tap gesture/i.test(msg)) {
      return '必须由你点击按钮才能调起订阅，请再点一次「授权微信提醒」'
    }
    return `订阅调起失败 ${code || ''} ${msg}`.trim()
  }
  return '订阅未完成'
}

module.exports = {
  REMIND_MINUTES_BEFORE,
  INAPP_WINDOW_MINUTES: REMIND_MINUTES_BEFORE,
  computeRemindAt,
  findImminentBookings,
  inAppToastKey,
  hasShownInAppToast,
  markInAppToastShown,
  requestClassRemindSubscribe,
  explainSubscribeResult
}
