/**
 * 概览：日期范围 + 课程/支出/老师聚合
 */

const { formatDate, pad } = require('./format')
const {
  BOOKING_STATUS,
  resolveBookingStatus
} = require('./booking-status')

const PRESET = {
  today: 'today',
  week: 'week',
  month: 'month',
  year: 'year',
  custom: 'custom'
}

const TEACHER_TONES = ['purple', 'blue', 'green']

/**
 * 本周：周一～周日
 * @param {Date} [now]
 * @returns {{ start: string, end: string }}
 */
function weekRange(now) {
  const d = now instanceof Date ? now : new Date()
  const day = d.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() + mondayOffset)
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)
  return { start: formatDate(start), end: formatDate(end) }
}

/**
 * @param {Date} [now]
 * @returns {{ start: string, end: string }}
 */
function todayRange(now) {
  const d = now instanceof Date ? now : new Date()
  const s = formatDate(d)
  return { start: s, end: s }
}

/**
 * @param {Date} [now]
 * @returns {{ start: string, end: string }}
 */
function monthRangeFromDate(now) {
  const d = now instanceof Date ? now : new Date()
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const last = new Date(y, m, 0).getDate()
  return {
    start: `${y}-${pad(m)}-01`,
    end: `${y}-${pad(m)}-${pad(last)}`
  }
}

/**
 * @param {Date} [now]
 * @returns {{ start: string, end: string }}
 */
function yearRange(now) {
  const d = now instanceof Date ? now : new Date()
  const y = d.getFullYear()
  return { start: `${y}-01-01`, end: `${y}-12-31` }
}

/**
 * @param {string} preset
 * @param {{ start?: string, end?: string }} [custom]
 * @param {Date} [now]
 * @returns {{ start: string, end: string, preset: string }}
 */
function resolvePeriod(preset, custom, now) {
  const key = preset || PRESET.month
  if (key === PRESET.custom && custom && custom.start && custom.end) {
    const start = custom.start <= custom.end ? custom.start : custom.end
    const end = custom.start <= custom.end ? custom.end : custom.start
    return { start, end, preset: PRESET.custom }
  }
  if (key === PRESET.today) {
    return Object.assign(todayRange(now), { preset: PRESET.today })
  }
  if (key === PRESET.week) {
    return Object.assign(weekRange(now), { preset: PRESET.week })
  }
  if (key === PRESET.year) {
    return Object.assign(yearRange(now), { preset: PRESET.year })
  }
  return Object.assign(monthRangeFromDate(now), { preset: PRESET.month })
}

/**
 * 对比区间（环比）
 * @param {string} start
 * @param {string} end
 * @param {string} preset
 * @returns {{ start: string, end: string }|null}
 */
function previousPeriod(start, end, preset) {
  if (!start || !end) return null
  const [sy, sm, sd] = start.split('-').map(Number)
  const [ey, em, ed] = end.split('-').map(Number)
  if (preset === PRESET.month) {
    const d = new Date(sy, sm - 2, 1)
    return monthRangeFromDate(d)
  }
  if (preset === PRESET.year) {
    return { start: `${sy - 1}-01-01`, end: `${sy - 1}-12-31` }
  }
  if (preset === PRESET.week || preset === PRESET.today || preset === PRESET.custom) {
    const startDate = new Date(sy, sm - 1, sd)
    const endDate = new Date(ey, em - 1, ed)
    const days = Math.round((endDate - startDate) / 86400000) + 1
    const prevEnd = new Date(sy, sm - 1, sd - 1)
    const prevStart = new Date(
      prevEnd.getFullYear(),
      prevEnd.getMonth(),
      prevEnd.getDate() - (days - 1)
    )
    return { start: formatDate(prevStart), end: formatDate(prevEnd) }
  }
  return null
}

/**
 * @param {string} start YYYY-MM-DD
 * @param {string} end
 * @param {string} preset
 * @returns {string}
 */
