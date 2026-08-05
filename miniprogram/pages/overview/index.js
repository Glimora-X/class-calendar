const { listBookings } = require('../../services/booking')
const { fetchNameList } = require('../../services/name-list')
const { showApiError } = require('../../utils/errors')
const { consumeBookingsDirty } = require('../../utils/sync-flags')
const {
  PRESET,
  resolvePeriod,
  previousPeriod,
  formatPeriodLabel,
  periodTitles,
  buildOverviewStats
} = require('../../utils/overview-stats')

Page({
  data: {
    statusBarHeight: 44,
    navPadTop: 88,
    preset: PRESET.month,
    start: '',
    end: '',
    periodLabel: '',
    courseTitle: '本月课程',
    expenseTitle: '本月支出',
    chips: [
      { id: PRESET.week, label: '本周', active: false },
      { id: PRESET.month, label: '本月', active: true },
      { id: PRESET.year, label: '本年', active: false }
    ],
    customOpen: false,
    customStart: '',
    customEnd: '',
    loading: false,
    total: 0,
    done: 0,
    pending: 0,
    closed: 0,
    expenseLabel: '¥ 0',
    paidCount: 0,
    avgLabel: '¥ 0',
    donutStyle: 'background: conic-gradient(#E5E7EB 0deg 360deg);',
    trendText: '',
    trendUp: false,
    trendFlat: true,
    teachersPreview: [],
    hasMoreTeachers: false,
    empty: false
  },

  onLoad() {
    try {
      const sys = wx.getSystemInfoSync()
      const menu = wx.getMenuButtonBoundingClientRect
        ? wx.getMenuButtonBoundingClientRect()
        : null
      const statusBarHeight = sys.statusBarHeight || 44
      let navPadTop = statusBarHeight + 44
      if (menu && menu.bottom) {
        navPadTop = menu.bottom + 8
      }
      this.setData({ statusBarHeight, navPadTop })
    } catch (e) {
      /* keep defaults */
    }
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
    const force = consumeBookingsDirty()
    if (!this.data.start || force) {
      this.applyPreset(this.data.preset || PRESET.month)
    } else {
      this.refresh({ force })
    }
  },

  applyPreset(preset, custom) {
    const period = resolvePeriod(preset, custom)
    const titles = periodTitles(period.preset)
    const chips = this.data.chips.map((c) =>
      Object.assign({}, c, { active: c.id === period.preset })
    )
    this.setData({
      preset: period.preset,
      start: period.start,
      end: period.end,
      periodLabel: formatPeriodLabel(period.start, period.end, period.preset),
      courseTitle: titles.courseTitle,
      expenseTitle: titles.expenseTitle,
      chips,
      customStart: period.start,
      customEnd: period.end,
      customOpen: false
    })
    this.refresh({ force: true })
  },

  onChip(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    if (id === this.data.preset) {
      this.refresh({ force: true })
      return
    }
    this.applyPreset(id)
  },

  onOpenCustom() {
    this.setData({
      customOpen: !this.data.customOpen,
      customStart: this.data.customStart || this.data.start,
      customEnd: this.data.customEnd || this.data.end
    })
  },

  onCustomStart(e) {
    this.setData({ customStart: e.detail.value })
  },

  onCustomEnd(e) {
    this.setData({ customEnd: e.detail.value })
  },

  onApplyCustom() {
    const start = this.data.customStart
    const end = this.data.customEnd
    if (!start || !end) {
      wx.showToast({ title: '请选择日期', icon: 'none' })
      return
    }
    this.applyPreset(PRESET.custom, { start, end })
  },

  async loadAvatarMap() {
    try {
      const list = await fetchNameList({ silent: true })
      const fileByName = {}
      const fileIds = []
      ;(list.teachers || []).forEach((t) => {
        if (!t || typeof t === 'string' || !t.name || !t.avatarFileID) return
        fileByName[t.name] = t.avatarFileID
        fileIds.push(t.avatarFileID)
      })
      const urlByFile = {}
      if (fileIds.length && wx.cloud && wx.cloud.getTempFileURL) {
        const unique = []
        fileIds.forEach((id) => {
          if (unique.indexOf(id) === -1) unique.push(id)
        })
        const r = await wx.cloud.getTempFileURL({ fileList: unique })
        ;(r.fileList || []).forEach((f) => {
          if (f.fileID && f.tempFileURL) urlByFile[f.fileID] = f.tempFileURL
        })
      }
      const map = {}
      Object.keys(fileByName).forEach((name) => {
        const url = urlByFile[fileByName[name]]
        if (url) map[name] = url
      })
      return map
    } catch (e) {
      return {}
    }
  },

  async refresh(options) {
    const force = !!(options && options.force)
    const { start, end, preset } = this.data
    if (!start || !end) return
    if (this._loading) return
    this._loading = true
    this.setData({ loading: true })
    try {
      const titles = periodTitles(preset)
      const prev = previousPeriod(start, end, preset)
      const tasks = [
        listBookings({ start, end }, { silent: !force, title: '加载中' }),
        this.loadAvatarMap()
      ]
      if (prev) {
        tasks.push(listBookings(prev, { silent: true }))
      }
      const results = await Promise.all(tasks)
      const list = (results[0] && results[0].list) || []
      const avatarMap = results[1] || {}
      let previousTotal = null
      if (prev && results[2]) {
        previousTotal = ((results[2] && results[2].list) || []).length
      }
      const stats = buildOverviewStats(list, Date.now(), {
        previousTotal,
        compareLabel: titles.compareLabel
      })
      const teachersPreview = stats.teachersPreview.map((t) =>
        Object.assign({}, t, {
          avatarUrl: avatarMap[t.name] || ''
        })
      )
      this._bookings = list
      const trend = stats.trend
      this.setData({
        total: stats.total,
        done: stats.done,
        pending: stats.pending,
        closed: stats.closed,
        expenseLabel: stats.expenseLabel,
        paidCount: stats.paidCount,
        avgLabel: stats.avgLabel,
        donutStyle: stats.donutStyle,
        trendText: trend ? trend.text : '',
        trendUp: !!(trend && trend.up),
        trendFlat: !trend || !!trend.flat,
        teachersPreview,
        hasMoreTeachers: stats.hasMoreTeachers,
        empty: stats.total === 0,
        loading: false
      })
    } catch (err) {
      this.setData({ loading: false })
      showApiError(err)
    } finally {
      this._loading = false
    }
  },

  onPullDownRefresh() {
    this.refresh({ force: true }).finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  buildQuery(extra) {
    const q = [
      `start=${encodeURIComponent(this.data.start)}`,
      `end=${encodeURIComponent(this.data.end)}`,
      `period=${encodeURIComponent(this.data.periodLabel)}`
    ]
    Object.keys(extra || {}).forEach((k) => {
      if (extra[k] == null || extra[k] === '') return
      q.push(`${k}=${encodeURIComponent(extra[k])}`)
    })
    return q.join('&')
  },

  onTapCourses(e) {
    const filter = (e.currentTarget.dataset && e.currentTarget.dataset.filter) || ''
    wx.navigateTo({
      url: `/pages/overview-list/index?${this.buildQuery({
        mode: 'courses',
        statusFilter: filter
      })}`
    })
  },

  onTapExpense() {
    wx.navigateTo({
      url: `/pages/overview-list/index?${this.buildQuery({ mode: 'expense' })}`
    })
  },

  onAvgInfo() {
    wx.showToast({
      title: '支出总额 ÷ 已支付节数',
      icon: 'none'
    })
  },

  onTapTeacher(e) {
    const name = e.currentTarget.dataset.name
    if (!name) return
    wx.navigateTo({
      url: `/pages/overview-list/index?${this.buildQuery({
        mode: 'teacher',
        teacherName: name
      })}`
    })
  },

  onTapAllTeachers() {
    wx.navigateTo({
      url: `/pages/overview-list/index?${this.buildQuery({ mode: 'teachers' })}`
    })
  }
})
