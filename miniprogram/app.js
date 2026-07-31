App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上基础库以使用云能力')
      return
    }

    // 开通云开发后填写环境 ID，例如 'cloud1-xxxxx'
    // 步骤见 docs/CLOUD_SETUP.md；也可复制 config/env.example.js 对照
    const CLOUD_ENV_ID = 'cloud1-d3g0a0fxs458d1c61'

    const init = { traceUser: true }
    if (CLOUD_ENV_ID) init.env = CLOUD_ENV_ID
    wx.cloud.init(init)
  },
  globalData: {
    viewingYear: null,
    viewingMonth: null
  }
})
