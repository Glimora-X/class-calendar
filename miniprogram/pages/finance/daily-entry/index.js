const portfolio = require('../../../services/portfolio')
const { showApiError, showWriteError } = require('../../../utils/errors')
const { todayStr, addDays, fmtMoney } = require('../../../utils/finance/money')
const { getLatestEOD } = require('../../../utils/finance/metrics')

Page({
  data: {
    date: todayStr(),
    dateOffset: 0,
    focusId: '',
    holdings: [],
    drafts: {},
    rows: [],
    filled: 0
  },

  onLoad(query) {
    if (query && query.id) this.setData({ focusId: query.id })
  },

  onShow() {
    this.reload()
  },

  reload() {
    portfolio
      .listHoldings({}, { silent: true })
      .then((res) => {
        const holdings = ((res && res.list) || []).filter(
          (p) => p.status !== 'eliminated'
        )
        this.setData({ holdings })
        this.buildRows()
      })
      .catch(showApiError)
  },

  buildRows() {
    const date = this.data.date
    const drafts = this.data.drafts
    const focusId = this.data.focusId
    let list = this.data.holdings
    if (focusId) {
      const focused = list.filter((p) => p._id === focusId)
      if (focused.length) list = focused
    }
    const rows = list.map((p) => {
      const existing = (p.dailyEntries || []).find((e) => e.date === date)
      const hasReal = existing && existing.dailyReturn !== 0
      const value =
        drafts[p._id] !== undefined && drafts[p._id] !== null
          ? String(drafts[p._id])
          : ''
      return {
        id: p._id,
        name: p.name,
        code: p.code,
        eodText: fmtMoney(getLatestEOD(p)),
        hint: hasReal
          ? '当日已有日结（非纯现金流）'
          : existing
            ? '当日仅有现金流记录'
            : '',
        value,
        cls: value !== '' ? 'filled' : ''
      }
    })
    const filled = rows.filter((r) => r.value !== '' && r.value != null).length
    this.setData({ rows, filled })
  },

  onDatePreset(e) {
    const o = Number(e.currentTarget.dataset.o)
    const date = addDays(todayStr(), o)
    this.setData({ dateOffset: o, date, drafts: {} })
    this.buildRows()
  },

  onDate(e) {
    this.setData({ date: e.detail.value, dateOffset: null, drafts: {} })
    this.buildRows()
  },

  onInput(e) {
    const id = e.currentTarget.dataset.id
    const drafts = Object.assign({}, this.data.drafts)
    drafts[id] = e.detail.value
    this.setData({ drafts })
    this.buildRows()
  },

  confirmIfNeeded(items, done) {
    const date = this.data.date
    const need = items.some((it) => {
      const p = this.data.holdings.find((x) => x._id === it._id)
      const ex = (p.dailyEntries || []).find((e) => e.date === date)
      return ex && ex.dailyReturn !== 0
    })
    if (!need) {
      done()
      return
    }
    wx.showModal({
      title: '覆盖确认',
      content: '当日已有非「纯现金流」日结记录，确认覆盖？',
      success: (r) => {
        if (r.confirm) done()
      }
    })
  },

  onSaveOne(e) {
    const id = e.currentTarget.dataset.id
    const raw = this.data.drafts[id]
    if (raw === undefined || raw === '') return
    const dailyReturn = Number(raw)
    if (!Number.isFinite(dailyReturn)) {
      wx.showToast({ title: '请输入数字', icon: 'none' })
      return
    }
    const items = [{ _id: id, date: this.data.date, dailyReturn }]
    this.confirmIfNeeded(items, () => {
      portfolio
        .upsertDaily({ items })
        .then(() => {
          const drafts = Object.assign({}, this.data.drafts)
          delete drafts[id]
          this.setData({ drafts })
          wx.showToast({ title: '已保存', icon: 'success' })
          this.reload()
        })
        .catch(showWriteError)
    })
  },

  onSubmit() {
    const items = []
    Object.keys(this.data.drafts).forEach((id) => {
      const raw = this.data.drafts[id]
      if (raw === '' || raw == null) return
      const dailyReturn = Number(raw)
      if (!Number.isFinite(dailyReturn)) return
      items.push({ _id: id, date: this.data.date, dailyReturn })
    })
    if (!items.length) {
      wx.showToast({ title: '请至少填写一条', icon: 'none' })
      return
    }
    this.confirmIfNeeded(items, () => {
      portfolio
        .upsertDaily({ items })
        .then(() => {
          wx.showToast({ title: '已保存 ' + items.length + ' 条', icon: 'success' })
          this.setData({ drafts: {} })
          setTimeout(() => wx.navigateBack(), 500)
        })
        .catch(showWriteError)
    })
  }
})
