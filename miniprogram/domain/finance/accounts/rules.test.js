/**
 * 秘密基地领域规则
 * 运行: node miniprogram/domain/finance/accounts/rules.test.js
 */

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const rules = require('./rules')

assert.strictEqual(rules.ACCOUNT_TYPES.length, 7)
assert.ok(!rules.ACCOUNT_TYPES.some((t) => t.code === 'CREDIT_CARD'))

{
  const bad = rules.validateAccountInput({ name: '  ', type: 'CASH', description: '' })
  assert.strictEqual(bad.ok, false)
  const card = rules.validateAccountInput({ name: '卡', type: 'CREDIT_CARD', description: '' })
  assert.strictEqual(card.ok, false)
  const ok = rules.validateAccountInput({ name: '  招行  ', type: 'SAVINGS_CARD', description: '工资' })
  assert.strictEqual(ok.ok, true)
  assert.strictEqual(ok.name, '招行')
}

{
  assert.strictEqual(rules.parseAmount('', 'CASH').state, 'empty')
  assert.strictEqual(rules.parseAmount('1,234.50', 'CASH').value, 1234.5)
  assert.strictEqual(rules.parseAmount('-1', 'CASH').state, 'invalid')
  assert.strictEqual(rules.parseAmount('-1', 'CUSTOM').value, -1)
  assert.strictEqual(rules.parseAmount('12.', 'CASH').state, 'partial')
  assert.strictEqual(rules.parseAmount('12.345', 'CASH').state, 'invalid')
  assert.strictEqual(rules.parseAmount('100000000000', 'CASH').state, 'invalid')
}

{
  const entries = [
    { type: 'CASH', participates: true, invalid: false, amount: 100, baseline: 0 },
    { type: 'DEBT', participates: true, invalid: false, amount: 40, baseline: 0 },
    { type: 'CUSTOM', participates: true, invalid: false, amount: -5, baseline: 0 }
  ]
  const totals = rules.computeTotals(entries)
  assert.strictEqual(totals.totalAssets, 95)
  assert.strictEqual(totals.totalLiabilities, 40)
  assert.strictEqual(totals.totalNetWorth, 55)
}

function account(partial) {
  return Object.assign({
    id: 'a',
    name: '现金',
    type: 'CASH',
    isActive: true,
    isDeleted: false,
    sortOrder: 0,
    description: '',
    mergedFrom: []
  }, partial)
}

{
  const accounts = [account({ id: 'new', name: '新账户' })]
  const rows = rules.resolveEntries(accounts, [], '2026-10-31', {})
  assert.strictEqual(rows[0].isFirstEntry, true)
  assert.strictEqual(rows[0].showInChanges, true)
  assert.strictEqual(rows[0].tone, 'first')
  assert.strictEqual(rows[0].changed, false)
  const grouped = rules.groupEntries(rows, 'changes', {})
  assert.strictEqual(grouped.empty, false)
  assert.strictEqual(grouped.groups[0].rows[0].badge, '首次')
  assert.strictEqual(rows[0].input, '')
  assert.strictEqual(rows[0].placeholder, '输入余额')
  assert.strictEqual(rows[0].deltaText, '')
  assert.strictEqual(rows[0].lastText, '还没有历史，请输入余额')
}

{
  const snapshots = [{
    date: '2026-10-01',
    totalNetWorth: 10,
    items: [{ accountId: 'a', amount: 10 }]
  }]
  const rows = rules.resolveEntries([account({})], snapshots, '2026-10-31', { a: '12' })
  assert.strictEqual(rows[0].isFirstEntry, false)
  assert.strictEqual(rows[0].changed, true)
  assert.strictEqual(rows[0].tone, 'up')
  assert.strictEqual(rows[0].source, 'explicit')
  assert.strictEqual(rows[0].inheritBadge, '继承')
  const same = rules.resolveEntries([account({})], snapshots, '2026-10-31', {})
  assert.strictEqual(same[0].changed, false)
  assert.strictEqual(same[0].showInChanges, false)
  assert.strictEqual(rules.groupEntries(same, 'changes', {}).empty, true)
}

{
  const snapshots = [{
    date: '2026-10-31',
    totalNetWorth: 8,
    items: [{ accountId: 'a', amount: 8 }]
  }]
  const rows = rules.resolveEntries([account({})], snapshots, '2026-10-31', { a: '-1' })
  assert.strictEqual(rows[0].invalid, true)
  assert.strictEqual(rules.computeTotals(rows).totalNetWorth, 8)
  const plan = rules.planSave({
    accounts: [account({})],
    snapshots,
    date: '2026-10-31',
    drafts: { a: '-1' },
    note: '',
    isRestored: true,
    today: '2026-10-31'
  })
  assert.strictEqual(plan.ok, false)
}

