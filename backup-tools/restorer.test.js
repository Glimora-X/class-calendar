/**
 * 运行: node backup-tools/restorer.test.js
 */
const assert = require('assert')
const { assertRestoreSafety, restorePayload } = require('./restorer')

assert.throws(
  () => assertRestoreSafety({ mode: 'create-only' }),
  /必须指定/
)

assert.throws(
  () =>
    assertRestoreSafety({
      mode: 'replace',
      env: 'cloud1-x',
      confirm: false
    }),
  /--confirm/
)

assertRestoreSafety({
  mode: 'replace',
  env: 'cloud1-x',
  confirm: true,
  confirmEnv: 'cloud1-x'
})

assert.throws(
  () =>
    assertRestoreSafety({
      mode: 'replace',
      env: 'cloud1-x',
      confirm: true,
      confirmEnv: 'other'
    }),
  /不一致/
)

async function runFakeRestore() {
  const store = {
    bookings: {
      existing: { _id: 'existing', _openid: 'o', title: 'old' }
    }
  }

  const app = {
    database() {
      return {
        collection(name) {
          if (!store[name]) store[name] = {}
          return {
            doc(id) {
              return {
                async get() {
                  if (!store[name][id]) {
                    const err = new Error('not found')
                    throw err
                  }
                  return { data: store[name][id] }
                },
                async set(data) {
                  store[name][id] = Object.assign({ _id: id }, data)
                }
              }
            }
          }
        }
      }
    }
  }

  const payload = {
    collections: {
      bookings: [
        { _id: 'existing', _openid: 'o', title: 'new' },
        { _id: 'fresh', _openid: 'o', title: 'n' }
      ],
      subjects: [{ _id: 's1', _openid: 'o', name: '英语' }]
    }
  }

  const createOnly = await restorePayload(app, payload, { mode: 'create-only' })
  assert.strictEqual(createOnly.totalSkipped, 1)
  assert.strictEqual(createOnly.totalWritten, 2)
  assert.strictEqual(store.bookings.existing.title, 'old')
  assert.strictEqual(store.bookings.fresh.title, 'n')

  const replaced = await restorePayload(app, payload, { mode: 'replace' })
  assert.strictEqual(store.bookings.existing.title, 'new')
  assert.ok(replaced.totalWritten >= 2)
}

runFakeRestore()
  .then(() => console.log('restorer tests OK'))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
