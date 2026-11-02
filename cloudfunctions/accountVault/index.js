const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const rules = require('./rules')

const ACCOUNT_COL = 'finance_accounts'
const SNAPSHOT_COL = 'finance_snapshots'

function fail(code, message) {
  return { code, message }
}

function mapAccount(doc) {
  return {
    id: doc._id,
    name: doc.name,
    type: doc.type,
    isActive: !!doc.isActive,
    isDeleted: !!doc.isDeleted,
    sortOrder: doc.sortOrder || 0,
    description: doc.description || '',
    mergedFrom: doc.mergedFrom || [],
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
  }
}

function mapSnapshot(doc) {
  return {
    id: doc._id,
    date: doc.date,
    note: doc.note || '',
    totalAssets: doc.totalAssets,
    totalLiabilities: doc.totalLiabilities,
    totalNetWorth: doc.totalNetWorth,
    items: doc.items || [],
    isRestored: !!doc.isRestored,
    createdAt: doc.createdAt
  }
}

async function fetchAll(name, openid) {
  const col = db.collection(name)
  const out = []
  let skip = 0
  while (out.length < 2000) {
    const res = await col.where({ _openid: openid }).skip(skip).limit(100).get()
    const batch = res.data || []
    out.push.apply(out, batch)
    if (batch.length < 100) break
    skip += batch.length
  }
  return out
}

async function owned(name, id, openid) {
  if (!id) return null
  const res = await db.collection(name).doc(id).get().catch(() => null)
  const data = res && res.data
  if (!data || data._openid !== openid) return null
  return data
}

async function persistMigration(docs, migratedAccounts) {
  const byId = {}
  migratedAccounts.forEach((account) => {
    byId[account.id] = account
  })
  const jobs = []
  docs.forEach((doc) => {
    const next = byId[doc._id]
    if (!next || next.type === doc.type && next.isActive === !!doc.isActive) return
    jobs.push(db.collection(ACCOUNT_COL).doc(doc._id).update({
      data: {
        type: next.type,
        isActive: next.isActive,
        description: next.description || '',
        updatedAt: new Date().toISOString()
      }
    }))
  })
  await Promise.all(jobs)
}

async function readState(openid) {
  const accountDocs = await fetchAll(ACCOUNT_COL, openid)
  const snapshotDocs = await fetchAll(SNAPSHOT_COL, openid)
  const accounts = accountDocs.map(mapAccount)
  const snapshots = snapshotDocs.map(mapSnapshot)
  const migrated = rules.migrateCreditCards(accounts, snapshots)
  if (migrated.migrated) await persistMigration(accountDocs, migrated.accounts)
  return {
    accounts: migrated.accounts,
    snapshots,
    migrated: migrated.migrated
  }
}

function okState(state) {
  return {
    code: 'OK',
    accounts: state.accounts,
    snapshots: state.snapshots,
    migrated: !!state.migrated
  }
}

function nextSort(accounts, type) {
  return (accounts || []).reduce((max, account) => {
    if (!account || account.isDeleted || account.type !== type) return max
    return Math.max(max, account.sortOrder || 0)
  }, -1) + 1
}

async function saveAccount(openid, payload) {
  const check = rules.validateAccountInput(payload || {})
  if (!check.ok) return fail('INVALID_PARAM', check.error)
  const now = new Date().toISOString()
  if (payload.id) {
    const doc = await owned(ACCOUNT_COL, payload.id, openid)
    if (!doc || doc.isDeleted) return fail('NOT_FOUND', '账户不存在')
    const state = await readState(openid)
    const current = state.accounts.find((account) => account.id === doc._id)
    const typeCheck = rules.assertTypeChange(current, state.snapshots, check.type)
    if (!typeCheck.ok) return fail('INVALID_PARAM', typeCheck.error)
    await db.collection(ACCOUNT_COL).doc(doc._id).update({
      data: {
        name: check.name,
        type: check.type,
        description: check.description,
        updatedAt: now
      }
    })
    return okState(await readState(openid))
  }
  const state = await readState(openid)
  await db.collection(ACCOUNT_COL).add({
    data: {
      _openid: openid,
      name: check.name,
      type: check.type,
      description: check.description,
      isActive: true,
      isDeleted: false,
      sortOrder: nextSort(state.accounts, check.type),
      mergedFrom: [],
      createdAt: now,
      updatedAt: now,
      deletedAt: '',
      activeBeforeDelete: true
    }
  })
  return okState(await readState(openid))
}

async function setActive(openid, payload) {
  const doc = await owned(ACCOUNT_COL, payload.id, openid)
  if (!doc || doc.isDeleted) return fail('NOT_FOUND', '账户不存在')
  const active = !!payload.isActive
  const data = { isActive: active, updatedAt: new Date().toISOString() }
  if (active) {
    const state = await readState(openid)
    data.sortOrder = nextSort(state.accounts, doc.type)
  }
  await db.collection(ACCOUNT_COL).doc(doc._id).update({ data })
  return okState(await readState(openid))
}

async function softDelete(openid, payload) {
  const doc = await owned(ACCOUNT_COL, payload.id, openid)
  if (!doc || doc.isDeleted) return fail('NOT_FOUND', '账户不存在')
  const now = new Date().toISOString()
  await db.collection(ACCOUNT_COL).doc(doc._id).update({
    data: {
      isDeleted: true,
      deletedAt: now,
      activeBeforeDelete: !!doc.isActive,
      updatedAt: now
    }
  })
  return okState(await readState(openid))
}

