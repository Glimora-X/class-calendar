const { DEFAULT_TIME, DEFAULT_SUBJECT_NAME } = require('../../utils/constants')
const {
  formatDate,
  formatTime,
  addMinutesToTime,
  minutesBetweenTimes
} = require('../../utils/format')
const {
  getClassDurationMinutes,
  getRemindMinutesBefore
} = require('../../utils/prefs')
const { listSubjects, upsertSubject } = require('../../services/subject')
const { upsertBooking, deleteBooking, listBookings } = require('../../services/booking')
const { appendName, fetchNameList } = require('../../services/name-list')
const { getLastSubjectId, setLastSubjectId } = require('../../utils/cache')
const { showApiError, showWriteError } = require('../../utils/errors')
const { callFunction } = require('../../utils/request')
const { CLOUD_FUNCTIONS } = require('../../utils/constants')
const { parseQuickInput } = require('../../utils/quick-parse')
const {
  BOOKING_STATUS,
  STATUS_OPTIONS,
  resolveBookingStatus,
  statusWritePayload,
  isManualStatus,
  startAtMs
} = require('../../utils/booking-status')
const {
  requestClassRemindSubscribe,
  explainSubscribeResult
} = require('../../utils/reminder')
const { getSubscribeTmplId } = require('../../utils/env-config')

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
    studentSuggestions: [],
    teacherSuggestions: [],
    quickText: '',
    saving: false,
    // 保存成功后展示：用独立按钮拉起订阅（避免保存链路吃掉手势）
    showSubscribeGate: false,
    subscribeTmplId: '',
    subscribeBusy: false
  },

  onLoad(query) {
    const now = new Date()
    const today = formatDate(now)
    const patch = {
      _id: query.id || '',
      date: query.date || today
    }
    // 新建：开始时间默认当前时刻，结束时间按设置的课程时长
    if (!query.id) {
      const startTime = formatTime(now)
      patch.startTime = startTime
      patch.endTime = addMinutesToTime(startTime, getClassDurationMinutes())
    }
    this.setData(patch)
    this.syncStatusPicker(BOOKING_STATUS.pending, false)
    this.loadNames()
    this.loadSubjects().then(() => {
      if (query.id) this.loadBooking(query.id)
    })
  },

  async loadNames() {
    try {
      const list = await fetchNameList({ silent: true })
      const teachers = (list.teachers || [])
        .map((t) => (typeof t === 'string' ? t : t.name))
        .filter(Boolean)
      this.setData({
        studentSuggestions: list.students || [],
        teacherSuggestions: teachers
      })
    } catch (e) {
      /* ignore */
    }
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

  onStudentSuggest(e) {
    this.setData({ studentName: e.detail.value })
  },

  onTeacherSuggest(e) {
    this.setData({ teacherName: e.detail.value })
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
    // 改开始时间：按原课时长度平移结束时间；无效则用设置的默认时长
    const duration = minutesBetweenTimes(this.data.startTime, this.data.endTime)
    const minutes = Number.isFinite(duration)
      ? duration
      : getClassDurationMinutes()
    this.setData({
      startTime,
      endTime: addMinutesToTime(startTime, minutes)
    })
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
      statusManual: finalStatus.statusManual,
      remindMinutesBefore: getRemindMinutesBefore()
    }
    if (_id) payload._id = _id

    const tmplId = getSubscribeTmplId()
    const startMs = startAtMs(payload)
    const isFuture = Number.isFinite(startMs) && startMs > Date.now()
    // 只要有模板且非已转/已退，保存后都展示授权入口（便于真机调通订阅）
    const skipRemind = isManualStatus(finalStatus.status)
    const needSubscribe = !!(tmplId && !skipRemind)
    console.log('[save] tmplId=', tmplId, 'isFuture=', isFuture, 'needSubscribe=', needSubscribe)

    this.setData({ saving: true })
    try {
      const res = await upsertBooking(payload)
      if (res && res._id) {
        this.setData({ _id: res._id })
        payload._id = res._id
      }
      setLastSubjectId(payload.subjectId)
      try {
        await appendName('student', payload.studentName)
        await appendName('teacher', payload.teacherName)
      } catch (e) {
        /* ignore */
      }

      if (needSubscribe) {
        // 不要 showToast：真机上 Toast 会挡住订阅弹窗，导致第二次「调不起」
        try {
          wx.hideToast()
        } catch (e) {
          /* ignore */
        }
        this.setData({
          showSubscribeGate: true,
          subscribeTmplId: tmplId
        })
      } else {
        const reason = !tmplId ? '未配置订阅模板' : '已转/已退无需提醒'
        console.warn('[save] skip subscribe gate:', reason)
        wx.showToast({ title: '已保存', icon: 'success', duration: 1200 })
        setTimeout(() => wx.navigateBack(), 1300)
      }
    } catch (err) {
      console.warn('[save] upsert fail', err)
      // 表单字段不清理，可直接重试
      showWriteError(err)
    } finally {
      this.setData({ saving: false })
    }
  },

  /** 独立按钮：点击同步调起订阅（勿在前面 await / showToast；禁止连点） */
  onSubscribeTap() {
    if (this.data.subscribeBusy) {
      console.warn('[subscribe] busy, ignore tap')
      return
    }
    try {
      wx.hideToast()
      wx.hideLoading()
    } catch (e) {
      /* ignore */
    }
    const tmplId = this.data.subscribeTmplId || getSubscribeTmplId()
    console.log('[subscribe] button tap', tmplId)
    if (!tmplId) {
      wx.showModal({
        title: '无法订阅',
        content: '未配置订阅模板 ID',
        showCancel: false
      })
      return
    }

    this.setData({ subscribeBusy: true })
    // 必须在 tap 同步栈里直接调起
    requestClassRemindSubscribe(tmplId, {
      onDone: (info) => {
        const text = explainSubscribeResult(info)
        console.log('[subscribe] result', info)
        const msg = String((info && info.errMsg) || '')
        const lastNotEnded = /last call has not ended/i.test(msg)

        if (info.result === 'accept') {
          this.afterSubscribeAccepted()
          return
        }

        // 连点导致的失败：不吓人，提示等弹窗结束
        if (lastNotEnded) {
          this.setData({ subscribeBusy: false })
          wx.showToast({
            title: '请先处理微信弹窗，勿连点',
            icon: 'none',
            duration: 2000
          })
          return
        }

        this.setData({ subscribeBusy: false })
        const blocked =
          info.result === 'fail' ||
          /tap gesture/i.test(msg) ||
          /cannot show/i.test(msg) ||
          info.errCode === 10005
        wx.showModal({
          title: blocked ? '暂时无法弹出订阅' : '微信订阅未开启',
          content: blocked
            ? `${text}\n\n请稍等片刻再点一次「授权微信提醒」。若仍不行：小程序右上角⋯→设置→打开订阅消息。`
            : text,
          confirmText: '知道了',
          cancelText: '返回',
          success: (r) => {
            if (r.cancel) wx.navigateBack()
          }
        })
      }
    })
  },

  async afterSubscribeAccepted() {
    const id = this.data._id
    if (!id) {
      wx.showToast({ title: '提醒已开启', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 1200)
      return
    }
    try {
      const diag = await callFunction(
        CLOUD_FUNCTIONS.reminderTick,
        { action: 'diagnose', _id: id },
        { silent: true }
      )
      console.log('[subscribe] diagnose', diag)
      const tip = (diag && diag.tip) || '已授权'
      const due =
        diag &&
        !diag.remindSentAt &&
        diag.pending &&
        diag.minutesUntilRemind != null &&
        diag.minutesUntilRemind <= 0

      if (due) {
        // 已到发送点：马上发，避免错过窗口
        const sendRes = await callFunction(
          CLOUD_FUNCTIONS.reminderTick,
          { action: 'send', _id: id, force: true },
          { title: '发送提醒' }
        )
        console.log('[subscribe] send due', sendRes)
        wx.showModal({
          title: sendRes && sendRes.sent ? '已发送微信提醒' : '发送未成功',
          content:
            sendRes && sendRes.sent
              ? '请查看微信服务通知'
              : `${sendRes && sendRes.message ? sendRes.message : ''}\n${sendRes && sendRes.error ? sendRes.error : ''}`.trim() ||
                tip,
          showCancel: false,
          success: () => wx.navigateBack()
        })
        return
      }

      wx.showModal({
        title: '提醒已授权',
        content: `${tip}\n\n可点「立即试发」马上收到一条（会用掉本次授权）；或等课前自动发。`,
        confirmText: '立即试发',
        cancelText: '等课前再发',
        success: async (r) => {
          if (!r.confirm) {
            wx.navigateBack()
            return
          }
          try {
            const sendRes = await callFunction(
              CLOUD_FUNCTIONS.reminderTick,
              { action: 'send', _id: id, force: true },
              { title: '发送提醒' }
            )
            console.log('[subscribe] send now', sendRes)
            wx.showModal({
              title: sendRes && sendRes.sent ? '已发送' : '发送失败',
              content:
                sendRes && sendRes.sent
                  ? '请查看微信服务通知（服务通知/小程序消息）'
                  : `${(sendRes && sendRes.message) || ''}\n${(sendRes && sendRes.error) || ''}`.trim() ||
                    '请查看云函数 reminderTick 日志',
              showCancel: false,
              success: () => wx.navigateBack()
            })
          } catch (err) {
            showApiError(err)
          }
        }
      })
    } catch (err) {
      console.warn('[subscribe] diagnose fail', err)
      wx.showToast({ title: '提醒已开启', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 1200)
    }
  },

  onSkipSubscribe() {
    wx.navigateBack()
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
