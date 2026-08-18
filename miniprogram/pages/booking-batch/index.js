const { DEFAULT_TIME, DEFAULT_SUBJECT_NAME, WEEKDAY_CN } = require('../../utils/constants')
const { datesByWeekday } = require('../../utils/date-utils')
const {
  formatMonthKey,
  formatTime,
  addMinutesToTime,
  minutesBetweenTimes,
  monthRange
} = require('../../utils/format')
const { listSubjects } = require('../../services/subject')
const { batchCreateBookings } = require('../../services/booking')
const { listDayHolds } = require('../../services/day-hold')
const {
  holdsToMap,
  isHoldDate,
  partitionBatchDates
} = require('../../utils/day-hold')
const {
  fetchNameList,
  appendName,
  studentNames
} = require('../../services/name-list')
const { getLastSubjectId, setLastSubjectId } = require('../../utils/cache')
const { showApiError, showWriteError } = require('../../utils/errors')
const {
  getClassDurationMinutes,
  getRemindMinutesBefore
} = require('../../utils/prefs')
const { teacherDefaultPrice } = require('../../utils/price')

const WEEKDAY_OPTIONS = WEEKDAY_CN.map((label, value) => ({
  value,
  label: `星期${label}`
}))

Page({
  data: {
    year: 0,
    month: 0,
    monthLabel: '',
    weekdayPickerIndex: 1,
    weekdayIndex: 1,
    weekdayOptions: WEEKDAY_OPTIONS,
    weekdayLabel: '星期一',
    studentName: '',
    teacherName: '',
    subjectId: '',
    subjectName: DEFAULT_SUBJECT_NAME,
    subjects: [],
    startTime: DEFAULT_TIME.startTime,
    endTime: DEFAULT_TIME.endTime,
    note: '',
    studentSuggestions: [],
    teacherSuggestions: [],
    teacherProfiles: [],
    previewRows: [],
    selectedPreviewCount: 0,
    skippedHoldCount: 0,
    previewOpen: false,
    holdMap: {},
    saving: false
  },

  onLoad() {
    const app = getApp()
    const now = new Date()
    const year = app.globalData.viewingYear || now.getFullYear()
    const month = app.globalData.viewingMonth || now.getMonth() + 1
    const startTime = formatTime(now)
    this.setData({
      year,
      month,
      monthLabel: `${year}年${month}月`,
      startTime,
      endTime: addMinutesToTime(startTime, getClassDurationMinutes())
    })
    this.loadSubjects()
    this.loadNames()
    this.refreshPreview()
  },

  async loadSubjects() {
    try {
      const { list } = await listSubjects()
      const subjects = list || []
      const lastId = getLastSubjectId()
      const preferred =
        subjects.find((s) => s._id === lastId) ||
        subjects.find((s) => s.name === DEFAULT_SUBJECT_NAME) ||
        subjects[0]
      this.setData({
        subjects,
        subjectId: preferred ? preferred._id : '',
        subjectName: preferred ? preferred.name : DEFAULT_SUBJECT_NAME
      })
    } catch (err) {
      showApiError(err)
    }
  },

  async loadNames() {
    try {
      const list = await fetchNameList({ silent: true })
      const profiles = list.teachers || []
      const teachers = profiles
        .map((t) => (typeof t === 'string' ? t : t.name))
        .filter(Boolean)
      this.setData({
        studentSuggestions: studentNames(list.students),
        teacherSuggestions: teachers,
        teacherProfiles: profiles
      })
    } catch (e) {
      /* ignore */
    }
  },

  async loadHoldMap(year, month) {
    const y = year != null ? year : this.data.year
    const m = month != null ? month : this.data.month
    try {
      const { start, end } = monthRange(y, m)
      const { list } = await listDayHolds({ start, end }, { silent: true })
      return holdsToMap(list || [])
    } catch (e) {
      return {}
    }
  },

  async refreshPreview(year, month, weekdayIndex) {
    const y = year != null ? year : this.data.year
    const m = month != null ? month : this.data.month
    const w = weekdayIndex != null ? weekdayIndex : this.data.weekdayIndex
    const dates = datesByWeekday(y, m, w)
    const holdMap = await this.loadHoldMap(y, m)
    const previewRows = dates.map((date) => {
      const hold = isHoldDate(holdMap, date)
      return {
        date,
        holdReason: hold ? holdMap[date] || '' : '',
        selected: !hold
      }
    })
    this.setData({
      holdMap,
      previewRows,
      selectedPreviewCount: previewRows.filter((r) => r.selected).length,
      skippedHoldCount: previewRows.filter((r) => r.holdReason && !r.selected).length
    })
  },

  onMonthPrev() {
    this.shiftMonth(-1)
  },

  onMonthNext() {
    this.shiftMonth(1)
  },

  shiftMonth(delta) {
    const d = new Date(this.data.year, this.data.month - 1 + delta, 1)
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    this.setData({
      year,
      month,
      monthLabel: `${year}年${month}月`
    })
    this.refreshPreview(year, month, this.data.weekdayIndex)
  },

  onWeekdayChange(e) {
    const idx = Number(e.detail.value)
    const selected = WEEKDAY_OPTIONS[idx] || WEEKDAY_OPTIONS[1]
    this.setData({
      weekdayPickerIndex: idx,
      weekdayIndex: selected.value,
      weekdayLabel: selected.label
    })
    this.refreshPreview(this.data.year, this.data.month, selected.value)
  },

  onStudentInput(e) {
    this.setData({ studentName: e.detail.value })
  },

  onTeacherInput(e) {
    this.setData({ teacherName: e.detail.value })
  },

  onStartTimeChange(e) {
    const startTime = e.detail.value
    const duration = minutesBetweenTimes(this.data.startTime, this.data.endTime)
    const minutes = Number.isFinite(duration)
      ? duration
      : getClassDurationMinutes()
    this.setData({
      startTime,
      endTime: addMinutesToTime(startTime, minutes)
    })
  },

  onEndTimeChange(e) {
    this.setData({ endTime: e.detail.value })
  },

  onNoteInput(e) {
    this.setData({ note: e.detail.value })
  },

  onSubjectChange(e) {
    const { subjectId, subjectName } = e.detail
    this.setData({ subjectId, subjectName })
    setLastSubjectId(subjectId)
  },

  onTogglePreview() {
    this.setData({ previewOpen: !this.data.previewOpen })
  },

  onTogglePreviewRow(e) {
    const date = e.currentTarget.dataset.date
    const previewRows = (this.data.previewRows || []).map((row) => {
      if (row.date !== date) return row
      return Object.assign({}, row, { selected: !row.selected })
    })
    this.setData({
      previewRows,
      selectedPreviewCount: previewRows.filter((r) => r.selected).length,
      skippedHoldCount: previewRows.filter((r) => r.holdReason && !r.selected).length
    })
  },

  async onSubmit() {
    const {
      year,
      month,
      weekdayIndex,
      studentName,
      teacherName,
      subjectId,
      subjectName,
      startTime,
      endTime,
      note,
      saving,
      previewRows,
      holdMap
    } = this.data
    if (saving) return
    if (!studentName || !teacherName || !subjectId || !startTime || !endTime) {
      wx.showToast({ title: '还有没填完的哦', icon: 'none' })
      return
    }
    if (String(subjectId).indexOf('local-') === 0) {
      wx.showToast({ title: '请先开通云开发并部署科目云函数', icon: 'none' })
      return
    }

    const dates = datesByWeekday(year, month, weekdayIndex)
    if (!dates.length) {
      wx.showToast({ title: '该月没有对应星期', icon: 'none' })
      return
    }

    const includedHoldDates = (previewRows || [])
      .filter((r) => r.selected && r.holdReason)
      .map((r) => r.date)
    const { selected, skippedHolds } = partitionBatchDates(
      dates,
      holdMap,
      includedHoldDates
    )
    // 再与预览勾选对齐：未选中的非占用日也不写
    const selectedSet = {}
    ;(previewRows || []).forEach((r) => {
      if (r.selected) selectedSet[r.date] = true
    })
    const writeDates = selected.filter((d) => selectedSet[d])
    if (!writeDates.length) {
      wx.showToast({ title: '请至少选择一天', icon: 'none' })
      return
    }

    const skipped = skippedHolds.length
    const confirm = await new Promise((resolve) => {
      wx.showModal({
        title: '确认创建',
        content: skipped
          ? `将创建 ${writeDates.length} 节（已跳过有其他安排的 ${skipped} 天），可以吗？`
          : `将在 ${year}年${month}月 记上 ${writeDates.length} 节，可以吗？`,
        success: (res) => resolve(!!res.confirm)
      })
    })
    if (!confirm) return

    const price = teacherDefaultPrice(this.data.teacherProfiles, teacherName.trim())
    const items = writeDates.map((date) => ({
      studentName: studentName.trim(),
      teacherName: teacherName.trim(),
      subjectId,
      subjectName,
      date,
      startTime,
      endTime,
      note: note ? note.trim() : null,
      price
    }))
    const batchId = `batch_${formatMonthKey(year, month)}_${Date.now()}`

    this.setData({ saving: true })
    try {
      const result = await batchCreateBookings({
        batchId,
        items,
        remindMinutesBefore: getRemindMinutesBefore()
      })
      try {
        await appendName('student', studentName.trim())
        await appendName('teacher', teacherName.trim())
      } catch (e) {
        /* ignore */
      }
      const created = result.created || 0
      const skippedDup = result.skipped || 0
      const failed = result.failed || 0
      wx.showToast({
        title: `已创建 ${created} 节，跳过重复 ${skippedDup} 节${failed ? `，失败 ${failed}` : ''}`,
        icon: 'none',
        duration: 2500
      })
      setTimeout(() => wx.navigateBack(), 600)
    } catch (err) {
      showWriteError(err)
    } finally {
      this.setData({ saving: false })
    }
  }
})
