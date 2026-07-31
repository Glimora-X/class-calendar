/**
 * 本地缓存（契约 §1.4）
 */

const { CACHE_KEYS } = require('./constants')

/**
 * @param {string} monthKey YYYY-MM
 * @param {Array} list BookingResponse[]
 */
function setMonthBookings(monthKey, list) {
  try {
    wx.setStorageSync(CACHE_KEYS.monthBookings(monthKey), list || [])
  } catch (e) {
    console.warn('[cache] setMonthBookings failed', e)
  }
}

/**
 * @param {string} monthKey
 * @returns {Array|null}
 */
function getMonthBookings(monthKey) {
  try {
    const data = wx.getStorageSync(CACHE_KEYS.monthBookings(monthKey))
    return Array.isArray(data) ? data : null
  } catch (e) {
    return null
  }
}

/**
 * @param {string} subjectId
 */
function setLastSubjectId(subjectId) {
  try {
    if (subjectId) wx.setStorageSync(CACHE_KEYS.lastSubjectId, subjectId)
  } catch (e) {
    console.warn('[cache] setLastSubjectId failed', e)
  }
}

/**
 * @returns {string|null}
 */
function getLastSubjectId() {
  try {
    return wx.getStorageSync(CACHE_KEYS.lastSubjectId) || null
  } catch (e) {
    return null
  }
}

/**
 * 退出登录：清本地约课与偏好，不清云端
 */
function clearAll() {
  try {
    const info = wx.getStorageInfoSync()
    const keys = (info && info.keys) || []
    keys.forEach((key) => {
      if (
        key.indexOf('bookings:') === 0 ||
        key === CACHE_KEYS.lastSubjectId ||
        key === CACHE_KEYS.nameLists
      ) {
        wx.removeStorageSync(key)
      }
    })
  } catch (e) {
    console.warn('[cache] clearAll failed', e)
  }
}

module.exports = {
  setMonthBookings,
  getMonthBookings,
  setLastSubjectId,
  getLastSubjectId,
  clearAll
}
