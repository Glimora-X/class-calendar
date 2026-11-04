/**
 * 秘密基地领域规则。云函数 accountVault/rules.js 必须与本文件保持一致。
 */

const AMOUNT_ABS_MAX = 99999999999.99
const NAME_MAX = 40
const ACCOUNT_NOTE_MAX = 200
const SNAPSHOT_NOTE_MAX = 500

const ACCOUNT_TYPES = [
  { code: 'CASH', name: '现金', side: 'asset', sign: 'nonneg' },
  { code: 'SAVINGS_CARD', name: '储蓄卡', side: 'asset', sign: 'nonneg' },
  { code: 'VIRTUAL', name: '虚拟账户', side: 'asset', sign: 'nonneg' },
  { code: 'INVESTMENT', name: '投资账户', side: 'asset', sign: 'nonneg' },
  { code: 'DEBT', name: '负债', side: 'liability', sign: 'nonneg' },
  { code: 'RECEIVABLE', name: '债权', side: 'asset', sign: 'nonneg' },
  { code: 'CUSTOM', name: '自定义资产', side: 'asset', sign: 'any' }
]

const TYPE_MAP = {}
ACCOUNT_TYPES.forEach((item) => {
  TYPE_MAP[item.code] = item
})

function round2(n) {
  return Math.round(Number(n) * 100) / 100
}

function cents(n) {
  return Math.round(Number(n) * 100)
}

function todayStr(d) {
  const x = d || new Date()
  const y = x.getFullYear()
  const m = String(x.getMonth() + 1).padStart(2, '0')
  const day = String(x.getDate()).padStart(2, '0')
  return y + '-' + m + '-' + day
}

function isDateStr(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))
}

function cmpDate(a, b) {
  if (a === b) return 0
  return a < b ? -1 : 1
}

function canSelectDate(date, today) {
  if (!isDateStr(date) || !isDateStr(today)) return false
  return cmpDate(date, today) <= 0
}

/** 当天默认看全部；历史日默认仅看变动 */
function defaultFilterForDate(date, today) {
  return date === today ? 'all' : 'changes'
}

function shiftDate(date, delta) {
  const matched = String(date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!matched) return ''
  const dt = new Date(Date.UTC(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3])))
  dt.setUTCDate(dt.getUTCDate() + delta)
  return dt.toISOString().slice(0, 10)
}

function acceptableClientToday(clientToday, serverNow) {
  if (!isDateStr(clientToday)) return false
  const server = (serverNow || new Date()).toISOString().slice(0, 10)
  return clientToday === server
    || clientToday === shiftDate(server, 1)
    || clientToday === shiftDate(server, -1)
}

function formatDateCn(date) {
  const matched = String(date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!matched) return ''
  return matched[1] + '年' + Number(matched[2]) + '月' + Number(matched[3]) + '日'
}

function formatGrouped(n) {
  const neg = Number(n) < 0
  const abs = Math.abs(round2(n)).toFixed(2)
  const parts = abs.split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return (neg ? '-' : '') + parts.join('.')
}

function formatYuan(n) {
  return '¥' + formatGrouped(n)
}

function formatSignedYuan(n) {
  const value = round2(n)
  if (value > 0) return '+' + formatYuan(value)
  if (value < 0) return '-' + formatYuan(Math.abs(value))
  return formatYuan(0)
}

function formatAmountInput(n) {
  return formatGrouped(n)
}

function formatTyping(raw) {
  const text = String(raw == null ? '' : raw)
  const neg = /^\s*-/.test(text)
  const cleaned = text.replace(/[¥,\s]/g, '').replace(/-/g, '')
  const matched = cleaned.match(/^(\d*)(\.\d{0,2})?/)
  if (!matched) return neg ? '-' : ''
  let intPart = matched[1] || ''
  intPart = intPart.replace(/^0+(?=\d)/, '')
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const dec = matched[2] || ''
  const body = (grouped || (dec ? '0' : '')) + dec
  if (!body) return neg ? '-' : ''
  return (neg ? '-' : '') + body
}

