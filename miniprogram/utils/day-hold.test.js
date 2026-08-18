const assert = require('assert')
const {
  HOLD_REASON_MAX,
  normalizeReason,
  holdsToMap,
  isHoldDate,
  annotateCopyRows,
  partitionBatchDates,
  holdDatesInList,
  formatHoldConfirmContent
} = require('./day-hold')

assert.strictEqual(HOLD_REASON_MAX, 20)

assert.deepStrictEqual(normalizeReason(''), { ok: false, reason: '', message: '写一下事由吧' })
assert.deepStrictEqual(normalizeReason('   '), { ok: false, reason: '', message: '写一下事由吧' })
assert.deepStrictEqual(normalizeReason(null), { ok: false, reason: '', message: '写一下事由吧' })
assert.deepStrictEqual(normalizeReason('出差'), { ok: true, reason: '出差', message: '' })
assert.deepStrictEqual(normalizeReason('  家里有事  '), { ok: true, reason: '家里有事', message: '' })
assert.deepStrictEqual(normalizeReason('一二三四五六七八九十一二三四五六七八九十多'), {
  ok: false,
  reason: '',
  message: '事由最多20个字'
})
assert.deepStrictEqual(normalizeReason('一二三四五六七八九十一二三四五六七八九十'), {
  ok: true,
  reason: '一二三四五六七八九十一二三四五六七八九十',
  message: ''
})

assert.deepStrictEqual(holdsToMap(null), {})
assert.deepStrictEqual(holdsToMap([]), {})
assert.deepStrictEqual(
  holdsToMap([
    { date: '2026-08-25', reason: '出差' },
    { date: '2026-08-28', reason: '婚礼' },
    { date: '', reason: 'x' },
    null
  ]),
  { '2026-08-25': '出差', '2026-08-28': '婚礼' }
)

const holdMap = { '2026-08-25': '出差', '2026-08-28': '婚礼' }
assert.strictEqual(isHoldDate(holdMap, '2026-08-25'), true)
assert.strictEqual(isHoldDate(holdMap, '2026-08-26'), false)
assert.strictEqual(isHoldDate({}, '2026-08-25'), false)
assert.strictEqual(isHoldDate(null, '2026-08-25'), false)

const rows = annotateCopyRows(
  [
    { key: 'a', date: '2026-08-25', checked: true, studentName: '小雨' },
    { key: 'b', date: '2026-08-26', checked: true, studentName: '小宇' },
    { key: 'c', date: '2026-08-28', checked: true, studentName: '小雨' }
  ],
  holdMap
)
assert.strictEqual(rows[0].checked, false)
assert.strictEqual(rows[0].holdReason, '出差')
assert.strictEqual(rows[1].checked, true)
assert.strictEqual(rows[1].holdReason, '')
assert.strictEqual(rows[2].checked, false)
assert.strictEqual(rows[2].holdReason, '婚礼')
assert.strictEqual(annotateCopyRows(null, holdMap).length, 0)

const dates = ['2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24', '2026-08-25']
const partDefault = partitionBatchDates(dates, holdMap, [])
assert.deepStrictEqual(partDefault.selected, [
  '2026-08-03',
  '2026-08-10',
  '2026-08-17',
  '2026-08-24'
])
assert.deepStrictEqual(partDefault.skippedHolds, ['2026-08-25'])

const partInclude = partitionBatchDates(dates, holdMap, ['2026-08-25'])
assert.deepStrictEqual(partInclude.selected, dates)
assert.deepStrictEqual(partInclude.skippedHolds, [])

assert.deepStrictEqual(holdDatesInList(['2026-08-25', '2026-08-26', '2026-08-28'], holdMap), [
  '2026-08-25',
  '2026-08-28'
])

assert.strictEqual(
  formatHoldConfirmContent(holdMap, ['2026-08-25']),
  '出差\n最好别再约。仍要约课吗？'
)
assert.ok(
  formatHoldConfirmContent(holdMap, ['2026-08-25', '2026-08-28']).indexOf('2026-08-25 出差') >= 0
)

console.log('day-hold.test.js OK')
