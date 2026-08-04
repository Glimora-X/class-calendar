const WEEKDAY_CN = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

const { DAY_CELL_SUMMARY_THRESHOLD } = require('../../utils/constants')
const { addMonths } = require('../../utils/date-utils')
const { formatMonthKey, monthRange, formatDate, pad } = require('../../utils/format')
const {
  getMonthBookings,
  setMonthBookings,
  isMonthBookingsFresh
} = require('../../utils/cache')
const { listBookings } = require('../../services/booking')
const { fetchNameList } = require('../../services/name-list')
const { showApiError } = require('../../utils/errors')
const { consumeBookingsDirty } = require('../../utils/sync-flags')
const {
  resolveBookingStatus,
  statusLabel,
  teacherInitial
} = require('../../utils/booking-status')
const { holidaysInMonth } = require('../../utils/holidays')
const {
  findImminentBookings,
  inAppToastKey,
  hasShownInAppToast,
  markInAppToastShown
} = require('../../utils/reminder')

const COLOR_TO_TONE = {
  accent: 'primary',
  pro: 'pro',
  success: 'mint',
  warning: 'warning'
}

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
    holidays: {},
    dayBookings: [],
    timelineGroups: [],
    monthBookings: [],
    teacherColorMap: {},
    loading: false
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
    const force = consumeBookingsDirty()
    if (this.data.year) {
      this.refreshMonth({ force }).then(() => this.checkImminentReminders())
    } else {
      this.checkImminentReminders()
    }
    this.loadTeacherColors()
  },

  onLoad() {
    const now = new Date()
    this.setViewing(now.getFullYear(), now.getMonth() + 1, formatDate(now), {
      force: true
    })
    this.loadTeacherColors()
  },

  async loadTeacherColors() {
    try {
      const list = await fetchNameList({ silent: true })
      const map = {}
      ;(list.teachers || []).forEach((t) => {
        if (!t) return
        if (typeof t === 'string') map[t] = 'primary'
        else if (t.name) map[t.name] = COLOR_TO_TONE[t.color] || 'primary'
      })
      this.setData({ teacherColorMap: map })
      if (this.data.monthBookings && this.data.monthBookings.length) {
        this.recomputeViews(this.data.monthBookings)
      }
    } catch (e) {
      /* ignore */
    }
  },

  setViewing(year, month, selectedDate, options) {
    const app = getApp()
    app.globalData.viewingYear = year
    app.globalData.viewingMonth = month
    const date = selectedDate || `${year}-${pad(month)}-01`
    this.setData({
      year,
      month,
      selectedDate: date,
      holidays: holidaysInMonth(year, month),
      dayBookings: [],
      timelineGroups: [],
      summaryText: ''
    })
    const force = !(options && options.force === false)
    this.refreshMonth({ force })
  },

  onMonthChange(e) {
    const next = addMonths(this.data.year, this.data.month, e.detail.delta)
    this.setViewing(next.year, next.month, null, { force: true })
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

  onTapBatch() {
    wx.navigateTo({ url: '/pages/booking-batch/index' })
  },

  onTapCopyMonth() {
    wx.navigateTo({ url: '/pages/booking-copy-month/index' })
  },

  checkImminentReminders() {
    const list = findImminentBookings(this.data.monthBookings || [])
    if (!list.length) return
    const b = list[0]
    const key = inAppToastKey(b)
    if (hasShownInAppToast(key)) return
    markInAppToastShown(key)
    const content = `${b.studentName || ''} · ${b.teacherName || ''}\n${b.date} ${b.startTime}-${b.endTime}`
    wx.showModal({
      title: '即将上课',
      content,
      confirmText: b._id ? '查看' : '知道了',
      showCancel: !!b._id,
      success: (res) => {
        if (res.confirm && b._id) {
          wx.navigateTo({ url: `/pages/booking-edit/index?id=${b._id}` })
        }
      }
    })
  },

  /**
   * @param {{ force?: boolean }} [options] force=true 跳过 TTL，必拉云
   */
  async refreshMonth(options) {
    const force = !!(options && options.force)
    const { year, month } = this.data
    const monthKey = formatMonthKey(year, month)
    const cached = getMonthBookings(monthKey)
    if (cached) this.applyMonthList(cached)

    if (!force && cached && isMonthBookingsFresh(monthKey)) {
      return
    }

    this.setData({ loading: true })
    try {
      const { start, end } = monthRange(year, month)
      const { list } = await listBookings({ start, end }, { silent: !force && !!cached })
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
    const { filterTeacher, selectedDate, teacherColorMap } = this.data
    const filtered = filterTeacher
      ? list.filter((b) => b.teacherName === filterTeacher)
      : list

    const teachers = uniqueTeachers(list)
    const totalByTeacher = countByTeacher(list)
    const chips = [
      { id: 'all', label: '全部', active: !filterTeacher, tone: '' },
      ...teachers.map((name) => {
        const total = totalByTeacher[name] || 0
        const tone = teacherColorMap[name] || 'primary'
        return {
          id: name,
          label: `${name} ${total}`,
          active: filterTeacher === name,
          tone
        }
      })
    ]

    const byDate = {}
    filtered.forEach((b) => {
      if (!byDate[b.date]) byDate[b.date] = []
      byDate[b.date].push(decorateBooking(b, teacherColorMap))
    })

    const marks = Object.keys(byDate).map((date) => {
      const items = byDate[date] || []
      const count = items.length
      const firstTone = (items[0] && items[0].cardTone) || 'primary'
      const tone = firstTone === 'surface' ? 'primary' : firstTone
      return {
        date,
        tone,
        count,
        summary: count > DAY_CELL_SUMMARY_THRESHOLD ? `${count}节` : ''
      }
    })

    const dayBookings = (byDate[selectedDate] || []).slice().sort(byStartTime)
    const selectedLabel = formatSelectedLabel(selectedDate)

    const timelineGroups = Object.keys(byDate)
      .sort()
      .map((date) => {
        const d = new Date(date.replace(/-/g, '/'))
        const items = byDate[date].slice().sort(byStartTime)
        const first = items[0]
        const statusDotClass =
          (first && first.status) || 'pending'
        return {
          date,
          day: pad(d.getDate()),
          weekdayLabel: WEEKDAY_CN[d.getDay()],
          statusDotClass,
          items
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

/** 本月每位老师约课总数（不区分状态） */
function countByTeacher(list) {
  const map = {}
  ;(list || []).forEach((b) => {
    const name = b.teacherName
    if (!name) return
    map[name] = (map[name] || 0) + 1
  })
  return map
}

function byStartTime(a, b) {
  return String(a.startTime).localeCompare(String(b.startTime))
}

function decorateBooking(b, teacherColorMap) {
  const map = teacherColorMap || {}
  const fromTeacher = b.teacherName && map[b.teacherName]
  const fallback = ['surface', 'primary', 'mint'][(b.studentName || '').length % 3]
  const resolved = resolveBookingStatus(b)
  const student = String(b.studentName || '').trim() || '学员'
  const subject = String(b.subjectName || '').trim() || '科目'
  return Object.assign({}, b, {
    cardTone: fromTeacher || b.cardTone || fallback,
    status: resolved,
    statusLabel: statusLabel(resolved),
    teacherInitial: teacherInitial(b.teacherName),
    metaLine: `${student} | ${subject}`
  })
}

function formatSelectedLabel(dateStr) {
  if (!dateStr) return '当日约课'
  const d = new Date(dateStr.replace(/-/g, '/'))
  return `${d.getMonth() + 1}月${d.getDate()}日 · ${WEEKDAY_CN[d.getDay()]}`
}
