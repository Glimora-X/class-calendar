/**
 * 秘密基地页面视图模型。只做展示组装，业务规则在 rules.js。
 */

const rules = require('./rules')

function emptyForm() {
  return { mode: 'create', id: '', name: '', type: 'CASH', description: '', error: '' }
}

function createModel(today) {
  const now = today || rules.todayStr()
  const parts = now.split('-')
  return {
    accounts: [],
    snapshots: [],
    session: rules.initialSession(now),
    hiddenIds: [],
    today: now,
    loaded: false,
    loading: false,
    loadError: '',
    saving: false,
    writing: false,
    sheet: '',
    form: emptyForm(),
    actionId: '',
    merge: { sourceId: '', step: 1, targetId: '' },
    calendar: { year: Number(parts[0]), month: Number(parts[1]) },
    swipeId: '',
    undo: null
  }
}

function findAccount(model, id) {
  return (model.accounts || []).find((account) => account.id === id) || null
}

function actionItems(account) {
  if (!account || account.isDeleted) return []
  const items = [
    { id: 'edit', label: '编辑', danger: false },
    { id: 'timeline', label: '历史', danger: false }
  ]
  if (account.isActive) {
    items.push({ id: 'archive', label: '停用', danger: false })
    items.push({ id: 'merge', label: '合并/迁移', danger: false })
  } else {
    items.push({ id: 'restore', label: '恢复', danger: false })
  }
  items.push({ id: 'delete', label: '删除', danger: true })
  items.push({ id: 'cancel', label: '取消', danger: false })
  return items
}

function presentForm(form) {
  const name = String(form.name || '')
  const description = String(form.description || '')
  return {
    mode: form.mode,
    title: form.mode === 'edit' ? '编辑账户' : '添加账户',
    name,
    type: form.type,
    description,
    error: form.error || '',
    nameCount: name.trim().length,
    noteCount: description.length,
    canSubmit: name.trim().length > 0 && name.trim().length <= rules.NAME_MAX && description.length <= rules.ACCOUNT_NOTE_MAX,
    types: rules.ACCOUNT_TYPES.map((item) => ({
      code: item.code,
      name: item.name,
      on: item.code === form.type
    }))
  }
}

