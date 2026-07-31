const { DEFAULT_TIME, DEFAULT_SUBJECT_NAME } = require('../../utils/constants')
const { formatDate } = require('../../utils/format')
const { listSubjects, upsertSubject } = require('../../services/subject')
const { upsertBooking, deleteBooking, listBookings } = require('../../services/booking')
const { appendName, fetchNameList } = require('../../services/name-list')
const { getLastSubjectId, setLastSubjectId } = require('../../utils/cache')
const { showApiError } = require('../../utils/errors')
const { parseQuickInput } = require('../../utils/quick-parse')
const {
  BOOKING_STATUS,
  STATUS_OPTIONS,
  resolveBookingStatus,
  statusWritePayload
} = require('../../utils/booking-status')

Page({
  data: {
    _id: '',
    studentName: '',
    teacherName: '',
    subjectId: '',
    subjectName: DEFAULT_SUBJECT_NAME,
    date: '',
    startTime: DEFAULT_TIME.startTime,
    endTime: DEFAULT_TIME.endTime,
    note: '',
    status: BOOKING_STATUS.pending,
    statusManual: false,
    statusOptions: STATUS_OPTIONS,
    statusIndex: 0,
    statusDisplay: '待上（按时间自动）',
    subjects: [],
    quickText: '',
    saving: false
  },

  onLoad(query) {
    const today = formatDate(new Date())
    this.setData({
      _id: query.id || '',
      date: query.date || today
    })
    this.syncStatusPicker(BOOKING_STATUS.pending, false)
    this.loadSubjects().then(() => {
      if (query.id) this.loadBooking(query.id)
    })
  },

  syncStatusPicker(status, statusManual, date, startTime) {
    const d = date != null ? date : this.data.date
    const st = startTime != null ? startTime : this.data.startTime
    const resolved = resolveBookingStatus(
      { date: d, startTime: st, status, statusManual },
      new Date()
    )
    const effective = statusManual ? status : resolved
    const idx = Math.max(
      0,
      STATUS_OPTIONS.findIndex((o) => o.value === effective)
    )
    this.setData({
      status: effective,
      statusManual: !!statusManual,
      statusIndex: idx,
      statusDisplay: STATUS_OPTIONS[idx].label
    })
  },

  applySubjects(subjects) {
    const list = subjects || []
    const lastId = getLastSubjectId()
    const preferred =
      list.find((s) => s._id === lastId) ||
      list.find((s) => s.name === DEFAULT_SUBJECT_NAME) ||
      list[0]
    this.setData({
      subjects: list,
      subjectId: preferred ? preferred._id : '',
      subjectName: preferred ? preferred.name : DEFAULT_SUBJECT_NAME
    })
  },

  async loadSubjects() {
    try {
      const { list } = await listSubjects()
      this.applySubjects(list || [])
    } catch (err) {
      this.applySubjects([
        { _id: 'local-default-english', name: DEFAULT_SUBJECT_NAME }
      ])
      showApiError(err)
    }
  },

  async loadBooking(id) {
    try {
      const { list } = await listBookings({ _id: id })
      const row = (list || [])[0]
      if (!row) {
        wx.showToast({ title: '记录不存在', icon: 'none' })
        return
      }
      this.setData({
        _id: row._id,
        studentName: row.studentName || '',
        teacherName: row.teacherName || '',
        subjectId: row.subjectId || '',
        subjectName: row.subjectName || DEFAULT_SUBJECT_NAME,
        date: row.date,
        startTime: row.startTime,
        endTime: row.endTime,
        note: row.note || ''
      })
      this.syncStatusPicker(row.status, !!row.statusManual, row.date, row.startTime)
      if (row.subjectId) setLastSubjectId(row.subjectId)
    } catch (err) {
      showApiError(err)
    }
  },

  onFieldInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [field]: e.detail.value })
  },

  onDateChange(e) {
    const date = e.detail.value
    this.setData({ date })
    if (!this.data.statusManual) {
      this.syncStatusPicker(this.data.status, false, date, this.data.startTime)
    }
  },

  onStartTimeChange(e) {
    const startTime = e.detail.value
    this.setData({ startTime })
    if (!this.data.statusManual) {
      this.syncStatusPicker(this.data.status, false, this.data.date, startTime)
    }
  },

  onEndTimeChange(e) {
    this.setData({ endTime: e.detail.value })
  },

  onStatusChange(e) {
    const idx = Number(e.detail.value)
    const opt = STATUS_OPTIONS[idx] || STATUS_OPTIONS[0]
    const write = statusWritePayload(opt.value)
    this.setData({
      status: write.status,
      statusManual: write.statusManual,
      statusIndex: idx,
      statusDisplay: opt.label
    })
  },

  onSubjectChange(e) {
    const { subjectId, subjectName } = e.detail
    this.setData({ subjectId, subjectName })
    setLastSubjectId(subjectId)
  },

  async onSubjectAdd(e) {
    const name = (e.detail.name || '').trim()
    if (!name) return
    try {
      const { _id } = await upsertSubject(name)
      const subjects = this.data.subjects.slice()
      if (!subjects.find((s) => s._id === _id)) {
        subjects.push({ _id, name })
      }
      this.setData({ subjects, subjectId: _id, subjectName: name })
      setLastSubjectId(_id)
    } catch (err) {
      showApiError(err)
    }
  },

  onQuickInput(e) {
    this.setData({ quickText: e.detail.value })
  },

  async onParseQuick() {
    const app = getApp()
    const year = app.globalData.viewingYear || new Date().getFullYear()
    let students = []
    let teachers = []
    try {
      const list = await fetchNameList()
      students = list.students || []
      teachers = (list.teachers || [])
        .map((t) => (typeof t === 'string' ? t : t.name))
        .filter(Boolean)
    } catch (e) {
      /* 无名单时仍走文本兜底 */
    }
    const knownNames = {
      students,
      teachers,
      subjects: (this.data.subjects || []).map((s) => s.name)
    }
    const result = parseQuickInput(this.data.quickText, year, knownNames)
    if (!result.ok) {
      wx.showToast({ title: result.error, icon: 'none' })
      return
    }
    const d = result.data
    const matched = (this.data.subjects || []).find((s) => s.name === d.subjectName)
    this.setData({
      studentName: d.studentName,
      teacherName: d.teacherName,
      date: d.date,
      startTime: d.startTime,
      endTime: d.endTime,
      subjectName: d.subjectName,
      subjectId: matched ? matched._id : this.data.subjectId
    })
    if (!this.data.statusManual) {
      this.syncStatusPicker(this.data.status, false, d.date, d.startTime)
    }
  },

  async onSave() {
    const {
      _id,
      studentName,
      teacherName,
      subjectId,
      subjectName,
      date,
      startTime,
      endTime,
      note,
      status,
      statusManual,
      saving
    } = this.data
    if (saving) return
    if (!studentName || !teacherName || !subjectId || !date || !startTime || !endTime) {
      wx.showToast({ title: '请完善必填项', icon: 'none' })
      return
    }
    if (String(subjectId).indexOf('local-') === 0) {
      wx.showToast({ title: '请先开通云开发并部署科目云函数', icon: 'none' })
      return
    }

    const finalStatus = statusManual
      ? statusWritePayload(status)
      : {
          status: resolveBookingStatus({ date, startTime }, new Date()),
          statusManual: false
        }

    const payload = {
      studentName: studentName.trim(),
      teacherName: teacherName.trim(),
      subjectId,
      subjectName,
      date,
      startTime,
      endTime,
      note: note ? note.trim() : null,
      status: finalStatus.status,
      statusManual: finalStatus.statusManual
    }
    if (_id) payload._id = _id

    this.setData({ saving: true })
    try {
      await upsertBooking(payload)
      setLastSubjectId(subjectId)
      try {
        await appendName('student', payload.studentName)
        await appendName('teacher', payload.teacherName)
      } catch (e) {
        /* ignore */
      }
      wx.showToast({ title: '已保存', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 400)
    } catch (err) {
      showApiError(err)
    } finally {
      this.setData({ saving: false })
    }
  },

  onDelete() {
    const { _id } = this.data
    if (!_id) return
    wx.showModal({
      title: '删除约课',
      content: '删除后不可恢复，确认删除？',
      confirmColor: '#ef4444',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await deleteBooking(_id)
          wx.showToast({ title: '已删除', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 400)
        } catch (err) {
          showApiError(err)
        }
      }
    })
  }
})