async function undoDelete(openid, payload) {
  const doc = await owned(ACCOUNT_COL, payload.id, openid)
  if (!doc || !doc.isDeleted) return fail('NOT_FOUND', '账户不存在')
  const deletedAt = Date.parse(doc.deletedAt || '')
  if (!deletedAt || Date.now() - deletedAt > 5000) return fail('INVALID_PARAM', '撤销已超时')
  await db.collection(ACCOUNT_COL).doc(doc._id).update({
    data: {
      isDeleted: false,
      isActive: doc.activeBeforeDelete !== false,
      deletedAt: '',
      updatedAt: new Date().toISOString()
    }
  })
  return okState(await readState(openid))
}

async function reorder(openid, payload) {
  const type = String(payload.type || '')
  if (!rules.ACCOUNT_TYPES.some((item) => item.code === type)) {
    return fail('INVALID_PARAM', '账户类型无效')
  }
  const orderedIds = Array.isArray(payload.orderedIds) ? payload.orderedIds.map(String) : []
  const state = await readState(openid)
  const current = state.accounts.filter((account) => !account.isDeleted && account.type === type)
  if (orderedIds.length !== current.length) return fail('INVALID_PARAM', '排序数据不完整')
  const known = {}
  current.forEach((account) => {
    known[account.id] = true
  })
  if (orderedIds.some((id) => !known[id])) return fail('INVALID_PARAM', '排序数据不完整')
  const now = new Date().toISOString()
  await Promise.all(orderedIds.map((id, index) => db.collection(ACCOUNT_COL).doc(id).update({
    data: { sortOrder: index, updatedAt: now }
  })))
  return okState(await readState(openid))
}

async function mergeAccounts(openid, payload) {
  const today = String(payload.today || '')
  if (!rules.acceptableClientToday(today)) return fail('INVALID_PARAM', '日期无效')
  const state = await readState(openid)
  const listed = rules.listMergeTargets(state.accounts, payload.sourceId)
  if (!listed.ok) return fail('INVALID_PARAM', listed.error)
  const target = listed.targets.find((account) => account.id === payload.targetId)
  if (!target) return fail('INVALID_PARAM', '只能合并到同类型的激活账户')
  const merged = rules.applyMerge(listed.source, target, today)
  const now = new Date().toISOString()
  await db.collection(ACCOUNT_COL).doc(listed.source.id).update({
    data: { isActive: false, updatedAt: now }
  })
  await db.collection(ACCOUNT_COL).doc(target.id).update({
    data: {
      mergedFrom: merged.target.mergedFrom,
      description: merged.target.description,
      updatedAt: now
    }
  })
  return okState(await readState(openid))
}

async function saveSnapshot(openid, payload) {
  const today = String(payload.today || '')
  if (!rules.acceptableClientToday(today)) return fail('INVALID_PARAM', '日期无效')
  const state = await readState(openid)
  const plan = rules.planSave({
    accounts: state.accounts,
    snapshots: state.snapshots,
    date: payload.date,
    drafts: payload.drafts || {},
    note: payload.note || '',
    isRestored: !!payload.isRestored,
    today
  })
  if (!plan.ok) return fail('INVALID_PARAM', plan.error)
  const col = db.collection(SNAPSHOT_COL)
  const existing = await col.where({ _openid: openid, date: plan.date }).limit(1).get()
  const old = existing.data && existing.data[0]
  const now = new Date().toISOString()
  const data = {
    _openid: openid,
    date: plan.date,
    note: plan.note,
    totalAssets: plan.totals.totalAssets,
    totalLiabilities: plan.totals.totalLiabilities,
    totalNetWorth: plan.totals.totalNetWorth,
    items: plan.items,
    isRestored: plan.isRestored,
    createdAt: now
  }
  if (old) {
    await col.doc(old._id).remove()
    try {
      await col.add({ data })
    } catch (error) {
      const backup = Object.assign({}, old)
      delete backup._id
      await col.add({ data: backup })
      throw error
    }
  } else {
    await col.add({ data })
  }
  return okState(await readState(openid))
}

exports.main = async (event) => {
  const context = cloud.getWXContext()
  const openid = context && context.OPENID
  if (!openid) return fail('FORBIDDEN', '无权操作')
  const payload = event || {}
  const action = String(payload.action || 'load')
  try {
    if (action === 'load') return okState(await readState(openid))
    if (action === 'saveAccount') return await saveAccount(openid, payload)
    if (action === 'setActive') return await setActive(openid, payload)
    if (action === 'softDelete') return await softDelete(openid, payload)
    if (action === 'undoDelete') return await undoDelete(openid, payload)
    if (action === 'reorder') return await reorder(openid, payload)
    if (action === 'merge') return await mergeAccounts(openid, payload)
    if (action === 'saveSnapshot') return await saveSnapshot(openid, payload)
    return fail('INVALID_PARAM', '未知操作')
  } catch (error) {
    console.error('accountVault', action, error)
    return fail('SYNC_FAILED', '同步失败，请重试')
  }
}
