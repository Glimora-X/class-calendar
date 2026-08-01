/**
 * holidays + datesByWeekday 冒烟
 * node miniprogram/utils/p1-smoke.test.js
 */
const assert = require('assert')
const { holidaysInMonth, holidayLabel } = require('./holidays')
const { datesByWeekday } = require('./date-utils')

assert.strictEqual(holidayLabel('2026-10-01'), '国庆')
assert.ok(Object.keys(holidaysInMonth(2026, 10)).length >= 3)

const mondays = datesByWeekday(2026, 8, 1)
assert.ok(mondays.length >= 4)
assert.ok(mondays.every((d) => d.indexOf('2026-08-') === 0))

console.log('p1 smoke passed')
