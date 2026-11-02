const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const { exportAllCollections } = require('./exporter')
const { publishBackupRelease } = require('./github-uploader')
const {
  SCHEMA_VERSION,
  buildPayload,
  encryptPayload,
  sha256Buffer,
  makeBackupId,
  buildCollectionStats,
  buildManifest,
  detectAnomaly,
  STATUS,
  FORMAT_VERSION,
  ALGORITHM
} = require('./lib')

const RUNS_COL = 'backup_runs'
const LATEST_SUCCESS_DOC = 'latest_success'

function env(name, fallback) {
  const v = process.env[name]
  if (v == null || v === '') return fallback
  return v
}

function requireEnv(name) {
  const v = env(name)
  if (!v) throw new Error('缺少环境变量: ' + name)
  return v
}

async function loadLastSuccessStats() {
  try {
    const res = await db.collection(RUNS_COL).doc(LATEST_SUCCESS_DOC).get()
    const row = res && res.data
    return row && row.collections ? row.collections : null
  } catch (e) {
    console.warn('loadLastSuccessStats', e.message || e)
    return null
  }
}

async function saveRun(doc) {
  try {
    await db.collection(RUNS_COL).add({ data: doc })
    if (doc.status === STATUS.VERIFY_SUCCESS) {
      await db
        .collection(RUNS_COL)
        .doc(LATEST_SUCCESS_DOC)
        .set({
          data: {
            backupId: doc.backupId,
            status: doc.status,
            collections: doc.collections,
            totalRecords: doc.totalRecords,
            sha256: doc.sha256,
            releaseTag: doc.releaseTag,
            keyId: doc.keyId,
            finishedAt: doc.finishedAt,
            updatedAt: new Date().toISOString()
          }
        })
    }
  } catch (e) {
    console.warn('saveRun failed', e.message || e)
  }
}

/**
 * 入参:
 * - bypassAnomaly: true  跳过数量异常拦截（合法清库后首次备份）
 * - skipUpload: true     仅导出加密，不上传（本地联调）
 * - dryRun: true         只统计不加密上传
 */