{
  const snapshots = [{
    date: '2026-10-31',
    totalNetWorth: 8,
    items: [{ accountId: 'a', amount: 8 }]
  }]
  const plan = rules.planSave({
    accounts: [account({})],
    snapshots,
    date: '2026-10-31',
    drafts: { a: '9' },
    note: '补记',
    isRestored: true,
    today: '2026-10-31'
  })
  assert.strictEqual(plan.ok, true)
  assert.strictEqual(plan.needsOverwrite, true)
  assert.strictEqual(plan.previousNet, 8)
  assert.strictEqual(plan.nextNet, 9)
  assert.strictEqual(plan.isRestored, true)
  assert.ok(plan.toast.indexOf('已以此模板新建快照') === 0)
  assert.strictEqual(plan.items[0].isFirstEntry, false)
}

{
  const future = rules.planSave({
    accounts: [account({})],
    snapshots: [],
    date: '2026-11-01',
    drafts: {},
    note: '',
    isRestored: false,
    today: '2026-10-31'
  })
  assert.strictEqual(future.ok, false)
}

{
  const grid = rules.buildMonthGrid({
    year: 2026,
    month: 10,
    today: '2026-10-31',
    selected: '2026-10-31',
    snapshotDates: ['2026-10-02']
  })
  const cells = grid.weeks.reduce((all, week) => all.concat(week), [])
  const nov = cells.find((c) => c.date === '2026-11-01')
  assert.ok(!nov)
  const marked = cells.find((c) => c.date === '2026-10-02')
  assert.strictEqual(marked.marked, true)
  assert.strictEqual(marked.disabled, false)
  const selected = cells.find((c) => c.date === '2026-10-31')
  assert.strictEqual(selected.selected, true)
}

{
  const blocked = rules.assertTypeChange(
    account({ id: 'a', type: 'CUSTOM' }),
    [{ date: '2026-10-01', items: [{ accountId: 'a', amount: -3 }] }],
    'CASH'
  )
  assert.strictEqual(blocked.ok, false)
  const fine = rules.assertTypeChange(
    account({ id: 'a', type: 'CASH' }),
    [{ date: '2026-10-01', items: [{ accountId: 'a', amount: 3 }] }],
    'DEBT'
  )
  assert.strictEqual(fine.ok, true)
}

{
  const accounts = [
    account({ id: 'card', type: 'CREDIT_CARD', name: '信用卡', isActive: true })
  ]
  const up = rules.migrateCreditCards(accounts, [{
    date: '2026-10-01',
    items: [{ accountId: 'card', amount: 20 }]
  }])
  assert.strictEqual(up.accounts[0].type, 'DEBT')
  assert.strictEqual(up.migrated, true)
  const zero = rules.migrateCreditCards(accounts, [])
  assert.strictEqual(zero.accounts[0].type, 'DEBT')
  assert.strictEqual(zero.accounts[0].isActive, false)
  const down = rules.migrateCreditCards(accounts, [{
    date: '2026-10-01',
    items: [{ accountId: 'card', amount: -2 }]
  }])
  assert.strictEqual(down.accounts[0].type, 'SAVINGS_CARD')
}

{
  const source = account({ id: 's', name: '工行', type: 'SAVINGS_CARD' })
  const target = account({ id: 't', name: '招行', type: 'SAVINGS_CARD', description: '主卡' })
  const other = account({ id: 'd', name: '花呗', type: 'DEBT' })
  const none = rules.listMergeTargets([source, other], 's')
  assert.strictEqual(none.ok, false)
  const found = rules.listMergeTargets([source, target, other], 's')
  assert.strictEqual(found.targets.length, 1)
  const merged = rules.applyMerge(source, target, '2026-10-31')
  assert.strictEqual(merged.source.isActive, false)
  assert.strictEqual(merged.target.mergedFrom.length, 1)
  assert.strictEqual(merged.target.mergedFrom[0].sourceName, '工行')
  assert.ok(merged.target.description.indexOf('[Merged from 工行 on 2026-10-31]') >= 0)
  assert.strictEqual(source.mergedFrom.length, 0)
}

