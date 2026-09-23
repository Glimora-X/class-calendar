Component({
  data: {
    selected: 0,
    list: [
      {
        pagePath: '/pages/calendar/index',
        text: '日历',
        icon: 'calendar'
      },
      {
        pagePath: '/pages/overview/index',
        text: '概览',
        icon: 'overview'
      },
      {
        pagePath: '/pages/mine/index',
        text: '我的',
        icon: 'mine'
      }
    ]
  },
  methods: {
    switchTab(e) {
      const index = Number(e.currentTarget.dataset.index)
      const path = this.data.list[index].pagePath
      wx.switchTab({ url: path })
      this.setData({ selected: index })
    },
    onFab() {
      const { buildBookingEditUrl, resolveCreateBookingDate } = require('../utils/booking-edit-nav')
      let date = ''
      let studentName = ''
      try {
        const pages = getCurrentPages()
        date = resolveCreateBookingDate(pages[pages.length - 1])
      } catch (e) {
        /* ignore */
      }
      try {
        const { getFilterStudent } = require('../utils/prefs')
        studentName = getFilterStudent()
      } catch (e) {
        /* ignore */
      }
      wx.navigateTo({ url: buildBookingEditUrl({ date, studentName }) })
    }
  }
})
