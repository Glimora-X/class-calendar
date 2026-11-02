const crypto = require('crypto')

const FORMAT_VERSION = 1
const ALGORITHM = 'AES-256-GCM'
const IV_LENGTH = 12
const KEY_BYTES = 32

function normalizeKeyMaterial(raw) {
  if (!raw || typeof raw !== 'string') {
    throw new Error('BACKUP_MASTER_KEY 缺失或无效')
  }
  const trimmed = raw.trim()
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex')
  }
  const b64 = Buffer.from(trimmed, 'base64')
  if (b64.length === KEY_BYTES) return b64
  // 允许 passphrase：派生固定长度密钥（仅便于本地开发；生产请用随机 32 字节）
  return crypto.createHash('sha256').update(trimmed, 'utf8').digest()
}

function generateMasterKeyHex() {
  return crypto.randomBytes(KEY_BYTES).toString('hex')
}

/**
 * @param {string|object} plaintext JSON 字符串或对象
 * @param {{ key: string|Buffer, keyId: string }} opts
 */
function encryptPayload(plaintext, opts) {
  const keyId = opts && opts.keyId
  if (!keyId) throw new Error('keyId 必填')
  const key = Buffer.isBuffer(opts.key)
    ? opts.key
    : normalizeKeyMaterial(opts.key)
  if (key.length !== KEY_BYTES) {
    throw new Error('AES-256 密钥必须为 32 字节')
  }

  const text = typeof plaintext === 'string'
    ? plaintext
    : JSON.stringify(plaintext)
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final()
  ])
  const authTag = cipher.getAuthTag()

  return {
    formatVersion: FORMAT_VERSION,
    algorithm: ALGORITHM,
    keyId,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: ciphertext.toString('base64')
  }
}

/**
 * @param {object} envelope encryptPayload 产物
 * @param {string|Buffer|Record<string,string>} keyOrMap 单密钥或 keyId→密钥 映射
 */
function decryptEnvelope(envelope, keyOrMap) {
  if (!envelope || envelope.formatVersion !== FORMAT_VERSION) {
    throw new Error('不支持的备份格式 version')
  }
  if (envelope.algorithm !== ALGORITHM) {
    throw new Error('不支持的加密算法: ' + envelope.algorithm)
  }
  if (!envelope.keyId || !envelope.iv || !envelope.authTag || !envelope.ciphertext) {
    throw new Error('密文信封字段不完整')
  }

  let keyMaterial = keyOrMap
  if (keyOrMap && typeof keyOrMap === 'object' && !Buffer.isBuffer(keyOrMap)) {
    keyMaterial = keyOrMap[envelope.keyId]
    if (!keyMaterial) {
      throw new Error('找不到 keyId 对应密钥: ' + envelope.keyId)
    }
  }
  const key = Buffer.isBuffer(keyMaterial)
    ? keyMaterial
    : normalizeKeyMaterial(String(keyMaterial))

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(envelope.iv, 'base64')
  )
  decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'))
  const plain = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final()
  ]).toString('utf8')

  return JSON.parse(plain)
}

function sha256Buffer(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex')
}

function sha256Json(obj) {
  return sha256Buffer(Buffer.from(JSON.stringify(obj), 'utf8'))
}

module.exports = {
  FORMAT_VERSION,
  ALGORITHM,
  normalizeKeyMaterial,
  generateMasterKeyHex,
  encryptPayload,
  decryptEnvelope,
  sha256Buffer,
  sha256Json
}
