const { WEEKDAY_CN } = require('../../utils/constants')
const { listBookings, batchDeleteBookings } = require('../../services/booking')
const { fetchNameList } = require('../../services/name-list')
const { showApiError, showWriteError } = require('../../utils/errors')
const {
  resolveBookingStatus,
  statusLabel,
  BOOKING_STATUS
} = require('../../utils/booking-status')
const { resolveBookingPrice } = require('../../utils/price')
const {
  formatYuan,
  buildOverviewStats,
  filterOverviewList
} = require('../../utils/overview-stats')
const {
  normalizeDeleteIds,
  toggleSelectedId,
  selectedIdList
} = require('../../utils/booking-batch-delete')

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
    studentName: '',
    statusFilter: '',
    title: '全部课程',
    chips: [],
    rows: [],
    teachers: [],
    loading: false,
    empty: false,
    canManage: false,
    selecting: false,
    selectedMap: {},
    selectedCount: 0
  },

  onLoad(query) {
    const mode = (query && query.mode) || 'courses'
    const start = decodeURIComponent((query && query.start) || '')
    const end = decodeURIComponent((query && query.end) || '')
    const periodLabel = decodeURIComponent((query && query.period) || '')
    const teacherName = decodeURIComponent((query && query.teacherName) || '')
    const statusFilter = decodeURIComponent((query && query.statusFilter) || '')
    const studentName = decodeURIComponent((query && query.studentName) || '')

    const title = this.resolveTitle(mode, teacherName)
    wx.setNavigationBarTitle({ title })

    this.setData({
      mode,
      start,
      end,
      periodLabel,
      teacherName,
      studentName,
      statusFilter,
      title,
      chips: this.buildChips(mode, statusFilter)
    })
    this.refresh()
  },

  resolveTitle(mode, teacherName) {
    if (mode === 'expense') return '支出明细'
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
      { id: 'closed', label: '退转', active: statusFilter === 'closed' },
      { id: 'missed', label: '缺课', active: statusFilter === 'missed' }
    ]
  },

  onChip(e) {
    const id = e.currentTarget.dataset.id
    const statusFilter = id == null ? '' : String(id)
    this.setData({
      statusFilter,
      chips: this.buildChips('courses', statusFilter),
      selecting: false,
      selectedMap: {},
      selectedCount: 0
    })
    this.applyFilter()
  },

  async refresh() {
    const { start, end } = this.data
    if (!start || !end) return
    this.setData({ loading: true })
    try {
      const [res, nameList] = await Promise.all([
        listBookings({ start, end }, { title: '加载中' }),
        fetchNameList({ silent: true }).catch(() => ({ teachers: [] }))
      ])
      this._bookings = (res && res.list) || []
      this._teachers = (nameList && nameList.teachers) || []
      this.applyFilter()
    } catch (err) {
      this.setData({ loading: false, empty: true })
      showApiError(err)
    }
  },

  applyFilter() {
    const { mode, statusFilter, teacherName, studentName, periodLabel } = this.data
    const bookings = this._bookings || []
    const teachers = this._teachers || []

    if (mode === 'teachers') {
      const scoped = studentName
        ? bookings.filter((b) => String((b && b.studentName) || '').trim() === studentName)
        : bookings
      const stats = buildOverviewStats(scoped, Date.now(), { teachers })
      this.setData({
        teachers: stats.teachers,
        rows: [],
        loading: false,
        empty: stats.teachers.length === 0,
        canManage: false,
        selecting: false,
        selectedMap: {},
        selectedCount: 0
      })
      return
    }

    const filtered = filterOverviewList(
      bookings,
      { mode, statusFilter, teacherName, studentName, teachers },
      Date.now()
    )

    const rows = filtered.map((b) => {
      const status = resolveBookingStatus(b)
      const price = resolveBookingPrice(b, teachers)
      const hasPrice = price != null
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
              : status === BOOKING_STATUS.missed
                ? 'is-missed'
                : 'is-closed',
        amountLabel: hasPrice && !closed ? formatYuan(price) : '',
        periodHint: periodLabel
      }
    })

    this.setData({
      rows,
      teachers: [],
      loading: false,
      empty: rows.length === 0,
      canManage: rows.length > 0,
      selectedMap: this.data.selecting ? this.pruneSelected(rows) : {},
      selectedCount: this.data.selecting
        ? selectedIdList(this.pruneSelected(rows)).length
        : 0
    })
  },

  pruneSelected(rows) {
    const next = {}
    const prev = this.data.selectedMap || {}
    ;(rows || []).forEach((r) => {
      if (r && r._id && prev[r._id]) next[r._id] = true
    })
    return next
  },

  onEnterSelect() {
    this.setData({
      selecting: true,
      selectedMap: {},
      selectedCount: 0
    })
  },

  onCancelSelect() {
    this.setData({
      selecting: false,
      selectedMap: {},
      selectedCount: 0
    })
  },

  onSelectAllRows() {
    const map = {}
    ;(this.data.rows || []).forEach((r) => {
      if (r && r._id) map[r._id] = true
    })
    this.setData({
      selectedMap: map,
      selectedCount: selectedIdList(map).length
    })
  },

  onTapRow(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    if (this.data.selecting) {
      const selectedMap = toggleSelectedId(this.data.selectedMap, id)
      this.setData({
        selectedMap,
        selectedCount: selectedIdList(selectedMap).length
      })
      return
    }
    wx.navigateTo({ url: `/pages/booking-edit/index?id=${id}` })
  },

  async onConfirmBatchDelete() {
    const ids = normalizeDeleteIds(selectedIdList(this.data.selectedMap))
    if (!ids.length) {
      wx.showToast({ title: '请先勾选课程', icon: 'none' })
      return
    }
    const confirm = await new Promise((resolve) => {
      wx.showModal({
        title: '确认删除',
        content: `将删除 ${ids.length} 节课，占用日标记不会动。删了回不来。`,
        confirmColor: '#ef4444',
        confirmText: '删除',
        success: (res) => resolve(!!res.confirm)
      })
    })
    if (!confirm) return
    try {
      const result = await batchDeleteBookings(ids)
      this.setData({
        selecting: false,
        selectedMap: {},
        selectedCount: 0
      })
      await this.refresh()
      const n = (result && result.deleted) || 0
      wx.showToast({
        title: n ? `已删掉 ${n} 节` : '没有删掉课程',
        icon: 'none'
      })
    } catch (err) {
      showWriteError(err)
    }
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
