/**
 * calendar-marks 单元测试
 * 运行: node miniprogram/utils/calendar-marks.test.js
 */
const assert = require('assert')
const {
  tonesFromDayBookings,
  buildMarks,
  buildLegend
} = require('./calendar-marks')

// tones：按首次出现去重，最多 3 个；surface 归一成 primary
assert.deepStrictEqual(
  tonesFromDayBookings([
    { cardTone: 'mint' },
    { cardTone: 'primary' },
    { cardTone: 'mint' },
    { cardTone: 'pro' },
    { cardTone: 'warning' }
  ]),
  ['mint', 'primary', 'pro']
)

assert.deepStrictEqual(
  tonesFromDayBookings([{ cardTone: 'surface' }, { cardTone: '' }]),
  ['primary']
)

// marks：按日聚合；count>2 出 summary，无 tones
const marks = buildMarks(
  [
    { date: '2026-08-05', cardTone: 'mint' },
    { date: '2026-08-05', cardTone: 'pro' },
    { date: '2026-08-05', cardTone: 'primary' },
    { date: '2026-08-01', cardTone: 'primary' }
  ],
  2
)
const m5 = marks.find((m) => m.date === '2026-08-05')
assert.strictEqual(m5.count, 3)
assert.strictEqual(m5.summary, '3节')
assert.deepStrictEqual(m5.tones, [])
assert.strictEqual(m5.tone, 'mint')

const m1 = marks.find((m) => m.date === '2026-08-01')
assert.strictEqual(m1.count, 1)
assert.strictEqual(m1.summary, '')
assert.deepStrictEqual(m1.tones, ['primary'])

// legend：按老师列表 + 色表
assert.deepStrictEqual(
  buildLegend(['天天', '乔姐'], { 天天: 'mint', 乔姐: 'primary' }),
  [
    { name: '天天', tone: 'mint' },
    { name: '乔姐', tone: 'primary' }
  ]
)

console.log('calendar-marks.test.js: OK')
