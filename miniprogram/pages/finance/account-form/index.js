const rules = require('../../../domain/finance/accounts/rules')
const vault = require('../../../services/vault')

function presentTypes(type) {
  return rules.ACCOUNT_TYPES.map((item) => ({
    code: item.code,
    name: item.name,
    on: item.code === type
  }))
}

Page({
  data: {
    editingId: '',
    name: '',
    type: 'CASH',
    description: '',
    error: '',
    nameCount: 0,
    noteCount: 0,
    canSubmit: false,
    saving: false,
    types: presentTypes('CASH')
  },

  onLoad(query) {
    const id = (query && query.id) || ''
    this.setData({ editingId: id })
    wx.setNavigationBarTitle({
      title: id ? '编辑账户' : '添加账户'
    })
    if (id) this.loadAccount(id)
  },

  syncMeta(extra) {
    const name = Object.prototype.hasOwnProperty.call(extra, 'name')
      ? extra.name
      : this.data.name
    const description = Object.prototype.hasOwnProperty.call(extra, 'description')
      ? extra.description
      : this.data.description
    const type = Object.prototype.hasOwnProperty.call(extra, 'type')
      ? extra.type
      : this.data.type
    const trimmed = String(name || '').trim()
    this.setData(Object.assign({}, extra, {
      nameCount: trimmed.length,
      noteCount: String(description || '').length,
      canSubmit: trimmed.length > 0
        && trimmed.length <= rules.NAME_MAX
        && String(description || '').length <= rules.ACCOUNT_NOTE_MAX,
      types: presentTypes(type)
    }))
  },

  async loadAccount(id) {
    try {
      const result = await vault.loadVault()
      const account = (result.accounts || []).find((item) => item.id === id)
      if (!account || account.isDeleted) {
        wx.showToast({ title: '账户不存在', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 400)
        return
      }
      this._account = account
      this._snapshots = result.snapshots || []
      this.syncMeta({
        name: account.name || '',
        type: account.type || 'CASH',
        description: account.description || '',
        error: ''
      })
    } catch (error) {
      wx.showToast({ title: '加载失败，请重试', icon: 'none' })
    }
  },

  onName(e) {
    this.syncMeta({ name: e.detail.value, error: '' })
  },

  onType(e) {
    this.syncMeta({ type: e.currentTarget.dataset.type, error: '' })
  },

  onNote(e) {
    this.syncMeta({
      description: String(e.detail.value || '').slice(0, rules.ACCOUNT_NOTE_MAX),
      error: ''
    })
  },

  onCancel() {
    wx.navigateBack()
  },

  async onSave() {
    if (this.data.saving) return
    const check = rules.validateAccountInput({
      name: this.data.name,
      type: this.data.type,
      description: this.data.description
    })
    if (!check.ok) {
      this.setData({ error: check.error })
      return
    }
    if (this.data.editingId) {
      const account = this._account || {
        id: this.data.editingId,
        name: this.data.name,
        type: this.data.type,
        description: this.data.description
      }
      const typeCheck = rules.assertTypeChange(account, this._snapshots || [], check.type)
      if (!typeCheck.ok) {
        this.setData({ error: typeCheck.error })
        return
      }
    }
    this.setData({ saving: true, error: '' })
    try {
      await vault.saveAccount({
        id: this.data.editingId || '',
        name: check.name,
        type: check.type,
        description: check.description
      })
      getApp().globalData.vaultDirty = true
      wx.showToast({
        title: this.data.editingId ? '已更新' : check.name + ' 已添加',
        icon: 'none'
      })
      setTimeout(() => wx.navigateBack(), 350)
    } catch (error) {
      this.setData({
        saving: false,
        error: (error && error.message) || '保存失败，请重试'
      })
    }
  }
})