const assert = require('assert')
const {
  shouldShowStudentFilter,
  studentNameList,
  filterByStudent,
  buildStudentChips,
  resolveFilterStudent,
  nextFilterStudent,
  studentFilterLabel
} = require('./student-filter')

assert.strictEqual(shouldShowStudentFilter([]), false)
assert.strictEqual(shouldShowStudentFilter([{ name: '小雨' }]), false)
assert.strictEqual(shouldShowStudentFilter([{ name: '小雨' }, { name: '小宇' }]), true)
assert.strictEqual(shouldShowStudentFilter(['小雨', '小宇']), true)

assert.deepStrictEqual(studentNameList([{ name: '小雨' }, '小宇', { name: '小雨' }, '']), [
  '小雨',
  '小宇'
])
assert.deepStrictEqual(studentNameList(null), [])

const bookings = [
  { studentName: '小雨', teacherName: 'A' },
  { studentName: '小宇', teacherName: 'B' },
  { studentName: '小雨', teacherName: 'C' }
]
assert.strictEqual(filterByStudent(bookings, '').length, 3)
assert.strictEqual(filterByStudent(bookings, null).length, 3)
assert.deepStrictEqual(
  filterByStudent(bookings, '小雨').map((b) => b.teacherName),
  ['A', 'C']
)
assert.deepStrictEqual(filterByStudent([], '小雨'), [])

assert.deepStrictEqual(buildStudentChips([{ name: '小雨' }], ''), [])
assert.deepStrictEqual(buildStudentChips([], '小雨'), [])

const chipsAll = buildStudentChips(['小雨', '小宇'], '')
assert.strictEqual(chipsAll.length, 3)
assert.strictEqual(chipsAll[0].id, 'all')
assert.strictEqual(chipsAll[0].active, true)
assert.strictEqual(chipsAll[1].label, '小雨')
assert.strictEqual(chipsAll[1].active, false)

const chipsOne = buildStudentChips(['小雨', '小宇'], '小宇')
assert.strictEqual(chipsOne[0].active, false)
assert.strictEqual(chipsOne[2].active, true)
assert.strictEqual(chipsOne[2].id, '小宇')

assert.strictEqual(resolveFilterStudent('小雨', ['小雨', '小宇']), '小雨')
assert.strictEqual(resolveFilterStudent('已删', ['小雨', '小宇']), '')
assert.strictEqual(resolveFilterStudent('', ['小雨', '小宇']), '')

assert.strictEqual(nextFilterStudent(['小雨'], ''), '')
assert.strictEqual(nextFilterStudent(['小雨', '小宇'], ''), '小雨')
assert.strictEqual(nextFilterStudent(['小雨', '小宇'], '小雨'), '小宇')
assert.strictEqual(nextFilterStudent(['小雨', '小宇'], '小宇'), '')
assert.strictEqual(nextFilterStudent(['小雨', '小宇', '小安'], '小宇'), '小安')
assert.strictEqual(studentFilterLabel(''), '全部')
assert.strictEqual(studentFilterLabel('小雨'), '小雨')

console.log('student-filter.test.js OK')
