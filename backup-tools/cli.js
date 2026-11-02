#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const shared = require('../backup-shared')
const { loadKeyMap } = require('./keys')
const github = require('./github')
const { restorePayload, assertRestoreSafety } = require('./restorer')

function usage() {
  console.log(`
class-calendar 灾备工具

用法:
  node backup-tools/cli.js <command> [options]

命令:
  keygen                         生成随机主密钥 (hex) 与建议 keyId
  list                           列出 GitHub Releases 备份
  download <tag>                 下载指定 Release 全部资产
  verify <enc.json>              校验 SHA-256（需同目录或 --manifest）
  decrypt <enc.json>             解密到 JSON
  inspect <enc.json|payload.json> 预览集合与条数
  export <enc.json> --out dir    按集合拆成 JSON（分析用）
  restore <payload.json>         恢复到 CloudBase（默认 create-only）

全局/环境变量:
  GITHUB_TOKEN GITHUB_OWNER GITHUB_REPO
  BACKUP_KEYS_FILE 或 BACKUP_KEY_ID + BACKUP_MASTER_KEY
  TCB_SECRET_ID TCB_SECRET_KEY   (restore)
  TCB_ENV                        (restore 默认可被 --env 覆盖)

示例:
  node backup-tools/cli.js keygen
  node backup-tools/cli.js download backup-latest --out ./analysis-workspace/raw
  node backup-tools/cli.js decrypt ./raw/backup-latest.enc.json --keys ./keys.json --out ./raw/payload.json
  node backup-tools/cli.js export ./raw/backup-latest.enc.json --keys ./keys.json --out ./analysis-workspace/json
  node backup-tools/cli.js restore ./raw/payload.json --env cloud1-xxx --mode create-only
  node backup-tools/cli.js restore ./raw/payload.json --env cloud1-xxx --mode replace --confirm --confirm-env cloud1-xxx
`)
}

function parseArgs(argv) {
  const args = argv.slice(2)
  const cmd = args[0]
  const positional = []
  const flags = {}
  for (let i = 1; i < args.length; i++) {
    const a = args[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = args[i + 1]
      if (!next || next.startsWith('--')) {
        flags[key] = true
      } else {
        flags[key] = next
        i++
      }
    } else {
      positional.push(a)
    }
  }
  return { cmd, positional, flags }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(obj, null, 2))
}

function resolveEncAndManifest(encPath, flags) {
  const enc = readJson(encPath)
  let manifest = null
  if (flags.manifest) {
    manifest = readJson(flags.manifest)
  } else {
    const dir = path.dirname(encPath)
    const base = path.basename(encPath)
    const candidates = [
      path.join(dir, base.replace(/\.enc\.json$/, '').replace(/^backup/, 'manifest') + '.json'),
      path.join(dir, 'manifest-latest.json'),
      path.join(dir, base.replace('backup-', 'manifest-').replace('.enc.json', '.json'))
    ]
    // backup-xxx.enc.json → manifest-xxx.json
    const m = base.match(/^backup-(.+)\.enc\.json$/)
    if (m) candidates.unshift(path.join(dir, 'manifest-' + m[1] + '.json'))
    for (let i = 0; i < candidates.length; i++) {
      if (fs.existsSync(candidates[i])) {
        manifest = readJson(candidates[i])
        break
      }
    }
  }
  return { enc, manifest }
}

function decryptFile(encPath, flags) {
  const envelope = readJson(encPath)
  const keyMap = loadKeyMap(flags.keys)
  return shared.decryptEnvelope(envelope, keyMap)
}