function present(model) {
  const session = model.session
  const entries = rules.resolveEntries(model.accounts, model.snapshots, session.date, session.drafts)
  const totals = rules.computeTotals(entries)
  const grouped = rules.groupEntries(entries, session.filter, session.collapsed)
  const net = rules.netSummary(model.snapshots, session.date, totals)
  const usable = (model.accounts || []).filter((account) => account && !account.isDeleted)
  const plan = rules.planSave({
    accounts: model.accounts,
    snapshots: model.snapshots,
    date: session.date,
    drafts: session.drafts,
    note: session.note,
    isRestored: !!(session.restore),
    today: model.today
  })
  const manageGroups = []
  const manageDotClass = {
    VIRTUAL: 'orange',
    DEBT: 'orange',
    INVESTMENT: 'teal',
    RECEIVABLE: 'teal'
  }
  rules.ACCOUNT_TYPES.forEach((meta) => {
    const list = rules.accountsOfType(model.accounts, meta.code, session.orderOverride)
    if (!list.length) return
    manageGroups.push({
      type: meta.code,
      name: meta.name,
      count: list.length,
      dotClass: manageDotClass[meta.code] || '',
      rows: list.map((account, index) => {
        const bal = rules.latestAmount(account.id, model.snapshots)
        return {
          id: account.id,
          name: account.name,
          active: !!account.isActive,
          archived: !account.isActive,
          status: account.isActive ? '' : '已停用',
          balanceText: bal == null ? '暂无余额' : rules.formatYuan(bal),
          canUp: index > 0,
          canDown: index < list.length - 1
        }
      })
    })
  })
  const hidden = {}
  ;(model.hiddenIds || []).forEach((id) => {
    hidden[id] = true
  })
  const deletedAll = (model.accounts || []).filter((account) => account && account.isDeleted)
  const deletedRows = deletedAll.filter((account) => !hidden[account.id]).map((account) => ({
    id: account.id,
    name: rules.accountLabel(account)
  }))
  const calendar = rules.buildMonthGrid({
    year: model.calendar.year,
    month: model.calendar.month,
    today: model.today,
    selected: session.date,
    snapshotDates: (model.snapshots || []).map((snapshot) => snapshot.date)
  })
  const mergeAccount = findAccount(model, model.merge.sourceId)
  const mergeListed = mergeAccount
    ? rules.listMergeTargets(model.accounts, mergeAccount.id)
    : { ok: false, error: '无可合并目标', targets: [], source: null }
  const mergeTarget = (mergeListed.targets || []).find((account) => account.id === model.merge.targetId) || null
  const actionAccount = findAccount(model, model.actionId)

  return {
    loaded: model.loaded,
    loading: model.loading,
    loadError: model.loadError,
    bootEmpty: model.loaded && !model.loadError && usable.length === 0,
    archivedOnly: model.loaded && usable.length > 0 && entries.length === 0,
    tab: session.tab,
    showRestore: !!session.restore,
    restoreText: session.restore ? session.restore.sourceDate : '',
    dateText: rules.formatDateCn(session.date),
    warning: rules.hasSameDaySnapshot(model.snapshots, session.date),
    netText: rules.formatYuan(totals.totalNetWorth),
    netHint: net.hint,
    netExpanded: !!session.netExpanded,
    assetsText: rules.formatYuan(totals.totalAssets),
    liabilitiesText: rules.formatYuan(totals.totalLiabilities),
    filter: session.filter,
    groups: grouped.groups.map((group) => ({
      type: group.type,
      name: group.name,
      count: group.count,
      collapsed: !!group.collapsed,
      rows: (group.rows || []).map((row) => ({
        id: row.accountId,
        name: row.name,
        input: row.input,
        placeholder: row.placeholder,
        invalid: row.invalid,
        error: row.error,
        badge: row.badge,
        inheritBadge: row.inheritBadge,
        lastText: row.lastText,
        deltaText: row.deltaText,
        tone: row.tone,
        allowNegative: row.allowNegative
      }))
    })),
    changesEmpty: session.filter !== 'all' && entries.length > 0 && grouped.empty,
    note: session.note,
    noteCount: String(session.note || '').length,
    saveLabel: session.restore ? '以此模板新建快照' : '保存快照',
    savePro: !!session.restore,
    saving: model.saving,
    writing: !!model.writing,
    showDock: model.loaded
      && !model.loadError
      && session.tab !== 'manage'
      && entries.length > 0
      && (!!session.restore || entries.some((entry) => {
        const drafts = session.drafts || {}
        if (!Object.prototype.hasOwnProperty.call(drafts, entry.accountId)) return false
        return String(drafts[entry.accountId] || '').trim() !== ''
      })),
    manageGroups,
    deletedCount: deletedAll.length,
    deletedOpen: !!session.deletedOpen,
    deletedRows,
    hiddenCount: deletedAll.length - deletedRows.length,
    sortMode: !!session.sortMode,
    sheet: model.sheet,
    form: presentForm(model.form),
    calendar,
    weekdays: ['日', '一', '二', '三', '四', '五', '六'],
    actions: actionItems(actionAccount),
    actionTitle: actionAccount ? actionAccount.name : '',
    merge: {
      step: model.merge.step,
      empty: !mergeListed.ok,
      emptyText: mergeListed.error || '无可合并目标',
      sourceName: mergeListed.source ? mergeListed.source.name : '',
      targetName: mergeTarget ? mergeTarget.name : '',
      canNext: !!mergeTarget,
      targets: (mergeListed.targets || []).map((account) => ({
        id: account.id,
        name: account.name,
        on: account.id === model.merge.targetId
      }))
    },
    overwrite: {
      beforeText: plan.ok && plan.previousNet != null ? rules.formatYuan(plan.previousNet) : '',
      afterText: plan.ok ? rules.formatYuan(plan.nextNet) : ''
    },
    undo: model.undo,
    showEntry: session.tab !== 'manage',
    showManage: session.tab === 'manage'
  }
}

module.exports = {
  emptyForm,
  createModel,
  present,
  findAccount
}
