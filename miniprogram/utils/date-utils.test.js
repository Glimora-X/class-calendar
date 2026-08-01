/**
 * date-utils 复制上月映射测试
 * node miniprogram/utils/date-utils.test.js
 */
const assert = require('assert')
const { shiftToNextMonth, buildCopyMonthPreview } = require('./date-utils')

// 2026-07-06 是第 1 个周一 → 2026-08 第 1 个周一 08-03
{
  const r = shiftToNextMonth('2026-07-06', 2026, 8)
  assert.strictEqual(r.date, '2026-08-03')
  assert.strictEqual(r.skippedReason, null)
}

// 2026-07-27 是第 4 个周一 → 08 月有第 4 个周一 08-24
{
  const r = shiftToNextMonth('2026-07-27', 2026, 8)
  assert.strictEqual(r.date, '2026-08-24')
}

// 某月第 5 个星期几在目标月不存在时应跳过
// 2026-08-31 是第 5 个周一；映射到 9 月：9 月没有第 5 个周一
{
  const r = shiftToNextMonth('2026-08-31', 2026, 9)
  assert.strictEqual(r.date, null)
  assert.ok(r.skippedReason && r.skippedReason.indexOf('第 5') !== -1)
}

{
  const { previewCreate, previewSkipped } = buildCopyMonthPreview(
    [
      { _id: 'a', date: '2026-07-06', studentName: 'S', teacherName: 'T' },
      { _id: 'b', date: '2026-08-31', studentName: 'S2', teacherName: 'T2' }
    ],
    2026,
    9
  )
  // 7-06 → 9 月第 1 个周一；8-31 第 5 周一 → 9 月跳过
  assert.strictEqual(previewCreate.length, 1)
  assert.strictEqual(previewCreate[0].date, '2026-09-07')
  assert.strictEqual(previewSkipped.length, 1)
}

console.log('date-utils tests passed')