async function main() {
  const { cmd, positional, flags } = parseArgs(process.argv)
  if (!cmd || cmd === 'help' || cmd === '-h' || cmd === '--help') {
    usage()
    return
  }

  if (cmd === 'keygen') {
    const key = shared.generateMasterKeyHex()
    const d = new Date()
    const keyId =
      'backup-key-' +
      d.getFullYear() +
      '-' +
      String(d.getMonth() + 1).padStart(2, '0')
    console.log(JSON.stringify({ keyId, masterKeyHex: key }, null, 2))
    console.log(
      '\n请立即：\n1) 写入云函数环境变量 BACKUP_KEY_ID / BACKUP_MASTER_KEY\n2) 离线保存到密码管理器（副本 B）\n3) 本地 keys.json: { "' +
        keyId +
        '": "' +
        key +
        '" }\n切勿提交到 Git。'
    )
    return
  }

  if (cmd === 'list') {
    const rows = await github.listRecentReleases({}, Number(flags.limit) || 20)
    rows.forEach((r) => {
      console.log(
        [r.tag, r.prerelease ? '(quarantine/pre)' : '', r.publishedAt, (r.assets || []).join(',')].join('\t')
      )
    })
    return
  }

  if (cmd === 'download') {
    const tag = positional[0] || flags.tag
    if (!tag) throw new Error('请指定 tag，例如 backup-latest')
    const out = path.resolve(flags.out || './analysis-workspace/raw/' + tag)
    const result = await github.downloadTag(tag, out, {})
    console.log('downloaded to', out)
    result.saved.forEach((f) => console.log(' -', f))
    return
  }

  if (cmd === 'verify') {
    const encPath = path.resolve(positional[0])
    const { enc, manifest } = resolveEncAndManifest(encPath, flags)
    const buf = Buffer.from(JSON.stringify(enc), 'utf8')
    // 文件可能带格式化空白；优先用磁盘原始字节
    const raw = fs.readFileSync(encPath)
    const digest = shared.sha256Buffer(raw)
    console.log('sha256(file):', digest)
    if (manifest && manifest.sha256) {
      if (manifest.sha256 === digest) {
        console.log('VERIFY_OK manifest.sha256 匹配')
      } else {
        // 兼容：若上传前对 JSON.stringify(envelope) 无 pretty，而下载 pretty 不同
        const compact = shared.sha256Buffer(Buffer.from(JSON.stringify(enc), 'utf8'))
        if (manifest.sha256 === compact) {
          console.log('VERIFY_OK manifest.sha256 匹配 (compact JSON)')
        } else {
          console.error('VERIFY_FAIL expected', manifest.sha256)
          process.exitCode = 2
        }
      }
    } else {
      console.log('无 manifest.sha256，仅输出文件摘要')
    }
    console.log('keyId:', enc.keyId)
    console.log('formatVersion:', enc.formatVersion)
    return
  }

  if (cmd === 'decrypt') {
    const encPath = path.resolve(positional[0])
    const payload = decryptFile(encPath, flags)
    const out = path.resolve(flags.out || encPath.replace(/\.enc\.json$/i, '.payload.json'))
    writeJson(out, payload)
    console.log('decrypted →', out)
    console.log('backupId:', payload.backupId)
    console.log(
      'collections:',
      Object.keys(payload.collections || {})
        .map((n) => n + '=' + (payload.collections[n] || []).length)
        .join(', ')
    )
    return
  }

  if (cmd === 'inspect') {
    const file = path.resolve(positional[0])
    let payload
    const raw = readJson(file)
    if (raw.ciphertext) {
      payload = decryptFile(file, flags)
    } else {
      payload = raw
    }
    const names = Object.keys(payload.collections || {}).sort()
    console.log('backupId:', payload.backupId)
    console.log('schemaVersion:', payload.schemaVersion)
    console.log('exportedAt:', payload.exportedAt)
    let total = 0
    names.forEach((n) => {
      const c = (payload.collections[n] || []).length
      total += c
      console.log(' -', n, c)
    })
    console.log('totalRecords:', total)
    return
  }

  if (cmd === 'export') {
    const encPath = path.resolve(positional[0])
    const raw = readJson(encPath)
    const payload = raw.ciphertext ? decryptFile(encPath, flags) : raw
    const outDir = path.resolve(flags.out || './analysis-workspace/json')
    fs.mkdirSync(outDir, { recursive: true })
    writeJson(path.join(outDir, '_meta.json'), {
      backupId: payload.backupId,
      schemaVersion: payload.schemaVersion,
      exportedAt: payload.exportedAt
    })
    Object.keys(payload.collections || {}).forEach((name) => {
      writeJson(path.join(outDir, name + '.json'), payload.collections[name])
    })
    console.log('exported collections →', outDir)
    console.log('可直接用于本地数据分析；勿提交明文到 Git。')
    return
  }

  if (cmd === 'restore') {
    const file = path.resolve(positional[0])
    const raw = readJson(file)
    const payload = raw.ciphertext ? decryptFile(file, flags) : raw
    const mode = flags.mode || 'create-only'
    const envId = flags.env || process.env.TCB_ENV
    assertRestoreSafety({
      mode,
      env: envId,
      confirm: flags.confirm === true || flags.confirm === 'true',
      confirmEnv: flags['confirm-env']
    })

    const secretId = process.env.TCB_SECRET_ID || process.env.TENCENTCLOUD_SECRETID
    const secretKey = process.env.TCB_SECRET_KEY || process.env.TENCENTCLOUD_SECRETKEY
    if (!secretId || !secretKey) {
      throw new Error('restore 需要 TCB_SECRET_ID / TCB_SECRET_KEY（腾讯云 API 密钥）')
    }

    let cloudbase
    try {
      cloudbase = require('@cloudbase/node-sdk')
    } catch (e) {
      throw new Error('请先在 backup-tools 目录 npm install')
    }

    const app = cloudbase.init({
      env: envId,
      secretId,
      secretKey
    })

    console.log('restoring to', envId, 'mode=', mode)
    const report = await restorePayload(app, payload, {
      mode,
      onProgress: (c) => {
        console.log(
          c.name +
            ': written=' +
            c.written +
            ' skipped=' +
            c.skipped +
            ' failed=' +
            c.failed
        )
      }
    })
    writeJson(
      path.resolve(flags.report || './analysis-workspace/restore-report.json'),
      report
    )
    console.log('done', {
      written: report.totalWritten,
      skipped: report.totalSkipped,
      failed: report.totalFailed
    })
    if (report.totalFailed) process.exitCode = 3
    return
  }

  usage()
  throw new Error('未知命令: ' + cmd)
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