{
  const target = account({
    id: 't',
    name: '招行',
    type: 'SAVINGS_CARD',
    mergedFrom: [{ accountId: 's', date: '2026-02-01', sourceName: '工行' }]
  })
  const source = account({ id: 's', name: '工行', type: 'SAVINGS_CARD', isActive: false })
  const snapshots = [
    { date: '2026-01-01', items: [{ accountId: 's', amount: 10 }, { accountId: 't', amount: 20 }] },
    { date: '2026-01-15', items: [{ accountId: 't', amount: 25 }] },
    { date: '2026-03-01', items: [{ accountId: 't', amount: 30 }] }
  ]
  const timeline = rules.buildTimeline(target, [target, source], snapshots)
  const mergeRow = timeline.rows.find((row) => row.kind === 'merge')
  assert.ok(mergeRow)
  assert.strictEqual(mergeRow.text, '合并自 工行 on 2026-02-01')
  const carried = timeline.rows.find((row) => row.tone === 'source' && row.date === '2026-01-15')
  assert.ok(carried)
  assert.strictEqual(carried.inheritedFrom, '2026-01-01')
  assert.ok(timeline.spark.length >= 1)
  const deleted = rules.buildTimeline(account({ isDeleted: true }), [], [])
  assert.ok(deleted.status.indexOf('已删除') >= 0)
  assert.strictEqual(deleted.empty, true)
}

{
  assert.strictEqual(rules.accountLabel(account({ name: '招行', isDeleted: true })), '招行（已删除）')
}

{
  const today = '2026-10-31'
  let session = rules.initialSession(today)
  session = rules.applyRestoreTemplate(session, {
    id: 'snap',
    date: '2026-10-01',
    note: '发薪',
    items: [
      { accountId: 'a', amount: 12 },
      { accountId: 'gone', amount: 99 }
    ]
  }, [account({ id: 'a' }), account({ id: 'gone', isDeleted: true })], today)
  assert.strictEqual(session.tab, 'entry')
  assert.strictEqual(session.restore.sourceDate, '2026-10-01')
  assert.strictEqual(session.drafts.a, '12.00')
  assert.strictEqual(session.drafts.gone, undefined)
  assert.ok(session.note.indexOf('恢复自 2026-10-01') >= 0)
  const switched = rules.switchTab(session, 'manage')
  assert.strictEqual(switched.blocked, false)
  assert.strictEqual(switched.session.restore.sourceDate, '2026-10-01')
  assert.strictEqual(switched.session.drafts.a, '12.00')
  const back = rules.switchTab(switched.session, 'entry')
  assert.strictEqual(back.session.restore.sourceDate, '2026-10-01')
  const abandoned = rules.abandonRestore(back.session, today)
  assert.strictEqual(abandoned.restore, null)
  assert.deepStrictEqual(abandoned.drafts, {})
  assert.strictEqual(abandoned.date, today)
}

{
  const today = '2026-10-31'
  assert.strictEqual(rules.defaultFilterForDate(today, today), 'all')
  assert.strictEqual(rules.defaultFilterForDate('2026-10-01', today), 'changes')
  assert.strictEqual(rules.initialSession(today).filter, 'all')
  const session = rules.initialSession(today)
  const past = rules.selectSessionDate(session, '2026-10-01', today)
  assert.strictEqual(past.date, '2026-10-01')
  assert.strictEqual(past.filter, 'changes')
  const back = rules.selectSessionDate(past, today, today)
  assert.strictEqual(back.date, today)
  assert.strictEqual(back.filter, 'all')
  assert.strictEqual(rules.selectSessionDate(session, '2026-11-01', today), session)
}

{
  const session = rules.initialSession('2026-10-31')
  session.tab = 'manage'
  session.sortMode = true
  session.sortDirty = true
  const blocked = rules.switchTab(session, 'entry')
  assert.strictEqual(blocked.blocked, true)
  assert.strictEqual(blocked.session.tab, 'manage')
}

{
  const cloudRules = fs.readFileSync(
    path.join(__dirname, '../../../../cloudfunctions/accountVault/rules.js'),
    'utf8'
  )
  const localRules = fs.readFileSync(path.join(__dirname, 'rules.js'), 'utf8')
  assert.strictEqual(cloudRules, localRules)
}