function formatPeriodLabel(start, end, preset) {
  if (!start || !end) return ''
  const [sy, sm, sd] = start.split('-').map(Number)
  const [ey, em, ed] = end.split('-').map(Number)
  if (preset === PRESET.year && sm === 1 && sd === 1 && em === 12 && ed === 31) {
    return `${sy}年`
  }
  if (
    preset === PRESET.month &&
    sy === ey &&
    sm === em &&
    sd === 1 &&
    ed === new Date(sy, sm, 0).getDate()
  ) {
    return `${sy}年${sm}月`
  }
  if (start === end) {
    return `${sy}年${sm}月${sd}日`
  }
  if (sy === ey) {
    return `${sm}月${sd}日 - ${em}月${ed}日`
  }
  return `${sy}年${sm}月${sd}日 - ${ey}年${em}月${ed}日`
}

/**
 * @param {string} preset
 * @returns {{ courseTitle: string, expenseTitle: string, compareLabel: string }}
 */
function periodTitles(preset) {
  if (preset === PRESET.week) {
    return { courseTitle: '本周课程', expenseTitle: '本周支出', compareLabel: '上周' }
  }
  if (preset === PRESET.year) {
    return { courseTitle: '本年课程', expenseTitle: '本年支出', compareLabel: '去年' }
  }
  if (preset === PRESET.today) {
    return { courseTitle: '今日课程', expenseTitle: '今日支出', compareLabel: '昨日' }
  }
  if (preset === PRESET.custom) {
    return { courseTitle: '课程', expenseTitle: '支出', compareLabel: '上一段' }
  }
  return { courseTitle: '本月课程', expenseTitle: '本月支出', compareLabel: '上月' }
}

/**
 * @param {number} n
 * @returns {string} 如 ¥ 1,600
 */
function formatYuan(n) {
  const v = Number(n)
  if (!Number.isFinite(v) || v < 0) return '¥ 0'
  const rounded = Math.round(v * 10) / 10
  const intPart = Math.floor(rounded)
  const dec = Math.round((rounded - intPart) * 10)
  const withComma = String(intPart).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  if (dec === 0) return `¥ ${withComma}`
  return `¥ ${withComma}.${dec}`
}

/**
 * @param {number} n
 * @returns {string}
 */
