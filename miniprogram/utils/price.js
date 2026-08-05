/**
 * 约课单价（元/节），最多 1 位小数
 */

/**
 * @param {unknown} raw
 * @returns {number|null} null 表示未填/无效
 */
function parsePriceInput(raw) {
  if (raw == null || raw === '') return null
  const s = String(raw)
    .trim()
    .replace(/[￥元]/g, '')
  if (!s) return null
  const n = Number(s)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 10) / 10
}

/**
 * @param {unknown} price
 * @returns {string} 输入框展示
 */
function formatPriceInput(price) {
  if (price == null || price === '') return ''
  const n = Number(price)
  if (!Number.isFinite(n)) return ''
  const rounded = Math.round(n * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : String(rounded)
}

/**
 * @param {Array|{name?:string,pricePerLesson?:unknown}} teachers
 * @param {string} name
 * @returns {number|null}
 */
function teacherDefaultPrice(teachers, name) {
  const key = String(name || '').trim()
  if (!key) return null
  const list = teachers || []
  for (let i = 0; i < list.length; i++) {
    const t = list[i]
    if (!t) continue
    if (typeof t === 'string') continue
    if (t.name === key) return parsePriceInput(t.pricePerLesson)
  }
  return null
}

/**
 * 换老师时是否用新默认价覆盖当前价：
 * 当前为空，或仍等于旧老师默认价（视为未手改）
 * @param {number|null} current
 * @param {number|null} oldDefault
 * @param {number|null} newDefault
 * @returns {number|null}
 */
function priceAfterTeacherChange(current, oldDefault, newDefault) {
  if (current == null) return newDefault
  if (oldDefault != null && current === oldDefault) return newDefault
  return current
}

module.exports = {
  parsePriceInput,
  formatPriceInput,
  teacherDefaultPrice,
  priceAfterTeacherChange
}
