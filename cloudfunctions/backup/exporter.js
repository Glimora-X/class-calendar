const { collectionNames } = require('./lib/collections')

const PAGE = 100
const MAX_DOCS_PER_COLLECTION = 50000

/**
 * 分页导出全部业务集合（管理员视角，不过滤 _openid）。
 * @param {object} db cloud.database()
 */
async function exportAllCollections(db) {
  const names = collectionNames()
  const collections = {}
  for (let i = 0; i < names.length; i++) {
    const name = names[i]
    collections[name] = await exportCollection(db, name)
  }
  return collections
}

async function exportCollection(db, name) {
  const col = db.collection(name)
  const out = []
  let skip = 0
  while (out.length < MAX_DOCS_PER_COLLECTION) {
    const res = await col.skip(skip).limit(PAGE).get()
    const batch = (res && res.data) || []
    out.push.apply(out, batch)
    if (batch.length < PAGE) break
    skip += batch.length
  }
  return out
}

module.exports = {
  exportAllCollections,
  exportCollection,
  PAGE,
  MAX_DOCS_PER_COLLECTION
}
