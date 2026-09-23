/**
 * 批量删除：id 规范化、按周几筛选
 * 运行: node miniprogram/utils/booking-batch-delete.test.js
 */
const assert = require('assert')
const {
  MAX_DELETE_IDS,
  normalizeDeleteIds,
  toggleSelectedId,
  selectedIdList,
  filterBookingsByWeekday
} = require('./booking-batch-delete')

assert.deepStrictEqual(normalizeDeleteIds(null), [])
assert.deepStrictEqual(normalizeDeleteIds([]), [])
assert.deepStrictEqual(normalizeDeleteIds(['a', '', 'a', ' b ', null]), ['a', 'b'])

{
  const many = []
  for (let i = 0; i < MAX_DELETE_IDS + 5; i++) many.push(`id${i}`)
  const out = normalizeDeleteIds(many)
  assert.strictEqual(out.length, MAX_DELETE_IDS)
  assert.strictEqual(out[0], 'id0')
}

{
  let map = {}
  map = toggleSelectedId(map, 'a')
  assert.deepStrictEqual(selectedIdList(map), ['a'])
  map = toggleSelectedId(map, 'b')
  assert.strictEqual(selectedIdList(map).length, 2)
  map = toggleSelectedId(map, 'a')
  assert.deepStrictEqual(selectedIdList(map), ['b'])
}

{
  const list = [
    { _id: '1', date: '2026-08-03', studentName: '小雨' },
    { _id: '2', date: '2026-08-04', studentName: '小宇' },
    { _id: '3', date: '2026-08-10', studentName: '小雨' },
    { _id: '4', date: '2026-08-24', studentName: '小雨' }
  ]
  const mondays = filterBookingsByWeekday(list, 1)
  assert.deepStrictEqual(
    mondays.map((b) => b._id),
    ['1', '3', '4']
  )
  assert.strictEqual(filterBookingsByWeekday(list, 2).length, 1)
  assert.strictEqual(filterBookingsByWeekday(null, 1).length, 0)
}

console.log('booking-batch-delete tests passed')
