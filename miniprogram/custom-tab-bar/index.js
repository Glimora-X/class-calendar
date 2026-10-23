Component({
  data: {
    selected: 0,
    list: [
      {
        pagePath: '/pages/booking/calendar/index',
        text: '约课',
        icon: 'calendar'
      },
      {
        pagePath: '/pages/finance/assets/index',
        text: '资产',
        icon: 'assets'
      },
      {
        pagePath: '/pages/finance/invest/index',
        text: '理财',
        icon: 'invest'
      },
      {
        pagePath: '/pages/booking/mine/index',
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
    }
  }
})
