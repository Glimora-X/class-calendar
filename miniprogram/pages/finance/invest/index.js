const portfolio = require('../../../services/portfolio')
const { showApiError } = require('../../../utils/errors')
const {
  buildAssetPageModel,
  createDefaultFilters,
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
    platformOpen: false,
    model: {
      filterCount: 0,
      summary: { count: 0 },
      platforms: [],
      sortLabel: '决策分 ↓',
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
    this.setData({ filters: createDefaultFilters() })
    this.rebuildModel()
    wx.showToast({ title: '筛选已重置', icon: 'none' })
  },

  onTogglePlatform() {
    this.setData({ platformOpen: !this.data.platformOpen })
  },

  onCycleSort() {
    const keys = SORT_KEYS
    let idx = keys.findIndex((x) => x.k === this.data.sortKey)
    if (idx < 0) idx = 0
    let sortKey = this.data.sortKey
    let sortDir = this.data.sortDir
    if (sortDir === 'desc') {
      sortDir = 'asc'
    } else {
      sortDir = 'desc'
      idx = (idx + 1) % keys.length
      sortKey = keys[idx].k
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

  onTags() {
    wx.navigateTo({ url: '/pages/finance/tags/index' })
  },

  onLibs() {
    wx.navigateTo({ url: '/pages/finance/libs/index' })
  }
})
