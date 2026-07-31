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
      wx.navigateTo({ url: '/pages/booking-edit/index' })
    }
  }
})
