const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

/**
 * 日程提醒（日历）模板
 * name1 提醒人 / time15 上课时间 / thing17 课程名称 / thing3 提醒事项
 */
const TEMPLATE_ID = 'kB65FXHwme7-n-p-ilFQb4Ow35xBLM9Is7DjdAm9KiY'

/** 扫描窗口：到期后仍尝试发送的时长（避免漏扫） */
const LOOKBACK_MS = 3 * 60 * 60 * 1000

const MINIPROGRAM_STATES = ['developer', 'trial', 'formal']

/** 约课 date+time 按北京时间解释（云函数主机多为 UTC） */
function chinaLocalMs(date, time) {
  if (!date || !time) return NaN
  const t = String(time).trim()
  const withSec = t.length === 5 ? `${t}:00` : t
  return new Date(`${String(date).trim()}T${withSec}+08:00`).getTime()
}

function startAtMs(booking) {
  if (!booking || !booking.date || !booking.startTime) return NaN
  return chinaLocalMs(booking.date, booking.startTime)
}

function isPending(booking, nowMs) {
  if (
    booking.statusManual &&
    (booking.status === 'transferred' || booking.status === 'refunded')
  ) {
    return false
  }
  const start = startAtMs(booking)
  if (!Number.isFinite(start)) return false
  return start > nowMs
}

function formatClassTime(date, startTime) {
  const parts = String(date || '').split('-').map(Number)
  if (parts.length < 3 || !startTime) return String(startTime || '')
  const y = parts[0]
  const m = parts[1]
  const d = parts[2]
  return `${y}年${m}月${d}日 ${startTime}`
}

function clip(str, max) {
  const s = String(str || '')
  return s.length > max ? s.slice(0, max) : s
}

function buildTemplateData(booking) {
  const student = clip(booking.studentName || '学员', 10)
  const teacher = booking.teacherName || '老师'
  const subject = clip(booking.subjectName || '约课', 20)
  const when = formatClassTime(booking.date, booking.startTime)
  // thing 最长约 20 字
  const tip = clip(`${teacher}的课即将开始`, 20)
  return {
    name1: { value: student },
    time15: { value: when },
    thing17: { value: subject },
    thing3: { value: tip }
  }
}

