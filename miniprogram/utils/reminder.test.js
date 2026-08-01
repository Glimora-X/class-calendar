/**
 * reminder 单元测试
 * node miniprogram/utils/reminder.test.js
 */
const assert = require('assert')
const { computeRemindAt, findImminentBookings } = require('./reminder')

const now = new Date(2026, 7, 1, 12, 0, 0) // 本地 2026-08-01 12:00

// 开课 21:00 → remindAt = 开课前 10 分钟
{
  const iso = computeRemindAt('2026-08-01', '21:00', 10, now)
  const expect = new Date(new Date('2026/08/01 21:00').getTime() - 10 * 60 * 1000).toISOString()
  assert.strictEqual(iso, expect)
}

// 已开课不设提醒
assert.strictEqual(computeRemindAt('2026-08-01', '11:00', 10, now), null)

{
  const list = [
    {
      _id: '1',
      date: '2026-08-01',
      startTime: '12:05',
      statusManual: false,
      studentName: 'A',
      teacherName: 'T'
    },
    {
      _id: '2',
      date: '2026-08-01',
      startTime: '15:00',
      statusManual: false
    },
    {
      _id: '3',
      date: '2026-08-01',
      startTime: '12:05',
      status: 'refunded',
      statusManual: true
    }
  ]
  const hit = findImminentBookings(list, now, 10)
  assert.strictEqual(hit.length, 1)
  assert.strictEqual(hit[0]._id, '1')
}

console.log('reminder tests passed')
