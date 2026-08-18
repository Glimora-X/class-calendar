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
      this.getTabBar().setData({ selected: 2 })
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
      title: '清空全部课程？',
      content: '云端课程会全部删掉，回不来哦。科目、老师和学生名单还在。',
      confirmColor: '#ef4444',
      confirmText: '继续',
      success: (res) => {
        if (!res.confirm) return
        wx.showModal({
          title: '再确认一下',
          content: '真的清空全部课程吗？',
          confirmColor: '#ef4444',
          confirmText: '清空',
          success: async (res2) => {
            if (!res2.confirm) return
            try {
              const result = await clearAllBookings()
              clearAll()
              const n = (result && result.deleted) || 0
              wx.showToast({
                title: n ? `已删掉 ${n} 节` : '已清空',
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
      content: '只会清掉本机缓存，云端课程和设置都还在。下次打开会重新同步。',
      success: (res) => {
        if (!res.confirm) return
        clearAll()
        wx.showToast({ title: '本机缓存已清掉', icon: 'none', duration: 1200 })
        setTimeout(() => {
          wx.reLaunch({ url: '/pages/calendar/index' })
        }, 400)
      }
    })
  },

  onAbout() {
    wx.showModal({
      title: '关于小课记录本',
      content: '一本轻巧的家庭课表：记课、批量加课、课前提醒，打开就能看本月安排。',
      showCancel: false
    })
  }
})
