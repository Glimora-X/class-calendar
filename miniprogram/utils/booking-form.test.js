/**
 * 编辑课程回填映射
 * 运行: node miniprogram/utils/booking-form.test.js
 */
const assert = require('assert')
const {
  normalizeDate,
  normalizeTime,
  pickBookingFromList,
  bookingToEditForm
} = require('./booking-form')

assert.strictEqual(normalizeDate('2026-08-07'), '2026-08-07')
assert.strictEqual(normalizeDate('2026-08-07T16:00:00.000Z'), '2026-08-07')
assert.strictEqual(normalizeDate('2026/8/7'), '2026-08-07')
assert.strictEqual(normalizeDate(''), '')

assert.strictEqual(normalizeTime('21:30'), '21:30')
assert.strictEqual(normalizeTime('21:30:00'), '21:30')
assert.strictEqual(normalizeTime('9:05'), '09:05')
assert.strictEqual(normalizeTime(''), '')

const rows = [
  { _id: 'a', studentName: '小雨', startTime: '08:00' },
  { _id: 'b', studentName: '小明', startTime: '21:30' }
]
assert.strictEqual(pickBookingFromList(rows, 'b').studentName, '小明')
assert.strictEqual(pickBookingFromList(rows, 'missing'), null)
assert.strictEqual(pickBookingFromList([rows[1]], 'b')._id, 'b')
assert.strictEqual(
  pickBookingFromList([{ studentName: '仅一条' }], 'any').studentName,
  '仅一条'
)

const teachers = [{ name: '乔姐', pricePerLesson: 90 }]
const subjects = [{ _id: 'sub-math', name: '数学' }]

{
  const form = bookingToEditForm(
    {
      _id: 'bk1',
      studentName: '小雨',
      teacherName: '乔姐',
      subjectId: 'sub-math',
      subjectName: '',
      date: '2026-08-07T00:00:00.000Z',
      startTime: '21:30:00',
      endTime: '21:55:00',
      note: '带书',
      price: null,
      status: 'pending',
      statusManual: false
    },
    { subjects, teachers }
  )
  assert.strictEqual(form.studentName, '小雨')
  assert.strictEqual(form.teacherName, '乔姐')
  assert.strictEqual(form.subjectId, 'sub-math')
  assert.strictEqual(form.subjectName, '数学')
  assert.strictEqual(form.date, '2026-08-07')
  assert.strictEqual(form.startTime, '21:30')
  assert.strictEqual(form.endTime, '21:55')
  assert.strictEqual(form.note, '带书')
  assert.strictEqual(form.price, 90)
  assert.strictEqual(form.priceText, '90')
}

{
  const form = bookingToEditForm(
    {
      _id: 'bk2',
      studentName: '小明',
      teacherName: '乔姐',
      subjectId: 'sub-en',
      subjectName: '英语',
      date: '2026-08-08',
      startTime: '10:00',
      endTime: '10:25',
      price: 120
    },
    { subjects, teachers }
  )
  assert.strictEqual(form.subjectName, '英语')
  assert.strictEqual(form.price, 120)
  assert.strictEqual(form.priceText, '120')
}

{
  const form = bookingToEditForm(
    { _id: 'bk3', studentName: '空科目' },
    { subjects: [], teachers: [] }
  )
  assert.strictEqual(form.subjectName, '')
  assert.strictEqual(form.date, '')
  assert.strictEqual(form.startTime, '')
  assert.strictEqual(form.endTime, '')
  assert.strictEqual(form.priceText, '')
}

console.log('booking-form tests passed')
