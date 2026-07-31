App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上基础库以使用云能力')
      return
    }
    wx.cloud.init({
      // 在微信开发者工具中配置云环境后替换 env
      // env: 'your-env-id',
      traceUser: true
    })
  },
  globalData: {
    viewingYear: null,
    viewingMonth: null
  }
})
