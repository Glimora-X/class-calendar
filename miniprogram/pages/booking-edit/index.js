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
const {
  upsertBooking,
  deleteBooking,
  listBookings,
  batchCreateBookings
} = require('../../services/booking')
const { appendName, fetchNameList } = require('../../services/name-list')
const { getLastSubjectId, setLastSubjectId } = require('../../utils/cache')
const { showApiError, showWriteError } = require('../../utils/errors')
const { callFunction } = require('../../utils/request')
const { CLOUD_FUNCTIONS } = require('../../utils/constants')
const { parseQuickInputMulti } = require('../../utils/quick-parse')
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

const WEEKDAY_SHORT = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const NOTE_MAX_LEN = 100

function formatDateLabel(dateStr) {
  if (!dateStr) return ''
  const d = new Date(String(dateStr).replace(/-/g, '/'))
  if (Number.isNaN(d.getTime())) return dateStr
  return `${dateStr} (${WEEKDAY_SHORT[d.getDay()]})`
}

function formatSummaryDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(String(dateStr).replace(/-/g, '/'))
  if (Number.isNaN(d.getTime())) return dateStr
  return `${d.getMonth() + 1}月${d.getDate()}日 ${WEEKDAY_SHORT[d.getDay()]}`
}

function formatDurationLabel(startTime, endTime) {
  const mins = minutesBetweenTimes(startTime, endTime)
  if (!Number.isFinite(mins) || mins <= 0) return ''
  return `时长：${mins} 分钟`
}

function formatDurationShort(startTime, endTime) {
  const mins = minutesBetweenTimes(startTime, endTime)
  if (!Number.isFinite(mins) || mins <= 0) return ''
  return `${mins} 分钟`
}

function decorateDraft(draft) {
  const note = draft && draft.note != null ? String(draft.note) : ''
  const startTime = draft.startTime || ''
  const endTime = draft.endTime || ''
  return Object.assign({}, draft, {
    dateLabel: formatDateLabel(draft.date),
    durationLabel: formatDurationLabel(startTime, endTime),
    durationShort: formatDurationShort(startTime, endTime),
    summaryDate: formatSummaryDate(draft.date),
    summaryTime: startTime && endTime ? `${startTime}-${endTime}` : startTime || endTime || '',
    noteLen: Math.min(note.length, NOTE_MAX_LEN)
  })
}

