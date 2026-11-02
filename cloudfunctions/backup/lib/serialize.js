/** AUTO-SYNCED from backup-shared/serialize.js — 勿手改；运行 node scripts/sync-backup-shared.js */
/**
 * CloudBase 文档 → 可 JSON 序列化的纯数据。
 * Date 统一为 ISO 字符串，保证加解密往返稳定。
 */

function serializeValue(value) {
  if (value === null || value === undefined) return value
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(serializeValue)
  if (Buffer.isBuffer && Buffer.isBuffer(value)) {
    return { __type: 'Buffer', data: value.toString('base64') }
  }
  if (typeof value === 'object') {
    // 云开发偶发 { $date: '...' } 形态
    if (typeof value.$date === 'string') return value.$date
    const out = {}
    Object.keys(value).forEach((key) => {
      out[key] = serializeValue(value[key])
    })
    return out
  }
  return value
}

function serializeDocs(docs) {
  return (docs || []).map((doc) => serializeValue(doc))
}

function buildPayload(collectionsMap, meta) {
  const collections = {}
  Object.keys(collectionsMap).forEach((name) => {
    collections[name] = serializeDocs(collectionsMap[name])
  })
  return {
    schemaVersion: meta.schemaVersion,
    backupId: meta.backupId,
    exportedAt: meta.exportedAt,
    database: 'cloudbase',
    collections
  }
}

module.exports = {
  serializeValue,
  serializeDocs,
  buildPayload
}
