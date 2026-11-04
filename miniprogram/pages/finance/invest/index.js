const portfolio = require('../../../services/portfolio')
const { showApiError } = require('../../../utils/errors')
const {
  buildAssetPageModel,
  createDefaultFilters,
  SHEET_FILTER_KEYS,
  SORT_KEYS
} = require('../../../utils/finance/query')
const { createDefaultCatalog } = require('../../../domain/finance/schema/catalog')

Page({
  data: {
    holdings: [],
    catalog: createDefaultCatalog(),
    filters: createDefaultFilters(),
    sortKey: 'score',
    sortDir: 'desc',
    filterOpen: false,
    sortOpen: false,
    platformOpen: false,
    model: {
      filterCount: 0,
      summary: { count: 0 },
      platforms: [],
      platformChips: [],
      sortLabel: '决策分 ↓',
      sortOptions: [],
      cards: [],
      filterGroups: [],
      docks: []
    }
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
    this.reload()
  },

  rebuildModel() {
    const model = buildAssetPageModel({
      holdings: this.data.holdings,
      catalog: this.data.catalog,
      filters: this.data.filters,
      sortKey: this.data.sortKey,
      sortDir: this.data.sortDir
    })
    this.setData({ model })
  },

  reload() {
    Promise.all([
      portfolio.listHoldings({}, { silent: true }),
      portfolio.listCatalog({ silent: true })
    ])
      .then(([holdingsRes, catalog]) => {
        this.setData({
          holdings: (holdingsRes && holdingsRes.list) || [],
          catalog: catalog || createDefaultCatalog()
        })
        this.rebuildModel()
      })
      .catch((err) => {
        showApiError(err)
        this.rebuildModel()
      })
  },

  onOpenFilter() {
    this.setData({ filterOpen: true })
  },

  onCloseFilter() {
    this.setData({ filterOpen: false })
  },

  onFilterChange(e) {
    const { key, value } = e.detail || {}
    if (!key) return
    const filters = Object.assign({}, this.data.filters, { [key]: value })
    this.setData({ filters })
    this.rebuildModel()
  },

  onFilterReset() {
    const filters = Object.assign({}, this.data.filters)
    SHEET_FILTER_KEYS.forEach((k) => {
      filters[k] = 'all'
    })
    this.setData({ filters })
    this.rebuildModel()
    wx.showToast({ title: '筛选已重置', icon: 'none' })
  },

  onPlatformChip(e) {
    const id = e.detail && e.detail.id
    if (id == null || id === '') return
    const filters = Object.assign({}, this.data.filters, { platform: id })
    this.setData({ filters })
    this.rebuildModel()
  },

  onTogglePlatform() {
    this.setData({ platformOpen: !this.data.platformOpen })
  },

  onOpenSort() {
    this.setData({ sortOpen: true })
  },

  onCloseSort() {
    this.setData({ sortOpen: false })
  },

  onSortChange(e) {
    const key = e.detail && e.detail.key
    if (!key || !SORT_KEYS.some((x) => x.k === key)) return
    let sortKey = this.data.sortKey
    let sortDir = this.data.sortDir
    if (key === sortKey) {
      sortDir = sortDir === 'desc' ? 'asc' : 'desc'
    } else {
      sortKey = key
      sortDir = 'desc'
    }
    this.setData({ sortKey, sortDir })
    this.rebuildModel()
  },

  onOpenHolding(e) {
    const id = e.detail && e.detail.id
    if (!id) return
    wx.navigateTo({
      url: '/pages/finance/holding-detail/index?id=' + id
    })
  },

  onOpenDock(e) {
    const variant = e.detail && e.detail.variant
    if (variant === 'closed') {
      wx.navigateTo({ url: '/pages/finance/closed/index' })
    }
    if (variant === 'eliminated') {
      wx.navigateTo({ url: '/pages/finance/eliminated/index' })
    }
  },

  onAdd() {
    wx.navigateTo({ url: '/pages/finance/holding-form/index' })
  },

  onDaily() {
    wx.navigateTo({ url: '/pages/finance/daily-entry/index' })
  },

  onReturnsCal() {
    wx.navigateTo({ url: '/pages/finance/returns-calendar/index' })
  }
})
