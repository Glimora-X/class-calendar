const fs = require('fs')
const path = require('path')

/**
 * 加载密钥映射。优先级：
 * 1. --keys path 指向 JSON: { "backup-key-2026-01": "hex-or-base64-or-passphrase" }
 * 2. 环境变量 BACKUP_KEYS_FILE
 * 3. 环境变量 BACKUP_KEY_ID + BACKUP_MASTER_KEY（单密钥）
 */
function loadKeyMap(keysFile) {
  const file =
    keysFile ||
    process.env.BACKUP_KEYS_FILE ||
    ''
  if (file) {
    const abs = path.resolve(file)
    const raw = JSON.parse(fs.readFileSync(abs, 'utf8'))
    if (!raw || typeof raw !== 'object') {
      throw new Error('密钥文件格式错误，应为 { keyId: keyMaterial }')
    }
    return raw
  }

  const keyId = process.env.BACKUP_KEY_ID
  const key = process.env.BACKUP_MASTER_KEY
  if (keyId && key) {
    const map = {}
    map[keyId] = key
    return map
  }

  throw new Error(
    '未找到密钥。请设置 BACKUP_KEYS_FILE，或 BACKUP_KEY_ID + BACKUP_MASTER_KEY，或传入 --keys'
  )
}

module.exports = { loadKeyMap }
