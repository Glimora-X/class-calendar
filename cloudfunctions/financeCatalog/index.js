const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const DEFAULTS = {
  platforms: [
    '工商银行',
    '中国银行',
    '建设银行',
    '中邮理财',
    '民生银行',
    '招商银行'
  ],
  types: ['固收', '固收+', '混合', '现金管理', '权益'],
  tags: ['可加仓', '可赎回', '可清仓', '观望中', '长线持有']
}

function normalizeList(arr, fallback) {
  if (!Array.isArray(arr) || !arr.length) return fallback.slice()
  return arr.map((x) => String(x).trim()).filter(Boolean)
}

async function loadOrCreate(col, OPENID) {
  const found = await col.where({ _openid: OPENID }).limit(1).get()
  if (found.data && found.data[0]) {
    const r = found.data[0]
    return {
      docId: r._id,
      record: {
        platforms: normalizeList(r.platforms, DEFAULTS.platforms),
        types: normalizeList(r.types, DEFAULTS.types),
        tags: normalizeList(r.tags, DEFAULTS.tags)
      }
    }
  }
  const now = new Date().toISOString()
  const data = {
    _openid: OPENID,
    platforms: DEFAULTS.platforms.slice(),
    types: DEFAULTS.types.slice(),
    tags: DEFAULTS.tags.slice(),
    createdAt: now,
    updatedAt: now
  }
  const addRes = await col.add({ data })
  return {
    docId: addRes._id,
    record: {
      platforms: data.platforms,
      types: data.types,
      tags: data.tags
    }
  }
}

async function persist(col, docId, record) {
  const now = new Date().toISOString()
  await col.doc(docId).update({
    data: {
      platforms: record.platforms,
      types: record.types,
      tags: record.tags,
      updatedAt: now
    }
  })
}

/**
 * 入参:
 *   {} | { action: 'list' }
 *   { action: 'add', field: 'platforms'|'types'|'tags', value }
 *   { action: 'update', field, index, value }
 *   { action: 'remove', field, index }
 * 出参: { platforms, types, tags }
 */
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const payload = event || {}
  const action = String(payload.action || 'list').trim()
  const col = db.collection('finance_catalog')

  try {
    const { docId, record } = await loadOrCreate(col, OPENID)

    if (action === 'list') {
      return record
    }

    const field = String(payload.field || '').trim()
    if (['platforms', 'types', 'tags'].indexOf(field) === -1) {
      return { code: 'INVALID_PARAM', message: 'field 无效' }
    }

    if (action === 'add') {
      const value = String(payload.value || '').trim()
      if (!value) return { code: 'INVALID_PARAM', message: '请输入名称' }
      if (record[field].indexOf(value) !== -1) {
        return { code: 'INVALID_PARAM', message: '已存在' }
      }
      record[field].push(value)
      await persist(col, docId, record)
      return record
    }

    if (action === 'update') {
      const index = Number(payload.index)
      const value = String(payload.value || '').trim()
      if (!Number.isFinite(index) || index < 0 || index >= record[field].length) {
        return { code: 'INVALID_PARAM', message: '索引无效' }
      }
      if (!value) return { code: 'INVALID_PARAM', message: '请输入名称' }
      record[field][index] = value
      await persist(col, docId, record)
      return record
    }

    if (action === 'remove') {
      const index = Number(payload.index)
      if (!Number.isFinite(index) || index < 0 || index >= record[field].length) {
        return { code: 'INVALID_PARAM', message: '索引无效' }
      }
      const name = record[field][index]
      if (field === 'platforms' || field === 'types') {
        const key = field === 'platforms' ? 'platform' : 'type'
        const used = await db
          .collection('finance_holdings')
          .where({ _openid: OPENID, [key]: name })
          .limit(1)
          .get()
        if (used.data && used.data.length) {
          return {
            code: 'INVALID_PARAM',
            message: '已被产品使用，无法删除'
          }
        }
      }
      record[field].splice(index, 1)
      await persist(col, docId, record)
      return record
    }

    return { code: 'INVALID_PARAM', message: '未知 action' }
  } catch (e) {
    console.error('financeCatalog', e)
    return { code: 'SYNC_FAILED', message: '同步失败，请重试' }
  }
}
