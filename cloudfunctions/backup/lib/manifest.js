/** AUTO-SYNCED from backup-shared/manifest.js — 勿手改；运行 node scripts/sync-backup-shared.js */
const { SCHEMA_VERSION } = require('./schema-version')

const STATUS = {
  PENDING: 'PENDING',
  EXPORT_SUCCESS: 'EXPORT_SUCCESS',
  VALIDATE_SUCCESS: 'VALIDATE_SUCCESS',
  ENCRYPT_SUCCESS: 'ENCRYPT_SUCCESS',
  UPLOAD_SUCCESS: 'UPLOAD_SUCCESS',
  VERIFY_SUCCESS: 'VERIFY_SUCCESS',
  REJECTED_ANOMALY: 'REJECTED_ANOMALY',
  PARTIAL_FAIL: 'PARTIAL_FAIL',
  FAILED: 'FAILED'
}

function makeBackupId(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return (
    date.getFullYear() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    '-' +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())
  )
}

function buildCollectionStats(collectionsMap) {
  return Object.keys(collectionsMap)
    .sort()
    .map((name) => ({
      name,
      count: (collectionsMap[name] || []).length
    }))
}

function totalRecords(stats) {
  return stats.reduce((sum, row) => sum + row.count, 0)
}

/**
 * @param {object} opts
 */
function buildManifest(opts) {
  const collections = opts.collections || []
  return {
    backupId: opts.backupId,
    schemaVersion: opts.schemaVersion != null ? opts.schemaVersion : SCHEMA_VERSION,
    database: 'cloudbase',
    formatVersion: opts.formatVersion,
    algorithm: opts.algorithm,
    keyId: opts.keyId,
    encrypted: true,
    collections,
    totalRecords: totalRecords(collections),
    sha256: opts.sha256 || '',
    assetName: opts.assetName || '',
    releaseTag: opts.releaseTag || '',
    status: opts.status || STATUS.PENDING,
    anomaly: opts.anomaly || null,
    startedAt: opts.startedAt,
    finishedAt: opts.finishedAt || null,
    error: opts.error || null
  }
}

module.exports = {
  STATUS,
  makeBackupId,
  buildCollectionStats,
  totalRecords,
  buildManifest
}
