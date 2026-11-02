/**
 * 运行: node backup-shared/crypto.test.js
 */
const assert = require('assert')
const {
  generateMasterKeyHex,
  encryptPayload,
  decryptEnvelope,
  sha256Buffer,
  detectAnomaly,
  buildCollectionStats,
  serializeValue,
  buildPayload,
  SCHEMA_VERSION
} = require('./index')

{
  const key = generateMasterKeyHex()
  assert.strictEqual(key.length, 64)
  const payload = buildPayload(
    {
      bookings: [{ _id: 'a1', _openid: 'o1', date: new Date('2026-11-01T00:00:00.000Z') }],
      subjects: []
    },
    { schemaVersion: SCHEMA_VERSION, backupId: 't1', exportedAt: '2026-11-02T00:00:00.000Z' }
  )
  assert.strictEqual(payload.collections.bookings[0].date, '2026-11-01T00:00:00.000Z')

  const env = encryptPayload(payload, { key, keyId: 'backup-key-test' })
  assert.strictEqual(env.formatVersion, 1)
  assert.strictEqual(env.keyId, 'backup-key-test')
  assert.ok(env.iv && env.authTag && env.ciphertext)

  const round = decryptEnvelope(env, { 'backup-key-test': key })
  assert.strictEqual(round.backupId, 't1')
  assert.strictEqual(round.collections.bookings[0]._openid, 'o1')

  assert.throws(
    () => decryptEnvelope(env, { 'backup-key-other': key }),
    /找不到 keyId/
  )
}

{
  const stats = buildCollectionStats({
    bookings: [1, 2, 3],
    finance_holdings: [1]
  })
  assert.deepStrictEqual(
    detectAnomaly(stats, null).firstRun,
    true
  )
  const prev = [
    { name: 'bookings', count: 100 },
    { name: 'finance_holdings', count: 50 },
    { name: 'finance_accounts', count: 5 },
    { name: 'finance_snapshots', count: 10 }
  ]
  const empty = buildCollectionStats({
    bookings: [],
    finance_holdings: [],
    finance_accounts: [],
    finance_snapshots: []
  })
  const hit = detectAnomaly(empty, prev)
  assert.strictEqual(hit.anomalous, true)
  assert.ok(hit.reasons.length >= 1)

  const bypass = detectAnomaly(empty, prev, { bypass: true })
  assert.strictEqual(bypass.anomalous, false)
}

{
  assert.strictEqual(serializeValue(null), null)
  assert.strictEqual(typeof sha256Buffer(Buffer.from('x')), 'string')
}

console.log('backup-shared tests OK')