function accountLabel(account) {
  if (!account) return '未知账户'
  const name = account.name || '未命名'
  if (account.isDeleted) return name + '（已删除）'
  return name
}

function typeIndex(code) {
  const index = ACCOUNT_TYPES.findIndex((item) => item.code === code)
  return index < 0 ? 99 : index
}

function validateAccountInput(input) {
  const name = String((input && input.name) || '').trim()
  const type = String((input && input.type) || '').trim()
  const description = String((input && input.description) || '').trim()
  if (!name) return { ok: false, error: '请填写名称' }
  if (name.length > NAME_MAX) return { ok: false, error: '名称不能超过 40 字' }
  if (type === 'CREDIT_CARD') return { ok: false, error: '不能新建信用卡' }
  if (!TYPE_MAP[type]) return { ok: false, error: '请选择账户类型' }
  if (description.length > ACCOUNT_NOTE_MAX) return { ok: false, error: '备注不能超过 200 字' }
  return { ok: true, name, type, description, error: '' }
}

function signAllows(type, amount) {
  const meta = TYPE_MAP[type]
  if (!meta || !Number.isFinite(amount)) return false
  if (Math.abs(amount) > AMOUNT_ABS_MAX) return false
  if (meta.sign === 'nonneg' && amount < 0) return false
  return true
}

function parseAmount(raw, type) {
  const meta = TYPE_MAP[type]
  if (!meta) return { state: 'invalid', value: null, error: '账户类型无效' }
  if (raw == null) return { state: 'empty', value: null, error: '' }
  const text = String(raw).trim()
  if (!text) return { state: 'empty', value: null, error: '' }
  const cleaned = text.replace(/[¥,\s]/g, '')
  if (/^-?\d+\.$/.test(cleaned) || cleaned === '-' || cleaned === '.' || cleaned === '-.') {
    return { state: 'partial', value: null, error: '' }
  }
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return { state: 'invalid', value: null, error: '请输入有效金额' }
  }
  const dot = cleaned.indexOf('.')
  if (dot >= 0 && cleaned.length - dot - 1 > 2) {
    return { state: 'invalid', value: null, error: '最多保留 2 位小数' }
  }
  const value = round2(Number(cleaned))
  if (!Number.isFinite(value)) return { state: 'invalid', value: null, error: '请输入有效金额' }
  if (Math.abs(value) > AMOUNT_ABS_MAX) return { state: 'invalid', value: null, error: '金额超出上限' }
  if (meta.sign === 'nonneg' && value < 0) {
    return { state: 'invalid', value: null, error: '该类型不能为负数' }
  }
  return { state: 'ok', value, error: '' }
}

function participating(account) {
  return !!(account && account.isActive && !account.isDeleted)
}

function itemsOf(snapshot) {
  return (snapshot && snapshot.items) || []
}

function findItem(snapshot, accountId) {
  return itemsOf(snapshot).find((item) => item && item.accountId === accountId) || null
}

function sortedSnapshots(snapshots) {
  return (snapshots || []).slice().sort((a, b) => cmpDate(a.date, b.date))
}

function isFirstEntry(accountId, snapshots, date) {
  return !sortedSnapshots(snapshots).some((snapshot) => {
    if (!snapshot || !snapshot.date || cmpDate(snapshot.date, date) > 0) return false
    return !!findItem(snapshot, accountId)
  })
}

function priorAmountBeforeDate(accountId, snapshots, date) {
  let prior = null
  sortedSnapshots(snapshots).forEach((snapshot) => {
    if (!snapshot.date || cmpDate(snapshot.date, date) >= 0) return
    const item = findItem(snapshot, accountId)
    if (item && Number.isFinite(Number(item.amount))) {
      prior = { date: snapshot.date, amount: round2(item.amount) }
    }
  })
  return prior
}

