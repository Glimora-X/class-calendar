const WEEKDAY_CN = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

const { addMonths } = require('../../utils/date-utils')
const { formatMonthKey, monthRange, formatDate, pad } = require('../../utils/format')
const { getMonthBookings, setMonthBookings } = require('../../utils/cache')
const { listBookings } = require('../../services/booking')
const { showApiError } = require('../../utils/errors')

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
      if (!cached) {
        // 骨架演示：无云时用本地示意数据，方便看 UI
        const demo = buildDemoBookings(year, month)
        this.applyMonthList(demo)
        if (!demo.length) showApiError(err)
      }
    } finally {
      this.setData({ loading: false })
    }
  },

  applyMonthList(list) {
    const rows = list || []
    let selectedDate = this.data.selectedDate
    const hasSelected = rows.some((b) => b.date === selectedDate)
    if (!hasSelected && rows.length) {
      selectedDate = rows.slice().sort((a, b) => a.date.localeCompare(b.date))[0].date
    }
    this.setData({ monthBookings: rows, selectedDate })
    this.recomputeViews(rows)
  },

  recomputeViews(list) {
    const { filterTeacher, selectedDate } = this.data
    const filtered = filterTeacher
      ? list.filter((b) => b.teacherName === filterTeacher)
      : list

    const teachers = uniqueTeachers(list)
    const chips = [
      { id: 'all', label: '全部', active: !filterTeacher },
      ...teachers.map((name) => ({
        id: name,
        label: name,
        active: filterTeacher === name
      }))
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

function byStartTime(a, b) {
  return String(a.startTime).localeCompare(String(b.startTime))
}

function decorateBooking(b) {
  const tones = ['surface', 'primary', 'mint']
  const tone = tones[(b.studentName || '').length % tones.length]
  return Object.assign({}, b, { cardTone: b.cardTone || tone })
}

function formatSelectedLabel(dateStr) {
  if (!dateStr) return '当日约课'
  const d = new Date(dateStr.replace(/-/g, '/'))
  return `${d.getMonth() + 1}月${d.getDate()}日 · ${WEEKDAY_CN[d.getDay()]}`
}

/** 仅 UI 联调：云未就绪时展示示意数据 */
function buildDemoBookings(year, month) {
  const d8 = `${year}-${pad(month)}-08`
  const d11 = `${year}-${pad(month)}-11`
  const d20 = `${year}-${pad(month)}-20`
  return [
    {
      _id: 'demo-1',
      studentName: '小明',
      teacherName: '王老师',
      subjectName: '英语',
      date: d8,
      startTime: '19:30',
      endTime: '19:55',
      cardTone: 'mint'
    },
    {
      _id: 'demo-2',
      studentName: '小红',
      teacherName: '李老师',
      subjectName: '数学',
      date: d11,
      startTime: '10:00',
      endTime: '11:00',
      cardTone: 'surface'
    },
    {
      _id: 'demo-3',
      studentName: '小明',
      teacherName: '王老师',
      subjectName: '英语',
      date: d11,
      startTime: '19:30',
      endTime: '19:55',
      cardTone: 'primary'
    },
    {
      _id: 'demo-4',
      studentName: '小杰',
      teacherName: '张老师',
      subjectName: '钢琴',
      date: d20,
      startTime: '16:00',
      endTime: '16:45',
      cardTone: 'surface'
    }
  ]
}
