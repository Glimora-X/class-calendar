/**
 * 本地缓存（契约 §1.4）
 */

const { CACHE_KEYS } = require('./constants')

/** 月历云端数据认为「新鲜」的时长：期内 onShow 不重复拉取 */
const MONTH_CACHE_TTL_MS = 45 * 1000

/**
 * @param {string} monthKey YYYY-MM
 * @param {Array} list BookingResponse[]
 */
function setMonthBookings(monthKey, list) {
  try {
    wx.setStorageSync(CACHE_KEYS.monthBookings(monthKey), {
      list: list || [],
      fetchedAt: Date.now()
    })
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
    if (Array.isArray(data)) return data
    if (data && Array.isArray(data.list)) return data.list
    return null
  } catch (e) {
    return null
  }
}

/**
 * @param {string} monthKey
 * @param {number} [ttlMs]
 * @returns {boolean}
 */
function isMonthBookingsFresh(monthKey, ttlMs) {
  const ttl = ttlMs == null ? MONTH_CACHE_TTL_MS : ttlMs
  try {
    const data = wx.getStorageSync(CACHE_KEYS.monthBookings(monthKey))
    if (!data || Array.isArray(data) || !data.fetchedAt) return false
    return Date.now() - Number(data.fetchedAt) < ttl
  } catch (e) {
    return false
  }
}

/**
 * @param {string} monthKey YYYY-MM
 * @param {Array} list day hold rows
 */
function setMonthHolds(monthKey, list) {
  try {
    wx.setStorageSync(CACHE_KEYS.monthHolds(monthKey), {
      list: list || [],
      fetchedAt: Date.now()
    })
  } catch (e) {
    console.warn('[cache] setMonthHolds failed', e)
  }
}

/**
 * @param {string} monthKey
 * @returns {Array|null}
 */
function getMonthHolds(monthKey) {
  try {
    const data = wx.getStorageSync(CACHE_KEYS.monthHolds(monthKey))
    if (Array.isArray(data)) return data
    if (data && Array.isArray(data.list)) return data.list
    return null
  } catch (e) {
    return null
  }
}

/**
 * @param {string} monthKey
 * @param {number} [ttlMs]
 * @returns {boolean}
 */
function isMonthHoldsFresh(monthKey, ttlMs) {
  const ttl = ttlMs == null ? MONTH_CACHE_TTL_MS : ttlMs
  try {
    const data = wx.getStorageSync(CACHE_KEYS.monthHolds(monthKey))
    if (!data || Array.isArray(data) || !data.fetchedAt) return false
    return Date.now() - Number(data.fetchedAt) < ttl
  } catch (e) {
    return false
  }
}

/**
 * @param {object} payload nameList 云函数返回
 */
function setNameListsCache(payload) {
  try {
    wx.setStorageSync(CACHE_KEYS.nameLists, {
      data: payload || {},
      fetchedAt: Date.now()
    })
  } catch (e) {
    console.warn('[cache] setNameListsCache failed', e)
  }
}

/**
 * @param {number} [ttlMs]
 * @returns {object|null}
 */
function getNameListsCache(ttlMs) {
  const ttl = ttlMs == null ? 5 * 60 * 1000 : ttlMs
  try {
    const raw = wx.getStorageSync(CACHE_KEYS.nameLists)
    if (!raw || !raw.data || !raw.fetchedAt) return null
    if (Date.now() - Number(raw.fetchedAt) >= ttl) return null
    return raw.data
  } catch (e) {
    return null
  }
}

function clearNameListsCache() {
  try {
    wx.removeStorageSync(CACHE_KEYS.nameLists)
  } catch (e) {
    /* ignore */
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
 * 退出登录：清本地约课、偏好与提醒去重标记，不清云端
 */
function clearAll() {
  try {
    const info = wx.getStorageInfoSync()
    const keys = (info && info.keys) || []
    keys.forEach((key) => {
      if (
        key.indexOf('bookings:') === 0 ||
        key.indexOf('holds:') === 0 ||
        key.indexOf('remind:toast:') === 0 ||
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
  MONTH_CACHE_TTL_MS,
  setMonthBookings,
  getMonthBookings,
  isMonthBookingsFresh,
  setMonthHolds,
  getMonthHolds,
  isMonthHoldsFresh,
  setNameListsCache,
  getNameListsCache,
  clearNameListsCache,
  setLastSubjectId,
  getLastSubjectId,
  clearAll
}
