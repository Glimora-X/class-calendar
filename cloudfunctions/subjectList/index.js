const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

/**
 * 入参: {}
 * 出参: { list }
 * 正式实现: 空档自动创建「英语」
 * 脚手架: 返回内存默认项，方便表单联调（上线前改为写库）
 */
exports.main = async () => {
  return {
    list: [{ _id: 'local-default-english', name: '英语' }]
  }
}
