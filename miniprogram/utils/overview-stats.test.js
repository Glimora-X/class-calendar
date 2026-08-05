/**
 * overview-stats 单元测试
 * 运行: node miniprogram/utils/overview-stats.test.js
 */

const assert = require('assert')
const {
  PRESET,
  weekRange,
  resolvePeriod,
  formatPeriodLabel,
  formatYuan,
  buildOverviewStats,
  filterOverviewList
} = require('./overview-stats')
const { BOOKING_STATUS } = require('./booking-status')

const now = new Date('2026-08-10T12:00:00+08:00')

// 本周：2026-08-10 周一 → 周一 8/10 ～ 周日 8/16
const week = weekRange(now)
assert.strictEqual(week.start, '2026-08-10')
assert.strictEqual(week.end, '2026-08-16')

const month = resolvePeriod(PRESET.month, null, now)
assert.strictEqual(month.start, '2026-08-01')
assert.strictEqual(month.end, '2026-08-31')
assert.strictEqual(formatPeriodLabel(month.start, month.end, PRESET.month), '2026年8月')

assert.strictEqual(formatYuan(3600), '¥ 3,600')
assert.strictEqual(formatYuan(225.5), '¥ 225.5')
assert.strictEqual(formatYuan(0), '¥ 0')
assert.strictEqual(formatYuan(1600), '¥ 1,600')

const bookings = [
  {
    teacherName: '王老师',
    date: '2026-08-05',
    startTime: '16:00',
    status: BOOKING_STATUS.pending,
    statusManual: false,
    price: 200
  },
  {
    teacherName: '王老师',
    date: '2026-08-12',
    startTime: '16:00',
    status: BOOKING_STATUS.pending,
    statusManual: false,
    price: 200
  },
  {
    teacherName: '李老师',
    date: '2026-08-06',
    startTime: '10:00',
    status: BOOKING_STATUS.pending,
    statusManual: false,
    price: 200
  },
  {
    teacherName: '李老师',
    date: '2026-08-01',
    startTime: '10:00',
    status: BOOKING_STATUS.refunded,
    statusManual: true,
    price: 200
  },
  {
    teacherName: '王老师',
    date: '2026-08-02',
    startTime: '16:00',
    status: BOOKING_STATUS.transferred,
    statusManual: true,
    price: 200
  }
]

const stats = buildOverviewStats(bookings, now)
assert.strictEqual(stats.total, 5)
assert.strictEqual(stats.done, 2)
assert.strictEqual(stats.pending, 1)
assert.strictEqual(stats.closed, 2)
assert.strictEqual(stats.paidCount, 3)
assert.strictEqual(stats.expenseTotal, 600)
assert.strictEqual(stats.avgPerLesson, 200)
assert.strictEqual(stats.teachers.length, 2)
assert.strictEqual(stats.teachers[0].name, '王老师')
assert.strictEqual(stats.teachers[0].lessonCount, 3)
assert.strictEqual(stats.teachers[0].amount, 400)
assert.ok(stats.teachers[0].percent >= 0)
assert.ok(stats.donutStyle.indexOf('conic-gradient') >= 0)
assert.strictEqual(stats.teachers[1].name, '李老师')
assert.strictEqual(stats.teachers[1].lessonCount, 2)
assert.strictEqual(stats.teachers[1].amount, 200)

const expenseList = filterOverviewList(bookings, { mode: 'expense' }, now)
assert.strictEqual(expenseList.length, 3)

const closedList = filterOverviewList(
  bookings,
  { mode: 'courses', statusFilter: 'closed' },
  now
)
assert.strictEqual(closedList.length, 2)

const wangList = filterOverviewList(
  bookings,
  { mode: 'teacher', teacherName: '王老师' },
  now
)
assert.strictEqual(wangList.length, 3)

console.log('overview-stats tests passed')
