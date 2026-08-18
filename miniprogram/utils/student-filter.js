/**
 * 学员筛选：是否展示、过滤约课、构建 chips（纯函数）
 */

/**
 * @param {Array} students name_lists.students（对象或字符串）
 * @returns {boolean}
 */
function shouldShowStudentFilter(students) {
  return studentNameList(students).length >= 2
}

/**
 * @param {Array} students
 * @returns {string[]}
 */
function studentNameList(students) {
  const out = []
  const seen = Object.create(null)
  ;(students || []).forEach((s) => {
    const name = String(typeof s === 'string' ? s : (s && s.name) || '').trim()
    if (!name || seen[name]) return
    seen[name] = true
    out.push(name)
  })
  return out
}

/**
 * @param {Array<{ studentName?: string }>} bookings
 * @param {string} [studentName]
 * @returns {Array}
 */
function filterByStudent(bookings, studentName) {
  const key = String(studentName || '').trim()
  if (!key) return bookings || []
  return (bookings || []).filter((b) => String((b && b.studentName) || '').trim() === key)
}

/**
 * @param {Array} students
 * @param {string} [activeName] 空字符串表示「全部」
 * @returns {Array<{ id: string, label: string, active: boolean, variant?: string }>}
 */
function buildStudentChips(students, activeName) {
  const names = studentNameList(students)
  if (names.length < 2) return []
  const active = String(activeName || '').trim()
  const chips = [
    {
      id: 'all',
      label: '全部',
      active: !active,
      variant: 'student'
    }
  ]
  names.forEach((name) => {
    chips.push({
      id: name,
      label: name,
      active: active === name,
      variant: 'student'
    })
  })
  return chips
}

/**
 * 若记忆中的学员已不在名单中，回退为空（全部）
 * @param {string} stored
 * @param {Array} students
 * @returns {string}
 */
function resolveFilterStudent(stored, students) {
  const key = String(stored || '').trim()
  if (!key) return ''
  const names = studentNameList(students)
  return names.indexOf(key) >= 0 ? key : ''
}

/**
 * 轮换下一个学员筛选：全部 → 名1 → 名2 → … → 全部
 * 名单不足 2 人时保持原值
 * @param {Array} students
 * @param {string} [current]
 * @returns {string}
 */
function nextFilterStudent(students, current) {
  const names = studentNameList(students)
  if (names.length < 2) return String(current || '').trim()
  const key = String(current || '').trim()
  if (!key) return names[0]
  const idx = names.indexOf(key)
  if (idx < 0 || idx >= names.length - 1) return ''
  return names[idx + 1]
}

/**
 * @param {string} [filterStudent]
 * @returns {string}
 */
function studentFilterLabel(filterStudent) {
  const key = String(filterStudent || '').trim()
  return key || '全部'
}

module.exports = {
  shouldShowStudentFilter,
  studentNameList,
  filterByStudent,
  buildStudentChips,
  resolveFilterStudent,
  nextFilterStudent,
  studentFilterLabel
}
