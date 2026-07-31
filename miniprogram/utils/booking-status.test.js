/**
 * booking-status 单元测试
 * 运行: node miniprogram/utils/booking-status.test.js
 */

const assert = require('assert')
const {
  BOOKING_STATUS,
  resolveBookingStatus,
  statusLabel,
  isManualStatus
} = require('./booking-status')

const base = {
  date: '2026-07-31',
  startTime: '21:00'
}

// 自动：开课前 → 待上
assert.strictEqual(
  resolveBookingStatus(base, new Date('2026-07-31T12:00:00+08:00')),
  BOOKING_STATUS.pending
)

// 自动：开课后 → 已上
assert.strictEqual(
  resolveBookingStatus(base, new Date('2026-07-31T21:00:00+08:00')),
  BOOKING_STATUS.done
)
assert.strictEqual(
  resolveBookingStatus(base, new Date('2026-07-31T22:00:00+08:00')),
  BOOKING_STATUS.done
)

// 手动已转/已退：不随时间变
assert.strictEqual(
  resolveBookingStatus(
    { ...base, status: BOOKING_STATUS.transferred, statusManual: true },
    new Date('2026-07-31T12:00:00+08:00')
  ),
  BOOKING_STATUS.transferred
)
assert.strictEqual(
  resolveBookingStatus(
    { ...base, status: BOOKING_STATUS.refunded, statusManual: true },
    new Date('2026-08-01T12:00:00+08:00')
  ),
  BOOKING_STATUS.refunded
)

// 无 statusManual：即使库里有 pending 也按时间重算
assert.strictEqual(
  resolveBookingStatus(
    { ...base, status: BOOKING_STATUS.pending, statusManual: false },
    new Date('2026-07-31T22:00:00+08:00')
  ),
  BOOKING_STATUS.done
)

assert.strictEqual(statusLabel(BOOKING_STATUS.pending), '待上')
assert.strictEqual(statusLabel(BOOKING_STATUS.done), '已上')
assert.strictEqual(statusLabel(BOOKING_STATUS.transferred), '已转')
assert.strictEqual(statusLabel(BOOKING_STATUS.refunded), '已退')

assert.strictEqual(isManualStatus(BOOKING_STATUS.transferred), true)
assert.strictEqual(isManualStatus(BOOKING_STATUS.pending), false)

console.log('all tests passed')
