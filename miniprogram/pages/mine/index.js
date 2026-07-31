const { clearAll } = require('../../utils/cache')

Page({
  data: {
    version: '0.1.0-scaffold'
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
  },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '将清除本地缓存，云端数据保留。',
      success: (res) => {
        if (!res.confirm) return
        clearAll()
        wx.showToast({ title: '已清除本地缓存', icon: 'none' })
      }
    })
  },

  onAbout() {
    wx.showModal({
      title: '关于约课',
      content: '个人主体约课小程序。当前为 Soft UI 骨架 + API 契约。',
      showCancel: false
    })
  }
})
