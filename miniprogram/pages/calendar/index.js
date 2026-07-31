const WEEKDAY_CN = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

const { addMonths } = require('../../utils/date-utils')
const { formatMonthKey, monthRange, formatDate, pad } = require('../../utils/format')
const { getMonthBookings, setMonthBookings } = require('../../utils/cache')
const { listBookings } = require('../../services/booking')
const { showApiError } = require('../../utils/errors')
const { resolveBookingStatus, statusLabel, BOOKING_STATUS } = require('../../utils/booking-status')

Page({
  data: {
    year: 0,
    month: 0,
    mode: 'calendar',
    summaryText: '',
    selectedDate: '',
    selectedLabel: '',
    filterTeacher: '',
    chips: [],
    marks: [],
    dayBookings: [],
    timelineGroups: [],
    monthBookings: [],
    loading: false
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
    if (this.data.year) this.refreshMonth()
  },

  onLoad() {
    const now = new Date()
    this.setViewing(now.getFullYear(), now.getMonth() + 1, formatDate(now))
  },

  setViewing(year, month, selectedDate) {
    const app = getApp()
    app.globalData.viewingYear = year
    app.globalData.viewingMonth = month
    const date =
      selectedDate ||
      `${year}-${pad(month)}-01`
    this.setData({
      year,
      month,
      selectedDate: date,
      dayBookings: [],
      timelineGroups: [],
      summaryText: ''
    })
    this.refreshMonth()
  },

  onMonthChange(e) {
    const next = addMonths(this.data.year, this.data.month, e.detail.delta)
    this.setViewing(next.year, next.month)
  },

  onModeChange(e) {
    this.setData({ mode: e.detail.mode })
  },

  onFilterChange(e) {
    const id = e.detail.id
    const filterTeacher = id === 'all' ? '' : id
    this.setData({ filterTeacher })
    this.recomputeViews(this.data.monthBookings)
  },

  onSelectDate(e) {
    const date = e.detail.date
    this.setData({ selectedDate: date })
    this.recomputeViews(this.data.monthBookings)
  },

  async refreshMonth() {
    const { year, month } = this.data
    const monthKey = formatMonthKey(year, month)
    const cached = getMonthBookings(monthKey)
    if (cached) this.applyMonthList(cached)

    this.setData({ loading: true })
    try {
      const { start, end } = monthRange(year, month)
      const { list } = await listBookings({ start, end })
      const rows = list || []
      setMonthBookings(monthKey, rows)
      this.applyMonthList(rows)
    } catch (err) {
      if (!cached) this.applyMonthList([])
      showApiError(err)
    } finally {
      this.setData({ loading: false })
    }
  },

  applyMonthList(list) {
    const rows = list || []
    this.setData({ monthBookings: rows })
    this.recomputeViews(rows)
  },

  recomputeViews(list) {
    const { filterTeacher, selectedDate } = this.data
    const filtered = filterTeacher
      ? list.filter((b) => b.teacherName === filterTeacher)
      : list

    const teachers = uniqueTeachers(list)
    const doneCountByTeacher = countDoneByTeacher(list)
    const chips = [
      { id: 'all', label: '全部', active: !filterTeacher },
      ...teachers.map((name) => {
        const done = doneCountByTeacher[name] || 0
        return {
          id: name,
          label: `${name} ${done}`,
          active: filterTeacher === name
        }
      })
    ]

    const byDate = {}
    filtered.forEach((b) => {
      if (!byDate[b.date]) byDate[b.date] = []
      byDate[b.date].push(decorateBooking(b))
    })

    const marks = Object.keys(byDate).map((date, idx) => ({
      date,
      tone: idx % 2 === 0 ? 'primary' : 'mint'
    }))

    const dayBookings = (byDate[selectedDate] || []).slice().sort(byStartTime)
    const selectedLabel = formatSelectedLabel(selectedDate)

    const timelineGroups = Object.keys(byDate)
      .sort()
      .map((date) => {
        const d = new Date(date.replace(/-/g, '/'))
        const tone = marks.find((m) => m.date === date)
        return {
          date,
          day: pad(d.getDate()),
          weekdayLabel: WEEKDAY_CN[d.getDay()],
          tone: (tone && tone.tone) || 'primary',
          items: byDate[date].slice().sort(byStartTime)
        }
      })

    this.setData({
      chips,
      marks,
      dayBookings,
      selectedLabel,
      timelineGroups,
      summaryText: filtered.length ? `本月 ${filtered.length} 节` : '本月暂无约课'
    })
  },

  onTapBooking(e) {
    const id = (e.detail && e.detail.id) || ''
    const url = id
      ? `/pages/booking-edit/index?id=${id}`
      : '/pages/booking-edit/index'
    wx.navigateTo({ url })
  },

  onTapTimelineItem(e) {
    this.onTapBooking(e)
  }
})

function uniqueTeachers(list) {
  const set = []
  ;(list || []).forEach((b) => {
    if (b.teacherName && set.indexOf(b.teacherName) === -1) set.push(b.teacherName)
  })
  return set
}

/** 本月每位老师「已上」课次数（含自动按时间算出的已上） */
function countDoneByTeacher(list) {
  const map = {}
  const now = new Date()
  ;(list || []).forEach((b) => {
    const name = b.teacherName
    if (!name) return
    if (resolveBookingStatus(b, now) !== BOOKING_STATUS.done) return
    map[name] = (map[name] || 0) + 1
  })
  return map
}

function byStartTime(a, b) {
  return String(a.startTime).localeCompare(String(b.startTime))
}

function decorateBooking(b) {
  const tones = ['surface', 'primary', 'mint']
  const tone = tones[(b.studentName || '').length % tones.length]
  const resolved = resolveBookingStatus(b)
  return Object.assign({}, b, {
    cardTone: b.cardTone || tone,
    status: resolved,
    statusLabel: statusLabel(resolved)
  })
}

function formatSelectedLabel(dateStr) {
  if (!dateStr) return '当日约课'
  const d = new Date(dateStr.replace(/-/g, '/'))
  return `${d.getMonth() + 1}月${d.getDate()}日 · ${WEEKDAY_CN[d.getDay()]}`
}