function baselineOf(accountId, snapshots, date) {
  const list = sortedSnapshots(snapshots)
  const same = list.find((snapshot) => snapshot.date === date)
  const sameItem = same ? findItem(same, accountId) : null
  if (sameItem && Number.isFinite(Number(sameItem.amount))) {
    return { amount: round2(sameItem.amount), source: 'same-day', inheritedFrom: null }
  }
  const prior = priorAmountBeforeDate(accountId, snapshots, date)
  if (prior) return { amount: prior.amount, source: 'carry', inheritedFrom: prior.date }
  return { amount: 0, source: 'zero', inheritedFrom: null }
}

/**
 * 历史快照单节点明细：原始值 / 结果值 / 变动值
 */
function buildSnapshotDetails(snapshot, snapshots, accounts) {
  if (!snapshot) return []
  const byId = {}
  ;(accounts || []).forEach((account) => {
    if (account) byId[account.id] = account
  })
  const rows = []
  itemsOf(snapshot).forEach((item) => {
    if (!item || !item.accountId) return
    if (!Number.isFinite(Number(item.amount))) return
    const current = round2(item.amount)
    const prior = priorAmountBeforeDate(item.accountId, snapshots, snapshot.date)
    const original = prior ? prior.amount : 0
    const first = !prior
    const delta = round2(current - original)
    let deltaTone = ''
    if (!first && delta > 0) deltaTone = 'up'
    if (!first && delta < 0) deltaTone = 'down'
    rows.push({
      accountId: item.accountId,
      name: accountLabel(byId[item.accountId] || { name: '未知账户', isDeleted: false }),
      original,
      originalText: first ? '—' : formatYuan(original),
      current,
      currentText: formatYuan(current),
      delta,
      deltaText: first ? '首次' : formatSignedYuan(delta),
      deltaTone: first ? 'first' : deltaTone,
      first
    })
  })
  rows.sort((a, b) => {
    const accA = byId[a.accountId]
    const accB = byId[b.accountId]
    const typeA = accA ? typeIndex(accA.type) : 99
    const typeB = accB ? typeIndex(accB.type) : 99
    if (typeA !== typeB) return typeA - typeB
    return String(a.name).localeCompare(String(b.name), 'zh')
  })
  return rows
}

function buildHistoryRows(snapshots, accounts) {
  return sortedSnapshots(snapshots).slice().reverse().map((snapshot) => {
    const details = buildSnapshotDetails(snapshot, snapshots, accounts)
    return {
      id: snapshot.id || snapshot._id || snapshot.date,
      date: snapshot.date,
      dateText: formatDateCn(snapshot.date),
      netText: formatYuan(snapshot.totalNetWorth),
      note: snapshot.note || '',
      restored: !!snapshot.isRestored,
      details,
      detailCount: details.length
    }
  })
}

function latestAmount(accountId, snapshots) {
  let found = null
  sortedSnapshots(snapshots).forEach((snapshot) => {
    const item = findItem(snapshot, accountId)
    if (item && Number.isFinite(Number(item.amount))) found = round2(item.amount)
  })
  return found
}

function assertTypeChange(account, snapshots, nextType) {
  const check = validateAccountInput({
    name: account.name,
    type: nextType,
    description: account.description || ''
  })
  if (!check.ok) return check
  if (account.type === nextType) return { ok: true, error: '' }
  const latest = latestAmount(account.id, snapshots)
  if (latest == null) return { ok: true, error: '' }
  if (!signAllows(nextType, latest)) {
    return { ok: false, error: '最近余额与新类型符号不兼容，请先调整余额或另选类型' }
  }
  return { ok: true, error: '' }
}