function toBeijingLabel(isoOrMs) {
  const ms = typeof isoOrMs === 'number' ? isoOrMs : Date.parse(isoOrMs)
  if (!Number.isFinite(ms)) return ''
  const d = new Date(ms + 8 * 60 * 60 * 1000)
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

async function sendSubscribe(row) {
  const data = buildTemplateData(row)
  let lastErr = null
  for (let i = 0; i < MINIPROGRAM_STATES.length; i++) {
    const state = MINIPROGRAM_STATES[i]
    try {
      await cloud.openapi.subscribeMessage.send({
        touser: row._openid,
        templateId: TEMPLATE_ID,
        page: `pages/booking-edit/index?id=${row._id}`,
        data,
        miniprogramState: state
      })
      console.log('reminderTick send ok', row._id, state)
      return { ok: true, state }
    } catch (e) {
      lastErr = e
      console.warn('reminderTick send try fail', row._id, state, e)
    }
  }
  return { ok: false, error: lastErr }
}

async function diagnose(_id) {
  const nowMs = Date.now()
  const doc = await db.collection('bookings').doc(_id).get()
  const row = doc && doc.data
  if (!row) return { code: 'NOT_FOUND', message: '记录不存在' }

  const startMs = startAtMs(row)
  const remindMs = row.remindAt ? Date.parse(row.remindAt) : NaN
  const pending = isPending(row, nowMs)

  return {
    code: 'OK',
    _id,
    date: row.date,
    startTime: row.startTime,
    startBeijing: toBeijingLabel(startMs),
    remindAt: row.remindAt || null,
    remindBeijing: row.remindAt ? toBeijingLabel(row.remindAt) : null,
    remindSentAt: row.remindSentAt || null,
    hasOpenid: !!row._openid,
    pending,
    minutesUntilRemind: Number.isFinite(remindMs)
      ? Math.round((remindMs - nowMs) / 60000)
      : null,
    minutesUntilStart: Number.isFinite(startMs)
      ? Math.round((startMs - nowMs) / 60000)
      : null,
    tip: !row.remindAt
      ? '无 remindAt：开课可能已过，或未重新保存（需部署时区修复后的 bookingUpsert）'
      : row.remindSentAt
        ? '已发送过（remindSentAt 有值）'
        : !pending
          ? '课程已不再是待上，不会发送'
          : remindMs > nowMs
            ? `未到发送点，约 ${Math.round((remindMs - nowMs) / 60000)} 分钟后发送（北京 ${toBeijingLabel(row.remindAt)}）`
            : '已到发送点，等待定时器扫描或手动补发'
  }
}

async function sendOne(_id, opts) {
  const force = !!(opts && opts.force)
  const nowMs = Date.now()
  const nowIso = new Date(nowMs).toISOString()
  const doc = await db.collection('bookings').doc(_id).get()
  const row = doc && doc.data
  if (!row) return { code: 'NOT_FOUND', message: '记录不存在', sent: 0 }

  if (!force && row.remindSentAt) {
    return { code: 'OK', sent: 0, skipped: 1, reason: 'ALREADY_SENT' }
  }
  if (!row._openid) {
    return { code: 'INVALID_PARAM', message: '缺少 _openid', sent: 0 }
  }
  if (!force && !isPending(row, nowMs)) {
    return { code: 'OK', sent: 0, skipped: 1, reason: 'NOT_PENDING' }
  }

  const result = await sendSubscribe(row)
  if (!result.ok) {
    console.error('reminderTick sendOne fail', _id, result.error)
    return {
      code: 'SYNC_FAILED',
      message: '发送失败',
      sent: 0,
      failed: 1,
      error: String(
        (result.error && (result.error.errMsg || result.error.message)) ||
          result.error ||
          ''
      )
    }
  }

  await db.collection('bookings').doc(_id).update({
    data: { remindSentAt: nowIso }
  })
  return { code: 'OK', sent: 1, state: result.state }
}

async function scanDue() {
  const nowMs = Date.now()
  const nowIso = new Date(nowMs).toISOString()
  const fromIso = new Date(nowMs - LOOKBACK_MS).toISOString()

  let sent = 0
  let skipped = 0
  let failed = 0

  const res = await db
    .collection('bookings')
    .where({
      remindAt: _.lte(nowIso).and(_.gte(fromIso))
    })
    .limit(100)
    .get()

  const rows = res.data || []
  console.log('reminderTick scan', {
    count: rows.length,
    fromIso,
    nowIso
  })

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (row.remindSentAt) {
      skipped++
      continue
    }
    if (!isPending(row, nowMs)) {
      skipped++
      continue
    }
    if (!row._openid) {
      skipped++
      continue
    }

    const result = await sendSubscribe(row)
    if (!result.ok) {
      failed++
      console.error('reminderTick send fail', row._id, result.error)
      continue
    }
    await db.collection('bookings').doc(row._id).update({
      data: { remindSentAt: nowIso }
    })
    sent++
  }

  return { code: 'OK', sent, skipped, failed }
}

/**
 * event.action:
 * - 空/scan：定时扫描（默认）
 * - diagnose + _id：诊断某条（不发送）
 * - send + _id：立即补发（消耗一次订阅授权；force 可忽略已发送）
 */
exports.main = async (event) => {
  if (!TEMPLATE_ID) {
    console.warn('reminderTick: TEMPLATE_ID 未配置，跳过发送')
    return { sent: 0, skipped: 0, reason: 'NO_TEMPLATE' }
  }

  const payload = event || {}
  const action = String(payload.action || 'scan')
  const id = payload._id ? String(payload._id) : ''

  try {
    if (action === 'diagnose') {
      if (!id) return { code: 'INVALID_PARAM', message: '缺少 _id' }
      return diagnose(id)
    }
    if (action === 'send') {
      if (!id) return { code: 'INVALID_PARAM', message: '缺少 _id' }
      return sendOne(id, { force: !!payload.force })
    }
    return scanDue()
  } catch (e) {
    console.error('reminderTick', e)
    return {
      code: 'SYNC_FAILED',
      message: '提醒处理失败',
      error: String((e && e.message) || e)
    }
  }
}