{
  const { createModel, present } = require('./present')
  const model = createModel('2026-10-31')
  model.loaded = true
  model.accounts = [{
    id: 'a',
    name: '现金',
    type: 'CASH',
    isActive: true,
    isDeleted: false,
    sortOrder: 0,
    description: '',
    mergedFrom: []
  }]
  const first = present(model)
  assert.strictEqual(first.bootEmpty, false)
  assert.strictEqual(first.filter, 'all')
  assert.strictEqual(first.changesEmpty, false)
  assert.strictEqual(first.groups[0].rows[0].badge, '首次')
  assert.strictEqual(first.groups[0].rows[0].input, '')
  model.snapshots = [{
    date: '2026-10-01',
    totalNetWorth: 5,
    items: [{ accountId: 'a', amount: 5 }]
  }]
  model.session.filter = 'changes'
  const quiet = present(model)
  assert.strictEqual(quiet.changesEmpty, true)
  assert.strictEqual(quiet.warning, false)
  model.session.date = '2026-10-01'
  assert.strictEqual(present(model).warning, true)
  model.session.restore = { sourceDate: '2026-10-01', sourceId: 's' }
  model.session.tab = 'manage'
  const back = present(model)
  assert.strictEqual(back.showRestore, true)
  assert.strictEqual(back.showManage, true)
  model.session.tab = 'entry'
  const restored = present(model)
  assert.strictEqual(restored.saveLabel, '以此模板新建快照')
  assert.strictEqual(restored.savePro, true)
}

{
  const snapshots = [{
    date: '2026-10-01',
    totalNetWorth: 10,
    items: [{ accountId: 'a', amount: 10 }]
  }]
  const partial = rules.resolveEntries([account({})], snapshots, '2026-10-31', { a: '12.' })
  assert.strictEqual(partial[0].partial, true)
  assert.strictEqual(partial[0].showInChanges, true)
  const illegal = rules.resolveEntries([account({})], snapshots, '2026-10-31', { a: '-3' })
  assert.strictEqual(illegal[0].invalid, true)
  assert.strictEqual(illegal[0].showInChanges, true)
  assert.strictEqual(rules.groupEntries(illegal, 'changes', {}).empty, false)
}

{
  const card = account({ id: 'a', name: '招行', type: 'SAVINGS_CARD' })
  const snapshots = [{
    date: '2026-10-01',
    totalNetWorth: -2,
    items: [{ accountId: 'a', amount: -2 }]
  }]
  const rows = rules.resolveEntries([card], snapshots, '2026-10-31', {})
  assert.strictEqual(rows[0].invalid, true)
  assert.strictEqual(rows[0].showInChanges, true)
  assert.strictEqual(rules.computeTotals(rows).totalNetWorth, 0)
  const blocked = rules.planSave({
    accounts: [card],
    snapshots,
    date: '2026-10-31',
    drafts: {},
    note: '',
    isRestored: false,
    today: '2026-10-31'
  })
  assert.strictEqual(blocked.ok, false)
  const fixed = rules.planSave({
    accounts: [card],
    snapshots,
    date: '2026-10-31',
    drafts: { a: '6' },
    note: '',
    isRestored: false,
    today: '2026-10-31'
  })
  assert.strictEqual(fixed.ok, true)
  assert.strictEqual(fixed.items[0].amount, 6)
}

{
  assert.strictEqual(rules.canSelectDate('2026-11-01', '2026-10-31'), false)
  assert.strictEqual(rules.canSelectDate('2026-10-31', '2026-10-31'), true)
  assert.strictEqual(rules.canSelectDate('2026-10-02', '2026-10-31'), true)
  assert.strictEqual(rules.canSelectDate('', '2026-10-31'), false)
}

{
  const accounts = [
    account({ id: 'a', name: '招行', type: 'SAVINGS_CARD' }),
    account({ id: 'b', name: '现金', type: 'CASH' })
  ]
  const snapshots = [
    {
      id: 's1',
      date: '2026-10-01',
      totalNetWorth: 100,
      note: '',
      items: [
        { accountId: 'a', amount: 80 },
        { accountId: 'b', amount: 20 }
      ]
    },
    {
      id: 's2',
      date: '2026-10-15',
      totalNetWorth: 130,
      note: '发薪',
      isRestored: false,
      items: [
        { accountId: 'a', amount: 100 },
        { accountId: 'b', amount: 30 }
      ]
    }
  ]
  const history = rules.buildHistoryRows(snapshots, accounts)
  assert.strictEqual(history.length, 2)
  assert.strictEqual(history[0].date, '2026-10-15')
  assert.strictEqual(history[0].details.length, 2)
  const a = history[0].details.find((row) => row.accountId === 'a')
  assert.strictEqual(a.original, 80)
  assert.strictEqual(a.current, 100)
  assert.strictEqual(a.delta, 20)
  assert.strictEqual(a.deltaText, '+¥20.00')
  const firstDay = history[1].details.find((row) => row.accountId === 'b')
  assert.strictEqual(firstDay.first, true)
  assert.strictEqual(firstDay.originalText, '—')
  assert.strictEqual(firstDay.deltaText, '首次')
}

console.log('accounts rules ok')