function resolveEntry(account, snapshots, date, draftRaw) {
  const base = baselineOf(account.id, snapshots, date)
  const first = isFirstEntry(account.id, snapshots, date)
  const parsed = draftRaw === undefined
    ? { state: 'empty', value: null, error: '' }
    : parseAmount(draftRaw, account.type)
  let invalid = parsed.state === 'invalid'
  const partial = parsed.state === 'partial'
  const explicit = parsed.state === 'ok'
  let error = invalid ? parsed.error : ''
  if (!explicit && !invalid && !partial && !signAllows(account.type, base.amount)) {
    invalid = true
    error = '继承余额与当前类型不兼容，请重新输入'
  }
  const amount = explicit ? parsed.value : base.amount
  const changed = explicit && !first && cents(parsed.value) !== cents(base.amount)
  let tone = ''
  let deltaText = ''
  if (first) {
    tone = 'first'
  } else if (changed) {
    const diff = round2(parsed.value - base.amount)
    tone = diff > 0 ? 'up' : 'down'
    deltaText = formatSignedYuan(diff)
  }
  let lastText = '上次 ' + formatYuan(base.amount)
  if (first) {
    lastText = explicit ? '将作为第一笔记录' : '还没有历史，请输入余额'
  } else if (base.source === 'carry' && base.inheritedFrom) {
    lastText = '继承自 ' + base.inheritedFrom
  }
  // 未编辑时不预填 0.00，避免用户先删再录
  let input = ''
  if (draftRaw !== undefined) input = parsed.state === 'empty' ? '' : formatTyping(draftRaw)
  return {
    accountId: account.id,
    name: account.name,
    type: account.type,
    typeName: TYPE_MAP[account.type] ? TYPE_MAP[account.type].name : '',
    participates: participating(account),
    amount,
    baseline: base.amount,
    source: explicit ? 'explicit' : base.source,
    inheritedFrom: base.source === 'carry' ? base.inheritedFrom : null,
    isFirstEntry: first,
    changed,
    showInChanges: changed || first || invalid || partial,
    invalid,
    partial,
    error,
    input,
    placeholder: first ? '输入余额' : formatAmountInput(base.amount),
    allowNegative: account.type === 'CUSTOM',
    badge: first ? '首次' : '',
    inheritBadge: !first && base.source === 'carry' ? '继承' : '',
    lastText,
    deltaText,
    tone,
    archived: !account.isActive && !account.isDeleted
  }
}

function resolveEntries(accounts, snapshots, date, drafts) {
  const map = drafts || {}
  return (accounts || [])
    .filter((account) => account && participating(account))
    .slice()
    .sort((a, b) => {
      const byType = typeIndex(a.type) - typeIndex(b.type)
      if (byType) return byType
      return (a.sortOrder || 0) - (b.sortOrder || 0)
    })
    .map((account) => resolveEntry(
      account,
      snapshots,
      date,
      Object.prototype.hasOwnProperty.call(map, account.id) ? map[account.id] : undefined
    ))
}

function computeTotals(entries) {
  let assets = 0
  let liabilities = 0
  ;(entries || []).forEach((row) => {
    if (!row || row.participates === false) return
    const meta = TYPE_MAP[row.type]
    if (!meta) return
    const amt = row.invalid ? Number(row.baseline) : Number(row.amount)
    if (!Number.isFinite(amt) || !signAllows(row.type, amt)) return
    if (meta.side === 'liability') liabilities += amt
    else assets += amt
  })
  assets = round2(assets)
  liabilities = round2(liabilities)
  return {
    totalAssets: assets,
    totalLiabilities: liabilities,
    totalNetWorth: round2(assets - liabilities)
  }
}

function groupEntries(entries, filter, collapsed) {
  const visible = filter === 'all' ? entries : (entries || []).filter((row) => row.showInChanges)
  const groups = []
  ACCOUNT_TYPES.forEach((meta) => {
    const rows = visible.filter((row) => row.type === meta.code)
    if (!rows.length) return
    const known = collapsed && Object.prototype.hasOwnProperty.call(collapsed, meta.code)
    const isCollapsed = known ? !!collapsed[meta.code] : false
    groups.push({
      type: meta.code,
      name: meta.name,
      count: rows.length,
      collapsed: isCollapsed,
      rows: isCollapsed ? [] : rows
    })
  })
  return { groups, empty: visible.length === 0, visibleCount: visible.length }
}

function hasSameDaySnapshot(snapshots, date) {
  return (snapshots || []).some((snapshot) => snapshot && snapshot.date === date)
}

