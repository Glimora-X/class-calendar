const WEEKDAY_CN = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

const { DAY_CELL_SUMMARY_THRESHOLD } = require('../../utils/constants')
const { buildMarks, buildLegend } = require('../../utils/calendar-marks')
const {
  filterByStudent,
  resolveFilterStudent,
  shouldShowStudentFilter,
  nextFilterStudent,
  studentFilterLabel
} = require('../../utils/student-filter')
const { getFilterStudent, setFilterStudent } = require('../../utils/prefs')
const { addMonths } = require('../../utils/date-utils')
const { formatMonthKey, monthRange, formatDate, pad } = require('../../utils/format')
const {
  getMonthBookings,
  setMonthBookings,
  isMonthBookingsFresh,
  getMonthHolds,
  setMonthHolds,
  isMonthHoldsFresh
} = require('../../utils/cache')
const { listBookings, batchDeleteBookings } = require('../../services/booking')
const { fetchNameList } = require('../../services/name-list')
const {
  listDayHolds,
  upsertDayHold,
  removeDayHold
} = require('../../services/day-hold')
const { showApiError, showWriteError } = require('../../utils/errors')
const {
  holdsToMap,
  isHoldDate,
  normalizeReason
} = require('../../utils/day-hold')
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
const { resolveTeacherAvatarUrl } = require('../../utils/avatar-presets')
const { buildBookingEditUrl } = require('../../utils/booking-edit-nav')
const {
  normalizeDeleteIds,
  toggleSelectedId,
  selectedIdList
} = require('../../utils/booking-batch-delete')
const {
  measureTimelinePoster,
  fitPosterCanvasSize,
  drawTimelinePoster,
  collectPosterImageUrls
} = require('../../utils/timeline-poster')

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
    filterStudent: '',
    showStudentCycle: false,
    studentLabel: '全部',
    stageClass: '',
    chips: [],
    students: [],
    marks: [],
    legend: [],
    holidays: {},
    holdMap: {},
    selectedHoldReason: '',
    showHoldEditor: false,
    holdReasonDraft: '',
    dayBookings: [],
    timelineGroups: [],
    monthBookings: [],
    teacherColorMap: {},
    teacherAvatarUrlMap: {},
    loading: false,
    selecting: false,
    selectedMap: {},
    selectedCount: 0
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
    this.loadNameMeta()
  },

  onLoad() {
    const now = new Date()
    this.setData({ filterStudent: getFilterStudent() })
    this.setViewing(now.getFullYear(), now.getMonth() + 1, formatDate(now), {
      force: true
    })
    this.loadNameMeta()
  },

  async loadNameMeta() {
    try {
      const list = await fetchNameList({ silent: true, force: true })
      const students = list.students || []
      const filterStudent = resolveFilterStudent(getFilterStudent(), students)
      if (filterStudent !== getFilterStudent()) {
        setFilterStudent(filterStudent)
      }

      const map = {}
      const fileByName = {}
      const fileIds = []
      ;(list.teachers || []).forEach((t) => {
        if (!t) return
        if (typeof t === 'string') {
          map[t] = 'primary'
          return
        }
        if (!t.name) return
        map[t.name] = COLOR_TO_TONE[t.color] || 'primary'
        if (t.avatarFileID) {
          fileByName[t.name] = t.avatarFileID
          fileIds.push(t.avatarFileID)
        }
      })

      const urlByFile = {}
      if (fileIds.length && wx.cloud && wx.cloud.getTempFileURL) {
        try {
          const unique = []
          fileIds.forEach((id) => {
            if (unique.indexOf(id) === -1) unique.push(id)
          })
          const r = await wx.cloud.getTempFileURL({ fileList: unique })
          ;(r.fileList || []).forEach((f) => {
            if (f.fileID && f.tempFileURL) urlByFile[f.fileID] = f.tempFileURL
          })
        } catch (e) {
          /* 无 URL 时时间轴退回首字 */
        }
      }

      const teacherAvatarUrlMap = {}
      Object.keys(fileByName).forEach((name) => {
        const fid = fileByName[name]
        if (urlByFile[fid]) teacherAvatarUrlMap[name] = urlByFile[fid]
      })
      ;(list.teachers || []).forEach((t) => {
        if (!t || typeof t === 'string' || !t.name) return
        if (teacherAvatarUrlMap[t.name]) return
        const src = resolveTeacherAvatarUrl(t, urlByFile)
        if (src) teacherAvatarUrlMap[t.name] = src
      })

      this.setData({
        students,
        filterStudent,
        showStudentCycle: shouldShowStudentFilter(students),
        studentLabel: studentFilterLabel(filterStudent),
        teacherColorMap: map,
        teacherAvatarUrlMap
      })
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
      summaryText: '',
      showHoldEditor: false,
      holdReasonDraft: '',
      selecting: false,
      selectedMap: {},
      selectedCount: 0
    })
    const force = !(options && options.force === false)
    this.refreshMonth({ force })
  },

  onMonthChange(e) {
    const next = addMonths(this.data.year, this.data.month, e.detail.delta)
    this.setViewing(next.year, next.month, null, { force: true })
  },

  onModeChange(e) {
    this.setData({
      mode: e.detail.mode,
      selecting: false,
      selectedMap: {},
      selectedCount: 0
    })
  },

  onStudentCycle() {
    if (!shouldShowStudentFilter(this.data.students)) return
    if (this._studentAnimLock) return
    const filterStudent = nextFilterStudent(this.data.students, this.data.filterStudent)
    this._studentAnimLock = true
    if (this._stageTimer) clearTimeout(this._stageTimer)
    if (this._stageClearTimer) clearTimeout(this._stageClearTimer)
    this.setData({ stageClass: 'is-out' })
    this._stageTimer = setTimeout(() => {
      setFilterStudent(filterStudent)
      this.setData({
        filterStudent,
        studentLabel: studentFilterLabel(filterStudent),
        stageClass: 'is-in',
        selecting: false,
        selectedMap: {},
        selectedCount: 0
      })
      this.recomputeViews(this.data.monthBookings)
      this._stageClearTimer = setTimeout(() => {
        this.setData({ stageClass: '' })
        this._studentAnimLock = false
      }, 180)
    }, 90)
  },

  onFilterChange(e) {
    const id = e.detail.id
    const filterTeacher = id === 'all' ? '' : id
    this.setData({
      filterTeacher,
      selecting: false,
      selectedMap: {},
      selectedCount: 0
    })
    this.recomputeViews(this.data.monthBookings)
  },

  onSelectDate(e) {
    const date = e.detail.date
    this.setData({
      selectedDate: date,
      showHoldEditor: false,
      holdReasonDraft: ''
    })
    this.recomputeViews(this.data.monthBookings)
  },

  onTapMarkHold() {
    this.setData({
      showHoldEditor: true,
      holdReasonDraft: this.data.selectedHoldReason || ''
    })
  },

  onTapEditHold() {
    this.setData({
      showHoldEditor: true,
      holdReasonDraft: this.data.selectedHoldReason || ''
    })
  },

  onCancelHoldEditor() {
    this.setData({ showHoldEditor: false, holdReasonDraft: '' })
  },

  onHoldReasonInput(e) {
    this.setData({ holdReasonDraft: e.detail.value })
  },

  async onSaveHold() {
    const date = this.data.selectedDate
    const parsed = normalizeReason(this.data.holdReasonDraft)
    if (!parsed.ok) {
      wx.showToast({ title: parsed.message, icon: 'none' })
      return
    }
    try {
      await upsertDayHold({ date, reason: parsed.reason })
      const holdMap = Object.assign({}, this.data.holdMap, { [date]: parsed.reason })
      this.applyHoldMap(holdMap)
      this.setData({ showHoldEditor: false, holdReasonDraft: '' })
      wx.showToast({ title: '已记下', icon: 'none' })
    } catch (err) {
      showWriteError(err)
    }
  },

  async onTapRemoveHold() {
    const date = this.data.selectedDate
    const confirm = await new Promise((resolve) => {
      wx.showModal({
        title: '取消标记',
        content: '这天就不再标其他安排了？',
        success: (res) => resolve(!!res.confirm)
      })
    })
    if (!confirm) return
    try {
      await removeDayHold({ date })
      const holdMap = Object.assign({}, this.data.holdMap)
      delete holdMap[date]
      this.applyHoldMap(holdMap)
      wx.showToast({ title: '已取消', icon: 'none' })
    } catch (err) {
      showWriteError(err)
    }
  },

  onTapBatch() {
    wx.navigateTo({ url: '/pages/booking-batch/index' })
  },

  onTapBatchDelete() {
    const { year, month } = this.data
    wx.navigateTo({
      url: `/pages/booking-batch-delete/index?year=${year}&month=${month}`
    })
  },

  onTapCopyMonth() {
    wx.navigateTo({ url: '/pages/booking-copy-month/index' })
  },

  exitSelectMode() {
    this.setData({
      selecting: false,
      selectedMap: {},
      selectedCount: 0
    })
  },

  onEnterSelect() {
    this.setData({
      selecting: true,
      selectedMap: {},
      selectedCount: 0
    })
  },

  onCancelSelect() {
    this.exitSelectMode()
  },

  onSelectAllTimeline() {
    const map = {}
    ;(this.data.timelineGroups || []).forEach((g) => {
      ;(g.items || []).forEach((b) => {
        if (b && b._id) map[b._id] = true
      })
    })
    this.setData({
      selectedMap: map,
      selectedCount: selectedIdList(map).length
    })
  },

  bookingEditUrl(extra) {
    const q = Object.assign({}, extra || {})
    if (!q.id) {
      if (!q.date) q.date = this.data.selectedDate
      if (q.studentName == null) q.studentName = this.data.filterStudent
    }
    return buildBookingEditUrl(q)
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
          wx.navigateTo({ url: this.bookingEditUrl({ id: b._id }) })
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
    const cachedBookings = getMonthBookings(monthKey)
    const cachedHolds = getMonthHolds(monthKey)
    if (cachedBookings) this.applyMonthList(cachedBookings)
    if (cachedHolds) this.applyHoldMap(holdsToMap(cachedHolds), { skipPersist: true })

    const bookingsFresh = !force && cachedBookings && isMonthBookingsFresh(monthKey)
    const holdsFresh = !force && cachedHolds && isMonthHoldsFresh(monthKey)
    if (bookingsFresh && holdsFresh) {
      return
    }

    this.setData({ loading: true })
    const { start, end } = monthRange(year, month)
    try {
      const tasks = []
      if (!bookingsFresh) {
        tasks.push(
          listBookings({ start, end }, { silent: !force && !!cachedBookings }).then((res) => {
            const rows = (res && res.list) || []
            setMonthBookings(monthKey, rows)
            this.applyMonthList(rows)
          })
        )
      }
      if (!holdsFresh) {
        tasks.push(
          listDayHolds({ start, end }, { silent: !force && !!cachedHolds }).then((res) => {
            const rows = (res && res.list) || []
            setMonthHolds(monthKey, rows)
            this.applyHoldMap(holdsToMap(rows), { skipPersist: true })
          })
        )
      }
      await Promise.all(tasks)
    } catch (err) {
      if (!cachedBookings) this.applyMonthList([])
      if (!cachedHolds) this.applyHoldMap({}, { skipPersist: true })
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

  applyHoldMap(holdMap, options) {
    const map = holdMap || {}
    if (!(options && options.skipPersist)) {
      const { year, month } = this.data
      const monthKey = formatMonthKey(year, month)
      const list = Object.keys(map).map((date) => ({ date, reason: map[date] }))
      setMonthHolds(monthKey, list)
    }
    this.setData({ holdMap: map })
    this.recomputeViews(this.data.monthBookings)
  },

  recomputeViews(list) {
    const {
      filterTeacher,
      filterStudent,
      selectedDate,
      teacherColorMap,
      teacherAvatarUrlMap,
      students,
      holdMap
    } = this.data

    const afterStudent = filterByStudent(list, filterStudent)
    const filtered = filterTeacher
      ? afterStudent.filter((b) => b.teacherName === filterTeacher)
      : afterStudent

    const teachers = uniqueTeachers(afterStudent)
    const totalByTeacher = countByTeacher(afterStudent)
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
      byDate[b.date].push(
        decorateBooking(b, teacherColorMap, teacherAvatarUrlMap)
      )
    })

    const flatForMarks = []
    Object.keys(byDate).forEach((date) => {
      ;(byDate[date] || []).forEach((b) => flatForMarks.push(b))
    })
    const marks = buildMarks(flatForMarks, DAY_CELL_SUMMARY_THRESHOLD)
    const legend = buildLegend(teachers, teacherColorMap)

    const dayBookings = (byDate[selectedDate] || []).slice().sort(byStartTime)
    const selectedLabel = formatSelectedLabel(selectedDate)
    const selectedHoldReason = isHoldDate(holdMap, selectedDate)
      ? (holdMap && holdMap[selectedDate]) || ''
      : ''

    const todayStr = formatDate(new Date())
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
          isToday: date === todayStr,
          statusDotClass,
          holdReason: isHoldDate(holdMap, date) ? (holdMap && holdMap[date]) || '' : '',
          items
        }
      })

    this.setData({
      chips,
      showStudentCycle: shouldShowStudentFilter(students),
      studentLabel: studentFilterLabel(filterStudent),
      marks,
      legend,
      dayBookings,
      selectedLabel,
      selectedHoldReason,
      timelineGroups,
      summaryText: filtered.length ? `本月 ${filtered.length} 节` : '本月还没有课'
    })
  },

  onTapBooking(e) {
    const id = (e.detail && e.detail.id) || ''
    wx.navigateTo({
      url: id ? this.bookingEditUrl({ id }) : this.bookingEditUrl()
    })
  },

  onTapTimelineItem(e) {
    if (this.data.selecting) {
      const id = (e.detail && e.detail.id) || ''
      const selectedMap = toggleSelectedId(this.data.selectedMap, id)
      this.setData({
        selectedMap,
        selectedCount: selectedIdList(selectedMap).length
      })
      return
    }
    this.onTapBooking(e)
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
      this.exitSelectMode()
      await this.refreshMonth({ force: true })
      const n = (result && result.deleted) || 0
      wx.showToast({
        title: n ? `已删掉 ${n} 节` : '没有删掉课程',
        icon: 'none'
      })
    } catch (err) {
      showWriteError(err)
    }
  },

  onSaveTimelinePoster() {
    if (this._posterBusy) return
    const groups = this.data.timelineGroups || []
    if (!groups.length) {
      wx.showToast({ title: '本月还没有课', icon: 'none' })
      return
    }
    this._posterBusy = true
    wx.showLoading({ title: '生成长图…', mask: true })
    this.exportTimelinePoster(groups)
      .then(() => {
        wx.hideLoading()
        wx.showToast({ title: '已保存到相册', icon: 'success' })
      })
      .catch((err) => {
        wx.hideLoading()
        const msg = String((err && err.errMsg) || err || '')
        if (err === 'AUTH_DENY' || /auth deny|authorize/i.test(msg)) {
          wx.showModal({
            title: '需要相册权限',
            content: '保存长图需要写入相册，请在设置里打开。',
            confirmText: '去设置',
            success: (r) => {
              if (r.confirm) wx.openSetting()
            }
          })
          return
        }
        wx.showToast({ title: '保存失败，请重试', icon: 'none' })
      })
      .then(() => {
        this._posterBusy = false
      })
  },

  exportTimelinePoster(groups) {
    const layout = measureTimelinePoster(groups, {
      year: this.data.year,
      month: this.data.month,
      studentLabel: this.data.studentLabel,
      summaryText: this.data.summaryText
    })
    const sys = wx.getSystemInfoSync ? wx.getSystemInfoSync() : {}
    const size = fitPosterCanvasSize(layout.height, sys.pixelRatio || 2)
    return this.ensurePosterCanvas(size)
      .then((canvas) => this.drawPosterOnCanvas(canvas, layout, size, groups))
      .then((canvas) => this.canvasToTempFile(canvas))
      .then((filePath) => this.savePosterFile(filePath))
  },

  ensurePosterCanvas(size) {
    return new Promise((resolve, reject) => {
      wx.createSelectorQuery()
        .select('#tlPosterCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          const canvas = res && res[0] && res[0].node
          if (!canvas) {
            reject(new Error('NO_CANVAS'))
            return
          }
          canvas.width = size.pixelWidth
          canvas.height = size.pixelHeight
          resolve(canvas)
        })
    })
  },

  drawPosterOnCanvas(canvas, layout, size, groups) {
    const ctx = canvas.getContext('2d')
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(size.dpr, size.dpr)
    const urls = collectPosterImageUrls(groups)
    return Promise.all(urls.map((url) => loadCanvasImage(canvas, url))).then(
      (images) => {
        const map = {}
        urls.forEach((url, i) => {
          if (images[i]) map[url] = images[i]
        })
        drawTimelinePoster(ctx, layout, map)
        return canvas
      }
    )
  },

  canvasToTempFile(canvas) {
    return new Promise((resolve, reject) => {
      wx.canvasToTempFilePath({
        canvas,
        fileType: 'png',
        success: (r) => resolve(r.tempFilePath),
        fail: reject
      })
    })
  },

  savePosterFile(filePath) {
    return new Promise((resolve, reject) => {
      wx.saveImageToPhotosAlbum({
        filePath,
        success: resolve,
        fail: (err) => {
          const msg = String((err && err.errMsg) || '')
          if (/auth deny|authorize/i.test(msg)) {
            wx.getSetting({
              success: (s) => {
                const granted = s.authSetting && s.authSetting['scope.writePhotosAlbum']
                if (granted === false) {
                  reject('AUTH_DENY')
                  return
                }
                wx.authorize({
                  scope: 'scope.writePhotosAlbum',
                  success: () => {
                    wx.saveImageToPhotosAlbum({
                      filePath,
                      success: resolve,
                      fail: () => reject('AUTH_DENY')
                    })
                  },
                  fail: () => reject('AUTH_DENY')
                })
              },
              fail: () => reject(err)
            })
            return
          }
          reject(err)
        }
      })
    })
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

function decorateBooking(b, teacherColorMap, teacherAvatarUrlMap) {
  const map = teacherColorMap || {}
  const avatarMap = teacherAvatarUrlMap || {}
  const fromTeacher = b.teacherName && map[b.teacherName]
  const fallback = ['surface', 'primary', 'mint'][(b.studentName || '').length % 3]
  const resolved = resolveBookingStatus(b)
  const student = String(b.studentName || '').trim() || '学生'
  const subject = String(b.subjectName || '').trim() || '科目'
  return Object.assign({}, b, {
    cardTone: fromTeacher || b.cardTone || fallback,
    status: resolved,
    statusLabel: statusLabel(resolved),
    teacherInitial: teacherInitial(b.teacherName),
    teacherAvatarUrl: (b.teacherName && avatarMap[b.teacherName]) || '',
    metaLine: `${student} | ${subject}`
  })
}

function formatSelectedLabel(dateStr) {
  if (!dateStr) return '当天课程'
  const d = new Date(dateStr.replace(/-/g, '/'))
  return `${d.getMonth() + 1}月${d.getDate()}日 · ${WEEKDAY_CN[d.getDay()]}`
}

function loadCanvasImage(canvas, url) {
  return new Promise((resolve) => {
    if (!url || !canvas || !canvas.createImage) {
      resolve(null)
      return
    }
    const img = canvas.createImage()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}
