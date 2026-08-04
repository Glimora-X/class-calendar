/**
 * booking-status 单元测试
 * 运行: node miniprogram/utils/booking-status.test.js
 */

const assert = require('assert')
const {
  BOOKING_STATUS,
  resolveBookingStatus,
  statusLabel,
  isManualStatus,
  statusVisual,
  teacherInitial
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

const pendingV = statusVisual(BOOKING_STATUS.pending)
assert.strictEqual(pendingV.statusClass, 'st-pending')
assert.strictEqual(pendingV.cardBg, '#F0F6FF')
assert.strictEqual(pendingV.badgeBg, '#3B82F6')
assert.strictEqual(pendingV.timeColor, '#2563EB')
assert.strictEqual(pendingV.dotColor, '#3B82F6')
assert.strictEqual(pendingV.label, '待上')

assert.strictEqual(statusVisual(BOOKING_STATUS.done).statusClass, 'st-done')
assert.strictEqual(statusVisual(BOOKING_STATUS.done).badgeBg, '#52A878')
assert.strictEqual(statusVisual(BOOKING_STATUS.transferred).statusClass, 'st-transferred')
assert.strictEqual(statusVisual(BOOKING_STATUS.transferred).badgeBg, '#8B5CF6')
assert.strictEqual(statusVisual(BOOKING_STATUS.refunded).statusClass, 'st-refunded')
assert.strictEqual(statusVisual(BOOKING_STATUS.refunded).badgeBg, '#9AA1AA')
assert.strictEqual(statusVisual(BOOKING_STATUS.refunded).cardBg, '#F6F7F8')
// 未知状态回落待上
assert.strictEqual(statusVisual('nope').statusClass, 'st-pending')

assert.strictEqual(teacherInitial('然泽'), '然')
assert.strictEqual(teacherInitial('  Jo  '), 'J')
assert.strictEqual(teacherInitial(''), '?')
assert.strictEqual(teacherInitial(null), '?')

console.log('all tests passed')
