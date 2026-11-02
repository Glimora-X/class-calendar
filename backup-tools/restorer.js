const { RESTORE_ORDER } = require('../backup-shared/collections')

/**
 * 将解密后的 payload 写入 CloudBase。
 * mode:
 * - create-only: 已存在同 _id 则跳过
 * - replace: upsert（set 整文档），不自动 wipe
 *
 * @param {object} app @cloudbase/node-sdk init 结果
 * @param {object} payload decrypt 后的备份 JSON
 * @param {{ mode: 'create-only'|'replace', onProgress?: Function }} opts
 */
async function restorePayload(app, payload, opts) {
  const mode = (opts && opts.mode) || 'create-only'
  if (mode !== 'create-only' && mode !== 'replace') {
    throw new Error('mode 仅支持 create-only | replace')
  }
  if (!payload || !payload.collections) {
    throw new Error('无效备份 payload')
  }

  const db = app.database()
  const report = {
    mode,
    collections: [],
    totalWritten: 0,
    totalSkipped: 0,
    totalFailed: 0
  }

  const order = RESTORE_ORDER.slice()
  Object.keys(payload.collections).forEach((name) => {
    if (order.indexOf(name) < 0) order.push(name)
  })

  for (let i = 0; i < order.length; i++) {
    const name = order[i]
    const docs = payload.collections[name] || []
    const colReport = {
      name,
      expected: docs.length,
      written: 0,
      skipped: 0,
      failed: 0,
      errors: []
    }

    for (let j = 0; j < docs.length; j++) {
      const doc = docs[j]
      const id = doc && doc._id
      if (!id) {
        colReport.failed += 1
        colReport.errors.push('缺少 _id')
        continue
      }
      try {
        const ref = db.collection(name).doc(id)
        if (mode === 'create-only') {
          let exists = false
          try {
            const got = await ref.get()
            const data = got && got.data
            exists = Array.isArray(data) ? data.length > 0 : !!data
          } catch (e) {
            exists = false
          }
          if (exists) {
            colReport.skipped += 1
            continue
          }
          await ref.set(docBody(doc))
          colReport.written += 1
        } else {
          await ref.set(docBody(doc))
          colReport.written += 1
        }
      } catch (e) {
        colReport.failed += 1
        colReport.errors.push(id + ': ' + (e.message || e))
      }
    }

    report.collections.push(colReport)
    report.totalWritten += colReport.written
    report.totalSkipped += colReport.skipped
    report.totalFailed += colReport.failed
    if (opts && typeof opts.onProgress === 'function') {
      opts.onProgress(colReport)
    }
  }

  return report
}

/** set 时 _id 走 doc(id) 路径，body 仍保留 _openid 等业务字段 */
function docBody(doc) {
  const out = Object.assign({}, doc)
  delete out._id
  return out
}

function stripId(doc) {
  return docBody(doc)
}

function assertRestoreSafety(opts) {
  const mode = opts.mode || 'create-only'
  const envId = opts.env
  if (!envId) throw new Error('必须指定 --env <cloudbaseEnvId>')
  if (mode === 'replace') {
    if (opts.confirm !== true) {
      throw new Error('replace 模式需要 --confirm')
    }
    if (opts.confirmEnv && opts.confirmEnv !== envId) {
      throw new Error('--confirm-env 与 --env 不一致')
    }
  }
}

module.exports = {
  restorePayload,
  assertRestoreSafety,
  stripId
}
