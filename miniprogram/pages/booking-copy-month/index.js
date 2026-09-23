const { addMonths, buildCopyMonthPreview } = require('../../utils/date-utils')
const { monthRange, formatMonthKey, formatDate } = require('../../utils/format')
const { listBookings, batchCreateBookings } = require('../../services/booking')
const { listDayHolds } = require('../../services/day-hold')
const { annotateCopyRows, holdsToMap } = require('../../utils/day-hold')
const { showApiError, showWriteError } = require('../../utils/errors')
const { getRemindMinutesBefore } = require('../../utils/prefs')

Page({
  data: {
    targetYear: 0,
    targetMonth: 0,
    sourceYear: 0,
    sourceMonth: 0,
    titleText: '',
    sourceLabel: '',
    createRows: [],
    skippedRows: [],
    selectedCount: 0,
    loading: true,
    saving: false,
    empty: false
  },

  onLoad() {
    const app = getApp()
    const now = new Date()
    const targetYear = app.globalData.viewingYear || now.getFullYear()
    const targetMonth = app.globalData.viewingMonth || now.getMonth() + 1
    const source = addMonths(targetYear, targetMonth, -1)
    this.setData({
      targetYear,
      targetMonth,
      sourceYear: source.year,
      sourceMonth: source.month,
      titleText: `复制到 ${targetYear}年${targetMonth}月`,
      sourceLabel: `来源：${source.year}年${source.month}月`
    })
    this.loadPreview()
  },

  async loadPreview() {
    const { targetYear, targetMonth, sourceYear, sourceMonth } = this.data
    this.setData({ loading: true })
    try {
      const { start, end } = monthRange(sourceYear, sourceMonth)
      const targetRange = monthRange(targetYear, targetMonth)
      const [bookingRes, holdRes] = await Promise.all([
        listBookings({ start, end }),
        listDayHolds(
          { start: targetRange.start, end: targetRange.end },
          { silent: true }
        ).catch(() => ({ list: [] }))
      ])
      const sourceList = (bookingRes && bookingRes.list) || []
      const holdMap = holdsToMap((holdRes && holdRes.list) || [])
      const { previewCreate, previewSkipped } = buildCopyMonthPreview(
        sourceList,
        targetYear,
        targetMonth
      )
      const createRows = annotateCopyRows(
        previewCreate.map((row, idx) => ({
          key: row._id || `c-${idx}`,
          checked: true,
          sourceDate: row._sourceDate || '',
          date: row.date,
          studentName: row.studentName || '',
          teacherName: row.teacherName || '',
          subjectName: row.subjectName || '',
          subjectId: row.subjectId || '',
          startTime: row.startTime || '',
          endTime: row.endTime || '',
          note: row.note == null ? null : row.note
        })),
        holdMap,
        formatDate(new Date())
      )
      const skippedRows = previewSkipped.map((row, idx) => ({
        key: row._id || `s-${idx}`,
        sourceDate: row.date || '',
        studentName: row.studentName || '',
        teacherName: row.teacherName || '',
        startTime: row.startTime || '',
        endTime: row.endTime || '',
        reason: row.skippedReason
          ? `无法生成：${row.skippedReason}`
          : '无法生成：目标月没有对应周次'
      }))
      this.setData({
        createRows,
        skippedRows,
        selectedCount: createRows.filter((r) => r.checked).length,
        empty: !sourceList.length,
        loading: false
      })
    } catch (err) {
      this.setData({ loading: false, empty: true })
      showApiError(err)
    }
  },

  onToggleAll() {
    const allChecked = this.data.createRows.every((r) => r.checked)
    const createRows = this.data.createRows.map((r) =>
      Object.assign({}, r, { checked: !allChecked })
    )
    this.setData({
      createRows,
      selectedCount: createRows.filter((r) => r.checked).length
    })
  },

  onToggleRow(e) {
    const key = e.currentTarget.dataset.key
    const createRows = this.data.createRows.map((r) => {
      if (r.key !== key) return r
      return Object.assign({}, r, { checked: !r.checked })
    })
    this.setData({
      createRows,
      selectedCount: createRows.filter((r) => r.checked).length
    })
  },

  async onConfirm() {
    const {
      createRows,
      targetYear,
      targetMonth,
      saving,
      selectedCount
    } = this.data
    if (saving) return
    if (!selectedCount) {
      wx.showToast({ title: '请至少选择一条', icon: 'none' })
      return
    }

    const picked = createRows.filter((r) => r.checked)
    const confirm = await new Promise((resolve) => {
      wx.showModal({
        title: '确认创建',
        content: `将向 ${targetYear}年${targetMonth}月 写入 ${picked.length} 节，重复的会自动跳过。`,
        success: (res) => resolve(!!res.confirm)
      })
    })
    if (!confirm) return

    const items = picked.map((r) => ({
      studentName: r.studentName,
      teacherName: r.teacherName,
      subjectId: r.subjectId,
      subjectName: r.subjectName,
      date: r.date,
      startTime: r.startTime,
      endTime: r.endTime,
      note: r.note
    }))
    const batchId = `copy_${formatMonthKey(targetYear, targetMonth)}_${Date.now()}`

    this.setData({ saving: true })
    try {
      const result = await batchCreateBookings({
        batchId,
        items,
        remindMinutesBefore: getRemindMinutesBefore()
      })
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
