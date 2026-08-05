const { DEFAULT_TIME, DEFAULT_SUBJECT_NAME, WEEKDAY_CN } = require('../../utils/constants')
const { datesByWeekday } = require('../../utils/date-utils')
const {
  formatMonthKey,
  formatTime,
  addMinutesToTime,
  minutesBetweenTimes
} = require('../../utils/format')
const { listSubjects } = require('../../services/subject')
const { batchCreateBookings } = require('../../services/booking')
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
    previewDates: [],
    previewOpen: false,
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
      const teachers = (list.teachers || [])
        .map((t) => (typeof t === 'string' ? t : t.name))
        .filter(Boolean)
      this.setData({
        studentSuggestions: studentNames(list.students),
        teacherSuggestions: teachers
      })
    } catch (e) {
      /* ignore */
    }
  },

  refreshPreview(year, month, weekdayIndex) {
    const y = year != null ? year : this.data.year
    const m = month != null ? month : this.data.month
    const w = weekdayIndex != null ? weekdayIndex : this.data.weekdayIndex
    this.setData({ previewDates: datesByWeekday(y, m, w) })
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
    this.refreshPreview()
    this.setData({ previewOpen: !this.data.previewOpen })
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
      saving
    } = this.data
    if (saving) return
    if (!studentName || !teacherName || !subjectId || !startTime || !endTime) {
      wx.showToast({ title: '请完善必填项', icon: 'none' })
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

    const confirm = await new Promise((resolve) => {
      wx.showModal({
        title: '确认批量创建',
        content: `将在 ${year}年${month}月 的每个星期${WEEKDAY_CN[weekdayIndex]}创建 ${dates.length} 节约课，确认？`,
        success: (res) => resolve(!!res.confirm)
      })
    })
    if (!confirm) return

    const items = dates.map((date) => ({
      studentName: studentName.trim(),
      teacherName: teacherName.trim(),
      subjectId,
      subjectName,
      date,
      startTime,
      endTime,
      note: note ? note.trim() : null
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
      const skipped = result.skipped || 0
      const failed = result.failed || 0
      wx.showToast({
        title: `已创建 ${created} 节，跳过重复 ${skipped} 节${failed ? `，失败 ${failed}` : ''}`,
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
