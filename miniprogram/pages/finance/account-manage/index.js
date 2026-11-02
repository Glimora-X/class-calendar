const rules = require('../../../domain/finance/accounts/rules')
const { createModel, present, findAccount } = require('../../../domain/finance/accounts/present')
const vault = require('../../../services/vault')

const HIDDEN_KEY = 'vault:hiddenDeleted'

function readHidden() {
  try {
    const value = wx.getStorageSync(HIDDEN_KEY)
    return Array.isArray(value) ? value : []
  } catch (error) {
    return []
  }
}

Page({
  data: present(createModel(rules.todayStr())),

  onLoad() {
    this.model = createModel(rules.todayStr())
    this.model.session.tab = 'manage'
    this.model.hiddenIds = readHidden()
    this.model.loading = true
    this._undoTimer = null
    this.render()
  },

  onShow() {
    this.load()
  },

  onUnload() {
    this.clearUndoTimer()
  },

  noop() {},

  render() {
    this.model.session.tab = 'manage'
    this.setData(present(this.model))
  },

  toast(title) {
    wx.showToast({ title, icon: 'none' })
  },

  async load() {
    if (this._loading) return
    this._loading = true
    this.model.loading = !this.model.loaded
    this.render()
    try {
      const result = await vault.loadVault()
      this.model.accounts = result.accounts || []
      this.model.snapshots = result.snapshots || []
      this.model.loaded = true
      this.model.loadError = ''
      this.model.session.orderOverride = {}
    } catch (error) {
      if (!this.model.loaded) this.model.loadError = '账户加载失败'
      else this.toast('加载失败，请重试')
    } finally {
      this.model.loading = false
      this._loading = false
      this.render()
    }
  },

  onRetry() {
    this.load()
  },

  onCloseSheet() {
    this.model.sheet = ''
    this.render()
  },

  onAdd() {
    wx.navigateTo({ url: '/pages/finance/account-form/index' })
  },

  onEdit(id) {
    const account = findAccount(this.model, id)
    if (!account || account.isDeleted) return
    wx.navigateTo({ url: '/pages/finance/account-form/index?id=' + account.id })
  },

  onFlatAct(e) {
    const id = e.currentTarget.dataset.id
    const act = e.currentTarget.dataset.act
    const account = findAccount(this.model, id)
    if (act === 'timeline') {
      this.openTimeline(id)
      return
    }
    if (!account) return
    if (act === 'edit') this.onEdit(account.id)
    else if (act === 'archive') this.archive(account, false)
    else if (act === 'restore') this.archive(account, true)
    else if (act === 'merge') this.openMerge(account.id)
    else if (act === 'delete') {
      this.model.actionId = account.id
      this.model.sheet = 'deleteConfirm'
      this.render()
    }
  },

  openTimeline(id) {
    wx.navigateTo({ url: '/pages/finance/account-timeline/index?accountId=' + id })
  },

  async archive(account, active) {
    if (this.model.writing) return
    this.model.writing = true
    this.render()
    try {
      const result = await vault.setAccountActive(account.id, active)
      this.model.accounts = result.accounts || []
      this.model.snapshots = result.snapshots || []
      getApp().globalData.vaultDirty = true
      this.toast(active ? '已恢复' : '已停用')
    } catch (error) {
      this.toast((error && error.message) || '操作失败，请重试')
    } finally {
      this.model.writing = false
      this.render()
    }
  },

  onCancelDelete() {
    this.model.sheet = ''
    this.render()
  },

  async onConfirmDelete() {
    if (this.model.writing) return
    const account = findAccount(this.model, this.model.actionId)
    if (!account) return
    this.model.writing = true
    this.render()
    try {
      const result = await vault.softDeleteAccount(account.id)
      this.model.accounts = result.accounts || []
      this.model.snapshots = result.snapshots || []
      this.model.sheet = ''
      getApp().globalData.vaultDirty = true
      this.armUndo(account)
    } catch (error) {
      this.toast((error && error.message) || '删除失败，请重试')
    } finally {
      this.model.writing = false
      this.render()
    }
  },

  armUndo(account) {
    this.clearUndoTimer()
    this.model.undo = { id: account.id, name: account.name }
    this._undoTimer = setTimeout(() => {
      this.model.undo = null
      this._undoTimer = null
      this.render()
    }, 3000)
  },

  clearUndoTimer() {
    if (this._undoTimer) clearTimeout(this._undoTimer)
    this._undoTimer = null
  },

  async onUndo() {
    const undo = this.model.undo
    if (!undo) return
    this.clearUndoTimer()
    this.model.undo = null
    this.render()
    try {
      const result = await vault.undoDeleteAccount(undo.id)
      this.model.accounts = result.accounts || []
      this.model.snapshots = result.snapshots || []
      getApp().globalData.vaultDirty = true
      this.toast('已撤销删除')
    } catch (error) {
      this.toast((error && error.message) || '撤销已超时')
      this.load()
    }
    this.render()
  },

  onToggleDeleted() {
    this.model.session.deletedOpen = !this.model.session.deletedOpen
    this.render()
  },

  onHideDeleted(e) {
    const id = e.currentTarget.dataset.id
    if (this.model.hiddenIds.indexOf(id) < 0) this.model.hiddenIds.push(id)
    wx.setStorageSync(HIDDEN_KEY, this.model.hiddenIds)
    this.render()
  },

  onShowHidden() {
    this.model.hiddenIds = []
    wx.setStorageSync(HIDDEN_KEY, [])
    this.render()
  },

  async onMove(e) {
    if (this.model.writing) return
    const id = e.currentTarget.dataset.id
    const dir = Number(e.currentTarget.dataset.dir)
    const account = findAccount(this.model, id)
    if (!account) return
    const list = rules.accountsOfType(this.model.accounts, account.type, this.model.session.orderOverride)
    const moved = rules.moveOrder(list.map((item) => item.id), id, dir)
    if (!moved.moved) return
    this.model.writing = true
    this.render()
    try {
      const result = await vault.reorderAccounts(account.type, moved.ids)
      this.model.accounts = result.accounts || []
      this.model.snapshots = result.snapshots || []
      this.model.session.orderOverride = {}
      getApp().globalData.vaultDirty = true
    } catch (error) {
      this.toast((error && error.message) || '排序失败，请重试')
    } finally {
      this.model.writing = false
      this.render()
    }
  },

  openMerge(id) {
    const listed = rules.listMergeTargets(this.model.accounts, id)
    this.model.merge = { sourceId: id, step: listed.ok ? 1 : 0, targetId: '' }
    this.model.sheet = 'merge'
    this.render()
  },

  onPickMerge(e) {
    this.model.merge.targetId = e.currentTarget.dataset.id
    this.render()
  },

  onMergeNext() {
    if (!this.model.merge.targetId) return
    this.model.merge.step = 2
    this.render()
  },

  onMergeBack() {
    this.model.merge.step = 1
    this.render()
  },

  async onMergeConfirm() {
    if (this.model.writing) return
    const merge = this.model.merge
    const target = findAccount(this.model, merge.targetId)
    this.model.writing = true
    this.render()
    try {
      const result = await vault.mergeAccounts({
        sourceId: merge.sourceId,
        targetId: merge.targetId,
        today: this.model.today
      })
      this.model.accounts = result.accounts || []
      this.model.snapshots = result.snapshots || []
      this.model.sheet = ''
      getApp().globalData.vaultDirty = true
      this.toast('已合并到 ' + (target ? target.name : '目标账户'))
    } catch (error) {
      this.toast((error && error.message) || '合并失败，请重试')
    } finally {
      this.model.writing = false
      this.render()
    }
  }
})