function previousNetSnapshot(snapshots, date) {
  const earlier = sortedSnapshots(snapshots).filter((snapshot) => snapshot.date < date)
  if (earlier.length) return earlier[earlier.length - 1]
  return sortedSnapshots(snapshots).find((snapshot) => snapshot.date === date) || null
}

function netSummary(snapshots, date, totals) {
  if (!snapshots || !snapshots.length) {
    return { hint: '录入余额后保存第一份快照', delta: null, deltaText: '' }
  }
  const prev = previousNetSnapshot(snapshots, date)
  if (!prev || !Number.isFinite(Number(prev.totalNetWorth))) {
    return { hint: '录入余额后保存第一份快照', delta: null, deltaText: '' }
  }
  const delta = round2(totals.totalNetWorth - Number(prev.totalNetWorth))
  return {
    hint: '较上次 ' + formatSignedYuan(delta),
    delta,
    deltaText: formatSignedYuan(delta)
  }
}

function planSave(input) {
  const date = input && input.date
  const today = (input && input.today) || todayStr()
  if (!isDateStr(date)) return { ok: false, error: '日期无效' }
  if (cmpDate(date, today) > 0) return { ok: false, error: '不能记录未来的日期' }
  const note = String((input && input.note) || '')
  if (note.length > SNAPSHOT_NOTE_MAX) return { ok: false, error: '备注不能超过 500 字' }
  const entries = resolveEntries(input.accounts, input.snapshots, date, input.drafts)
  const bad = entries.find((row) => row.invalid || row.partial)
  if (bad) {
    return {
      ok: false,
      error: bad.invalid ? '请检查「' + bad.name + '」的金额' : '请补全「' + bad.name + '」的金额',
      focusId: bad.accountId
    }
  }
  const totals = computeTotals(entries)
  const items = entries.map((row) => ({
    accountId: row.accountId,
    amount: row.amount,
    isFirstEntry: row.isFirstEntry
  }))
  const existing = (input.snapshots || []).find((snapshot) => snapshot.date === date) || null
  let toast = existing
    ? '快照已更新 ' + formatYuan(totals.totalNetWorth)
    : '快照已保存 ' + formatYuan(totals.totalNetWorth)
  if (input && input.isRestored) toast = '已以此模板新建快照 ' + formatYuan(totals.totalNetWorth)
  return {
    ok: true,
    error: '',
    date,
    note,
    isRestored: !!(input && input.isRestored),
    items,
    totals,
    needsOverwrite: !!existing,
    previousNet: existing ? round2(existing.totalNetWorth) : null,
    nextNet: totals.totalNetWorth,
    toast
  }
}

function listMergeTargets(accounts, sourceId) {
  const source = (accounts || []).find((account) => account.id === sourceId)
  if (!source || !participating(source)) {
    return { ok: false, error: '只能合并激活账户', targets: [], source: source || null }
  }
  const targets = (accounts || []).filter((account) => {
    return participating(account) && account.type === source.type && account.id !== source.id
  })
  if (!targets.length) return { ok: false, error: '无可合并目标', targets: [], source }
  return { ok: true, error: '', targets, source }
}

function applyMerge(source, target, date) {
  const mergedFrom = (target.mergedFrom || []).slice()
  mergedFrom.push({ accountId: source.id, date, sourceName: source.name })
  const line = '[Merged from ' + source.name + ' on ' + date + ']'
  const prefix = target.description ? target.description + ' ' : ''
  return {
    source: Object.assign({}, source, { isActive: false }),
    target: Object.assign({}, target, {
      mergedFrom,
      description: (prefix + line).trim().slice(0, ACCOUNT_NOTE_MAX)
    })
  }
}

function migrateCreditCards(accounts, snapshots) {
  let migrated = false
  const next = (accounts || []).map((account) => {
    if (!account || account.type !== 'CREDIT_CARD') return account
    migrated = true
    const latest = latestAmount(account.id, snapshots)
    const prefix = account.description ? account.description + ' ' : ''
    const description = (prefix + '[Migrated from credit card]').trim().slice(0, ACCOUNT_NOTE_MAX)
    if (latest == null || cents(latest) === 0) {
      return Object.assign({}, account, { type: 'DEBT', isActive: false, description })
    }
    if (latest > 0) return Object.assign({}, account, { type: 'DEBT', description })
    return Object.assign({}, account, { type: 'SAVINGS_CARD', description })
  })
  return { accounts: next, migrated }
}

