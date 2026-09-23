/**
 * 时间线长图：布局 + Canvas 绘制（纯函数，页面负责取 canvas / 存相册）
 */

const { statusVisual } = require('./booking-status')

const POSTER_WIDTH = 375
const POSTER_MAX_PIXEL_HEIGHT = 4096
const CARD_H = 78
const CARD_GAP = 8
const HOLD_H = 42
const GROUP_GAP = 10
const DATE_COL = 48
const RAIL_W = 16

function buildPosterTitle(meta) {
  const m = meta || {}
  const year = m.year || 0
  const month = m.month || 0
  const monthTitle = `${year}年${month}月`
  const bits = []
  const student = String(m.studentLabel || '').trim()
  if (student && student !== '全部') bits.push(student)
  const summary = String(m.summaryText || '').trim()
  if (summary) bits.push(summary)
  return { monthTitle, subTitle: bits.join(' · ') }
}

function collectPosterImageUrls(groups) {
  const urls = []
  ;(groups || []).forEach((g) => {
    ;(g.items || []).forEach((b) => {
      const url = b && b.teacherAvatarUrl ? String(b.teacherAvatarUrl).trim() : ''
      if (url && urls.indexOf(url) === -1) urls.push(url)
    })
  })
  return urls
}

function measureTimelinePoster(groups, meta) {
  const title = buildPosterTitle(meta || {})
  let y = 24
  y += 32
  if (title.subTitle) y += 20
  y += 16

  const blocks = []
  ;(groups || []).forEach((g) => {
    const items = (g && g.items) || []
    const holdH = g && g.holdReason ? HOLD_H + 8 : 0
    const n = items.length
    const cardsH = n ? n * CARD_H + (n - 1) * CARD_GAP : 0
    const height = Math.max(holdH + cardsH, 52)
    blocks.push({
      date: g.date,
      day: g.day,
      weekdayLabel: g.weekdayLabel || '',
      isToday: !!g.isToday,
      statusDotClass: g.statusDotClass || 'pending',
      holdReason: g.holdReason || '',
      items,
      y,
      height
    })
    y += height + GROUP_GAP
  })
  y += 20
  return {
    width: POSTER_WIDTH,
    height: Math.max(y, 140),
    title,
    blocks
  }
}

