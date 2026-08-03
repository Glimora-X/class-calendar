/**
 * quick-parse 单元测试（node 直接跑）
 * 运行: node miniprogram/utils/quick-parse.test.js
 */

const assert = require('assert')
const { parseQuickInput, parseQuickInputMulti } = require('./quick-parse')

const empty = { students: [], teachers: [], subjects: [] }

function assertData(text, known, partial) {
  const result = parseQuickInput(text, 2026, known || empty)
  assert.strictEqual(result.ok, true, `${text} should parse ok`)
  Object.keys(partial).forEach((k) => {
    assert.strictEqual(
      result.data[k],
      partial[k],
      `${text} → ${k}: expected ${JSON.stringify(partial[k])}, got ${JSON.stringify(result.data[k])}`
    )
  })
}

// 空格分隔：学员 老师 日期 时间
assertData('Sisi2BJ 乔姐 7.31 21:00-21:25', empty, {
  studentName: 'Sisi2BJ',
  teacherName: '乔姐',
  date: '2026-07-31',
  startTime: '21:00',
  endTime: '21:25'
})

// 「约」连接：学员约老师
assertData('Sisi2BJ约乔姐 7.31 21:00-21:25', empty, {
  studentName: 'Sisi2BJ',
  teacherName: '乔姐'
})

// 已知老师优先
assertData('Sisi2BJ约乔姐 7.31 21:00-21:25', {
  students: [],
  teachers: ['乔姐'],
  subjects: []
}, {
  studentName: 'Sisi2BJ',
  teacherName: '乔姐'
})

// 已知学员 + 未知老师（空格）
assertData('Sisi2BJ 新老师 7.31 21:00-21:25', {
  students: ['Sisi2BJ'],
  teachers: [],
  subjects: []
}, {
  studentName: 'Sisi2BJ',
  teacherName: '新老师'
})

// 中文冒号
assertData('Sisi2BJ 然泽 7.27 21：30-21：55', empty, {
  studentName: 'Sisi2BJ',
  teacherName: '然泽',
  date: '2026-07-27',
  startTime: '21:30',
  endTime: '21:55'
})

// 冒号后有空格
assertData('Sisi2BJ 然泽 7.27 21: 30-21: 55', empty, {
  studentName: 'Sisi2BJ',
  teacherName: '然泽',
  startTime: '21:30',
  endTime: '21:55'
})

// 相对日期：明天（锚定 now）
{
  const now = new Date(2026, 7, 1) // 2026-08-01
  const result = parseQuickInput(
    'Sisi2BJ约明天真真11:30-11:55',
    2026,
    empty,
    now
  )
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.data.date, '2026-08-02')
  assert.strictEqual(result.data.studentName, 'Sisi2BJ')
  assert.strictEqual(result.data.teacherName, '真真')
  assert.strictEqual(result.data.startTime, '11:30')
  assert.strictEqual(result.data.endTime, '11:55')
}

// 多行解析：成功行 + 跳过空行
{
  const multi = parseQuickInputMulti(
    [
      'Sisi2BJ约乔姐 8月7号 21:30-21:55',
      '',
      'Sisi2BJ约乔姐 8月8号 13：00-13：25',
      'Sisi2BJ约乔姐 8月3号 21:00-21:25'
    ].join('\n'),
    2026,
    empty
  )
  assert.strictEqual(multi.okItems.length, 3)
  assert.strictEqual(multi.failItems.length, 0)
  assert.strictEqual(multi.okItems[0].data.date, '2026-08-07')
  assert.strictEqual(multi.okItems[0].data.startTime, '21:30')
  assert.strictEqual(multi.okItems[1].data.date, '2026-08-08')
  assert.strictEqual(multi.okItems[1].data.startTime, '13:00')
  assert.strictEqual(multi.okItems[2].data.date, '2026-08-03')
  assert.strictEqual(multi.okItems[0].data.studentName, 'Sisi2BJ')
  assert.strictEqual(multi.okItems[0].data.teacherName, '乔姐')
}

// 多行：部分失败
{
  const multi = parseQuickInputMulti(
    ['Sisi2BJ约乔姐 8月7号 21:30-21:55', '这行没法解析', 'Sisi2BJ约乔姐 8月8号 13:00-13:25'].join(
      '\n'
    ),
    2026,
    empty
  )
  assert.strictEqual(multi.okItems.length, 2)
  assert.strictEqual(multi.failItems.length, 1)
  assert.strictEqual(multi.failItems[0].line, 2)
}

console.log('all tests passed')
