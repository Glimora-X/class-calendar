/**
 * 新增课程跳转：日历选中日应预填到新增页
 * 运行: node miniprogram/utils/booking-edit-nav.test.js
 */
const assert = require('assert')
const {
  buildBookingEditUrl,
  resolveCreateBookingDate
} = require('./booking-edit-nav')

assert.strictEqual(buildBookingEditUrl(), '/pages/booking-edit/index')
assert.strictEqual(buildBookingEditUrl({}), '/pages/booking-edit/index')

assert.strictEqual(
  buildBookingEditUrl({ date: '2026-08-20' }),
  '/pages/booking-edit/index?date=2026-08-20'
)

assert.strictEqual(
  buildBookingEditUrl({ date: '2026-08-20', studentName: '小雨' }),
  '/pages/booking-edit/index?date=2026-08-20&studentName=%E5%B0%8F%E9%9B%A8'
)

assert.strictEqual(
  buildBookingEditUrl({ id: 'bk1', date: '2026-08-20' }),
  '/pages/booking-edit/index?id=bk1&date=2026-08-20'
)

assert.strictEqual(
  buildBookingEditUrl({ id: 'bk1', studentName: '小雨' }),
  '/pages/booking-edit/index?id=bk1'
)

assert.strictEqual(
  resolveCreateBookingDate({
    route: 'pages/calendar/index',
    data: { selectedDate: '2026-08-20' }
  }),
  '2026-08-20'
)

assert.strictEqual(
  resolveCreateBookingDate({
    __route__: 'pages/calendar/index',
    data: { selectedDate: '2026-08-15' }
  }),
  '2026-08-15'
)

assert.strictEqual(
  resolveCreateBookingDate({
    route: 'pages/overview/index',
    data: { selectedDate: '2026-08-20' }
  }),
  ''
)

assert.strictEqual(
  resolveCreateBookingDate({
    route: 'pages/mine/index',
    data: {}
  }),
  ''
)

assert.strictEqual(resolveCreateBookingDate(null), '')
assert.strictEqual(
  resolveCreateBookingDate({
    route: 'pages/calendar/index',
    data: { selectedDate: '' }
  }),
  ''
)

console.log('booking-edit-nav tests passed')
