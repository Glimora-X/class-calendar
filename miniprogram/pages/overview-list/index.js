const { WEEKDAY_CN } = require('../../utils/constants')
const { listBookings } = require('../../services/booking')
const { showApiError } = require('../../utils/errors')
const {
  resolveBookingStatus,
  statusLabel,
  BOOKING_STATUS
} = require('../../utils/booking-status')
const {
  formatYuan,
  buildOverviewStats,
  filterOverviewList
} = require('../../utils/overview-stats')

function weekdayOf(dateStr) {
  const parts = String(dateStr || '').split('-').map(Number)
  if (parts.length < 3) return ''
  const d = new Date(parts[0], parts[1] - 1, parts[2])
  return `周${WEEKDAY_CN[d.getDay()]}`
}

function shortDate(dateStr) {
  const parts = String(dateStr || '').split('-')
  if (parts.length < 3) return dateStr || ''
  return `${Number(parts[1])}-${Number(parts[2])}`
}

Page({
  data: {
    mode: 'courses',
    start: '',
    end: '',
    periodLabel: '',
    teacherName: '',
    statusFilter: '',
    title: '全部课程',
    chips: [],
    rows: [],
    teachers: [],
    loading: false,
    empty: false
  },

  onLoad(query) {
    const mode = (query && query.mode) || 'courses'
    const start = decodeURIComponent((query && query.start) || '')
    const end = decodeURIComponent((query && query.end) || '')
    const periodLabel = decodeURIComponent((query && query.period) || '')
    const teacherName = decodeURIComponent((query && query.teacherName) || '')
    const statusFilter = decodeURIComponent((query && query.statusFilter) || '')

    const title = this.resolveTitle(mode, teacherName)
    wx.setNavigationBarTitle({ title })

    this.setData({
      mode,
      start,
      end,
      periodLabel,
      teacherName,
      statusFilter,
      title,
      chips: this.buildChips(mode, statusFilter)
    })
    this.refresh()
  },

  resolveTitle(mode, teacherName) {
    if (mode === 'expense') return '消费明细'
    if (mode === 'teachers') return '全部老师'
    if (mode === 'teacher') return teacherName || '老师课程'
    return '全部课程'
  },

  buildChips(mode, statusFilter) {
    if (mode !== 'courses') return []
    return [
      { id: '', label: '全部', active: !statusFilter },
      { id: 'done', label: '已上', active: statusFilter === 'done' },
      { id: 'pending', label: '待上', active: statusFilter === 'pending' },
      { id: 'closed', label: '退转', active: statusFilter === 'closed' }
    ]
  },

  onChip(e) {
    const id = e.currentTarget.dataset.id
    const statusFilter = id == null ? '' : String(id)
    this.setData({
      statusFilter,
      chips: this.buildChips('courses', statusFilter)
    })
    this.applyFilter()
  },

  async refresh() {
    const { start, end } = this.data
    if (!start || !end) return
    this.setData({ loading: true })
    try {
      const res = await listBookings({ start, end }, { title: '加载中' })
      this._bookings = (res && res.list) || []
      this.applyFilter()
    } catch (err) {
      this.setData({ loading: false, empty: true })
      showApiError(err)
    }
  },

  applyFilter() {
    const { mode, statusFilter, teacherName, periodLabel } = this.data
    const bookings = this._bookings || []

    if (mode === 'teachers') {
      const stats = buildOverviewStats(bookings)
      this.setData({
        teachers: stats.teachers,
        rows: [],
        loading: false,
        empty: stats.teachers.length === 0
      })
      return
    }

    const filtered = filterOverviewList(
      bookings,
      { mode, statusFilter, teacherName },
      Date.now()
    )

    const rows = filtered.map((b) => {
      const status = resolveBookingStatus(b)
      const price = Number(b.price)
      const hasPrice = Number.isFinite(price) && price >= 0
      const closed =
        status === BOOKING_STATUS.transferred || status === BOOKING_STATUS.refunded
      return {
        _id: b._id,
        dateLabel: shortDate(b.date),
        weekday: weekdayOf(b.date),
        time: b.startTime || '',
        teacherName: b.teacherName || '',
        studentName: b.studentName || '',
        subjectName: b.subjectName || '',
        status,
        statusLabel: statusLabel(status),
        statusClass:
          status === BOOKING_STATUS.done
            ? 'is-done'
            : status === BOOKING_STATUS.pending
              ? 'is-pending'
              : 'is-closed',
        amountLabel: hasPrice && !closed ? formatYuan(price) : '',
        periodHint: periodLabel
      }
    })

    this.setData({
      rows,
      teachers: [],
      loading: false,
      empty: rows.length === 0
    })
  },

  onTapRow(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/booking-edit/index?id=${id}` })
  },

  onTapTeacher(e) {
    const name = e.currentTarget.dataset.name
    if (!name) return
    const q = [
      `mode=teacher`,
      `start=${encodeURIComponent(this.data.start)}`,
      `end=${encodeURIComponent(this.data.end)}`,
      `period=${encodeURIComponent(this.data.periodLabel)}`,
      `teacherName=${encodeURIComponent(name)}`
    ].join('&')
    wx.navigateTo({ url: `/pages/overview-list/index?${q}` })
  }
})
