/**
 * 跨页同步标记：写约课后标脏，日历 onShow 再拉云
 */

function markBookingsDirty() {
  try {
    const app = getApp()
    if (app && app.globalData) app.globalData.bookingsDirty = true
  } catch (e) {
    /* ignore */
  }
}

/** @returns {boolean} 是否需要强制刷新 */
function consumeBookingsDirty() {
  try {
    const app = getApp()
    if (!app || !app.globalData) return false
    const dirty = !!app.globalData.bookingsDirty
    app.globalData.bookingsDirty = false
    return dirty
  } catch (e) {
    return false
  }
}

module.exports = {
  markBookingsDirty,
  consumeBookingsDirty
}
