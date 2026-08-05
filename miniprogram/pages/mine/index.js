const { clearAll } = require('../../utils/cache')
const {
  DURATION_OPTIONS,
  REMIND_OPTIONS,
  getSettings,
  setSettings,
  durationOptionIndex,
  remindOptionIndex
} = require('../../utils/prefs')
const { clearAllBookings } = require('../../services/booking')
const { showWriteError } = require('../../utils/errors')

Page({
  data: {
    version: '0.1.0',
    durationOptions: DURATION_OPTIONS,
    remindOptions: REMIND_OPTIONS,
    durationLabels: DURATION_OPTIONS.map((m) => `${m} 分钟`),
    remindLabels: REMIND_OPTIONS.map((m) => `${m} 分钟`),
    durationIndex: 0,
    remindIndex: 0,
    durationLabel: '25 分钟',
    remindLabel: '10 分钟'
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
    this.syncPrefsUi()
  },

  syncPrefsUi() {
    const s = getSettings()
    const durationIndex = durationOptionIndex(s.classDurationMinutes)
    const remindIndex = remindOptionIndex(s.remindMinutesBefore)
    this.setData({
      durationIndex,
      remindIndex,
      durationLabel: `${DURATION_OPTIONS[durationIndex]} 分钟`,
      remindLabel: `${REMIND_OPTIONS[remindIndex]} 分钟`
    })
  },

  onDurationChange(e) {
    const idx = Number(e.detail.value)
    const minutes = DURATION_OPTIONS[idx]
    if (!minutes) return
    setSettings({ classDurationMinutes: minutes })
    this.setData({
      durationIndex: idx,
      durationLabel: `${minutes} 分钟`
    })
    wx.showToast({ title: '已保存', icon: 'success' })
  },

  onRemindChange(e) {
    const idx = Number(e.detail.value)
    const minutes = REMIND_OPTIONS[idx]
    if (!minutes) return
    setSettings({ remindMinutesBefore: minutes })
    this.setData({
      remindIndex: idx,
      remindLabel: `${minutes} 分钟`
    })
    wx.showToast({ title: '已保存', icon: 'success' })
  },

  onBatch() {
    wx.navigateTo({ url: '/pages/booking-batch/index' })
  },

  onTeachers() {
    wx.navigateTo({ url: '/pages/teacher-list/index' })
  },

  onStudents() {
    wx.navigateTo({ url: '/pages/student-list/index' })
  },

  onCopyMonth() {
    wx.navigateTo({ url: '/pages/booking-copy-month/index' })
  },

  onClearBookings() {
    wx.showModal({
      title: '清空全部约课？',
      content: '将永久删除云端属于你的全部约课记录，科目与老师/学员名列表保留。此操作不可恢复。',
      confirmColor: '#ef4444',
      confirmText: '继续',
      success: (res) => {
        if (!res.confirm) return
        wx.showModal({
          title: '再次确认',
          content: '确定清空全部约课？',
          confirmColor: '#ef4444',
          confirmText: '清空',
          success: async (res2) => {
            if (!res2.confirm) return
            try {
              const result = await clearAllBookings()
              clearAll()
              const n = (result && result.deleted) || 0
              wx.showToast({
                title: n ? `已删除 ${n} 条` : '已清空',
                icon: 'none',
                duration: 2000
              })
              setTimeout(() => {
                wx.reLaunch({ url: '/pages/calendar/index' })
              }, 500)
            } catch (err) {
              showWriteError(err)
            }
          }
        })
      }
    })
  },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '将清除本地约课缓存，云端数据与上方设置项保留。再次打开日历会从云端重新同步。',
      success: (res) => {
        if (!res.confirm) return
        clearAll()
        wx.showToast({ title: '已清除本地缓存', icon: 'none', duration: 1200 })
        setTimeout(() => {
          wx.reLaunch({ url: '/pages/calendar/index' })
        }, 400)
      }
    })
  },

  onAbout() {
    wx.showModal({
      title: '关于约课',
      content: '个人主体约课小程序：月历约课、批量创建、课前提醒。',
      showCancel: false
    })
  }
})
