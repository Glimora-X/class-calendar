/**
 * name-suggest 自定义事件解析。
 * 避免 PC 微信把原生 input 空事件误绑到姓名字段。
 */

/**
 * @param {unknown} detail
 * @returns {string|null} 可写回的姓名；null 表示忽略本次事件
 */
function resolveNameSuggestValue(detail) {
  if (detail == null || typeof detail !== 'object') return null
  if (!Object.prototype.hasOwnProperty.call(detail, 'value')) return null
  if (detail.value == null) return null
  return String(detail.value)
}

module.exports = {
  resolveNameSuggestValue
}