function buildTrack(accountId, snapshots, tone, maxDate) {
  const list = sortedSnapshots(snapshots).filter((snapshot) => !maxDate || cmpDate(snapshot.date, maxDate) <= 0)
  let started = false
  let last = null
  let lastDate = null
  const points = []
  list.forEach((snapshot) => {
    const item = findItem(snapshot, accountId)
    if (item && Number.isFinite(Number(item.amount))) {
      started = true
      last = round2(item.amount)
      lastDate = snapshot.date
      points.push({
        kind: 'point',
        date: snapshot.date,
        amount: last,
        amountText: formatYuan(last),
        tone,
        inheritedFrom: null,
        marker: '记录'
      })
      return
    }
    if (!started) return
    points.push({
      kind: 'point',
      date: snapshot.date,
      amount: last,
      amountText: formatYuan(last),
      tone,
      inheritedFrom: lastDate,
      marker: '继承自 ' + lastDate
    })
  })
  return points
}

function buildTimeline(account, accounts, snapshots) {
  if (!account) return { empty: true, status: '', rows: [], spark: [], accountName: '未知账户' }
  let status = ''
  if (account.isDeleted) status = '该账户已删除，历史只读'
  else if (!account.isActive) status = '该账户已停用'
  const byId = {}
  ;(accounts || []).forEach((item) => {
    if (item) byId[item.id] = item
  })
  const merges = (account.mergedFrom || []).slice().sort((a, b) => cmpDate(a.date, b.date))
  const self = buildTrack(account.id, snapshots, 'self')
  const rows = []
  if (!merges.length) {
    self.forEach((point) => rows.push(point))
  } else {
    let cursor = ''
    merges.forEach((merge) => {
      self.forEach((point) => {
        if (point.date > cursor && point.date < merge.date) rows.push(point)
      })
      const source = byId[merge.accountId]
      let sourceName = merge.sourceName || (source && source.name) || '未知账户'
      if (source && source.isDeleted && sourceName.indexOf('已删除') < 0) {
        sourceName += '（已删除）'
      }
      rows.push({
        kind: 'merge',
        date: merge.date,
        text: '合并自 ' + sourceName + ' on ' + merge.date,
        sourceName,
        accountId: merge.accountId
      })
      buildTrack(merge.accountId, snapshots, 'source', merge.date).forEach((point) => rows.push(point))
      cursor = merge.date
    })
    self.forEach((point) => {
      if (point.date >= cursor) rows.push(point)
    })
  }
  return {
    empty: rows.length === 0,
    status,
    rows,
    spark: self.slice(-12),
    accountName: accountLabel(account)
  }
}

function buildMonthGrid(input) {
  const year = input.year
  const month = input.month
  const today = input.today
  const selected = input.selected
  const marks = {}
  ;(input.snapshotDates || []).forEach((date) => {
    marks[date] = true
  })
  const first = new Date(year, month - 1, 1)
  const days = new Date(year, month, 0).getDate()
  const cells = []
  for (let i = 0; i < first.getDay(); i += 1) cells.push({ empty: true, key: 'e' + i })
  for (let day = 1; day <= days; day += 1) {
    const date = year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0')
    cells.push({
      empty: false,
      key: date,
      day,
      date,
      disabled: cmpDate(date, today) > 0,
      marked: !!marks[date],
      selected: date === selected
    })
  }
  const weeks = []
  for (let i = 0; i < cells.length; i += 7) {
    const week = cells.slice(i, i + 7)
    while (week.length < 7) week.push({ empty: true, key: 't' + i + '-' + week.length })
    weeks.push(week)
  }
  return { title: year + '年' + month + '月', weeks, year, month }
}