function fitPosterCanvasSize(layoutHeight, deviceDpr, maxPixel) {
  const max = maxPixel || POSTER_MAX_PIXEL_HEIGHT
  const h = Math.max(Number(layoutHeight) || 0, 1)
  let dpr = Number(deviceDpr)
  if (!Number.isFinite(dpr) || dpr < 1) dpr = 1
  if (dpr > 2) dpr = 2
  let pixelHeight = Math.ceil(h * dpr)
  if (pixelHeight > max) {
    dpr = max / h
    pixelHeight = max
  }
  return {
    dpr,
    pixelWidth: Math.ceil(POSTER_WIDTH * dpr),
    pixelHeight
  }
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

function drawTimelinePoster(ctx, layout, imageMap) {
  const map = imageMap || {}
  const width = layout.width
  const height = layout.height
  ctx.fillStyle = '#eef2f7'
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = '#1b2430'
  ctx.font = '700 22px sans-serif'
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.fillText(layout.title.monthTitle, 20, 24)
  if (layout.title.subTitle) {
    ctx.fillStyle = '#8b95a5'
    ctx.font = '400 12px sans-serif'
    ctx.fillText(layout.title.subTitle, 20, 52)
  }

  const contentX = 20 + DATE_COL + RAIL_W
  const contentW = width - contentX - 20

  layout.blocks.forEach((block, idx) => {
    const y = block.y
    ctx.fillStyle = '#1b2430'
    ctx.font = '700 20px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(String(block.day), 20, y)
    ctx.fillStyle = '#8b95a5'
    ctx.font = '400 11px sans-serif'
    ctx.fillText(block.weekdayLabel, 20, y + 24)
    if (block.isToday) {
      ctx.fillText('今天', 20, y + 40)
    }

    const vis = statusVisual(block.statusDotClass)
    const railX = 20 + DATE_COL + RAIL_W / 2
    ctx.strokeStyle = '#cbd5e1'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(railX, y + 10)
    const next = layout.blocks[idx + 1]
    ctx.lineTo(railX, next ? next.y : y + block.height)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(railX, y + 12, 5, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'
    ctx.fill()
    ctx.strokeStyle = vis.dotColor
    ctx.lineWidth = 2
    ctx.stroke()

    let cy = y
    if (block.holdReason) {
      roundRect(ctx, contentX, cy, contentW, HOLD_H, 8)
      ctx.fillStyle = 'rgba(100, 116, 139, 0.12)'
      ctx.fill()
      ctx.fillStyle = '#475569'
      ctx.font = '600 11px sans-serif'
      ctx.fillText('这天有其他安排', contentX + 10, cy + 8)
      ctx.fillStyle = '#64748b'
      ctx.font = '400 11px sans-serif'
      ctx.fillText(String(block.holdReason).slice(0, 16), contentX + 10, cy + 24)
      cy += HOLD_H + 8
    }

    ;(block.items || []).forEach((item, i) => {
      const cardY = cy + i * (CARD_H + CARD_GAP)
      const st = statusVisual(item.status)
      roundRect(ctx, contentX, cardY, contentW, CARD_H, 12)
      ctx.fillStyle = st.cardBg
      ctx.fill()

      ctx.fillStyle = st.timeColor
      ctx.font = '600 16px sans-serif'
      const time = `${item.startTime || ''} — ${item.endTime || ''}`
      ctx.fillText(time, contentX + 12, cardY + 12)

      const badge = item.statusLabel || st.label
      ctx.font = '600 10px sans-serif'
      const bw = Math.max(32, ctx.measureText ? ctx.measureText(badge).width + 12 : 40)
      roundRect(ctx, contentX + contentW - bw - 10, cardY + 10, bw, 18, 9)
      ctx.fillStyle = st.badgeBg
      ctx.fill()
      ctx.fillStyle = st.badgeText
      ctx.textAlign = 'center'
      ctx.fillText(badge, contentX + contentW - bw / 2 - 10, cardY + 13)
      ctx.textAlign = 'left'

      ctx.fillStyle = st.metaText
      ctx.font = '400 12px sans-serif'
      const meta = String(item.metaLine || '').slice(0, 18)
      ctx.fillText(meta, contentX + 12, cardY + 48)

      const teacher = String(item.teacherName || '')
      const initial = String(item.teacherInitial || teacher.charAt(0) || '?')
      const avX = contentX + contentW - 12 - 18
      const avY = cardY + 46
      const img = item.teacherAvatarUrl ? map[item.teacherAvatarUrl] : null
      ctx.save()
      ctx.beginPath()
      ctx.arc(avX, avY + 9, 9, 0, Math.PI * 2)
      ctx.closePath()
      ctx.clip()
      if (img) {
        ctx.drawImage(img, avX - 9, avY, 18, 18)
      } else {
        ctx.fillStyle = 'rgba(29, 41, 57, 0.08)'
        ctx.fill()
        ctx.fillStyle = st.mainText
        ctx.font = '600 10px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(initial, avX, avY + 9)
        ctx.textBaseline = 'top'
        ctx.textAlign = 'left'
      }
      ctx.restore()

      ctx.fillStyle = st.mainText
      ctx.font = '500 12px sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(teacher.slice(0, 6), avX - 14, cardY + 48)
      ctx.textAlign = 'left'
    })
  })
}

module.exports = {
  POSTER_WIDTH,
  POSTER_MAX_PIXEL_HEIGHT,
  buildPosterTitle,
  collectPosterImageUrls,
  measureTimelinePoster,
  fitPosterCanvasSize,
  drawTimelinePoster
}
