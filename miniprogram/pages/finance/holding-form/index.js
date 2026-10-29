const portfolio = require('../../../services/portfolio')
const { showApiError, showWriteError } = require('../../../utils/errors')
const { todayStr } = require('../../../utils/finance/money')
const {
  RISK_LEVELS,
  CURRENCIES,
  createEmptyHolding,
  validateHoldingArchive
} = require('../../../domain/finance/schema/holding')
const { createDefaultCatalog } = require('../../../domain/finance/schema/catalog')

Page({
  data: {
    editingId: '',
    form: createEmptyHolding(),
    lateDate: '',
    lateReturn: '',
    platforms: [],
    types: [],
    tagOptions: [],
    risks: RISK_LEVELS,
    currencies: CURRENCIES,
    platformIndex: 0,
    typeIndex: 0,
    riskIndex: 1,
    currencyIndex: 0,
    selectedTags: {}
  },

  onLoad(query) {
    const id = (query && query.id) || ''
    this.setData({ editingId: id })
    wx.setNavigationBarTitle({
      title: id ? '编辑产品' : '新增理财产品'
    })
    this.loadCatalog().then(() => {
      if (id) this.loadHolding(id)
      else {
        const form = createEmptyHolding()
        form.startDate = todayStr()
        form.minDays = 14
        form.risk = 'PR2'
        this.setData({ form })
        this.syncPickers()
      }
    })
  },

  loadCatalog() {
    return portfolio
      .listCatalog({ silent: true })
      .then((c) => {
        const catalog = c || createDefaultCatalog()
        this.setData({
          platforms: catalog.platforms || [],
          types: catalog.types || [],
          tagOptions: catalog.tags || []
        })
      })
      .catch((err) => {
        showApiError(err)
        const d = createDefaultCatalog()
        this.setData({
          platforms: d.platforms,
          types: d.types,
          tagOptions: d.tags
        })
      })
  },

  loadHolding(id) {
    portfolio
      .getHolding(id)
      .then((res) => {
        const h = res.holding || createEmptyHolding()
        const selectedTags = {}
        ;(h.tags || []).forEach((t) => {
          selectedTags[t] = true
        })
        this.setData({
          form: {
            name: h.name,
            code: h.code,
            institution: h.institution || '',
            platform: h.platform || '',
            type: h.type || '',
            risk: h.risk || 'PR2',
            principal: String(h.principal || ''),
            currency: h.currency || 'CNY',
            startDate: h.startDate || '',
            endDate: h.endDate || '',
            expectedAnnual:
              h.expectedAnnual == null ? '' : String(h.expectedAnnual),
            minDays: String(h.minDays == null ? 14 : h.minDays),
            summary: h.summary || '',
            notes: h.notes || '',
            tags: h.tags || []
          },
          selectedTags
        })
        this.syncPickers()
      })
      .catch(showApiError)
  },

  syncPickers() {
    const { form, platforms, types, risks, currencies } = this.data
    this.setData({
      platformIndex: Math.max(0, platforms.indexOf(form.platform)),
      typeIndex: Math.max(0, types.indexOf(form.type)),
      riskIndex: Math.max(0, risks.indexOf(form.risk)),
      currencyIndex: Math.max(0, currencies.indexOf(form.currency))
    })
  },

  onField(e) {
    const k = e.currentTarget.dataset.k
    this.setData({ ['form.' + k]: e.detail.value })
  },

  onLateDate(e) {
    this.setData({ lateDate: e.detail.value })
  },
  onLateReturn(e) {
    this.setData({ lateReturn: e.detail.value })
  },
  onStartDate(e) {
    this.setData({ 'form.startDate': e.detail.value })
  },
  onEndDate(e) {
    this.setData({ 'form.endDate': e.detail.value })
  },
  onPlatform(e) {
    const i = Number(e.detail.value)
    this.setData({
      platformIndex: i,
      'form.platform': this.data.platforms[i] || ''
    })
  },
  onType(e) {
    const i = Number(e.detail.value)
    this.setData({
      typeIndex: i,
      'form.type': this.data.types[i] || ''
    })
  },
  onRisk(e) {
    const i = Number(e.detail.value)
    this.setData({
      riskIndex: i,
      'form.risk': this.data.risks[i]
    })
  },
  onCurrency(e) {
    const i = Number(e.detail.value)
    this.setData({
      currencyIndex: i,
      'form.currency': this.data.currencies[i]
    })
  },

  onToggleTag(e) {
    const tag = e.currentTarget.dataset.tag
    const selectedTags = Object.assign({}, this.data.selectedTags)
    if (selectedTags[tag]) delete selectedTags[tag]
    else selectedTags[tag] = true
    this.setData({ selectedTags })
  },

  onCancel() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/finance/invest/index' }) })
  },

  buildPayload(replaceEliminatedId) {
    const f = this.data.form
    const tags = Object.keys(this.data.selectedTags)
    const payload = {
      name: f.name,
      code: f.code,
      institution: f.institution,
      platform: f.platform,
      type: f.type,
      risk: f.risk,
      principal: Number(f.principal),
      currency: f.currency,
      startDate: f.startDate,
      endDate: f.endDate,
      expectedAnnual: f.expectedAnnual === '' ? null : Number(f.expectedAnnual),
      minDays: Number(f.minDays) || 0,
      summary: f.summary,
      notes: f.notes,
      tags
    }
    if (this.data.editingId) payload._id = this.data.editingId
    else {
      if (this.data.lateDate && this.data.lateReturn !== '') {
        payload.lateDate = this.data.lateDate
        payload.lateReturn = Number(this.data.lateReturn)
      }
    }
    if (replaceEliminatedId) payload.replaceEliminatedId = replaceEliminatedId
    return payload
  },

  onSave() {
    const payload = this.buildPayload()
    const v = validateHoldingArchive(payload)
    if (!v.ok) {
      wx.showToast({ title: v.message, icon: 'none' })
      return
    }
    this.doSave(payload)
  },

  doSave(payload) {
    portfolio
      .upsertHolding(payload)
      .then(() => {
        wx.showToast({ title: '已保存', icon: 'success' })
        setTimeout(() => {
          wx.navigateBack({
            fail: () => wx.switchTab({ url: '/pages/finance/invest/index' })
          })
        }, 500)
      })
      .catch((err) => {
        if (err && err.code === 'CODE_CONFLICT' && err.result && err.result.conflict) {
          const c = err.result.conflict
          wx.showModal({
            title: '编号冲突确认',
            content:
              '编号 ' +
              c.code +
              ' 已被已淘汰产品「' +
              c.name +
              '」使用。确认放行后，原已淘汰产品将被永久删除。',
            success: (r) => {
              if (r.confirm) {
                this.doSave(this.buildPayload(c._id))
              }
            }
          })
          return
        }
        showWriteError(err)
      })
  }
})