function formatYuanPlain(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '0'
  const rounded = Math.round(v * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : String(rounded)
}

function isClosedStatus(status) {
  return status === BOOKING_STATUS.transferred || status === BOOKING_STATUS.refunded
}

/**
 * @param {number} done
 * @param {number} pending
 * @param {number} closed
 * @returns {string} conic-gradient CSS
 */
function buildDonutStyle(done, pending, closed) {
  const total = done + pending + closed
  if (total <= 0) {
    return 'background: conic-gradient(#E5E7EB 0deg 360deg);'
  }
  const dDeg = (done / total) * 360
  const pDeg = (pending / total) * 360
  const cDeg = (closed / total) * 360
  let cursor = 0
  const parts = []
  if (done > 0) {
    parts.push(`#52A878 ${cursor}deg ${cursor + dDeg}deg`)
    cursor += dDeg
  }
  if (pending > 0) {
    parts.push(`#3B82F6 ${cursor}deg ${cursor + pDeg}deg`)
    cursor += pDeg
  }
  if (closed > 0) {
    parts.push(`#C5CAD3 ${cursor}deg ${cursor + cDeg}deg`)
  } else if (parts.length && cursor < 360) {
    /* keep full circle covered */
  }
  if (!parts.length) {
    return 'background: conic-gradient(#E5E7EB 0deg 360deg);'
  }
  return `background: conic-gradient(${parts.join(', ')});`
}

/**
 * @param {number} current
 * @param {number} previous
 * @param {string} compareLabel
 * @returns {{ text: string, up: boolean, flat: boolean }|null}
 */
function buildCompareTrend(current, previous, compareLabel) {
  if (previous == null || !Number.isFinite(previous)) return null
  const diff = current - previous
  if (diff === 0) {
    return { text: `与${compareLabel}持平`, up: false, flat: true }
  }
  if (diff > 0) {
    return { text: `比${compareLabel}多 ${diff} 节`, up: true, flat: false }
  }
  return { text: `比${compareLabel}少 ${Math.abs(diff)} 节`, up: false, flat: false }
}

/**
 * @param {Array} bookings
 * @param {Date|number} [now]
 * @param {{ previousTotal?: number, compareLabel?: string }} [opts]
 */
function buildOverviewStats(bookings, now, opts) {
  const options = opts || {}
  let total = 0
  let done = 0
  let pending = 0
  let closed = 0
  let expenseTotal = 0
  let paidCount = 0
  const byTeacher = Object.create(null)

  ;(bookings || []).forEach((b) => {
    if (!b) return
    total += 1
    const status = resolveBookingStatus(b, now)
    if (status === BOOKING_STATUS.done) done += 1
    else if (status === BOOKING_STATUS.pending) pending += 1
    else closed += 1

    const name = String(b.teacherName || '').trim() || '未命名老师'
    if (!byTeacher[name]) {
      byTeacher[name] = { name, lessonCount: 0, amount: 0 }
    }
    byTeacher[name].lessonCount += 1

    if (isClosedStatus(status)) return
    const price = Number(b.price)
    if (!Number.isFinite(price) || price < 0) return
    expenseTotal += price
    paidCount += 1
    byTeacher[name].amount += price
  })

  const teachers = Object.keys(byTeacher)
    .map((k, idx) => {
      const row = byTeacher[k]
      const name = row.name
      const pct =
        total > 0 ? Math.round((row.lessonCount / total) * 100) : 0
      return {
        name,
        initial: name.charAt(0),
        lessonCount: row.lessonCount,
        amount: Math.round(row.amount * 10) / 10,
        amountLabel: formatYuan(row.amount),
        percent: pct,
        percentLabel: `${pct}%`,
        barWidth: `${Math.max(pct, pct > 0 ? 4 : 0)}%`,
        tone: TEACHER_TONES[idx % TEACHER_TONES.length],
        avatarUrl: ''
      }
    })
    .sort((a, b) => {
      if (b.amount !== a.amount) return b.amount - a.amount
      if (b.lessonCount !== a.lessonCount) return b.lessonCount - a.lessonCount
      return a.name.localeCompare(b.name, 'zh')
    })
    .map((row, idx) =>
      Object.assign({}, row, { tone: TEACHER_TONES[idx % TEACHER_TONES.length] })
    )

  const expenseRounded = Math.round(expenseTotal * 10) / 10
  const avg =
    paidCount > 0 ? Math.round((expenseRounded / paidCount) * 10) / 10 : null

  const compareLabel = options.compareLabel || '上月'
  const trend = buildCompareTrend(total, options.previousTotal, compareLabel)

  return {
    total,
    done,
    pending,
    closed,
    expenseTotal: expenseRounded,
    expenseLabel: formatYuan(expenseRounded),
    paidCount,
    avgPerLesson: avg,
    avgLabel: avg == null ? '¥ 0' : formatYuan(avg),
    donutStyle: buildDonutStyle(done, pending, closed),
    trend,
    teachers,
    teachersPreview: teachers.slice(0, 3),
    hasMoreTeachers: teachers.length > 3
  }
}

/**
 * 概览下钻列表过滤
 * @param {Array} bookings
 * @param {{ mode?: string, statusFilter?: string, teacherName?: string }} opts
 * @param {Date|number} [now]
 */
function filterOverviewList(bookings, opts, now) {
  const mode = (opts && opts.mode) || 'courses'
  const statusFilter = (opts && opts.statusFilter) || ''
  const teacherName = String((opts && opts.teacherName) || '').trim()
  const list = []

  ;(bookings || []).forEach((b) => {
    if (!b) return
    const status = resolveBookingStatus(b, now)
    const closed = isClosedStatus(status)

    if (teacherName && String(b.teacherName || '').trim() !== teacherName) return

    if (mode === 'expense') {
      if (closed) return
      const price = Number(b.price)
      if (!Number.isFinite(price) || price < 0) return
      list.push(b)
      return
    }

    if (mode === 'teacher' || mode === 'courses') {
      if (statusFilter === 'done' && status !== BOOKING_STATUS.done) return
      if (statusFilter === 'pending' && status !== BOOKING_STATUS.pending) return
      if (statusFilter === 'closed' && !closed) return
      list.push(b)
    }
  })

  return list
}

module.exports = {
  PRESET,
  TEACHER_TONES,
  weekRange,
  todayRange,
  monthRangeFromDate,
  yearRange,
  resolvePeriod,
  previousPeriod,
  formatPeriodLabel,
  periodTitles,
  formatYuan,
  formatYuanPlain,
  isClosedStatus,
  buildDonutStyle,
  buildCompareTrend,
  buildOverviewStats,
  filterOverviewList
}
