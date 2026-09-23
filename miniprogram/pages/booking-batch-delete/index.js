const { WEEKDAY_CN } = require('../../utils/constants')
const { monthRange } = require('../../utils/format')
const { listBookings, batchDeleteBookings } = require('../../services/booking')
const { showApiError, showWriteError } = require('../../utils/errors')
const {
  MAX_DELETE_IDS,
  normalizeDeleteIds,
  filterBookingsByWeekday
} = require('../../utils/booking-batch-delete')

const WEEKDAY_OPTIONS = WEEKDAY_CN.map((label, value) => ({
  value,
  label: `星期${label}`
}))

function byDateThenTime(a, b) {
  const da = String((a && a.date) || '')
  const db = String((b && b.date) || '')
  if (da !== db) return da < db ? -1 : 1
  const ta = String((a && a.startTime) || '')
  const tb = String((b && b.startTime) || '')
  return ta < tb ? -1 : ta > tb ? 1 : 0
}

Page({
  data: {
    year: 0,
    month: 0,
    monthLabel: '',
    weekdayPickerIndex: 1,
    weekdayIndex: 1,
    weekdayOptions: WEEKDAY_OPTIONS,
    weekdayLabel: '星期一',
    previewRows: [],
    selectedCount: 0,
    loading: false,
    saving: false
  },

  onLoad(query) {
    const app = getApp()
    const now = new Date()
    const year = Number(query && query.year) || app.globalData.viewingYear || now.getFullYear()
    const month = Number(query && query.month) || app.globalData.viewingMonth || now.getMonth() + 1
    this.setData({
      year,
      month,
      monthLabel: `${year}年${month}月`
    })
    this.refreshPreview(year, month, this.data.weekdayIndex)
  },

  async refreshPreview(year, month, weekdayIndex) {
    const y = year != null ? year : this.data.year
    const m = month != null ? month : this.data.month
    const w = weekdayIndex != null ? weekdayIndex : this.data.weekdayIndex
    this.setData({ loading: true })
    try {
      const { start, end } = monthRange(y, m)
      const res = await listBookings({ start, end }, { title: '加载中' })
      const matched = filterBookingsByWeekday((res && res.list) || [], w).slice().sort(byDateThenTime)
      const previewRows = matched.map((b) => ({
        _id: b._id,
        selected: true,
        date: b.date,
        timeLabel: [b.startTime, b.endTime].filter(Boolean).join('–'),
        title: [b.studentName, b.teacherName].filter(Boolean).join(' · '),
        subjectName: b.subjectName || ''
      }))
      this.setData({
        previewRows,
        selectedCount: previewRows.length,
        loading: false
      })
    } catch (err) {
      this.setData({ previewRows: [], selectedCount: 0, loading: false })
      showApiError(err)
    }
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

  onTogglePreviewRow(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    const previewRows = (this.data.previewRows || []).map((row) => {
      if (row._id !== id) return row
      return Object.assign({}, row, { selected: !row.selected })
    })
    this.setData({
      previewRows,
      selectedCount: previewRows.filter((r) => r.selected).length
    })
  },

  async onSubmit() {
    if (this.data.saving) return
    const picked = (this.data.previewRows || []).filter((r) => r.selected)
    const ids = normalizeDeleteIds(picked.map((r) => r._id))
    if (!ids.length) {
      wx.showToast({ title: '请先勾选课程', icon: 'none' })
      return
    }
    const truncated = picked.length > ids.length
    const confirm = await new Promise((resolve) => {
      wx.showModal({
        title: '确认删除',
        content: truncated
          ? `一次最多删除 ${MAX_DELETE_IDS} 节，将删除已勾选中的前 ${ids.length} 节。占用日标记不会动。`
          : `将删除 ${ids.length} 节课，占用日标记不会动。删了回不来。`,
        confirmColor: '#ef4444',
        confirmText: '删除',
        success: (res) => resolve(!!res.confirm)
      })
    })
    if (!confirm) return

    this.setData({ saving: true })
    try {
      const result = await batchDeleteBookings(ids)
      const n = (result && result.deleted) || 0
      wx.showToast({
        title: n ? `已删掉 ${n} 节` : '没有删掉课程',
        icon: 'none',
        duration: 2000
      })
      setTimeout(() => wx.navigateBack(), 600)
    } catch (err) {
      showWriteError(err)
    } finally {
      this.setData({ saving: false })
    }
  }
})
