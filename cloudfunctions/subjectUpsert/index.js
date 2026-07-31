const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

/**
 * 入参: SubjectCreateInput { name }
 * 出参: { _id }
 */
exports.main = async (event) => {
  return { code: 'NOT_IMPLEMENTED', message: 'subjectUpsert 待实现' }
}
