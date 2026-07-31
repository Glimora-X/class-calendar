const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

/**
 * 入参: {} | { type, name }
 * 出参: { teachers, students }
 */
exports.main = async (event) => {
  return { teachers: [], students: [] }
}
