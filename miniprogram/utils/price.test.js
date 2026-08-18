/**
 * price 工具单测
 * 运行: node miniprogram/utils/price.test.js
 */

const assert = require('assert')
const {
  parsePriceInput,
  formatPriceInput,
  teacherDefaultPrice,
  priceAfterTeacherChange
} = require('./price')

assert.strictEqual(parsePriceInput(''), null)
assert.strictEqual(parsePriceInput('80'), 80)
assert.strictEqual(parsePriceInput('80.5'), 80.5)
assert.strictEqual(parsePriceInput('￥80'), 80)
assert.strictEqual(parsePriceInput('80.55'), 80.6)
assert.strictEqual(parsePriceInput('-1'), null)

assert.strictEqual(formatPriceInput(80), '80')
assert.strictEqual(formatPriceInput(80.5), '80.5')
assert.strictEqual(formatPriceInput(null), '')

assert.strictEqual(
  teacherDefaultPrice([{ name: '然泽', pricePerLesson: 90 }], '然泽'),
  90
)
assert.strictEqual(teacherDefaultPrice([{ name: '然泽' }], '然泽'), null)

assert.strictEqual(priceAfterTeacherChange(null, 80, 90), 90)
assert.strictEqual(priceAfterTeacherChange(80, 80, 90), 90)
assert.strictEqual(priceAfterTeacherChange(100, 80, 90), 100)

const {
  teacherPriceMap,
  resolveBookingPrice
} = require('./price')

const map = teacherPriceMap([
  { name: '王老师', pricePerLesson: 200 },
  { name: '李老师' }
])
assert.strictEqual(map['王老师'], 200)
assert.strictEqual(map['李老师'], undefined)

assert.strictEqual(
  resolveBookingPrice({ teacherName: '王老师', price: null }, map),
  200
)
assert.strictEqual(
  resolveBookingPrice({ teacherName: '王老师', price: 180 }, map),
  180
)
assert.strictEqual(
  resolveBookingPrice({ teacherName: '李老师', price: null }, map),
  null
)
assert.strictEqual(
  resolveBookingPrice(
    { teacherName: '王老师' },
    [{ name: '王老师', pricePerLesson: 220 }]
  ),
  220
)

console.log('all tests passed')
