/**
 * 时间线长图布局
 * 运行: node miniprogram/utils/timeline-poster.test.js
 */
const assert = require('assert')
const {
  POSTER_WIDTH,
  POSTER_MAX_PIXEL_HEIGHT,
  buildPosterTitle,
  measureTimelinePoster,
  fitPosterCanvasSize
} = require('./timeline-poster')

{
  const t = buildPosterTitle({
    year: 2026,
    month: 8,
    studentLabel: '全部',
    summaryText: '本月 12 节'
  })
  assert.strictEqual(t.monthTitle, '2026年8月')
  assert.strictEqual(t.subTitle, '本月 12 节')
}

{
  const t = buildPosterTitle({
    year: 2026,
    month: 8,
    studentLabel: '小雨',
    summaryText: '本月 3 节'
  })
  assert.strictEqual(t.subTitle, '小雨 · 本月 3 节')
}

{
  const empty = measureTimelinePoster([], {
    year: 2026,
    month: 8,
    studentLabel: '全部',
    summaryText: '本月还没有课'
  })
  assert.strictEqual(empty.width, POSTER_WIDTH)
  assert.ok(empty.height >= 120)
  assert.strictEqual(empty.blocks.length, 0)
}

{
  const layout = measureTimelinePoster(
    [
      {
        date: '2026-08-20',
        day: '20',
        weekdayLabel: '星期四',
        isToday: true,
        statusDotClass: 'pending',
        holdReason: '',
        items: [
          {
            startTime: '19:30',
            endTime: '19:55',
            status: 'pending',
            statusLabel: '待上',
            teacherName: '乔姐',
            teacherInitial: '乔',
            metaLine: '小雨 | 英语'
          }
        ]
      },
      {
        date: '2026-08-25',
        day: '25',
        weekdayLabel: '星期二',
        isToday: false,
        statusDotClass: 'pending',
        holdReason: '出差',
        items: [
          {
            startTime: '10:00',
            endTime: '10:25',
            status: 'pending',
            statusLabel: '待上',
            teacherName: '乔姐',
            teacherInitial: '乔',
            metaLine: '小雨 | 英语'
          }
        ]
      }
    ],
    { year: 2026, month: 8, studentLabel: '全部', summaryText: '本月 2 节' }
  )
  assert.strictEqual(layout.blocks.length, 2)
  assert.ok(layout.blocks[1].y > layout.blocks[0].y)
  assert.ok(layout.blocks[1].height > layout.blocks[0].height)
  assert.ok(layout.height > layout.blocks[1].y + layout.blocks[1].height)
}

{
  const fit = fitPosterCanvasSize(2000, 3, POSTER_MAX_PIXEL_HEIGHT)
  assert.ok(fit.pixelHeight <= POSTER_MAX_PIXEL_HEIGHT)
  assert.ok(fit.dpr <= 3)
  const small = fitPosterCanvasSize(400, 2, POSTER_MAX_PIXEL_HEIGHT)
  assert.strictEqual(small.pixelHeight, 800)
  assert.strictEqual(small.dpr, 2)
}

console.log('timeline-poster tests passed')