function initialSession(today) {
  return {
    tab: 'entry',
    date: today,
    filter: defaultFilterForDate(today, today),
    note: '',
    drafts: {},
    collapsed: {},
    netExpanded: false,
    restore: null,
    sortMode: false,
    sortDirty: false,
    orderOverride: {},
    deletedOpen: false
  }
}

function selectSessionDate(session, date, today) {
  if (!canSelectDate(date, today)) return session
  return Object.assign({}, session, {
    date,
    filter: defaultFilterForDate(date, today)
  })
}

function switchTab(session, tab) {
  if (session.sortMode && session.sortDirty && tab !== session.tab) {
    return { session, blocked: true }
  }
  return { session: Object.assign({}, session, { tab }), blocked: false }
}

function applyRestoreTemplate(session, snapshot, accounts, today) {
  const active = {}
  ;(accounts || []).forEach((account) => {
    if (participating(account)) active[account.id] = true
  })
  const drafts = {}
  ;((snapshot && snapshot.items) || []).forEach((item) => {
    if (!item || !active[item.accountId]) return
    if (!Number.isFinite(Number(item.amount))) return
    drafts[item.accountId] = formatAmountInput(item.amount)
  })
  const suffix = '（恢复自 ' + snapshot.date + '）'
  const raw = snapshot.note ? snapshot.note + suffix : suffix
  return Object.assign({}, session, {
    tab: 'entry',
    date: today,
    filter: defaultFilterForDate(today, today),
    note: raw.slice(0, SNAPSHOT_NOTE_MAX),
    drafts,
    restore: { sourceDate: snapshot.date, sourceId: snapshot.id || snapshot._id || '' },
    sortMode: false,
    sortDirty: false,
    orderOverride: {}
  })
}

function abandonRestore(session, today) {
  return initialSession(today)
}

function finishSave(today) {
  return initialSession(today)
}

function accountsOfType(accounts, type, orderOverride) {
  const list = (accounts || []).filter((account) => account && !account.isDeleted && account.type === type)
  const override = orderOverride && orderOverride[type]
  if (override && override.length) {
    const map = {}
    list.forEach((account) => {
      map[account.id] = account
    })
    const next = []
    override.forEach((id) => {
      if (!map[id]) return
      next.push(map[id])
      delete map[id]
    })
    list.slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).forEach((account) => {
      if (map[account.id]) next.push(account)
    })
    return next
  }
  return list.slice().sort((a, b) => {
    const byOrder = (a.sortOrder || 0) - (b.sortOrder || 0)
    if (byOrder) return byOrder
    return String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
  })
}

function moveOrder(ids, id, dir) {
  const next = (ids || []).slice()
  const index = next.indexOf(id)
  const target = index + dir
  if (index < 0 || target < 0 || target >= next.length) return { ids: next, moved: false }
  const current = next[index]
  next[index] = next[target]
  next[target] = current
  return { ids: next, moved: true }
}

module.exports = {
  AMOUNT_ABS_MAX,
  NAME_MAX,
  ACCOUNT_NOTE_MAX,
  SNAPSHOT_NOTE_MAX,
  ACCOUNT_TYPES,
  todayStr,
  isDateStr,
  cmpDate,
  canSelectDate,
  defaultFilterForDate,
  shiftDate,
  acceptableClientToday,
  formatDateCn,
  formatYuan,
  formatSignedYuan,
  formatAmountInput,
  formatTyping,
  accountLabel,
  validateAccountInput,
  signAllows,
  parseAmount,
  participating,
  isFirstEntry,
  baselineOf,
  latestAmount,
  assertTypeChange,
  resolveEntry,
  resolveEntries,
  computeTotals,
  groupEntries,
  hasSameDaySnapshot,
  netSummary,
  planSave,
  listMergeTargets,
  applyMerge,
  migrateCreditCards,
  buildTimeline,
  buildSnapshotDetails,
  buildHistoryRows,
  buildMonthGrid,
  initialSession,
  selectSessionDate,
  switchTab,
  applyRestoreTemplate,
  abandonRestore,
  finishSave,
  accountsOfType,
  moveOrder
}
