const rules = require('../../../domain/finance/accounts/rules')
const { createModel, present } = require('../../../domain/finance/accounts/present')
const vault = require('../../../services/vault')

Page({
  data: present(createModel(rules.todayStr())),

  onLoad() {
    this.model = createModel(rules.todayStr())
    this.model.loading = true
    this._pendingRestore = null
    this.render()
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
    const app = getApp()
    const intent = app.globalData && app.globalData.vaultIntent
    if (intent && intent.type === 'restore' && intent.snapshot) {
      app.globalData.vaultIntent = null
      this._pendingRestore = intent.snapshot
    }
    if (app.globalData && app.globalData.vaultDirty) {
      app.globalData.vaultDirty = false
    }
    this.load()
  },

  noop() {},

  render() {
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
      if (result.migrated) this.toast('信用卡账户已迁移')
      if (this._pendingRestore) {
        this.model.session = rules.applyRestoreTemplate(
          this.model.session,
          this._pendingRestore,
          this.model.accounts,
          this.model.today
        )
        this._pendingRestore = null
        this.model.sheet = ''
      }
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

  onOpenManage() {
    wx.navigateTo({ url: '/pages/finance/account-manage/index' })
  },

  onAskAbandon() {
    this.model.sheet = 'abandon'
    this.render()
  },

  onKeepRestore() {
    this.model.sheet = ''
    this.render()
  },

  onAbandonRestore() {
    this.model.session = rules.abandonRestore(this.model.session, this.model.today)
    this.model.sheet = ''
    this.render()
  },

  onOpenCalendar() {
    const parts = this.model.session.date.split('-')
    this.model.calendar = { year: Number(parts[0]), month: Number(parts[1]) }
    this.model.sheet = 'calendar'
    this.render()
  },

  onShiftMonth(e) {
    const dir = Number(e.currentTarget.dataset.dir)
    let year = this.model.calendar.year
    let month = this.model.calendar.month + dir
    if (month < 1) {
      month = 12
      year -= 1
    }
    if (month > 12) {
      month = 1
      year += 1
    }
    this.model.calendar = { year, month }
    this.render()
  },

  onPickDate(e) {
    const date = e.currentTarget.dataset.date
    const next = rules.selectSessionDate(this.model.session, date, this.model.today)
    if (next === this.model.session) return
    this.model.session = next
    this.model.sheet = ''
    this.render()
  },

  onCloseSheet() {
    this.model.sheet = ''
    this.render()
  },

  onToggleNet() {
    this.model.session.netExpanded = !this.model.session.netExpanded
    this.render()
  },

  onFilter(e) {
    this.model.session.filter = e.currentTarget.dataset.filter
    this.render()
  },

  onToggleGroup(e) {
    const type = e.currentTarget.dataset.type
    const collapsed = Object.assign({}, this.model.session.collapsed)
    const current = String(e.currentTarget.dataset.collapsed) === '1'
    collapsed[type] = !current
    this.model.session.collapsed = collapsed
    this.render()
  },

  onAmountInput(e) {
    const id = e.currentTarget.dataset.id
    this.model.session.drafts = Object.assign({}, this.model.session.drafts, {
      [id]: rules.formatTyping(e.detail.value)
    })
    this.render()
  },

  onAmountBlur(e) {
    const id = e.currentTarget.dataset.id
    const account = (this.model.accounts || []).find((item) => item.id === id)
    if (!account) return
    const drafts = Object.assign({}, this.model.session.drafts)
    const parsed = rules.parseAmount(drafts[id], account.type)
    if (parsed.state === 'empty') delete drafts[id]
    else if (parsed.state === 'ok') drafts[id] = rules.formatAmountInput(parsed.value)
    this.model.session.drafts = drafts
    this.render()
  },

  onNote(e) {
    this.model.session.note = String(e.detail.value || '').slice(0, rules.SNAPSHOT_NOTE_MAX)
    this.render()
  },

  onOpenHistory() {
    wx.navigateTo({ url: '/pages/finance/vault-history/index' })
  },

  onAdd() {
    wx.navigateTo({ url: '/pages/finance/account-form/index' })
  },

  currentPlan() {
    return rules.planSave({
      accounts: this.model.accounts,
      snapshots: this.model.snapshots,
      date: this.model.session.date,
      drafts: this.model.session.drafts,
      note: this.model.session.note,
      isRestored: !!this.model.session.restore,
      today: this.model.today
    })
  },

  onSave() {
    if (this.model.saving) return
    const plan = this.currentPlan()
    if (!plan.ok) {
      this.toast(plan.error || '请检查金额')
      if (plan.focusId) wx.pageScrollTo({ selector: '#row-' + plan.focusId, duration: 200 })
      return
    }
    if (plan.needsOverwrite) {
      this.model.sheet = 'overwrite'
      this.render()
      return
    }
    this.commitSave(plan)
  },

  onCancelOverwrite() {
    this.model.sheet = ''
    this.render()
  },

  onConfirmOverwrite() {
    const plan = this.currentPlan()
    if (!plan.ok) {
      this.model.sheet = ''
      this.toast(plan.error || '请检查金额')
      this.render()
      return
    }
    this.model.sheet = ''
    this.commitSave(plan)
  },

  async commitSave(plan) {
    this.model.saving = true
    this.render()
    try {
      const result = await vault.saveSnapshot({
        date: plan.date,
        note: plan.note,
        drafts: this.model.session.drafts,
        isRestored: plan.isRestored,
        today: this.model.today
      })
      this.model.accounts = result.accounts || []
      this.model.snapshots = result.snapshots || []
      this.model.session = rules.finishSave(this.model.today)
      this.toast(plan.toast)
    } catch (error) {
      this.toast('保存失败，请重试')
    } finally {
      this.model.saving = false
      this.render()
    }
  }
})