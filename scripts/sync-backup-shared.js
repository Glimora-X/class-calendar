#!/usr/bin/env node
/**
 * 将 backup-shared 同步到 cloudfunctions/backup/lib，供云函数部署打包。
 * 运行: node scripts/sync-backup-shared.js
 */
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const srcDir = path.join(root, 'backup-shared')
const destDir = path.join(root, 'cloudfunctions', 'backup', 'lib')

const files = [
  'collections.js',
  'schema-version.js',
  'serialize.js',
  'crypto.js',
  'manifest.js',
  'anomaly.js',
  'index.js'
]

if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })

files.forEach((name) => {
  const src = path.join(srcDir, name)
  const dest = path.join(destDir, name)
  if (!fs.existsSync(src)) {
    console.error('missing', src)
    process.exit(1)
  }
  let body = fs.readFileSync(src, 'utf8')
  body =
    '/** AUTO-SYNCED from backup-shared/' +
    name +
    ' — 勿手改；运行 node scripts/sync-backup-shared.js */\n' +
    body
  fs.writeFileSync(dest, body)
  console.log('synced', name)
})

console.log('OK →', destDir)