exports.main = async (event) => {
  const startedAt = new Date().toISOString()
  const backupId = makeBackupId(new Date())
  const bypassAnomaly = !!(event && event.bypassAnomaly)
  const skipUpload = !!(event && event.skipUpload)
  const dryRun = !!(event && event.dryRun)

  let status = STATUS.PENDING
  let anomaly = null
  let manifest = null
  let releaseInfo = null

  try {
    const collectionsMap = await exportAllCollections(db)
    status = STATUS.EXPORT_SUCCESS

    const stats = buildCollectionStats(collectionsMap)
    const previous = await loadLastSuccessStats()
    const dropRatio = Number(env('BACKUP_ANOMALY_DROP_RATIO', '0.5'))
    anomaly = detectAnomaly(stats, previous, {
      dropRatio: Number.isFinite(dropRatio) ? dropRatio : 0.5,
      bypass: bypassAnomaly
    })

    if (anomaly.anomalous) {
      status = STATUS.REJECTED_ANOMALY
    } else {
      status = STATUS.VALIDATE_SUCCESS
    }

    if (dryRun) {
      manifest = buildManifest({
        backupId,
        schemaVersion: SCHEMA_VERSION,
        formatVersion: FORMAT_VERSION,
        algorithm: ALGORITHM,
        keyId: env('BACKUP_KEY_ID', ''),
        collections: stats,
        status,
        anomaly,
        startedAt,
        finishedAt: new Date().toISOString()
      })
      return { code: 'OK', dryRun: true, manifest }
    }

    const payload = buildPayload(collectionsMap, {
      schemaVersion: SCHEMA_VERSION,
      backupId,
      exportedAt: startedAt
    })

    const keyId = requireEnv('BACKUP_KEY_ID')
    const masterKey = requireEnv('BACKUP_MASTER_KEY')
    const envelope = encryptPayload(payload, { key: masterKey, keyId })
    status = anomaly.anomalous ? STATUS.REJECTED_ANOMALY : STATUS.ENCRYPT_SUCCESS

    const encBuffer = Buffer.from(JSON.stringify(envelope), 'utf8')
    const digest = sha256Buffer(encBuffer)
    const dateTag = startedAt.slice(0, 10)
    const releaseTag = anomaly.anomalous
      ? 'backup-quarantine-' + backupId
      : 'backup-' + dateTag
    const latestTag = 'backup-latest'
    const encFileName = 'backup-' + backupId + '.enc.json'
    const manifestFileName = 'manifest-' + backupId + '.json'

    manifest = buildManifest({
      backupId,
      schemaVersion: SCHEMA_VERSION,
      formatVersion: FORMAT_VERSION,
      algorithm: ALGORITHM,
      keyId,
      collections: stats,
      sha256: digest,
      assetName: encFileName,
      releaseTag,
      status,
      anomaly,
      startedAt
    })

    if (!skipUpload) {
      const owner = requireEnv('GITHUB_OWNER')
      const repo = requireEnv('GITHUB_REPO')
      const token = requireEnv('GITHUB_TOKEN')

      const bodyLines = [
        'backupId: ' + backupId,
        'status: ' + status,
        'totalRecords: ' + manifest.totalRecords,
        'sha256: ' + digest,
        anomaly && anomaly.anomalous
          ? 'anomaly: ' + (anomaly.reasons || []).join('; ')
          : ''
      ].filter(Boolean)

      releaseInfo = await publishBackupRelease({
        owner,
        repo,
        token,
        tag: releaseTag,
        name: releaseTag,
        body: bodyLines.join('\n'),
        prerelease: !!anomaly.anomalous,
        encFileName,
        manifestFileName,
        encBuffer,
        manifestBuffer: Buffer.from(JSON.stringify(manifest, null, 2), 'utf8')
      })

      // 成功备份额外刷新 backup-latest（异常隔离不更新 latest）
      if (!anomaly.anomalous) {
        await publishBackupRelease({
          owner,
          repo,
          token,
          tag: latestTag,
          name: latestTag,
          body: bodyLines.concat(['sourceTag: ' + releaseTag]).join('\n'),
          prerelease: false,
          encFileName: 'backup-latest.enc.json',
          manifestFileName: 'manifest-latest.json',
          encBuffer,
          manifestBuffer: Buffer.from(JSON.stringify(manifest, null, 2), 'utf8')
        })
        status = STATUS.UPLOAD_SUCCESS
        // 上传成功即视为可 VERIFY（云函数侧不再二次下载，避免超时；CLI verify 做严格校验）
        status = STATUS.VERIFY_SUCCESS
      } else {
        status = STATUS.REJECTED_ANOMALY
      }

      manifest.status = status
      manifest.releaseTag = releaseTag
      manifest.finishedAt = new Date().toISOString()
    } else {
      status = STATUS.ENCRYPT_SUCCESS
      manifest.status = status
      manifest.finishedAt = new Date().toISOString()
    }

    await saveRun({
      backupId,
      status,
      collections: stats,
      totalRecords: manifest.totalRecords,
      sha256: digest,
      releaseTag,
      anomaly,
      keyId,
      startedAt,
      finishedAt: new Date().toISOString()
    })

    return {
      code: anomaly.anomalous ? 'ANOMALY' : 'OK',
      backupId,
      status,
      manifest,
      release: releaseInfo
        ? { tag: releaseInfo.tag, htmlUrl: releaseInfo.htmlUrl }
        : null
    }
  } catch (e) {
    console.error('backup failed', e)
    status = STATUS.FAILED
    await saveRun({
      backupId,
      status,
      error: String(e.message || e),
      startedAt,
      finishedAt: new Date().toISOString()
    })
    return {
      code: 'FAILED',
      backupId,
      status,
      message: String(e.message || e)
    }
  }
}
