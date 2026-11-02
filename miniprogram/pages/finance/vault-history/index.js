const rules = require('../../../domain/finance/accounts/rules')
const vault = require('../../../services/vault')

Page({
  data: {
    loading: true,
    error: '',
    rows: [],
    confirmOpen: false,
    confirm: {
      id: '',
      dateText: '',
      netText: '',
      detailCount: 0
    }
  },

  onShow() {
    this.load()
  },

  async load() {
    this.setData({ loading: true, error: '', confirmOpen: false })
    try {
      const result = await vault.loadVault()
      const snapshots = result.snapshots || []
      const accounts = result.accounts || []
      this._snapshots = snapshots
      this.setData({
        loading: false,
        rows: rules.buildHistoryRows(snapshots, accounts)
      })
    } catch (error) {
      this.setData({ loading: false, error: '快照加载失败' })
    }
  },

  onRetry() {
    this.load()
  },

  onAskRestore(e) {
    const id = e.currentTarget.dataset.id
    const row = (this.data.rows || []).find((item) => item.id === id)
    const snapshot = (this._snapshots || []).find((item) => item.id === id)
    if (!row || !snapshot) return
    this.setData({
      confirmOpen: true,
      confirm: {
        id,
        dateText: row.dateText,
        netText: row.netText,
        detailCount: row.detailCount
      }
    })
  },

  onCancelRestore() {
    this.setData({ confirmOpen: false })
  },

  noop() {},

  onConfirmRestore() {
    const id = this.data.confirm && this.data.confirm.id
    const snapshot = (this._snapshots || []).find((item) => item.id === id)
    if (!snapshot) {
      this.setData({ confirmOpen: false })
      return
    }
    this.setData({ confirmOpen: false })
    getApp().globalData.vaultIntent = { type: 'restore', snapshot }
    wx.switchTab({ url: '/pages/finance/assets/index' })
  }
})
