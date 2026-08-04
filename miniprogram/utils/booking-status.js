/**
 * 约课状态：自动待上/已上，手动已转/已退
 */

const BOOKING_STATUS = {
  pending: 'pending',
  done: 'done',
  transferred: 'transferred',
  refunded: 'refunded'
}

const STATUS_LABELS = {
  [BOOKING_STATUS.pending]: '待上',
  [BOOKING_STATUS.done]: '已上',
  [BOOKING_STATUS.transferred]: '已转',
  [BOOKING_STATUS.refunded]: '已退'
}

const STATUS_VISUAL = {
  [BOOKING_STATUS.pending]: {
    statusClass: 'st-pending',
    cardBg: '#F0F6FF',
    badgeBg: '#3B82F6',
    badgeText: '#FFFFFF',
    mainText: '#1D2939',
    metaText: '#667085',
    timeColor: '#2563EB',
    dotColor: '#3B82F6'
  },
  [BOOKING_STATUS.done]: {
    statusClass: 'st-done',
    cardBg: '#F3F7F5',
    badgeBg: '#52A878',
    badgeText: '#FFFFFF',
    mainText: '#34483D',
    metaText: '#718078',
    timeColor: '#438A62',
    dotColor: '#52A878'
  },
  [BOOKING_STATUS.transferred]: {
    statusClass: 'st-transferred',
    cardBg: '#F7F3FF',
    badgeBg: '#8B5CF6',
    badgeText: '#FFFFFF',
    mainText: '#49356B',
    metaText: '#81758F',
    timeColor: '#7C4DDB',
    dotColor: '#8B5CF6'
  },
  [BOOKING_STATUS.refunded]: {
    statusClass: 'st-refunded',
    cardBg: '#F6F7F8',
    badgeBg: '#9AA1AA',
    badgeText: '#FFFFFF',
    mainText: '#667085',
    metaText: '#98A2B3',
    timeColor: '#7B8490',
    dotColor: '#9AA1AA'
  }
}

const STATUS_OPTIONS = [
  { value: BOOKING_STATUS.pending, label: '待上（按时间自动）' },
  { value: BOOKING_STATUS.done, label: '已上（按时间自动）' },
  { value: BOOKING_STATUS.transferred, label: '已转' },
  { value: BOOKING_STATUS.refunded, label: '已退' }
]

/**
 * @param {string} status
 * @returns {boolean}
 */
function isManualStatus(status) {
  return status === BOOKING_STATUS.transferred || status === BOOKING_STATUS.refunded
}

/**
 * @param {string} status
 * @returns {string}
 */
function statusLabel(status) {
  return STATUS_LABELS[status] || '待上'
}

function statusVisual(status) {
  const key = STATUS_VISUAL[status] ? status : BOOKING_STATUS.pending
  const v = STATUS_VISUAL[key]
  return Object.assign({}, v, { label: STATUS_LABELS[key] })
}

function teacherInitial(name) {
  const s = String(name || '').trim()
  if (!s) return '?'
  return s.charAt(0).toUpperCase()
}

/**
 * 开课时刻（本地时区按 date + startTime 拼接）
 * @param {{ date?: string, startTime?: string }} booking
 * @returns {number} ms，无效则 NaN
 */
function startAtMs(booking) {
  const date = booking && booking.date
  const startTime = booking && booking.startTime
  if (!date || !startTime) return NaN
  return new Date(`${String(date).replace(/-/g, '/')} ${startTime}`).getTime()
}

/**
 * @param {{ date?: string, startTime?: string, status?: string, statusManual?: boolean }} booking
 * @param {Date|number} [now]
 * @returns {string}
 */
function resolveBookingStatus(booking, now) {
  const row = booking || {}
  if (row.statusManual && isManualStatus(row.status)) {
    return row.status
  }
  const start = startAtMs(row)
  const t = now instanceof Date ? now.getTime() : Number(now || Date.now())
  if (!Number.isFinite(start)) return BOOKING_STATUS.pending
  return t >= start ? BOOKING_STATUS.done : BOOKING_STATUS.pending
}

/**
 * 编辑页选中某状态后，写入字段
 * 待上/已上 → 解除手动锁定，交回时间自动
 * 已转/已退 → 手动锁定
 * @param {string} selected
 * @returns {{ status: string, statusManual: boolean }}
 */
function statusWritePayload(selected) {
  if (isManualStatus(selected)) {
    return { status: selected, statusManual: true }
  }
  return { status: selected || BOOKING_STATUS.pending, statusManual: false }
}

module.exports = {
  BOOKING_STATUS,
  STATUS_LABELS,
  STATUS_OPTIONS,
  isManualStatus,
  statusLabel,
  statusVisual,
  teacherInitial,
  resolveBookingStatus,
  statusWritePayload,
  startAtMs
}