Page({
  data: {
    _id: '',
    /** 是否编辑态（由 onLoad query.id 决定，不依赖异步回填） */
    isEdit: false,
    /** 编辑态等 loadBooking 完成后再挂载表单，避免 input 受控不刷新 */
    formReady: false,
    studentName: '',
    teacherName: '',
    subjectId: '',
    subjectName: DEFAULT_SUBJECT_NAME,
    date: '',
    dateLabel: '',
    startTime: DEFAULT_TIME.startTime,
    endTime: DEFAULT_TIME.endTime,
    durationLabel: '',
    note: '',
    noteLen: 0,
    noteMaxLen: NOTE_MAX_LEN,
    status: BOOKING_STATUS.pending,
    statusManual: false,
    statusOptions: STATUS_OPTIONS,
    statusIndex: 0,
    statusDisplay: '待上（按时间自动）',
    subjects: [],
    studentSuggestions: [],
    teacherSuggestions: [],
    quickText: '',
    drafts: [],
    draftCount: 0,
    saveLabel: '保存约课',
    /** 新增态：当前展开编辑的草稿下标，-1 表示全部折叠 */
    expandedIndex: 0,
    /** 快捷解析区是否展开 */
    parseExpanded: true,
    /** 首次小贴士 */
    showEditTip: true,
    saving: false,
    // 保存成功后展示：用独立按钮拉起订阅（避免保存链路吃掉手势）
    showSubscribeGate: false,
    subscribeTmplId: '',
    subscribeBusy: false
  },

  onLoad(query) {
    const now = new Date()
    const today = formatDate(now)
    const editId = (query && query.id) || ''
    const isEdit = !!editId

    if (isEdit) {
      wx.setNavigationBarTitle({ title: '编辑约课' })
      // 先不挂载表单：等科目列表 + 约课详情回填后再 formReady
      this.setData({
        isEdit: true,
        formReady: false,
        _id: editId,
        date: today
      })
      this.syncStatusPicker(BOOKING_STATUS.pending, false)
      this.loadNames()
      this.loadSubjects()
        .then(() => this.loadBooking(editId))
        .catch(() => {})
        .then(() => {
          this.setData({ formReady: true })
        })
      return
    }

    const startTime = formatTime(now)
    const endTime = addMinutesToTime(startTime, getClassDurationMinutes())
    const date = (query && query.date) || today
    this.setData({
      isEdit: false,
      formReady: true,
      _id: '',
      date,
      dateLabel: formatDateLabel(date),
      startTime,
      endTime,
      durationLabel: formatDurationLabel(startTime, endTime),
      noteLen: 0,
      parseExpanded: true,
      expandedIndex: 0,
      showEditTip: true
    })
    this.syncDraftMeta(
      [
        decorateDraft(
          this.makeEmptyDraft({
            date,
            startTime,
            endTime
          })
        )
      ],
      0
    )
    this.syncStatusPicker(BOOKING_STATUS.pending, false)
    this.loadNames()
    this.loadSubjects()
  },

  makeEmptyDraft(overrides) {
    this._draftSeq = (this._draftSeq || 0) + 1
    const now = new Date()
    const startTime = formatTime(now)
    return Object.assign(
      {
        key: `d_${Date.now()}_${this._draftSeq}`,
        subjectId: this.data.subjectId || '',
        subjectName: this.data.subjectName || DEFAULT_SUBJECT_NAME,
        studentName: '',
        teacherName: '',
        date: formatDate(now),
        startTime,
        endTime: addMinutesToTime(startTime, getClassDurationMinutes()),
        note: ''
      },
      overrides || {}
    )
  },

  syncDraftMeta(list, expandedIndex) {
    const drafts = (list || []).map(decorateDraft)
    let exp = expandedIndex
    if (exp == null) exp = this.data.expandedIndex
    if (!drafts.length) exp = -1
    else if (exp >= drafts.length) exp = drafts.length - 1
    const count = drafts.length
    this.setData({
      drafts,
      draftCount: count,
      expandedIndex: exp,
      saveLabel: count > 0 ? `保存 ${count} 节约课` : '保存约课'
    })
  },

  setDrafts(list, expandedIndex) {
    this.syncDraftMeta(list, expandedIndex)
  },

  updateDraft(index, patch) {
    const drafts = (this.data.drafts || []).slice()
    if (index < 0 || index >= drafts.length) return
    drafts[index] = decorateDraft(Object.assign({}, drafts[index], patch))
    this.syncDraftMeta(drafts, this.data.expandedIndex)
  },

  syncEditDisplay(extra) {
    const date = extra && extra.date != null ? extra.date : this.data.date
    const startTime =
      extra && extra.startTime != null ? extra.startTime : this.data.startTime
    const endTime =
      extra && extra.endTime != null ? extra.endTime : this.data.endTime
    const note = extra && extra.note != null ? extra.note : this.data.note
    const noteStr = note != null ? String(note) : ''
    this.setData(
      Object.assign({}, extra || {}, {
        dateLabel: formatDateLabel(date),
        durationLabel: formatDurationLabel(startTime, endTime),
        noteLen: Math.min(noteStr.length, NOTE_MAX_LEN)
      })
    )
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
    const subjectId = preferred ? preferred._id : ''
    const subjectName = preferred ? preferred.name : DEFAULT_SUBJECT_NAME

    // 编辑态：只更新科目列表，选中项留给 loadBooking，避免默认科目覆盖回填
    if (this.data.isEdit) {
      this.setData({ subjects: list })
      return
    }

    const patch = {
      subjects: list,
      subjectId,
      subjectName
    }
    if ((this.data.drafts || []).length) {
      patch.drafts = this.data.drafts.map((d) => {
        if (d.subjectId) return decorateDraft(d)
        return decorateDraft(Object.assign({}, d, { subjectId, subjectName }))
      })
      patch.draftCount = patch.drafts.length
      patch.saveLabel =
        patch.draftCount > 0 ? `保存 ${patch.draftCount} 节约课` : '保存约课'
    }
    this.setData(patch)
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
        dateLabel: formatDateLabel(row.date),
        startTime: row.startTime,
        endTime: row.endTime,
        durationLabel: formatDurationLabel(row.startTime, row.endTime),
        note: row.note || '',
        noteLen: Math.min(String(row.note || '').length, NOTE_MAX_LEN)
      })
      this.syncStatusPicker(row.status, !!row.statusManual, row.date, row.startTime)
      if (row.subjectId) setLastSubjectId(row.subjectId)
    } catch (err) {
      showApiError(err)
    }
  },

  onFieldInput(e) {
    const field = e.currentTarget.dataset.field
    let value = e.detail.value
    if (field === 'note') {
      value = String(value || '').slice(0, NOTE_MAX_LEN)
      this.syncEditDisplay({ note: value })
      return
    }
    this.setData({ [field]: value })
  },

  onStudentSuggest(e) {
    this.setData({ studentName: e.detail.value })
  },

  onTeacherSuggest(e) {
    this.setData({ teacherName: e.detail.value })
  },

  onDateChange(e) {
    const date = e.detail.value
    this.syncEditDisplay({ date })
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
    const endTime = addMinutesToTime(startTime, minutes)
    this.syncEditDisplay({ startTime, endTime })
    if (!this.data.statusManual) {
      this.syncStatusPicker(this.data.status, false, this.data.date, startTime)
    }
  },

  onEndTimeChange(e) {
    this.syncEditDisplay({ endTime: e.detail.value })
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

  onPickEditSubject() {
    this.openSubjectPicker({
      onSelect: (subjectId, subjectName) => {
        this.setData({ subjectId, subjectName })
        setLastSubjectId(subjectId)
      },
      onAdd: (name) => this.onSubjectAdd({ detail: { name } })
    })
  },

  onPickDraftSubject(e) {
    const index = Number(e.currentTarget.dataset.index)
    if (!Number.isFinite(index) || index < 0) return
    this.openSubjectPicker({
      onSelect: (subjectId, subjectName) => {
        this.updateDraft(index, { subjectId, subjectName })
        setLastSubjectId(subjectId)
      },
      onAdd: (name) => this.addSubjectToDraft(index, name)
    })
  },

  openSubjectPicker({ onSelect, onAdd }) {
    const list = this.data.subjects || []
    if (!list.length) {
      wx.showToast({ title: '暂无科目', icon: 'none' })
      return
    }
    const names = list.map((s) => s.name)
    names.push('＋ 新增科目')
    wx.showActionSheet({
      itemList: names,
      success: (res) => {
        const idx = res.tapIndex
        if (idx === names.length - 1) {
          wx.showModal({
            title: '新增科目',
            editable: true,
            placeholderText: '如：数学、钢琴',
            success: async (modalRes) => {
              if (!modalRes.confirm) return
              const name = String(modalRes.content || '').trim()
              if (!name) {
                wx.showToast({ title: '请输入科目名', icon: 'none' })
                return
              }
              await onAdd(name)
            }
          })
          return
        }
        const selected = list[idx]
        if (selected) onSelect(selected._id, selected.name)
      }
    })
  },

  async addSubjectToDraft(index, name) {
    const trimmed = String(name || '').trim()
    if (!trimmed) return
    try {
      const { _id } = await upsertSubject(trimmed)
      const subjects = this.data.subjects.slice()
      if (!subjects.find((s) => s._id === _id)) {
        subjects.push({ _id, name: trimmed })
      }
      this.setData({ subjects })
      this.updateDraft(index, { subjectId: _id, subjectName: trimmed })
      setLastSubjectId(_id)
    } catch (err) {
      showApiError(err)
    }
  },

  onAddDraft() {
    const drafts = (this.data.drafts || []).slice()
    for (let i = 0; i < drafts.length; i++) {
      const missing = this.draftMissingLabel(drafts[i])
      if (missing) {
        this.syncDraftMeta(drafts, i)
        wx.showToast({
          title: `请先完善第 ${i + 1} 条的${missing}`,
          icon: 'none'
        })
        return
      }
    }
    drafts.push(decorateDraft(this.makeEmptyDraft()))
    this.syncDraftMeta(drafts, drafts.length - 1)
  },

  onCopyDraft(e) {
    const index = Number(e.currentTarget.dataset.index)
    const drafts = (this.data.drafts || []).slice()
    const src = drafts[index]
    if (!src) return
    const copy = decorateDraft(
      this.makeEmptyDraft({
        subjectId: src.subjectId,
        subjectName: src.subjectName,
        studentName: src.studentName,
        teacherName: src.teacherName,
        date: src.date,
        startTime: src.startTime,
        endTime: src.endTime,
        note: src.note || ''
      })
    )
    drafts.splice(index + 1, 0, copy)
    this.syncDraftMeta(drafts, index + 1)
    wx.showToast({ title: '已复制', icon: 'none', duration: 1000 })
  },

  onDraftReorder(e) {
    const index = Number(e.currentTarget.dataset.index)
    const drafts = (this.data.drafts || []).slice()
    if (drafts.length < 2) {
      wx.showToast({ title: '至少两条才能调整顺序', icon: 'none' })
      return
    }
    const itemList = []
    if (index > 0) itemList.push('上移')
    if (index < drafts.length - 1) itemList.push('下移')
    wx.showActionSheet({
      itemList,
      success: (res) => {
        const label = itemList[res.tapIndex]
        const next = drafts.slice()
        const moved = next.splice(index, 1)[0]
        let nextIndex = index
        if (label === '上移') {
          next.splice(index - 1, 0, moved)
          nextIndex = index - 1
        } else {
          next.splice(index + 1, 0, moved)
          nextIndex = index + 1
        }
        let exp = this.data.expandedIndex
        if (exp === index) exp = nextIndex
        else if (label === '上移' && exp === index - 1) exp = index
        else if (label === '下移' && exp === index + 1) exp = index
        this.syncDraftMeta(next, exp)
      }
    })
  },

  onRemoveDraft(e) {
    const index = Number(e.currentTarget.dataset.index)
    const drafts = (this.data.drafts || []).slice()
    if (drafts.length <= 1) {
      wx.showToast({ title: '至少保留一条约课', icon: 'none' })
      return
    }
    if (index < 0 || index >= drafts.length) return
    drafts.splice(index, 1)
    let exp = this.data.expandedIndex
    if (exp === index) exp = Math.min(index, drafts.length - 1)
    else if (exp > index) exp -= 1
    this.syncDraftMeta(drafts, exp)
  },

  onToggleDraft(e) {
    const index = Number(e.currentTarget.dataset.index)
    if (!Number.isFinite(index)) return
    const cur = this.data.expandedIndex
    this.setData({ expandedIndex: cur === index ? -1 : index })
  },

  onToggleParse() {
    this.setData({ parseExpanded: !this.data.parseExpanded })
  },

  onDismissEditTip() {
    this.setData({ showEditTip: false })
  },

  onPasteQuick() {
    wx.getClipboardData({
      success: (res) => {
        const text = String((res && res.data) || '')
        if (!text.trim()) {
          wx.showToast({ title: '剪贴板为空', icon: 'none' })
          return
        }
        this.setData({ quickText: text, parseExpanded: true })
        wx.showToast({ title: '已粘贴', icon: 'none', duration: 800 })
      },
      fail: () => {
        wx.showToast({ title: '无法读取剪贴板', icon: 'none' })
      }
    })
  },

  onDraftStudentSuggest(e) {
    const index = Number(e.currentTarget.dataset.index)
    this.updateDraft(index, { studentName: e.detail.value })
  },

  onDraftTeacherSuggest(e) {
    const index = Number(e.currentTarget.dataset.index)
    this.updateDraft(index, { teacherName: e.detail.value })
  },

  onDraftDateChange(e) {
    const index = Number(e.currentTarget.dataset.index)
    this.updateDraft(index, { date: e.detail.value })
  },

  onDraftStartTimeChange(e) {
    const index = Number(e.currentTarget.dataset.index)
    const drafts = this.data.drafts || []
    const draft = drafts[index]
    if (!draft) return
    const startTime = e.detail.value
    const duration = minutesBetweenTimes(draft.startTime, draft.endTime)
    const minutes = Number.isFinite(duration)
      ? duration
      : getClassDurationMinutes()
    this.updateDraft(index, {
      startTime,
      endTime: addMinutesToTime(startTime, minutes)
    })
  },

  onDraftEndTimeChange(e) {
    const index = Number(e.currentTarget.dataset.index)
    this.updateDraft(index, { endTime: e.detail.value })
  },

  onDraftNoteInput(e) {
    const index = Number(e.currentTarget.dataset.index)
    const note = String(e.detail.value || '').slice(0, NOTE_MAX_LEN)
    this.updateDraft(index, { note })
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
    const { okItems, failItems } = parseQuickInputMulti(
      this.data.quickText,
      year,
      knownNames
    )
    if (!okItems.length) {
      const tip =
        (failItems[0] && failItems[0].error) || '没识别出可用约课，请检查格式'
      wx.showToast({ title: tip, icon: 'none' })
      return
    }

    const preferredId = this.data.subjectId
    const preferredName = this.data.subjectName || DEFAULT_SUBJECT_NAME
    const drafts = okItems.map(({ data }) => {
      const matched = (this.data.subjects || []).find(
        (s) => s.name === data.subjectName
      )
      return decorateDraft(
        this.makeEmptyDraft({
          studentName: data.studentName,
          teacherName: data.teacherName,
          date: data.date,
          startTime: data.startTime,
          endTime: data.endTime,
          subjectName: data.subjectName,
          subjectId: matched ? matched._id : preferredId,
          note: ''
        })
      )
    })
    drafts.forEach((d) => {
      if (!d.subjectId && !d.subjectName) d.subjectName = preferredName
    })
    this.syncDraftMeta(drafts, 0)
    this.setData({ parseExpanded: false })

    let title = `已生成 ${okItems.length} 条`
    if (failItems.length) {
      const firstFail = failItems[0]
      title = `${title}，${failItems.length} 条失败`
      if (firstFail) {
        title = `${title}（第${firstFail.line}行）`
      }
    }
    wx.showToast({ title, icon: 'none', duration: 2500 })
  },

  draftMissingLabel(draft) {
    if (!draft) return '内容'
    if (!(draft.studentName || '').trim()) return '学员'
    if (!(draft.teacherName || '').trim()) return '老师'
    if (!(draft.subjectId || '').trim()) return '科目'
    if (!(draft.subjectName || '').trim()) return '科目'
    if (!(draft.date || '').trim()) return '日期'
    if (!(draft.startTime || '').trim()) return '开始时间'
    if (!(draft.endTime || '').trim()) return '结束时间'
    return ''
  },

  async onSaveMulti() {
    const { drafts, saving } = this.data
    if (saving) return
    if (!drafts || drafts.length < 1) {
      wx.showToast({ title: '请至少填写一条约课', icon: 'none' })
      return
    }

    const incompletes = []
    for (let i = 0; i < drafts.length; i++) {
      const missing = this.draftMissingLabel(drafts[i])
      if (missing) incompletes.push({ index: i, missing })
    }
    if (incompletes.length === drafts.length) {
      wx.showToast({ title: '请至少填写一条约课', icon: 'none' })
      return
    }
    if (incompletes.length) {
      const first = incompletes[0]
      wx.showToast({
        title: `第 ${first.index + 1} 条缺少${first.missing}`,
        icon: 'none'
      })
      return
    }

    const firstLocal = drafts.find(
      (d) => String(d.subjectId || '').indexOf('local-') === 0
    )
    if (firstLocal) {
      wx.showToast({ title: '请先开通云开发并部署科目云函数', icon: 'none' })
      return
    }

    const items = drafts.map((d) => ({
      studentName: d.studentName.trim(),
      teacherName: d.teacherName.trim(),
      subjectId: d.subjectId,
      subjectName: d.subjectName,
      date: d.date,
      startTime: d.startTime,
      endTime: d.endTime,
      note: d.note ? String(d.note).trim() : null
    }))

    const tmplId = getSubscribeTmplId()
    const needSubscribe = !!tmplId

    this.setData({ saving: true })
    try {
      const result = await batchCreateBookings({
        batchId: `multi_${Date.now()}`,
        items,
        remindMinutesBefore: getRemindMinutesBefore()
      })

      const subjectId = items[0] && items[0].subjectId
      if (subjectId) setLastSubjectId(subjectId)

      const studentSet = {}
      const teacherSet = {}
      items.forEach((it) => {
        studentSet[it.studentName] = true
        teacherSet[it.teacherName] = true
      })
      try {
        const studentNames = Object.keys(studentSet)
        const teacherNames = Object.keys(teacherSet)
        for (let i = 0; i < studentNames.length; i++) {
          await appendName('student', studentNames[i])
        }
        for (let i = 0; i < teacherNames.length; i++) {
          await appendName('teacher', teacherNames[i])
        }
      } catch (e) {
        /* ignore */
      }

      const created = result.created || 0
      const skipped = result.skipped || 0
      const failed = result.failed || 0

      if (needSubscribe && created > 0) {
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
        wx.showToast({
          title: `已创建 ${created} 节，跳过重复 ${skipped} 节${
            failed ? `，失败 ${failed}` : ''
          }`,
          icon: 'none',
          duration: 2500
        })
        setTimeout(() => wx.navigateBack(), 600)
      }
    } catch (err) {
      showWriteError(err)
    } finally {
      this.setData({ saving: false })
    }
  },

  async onSave() {
    if (!this.data._id) {
      return this.onSaveMulti()
    }

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
