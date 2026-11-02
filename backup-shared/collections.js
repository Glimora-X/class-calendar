/**
 * 灾备导出集合清单。恢复与备份必须共用此列表。
 * schemaVersion 变更时同步更新 schema-version.js。
 */

const COLLECTIONS = [
  { name: 'subjects', group: 'booking' },
  { name: 'name_lists', group: 'booking' },
  { name: 'day_holds', group: 'booking' },
  { name: 'bookings', group: 'booking' },
  { name: 'finance_catalog', group: 'finance' },
  { name: 'finance_accounts', group: 'finance' },
  { name: 'finance_holdings', group: 'finance' },
  { name: 'finance_snapshots', group: 'finance' }
]

/** 恢复时建议顺序：先配置/主数据，再流水类 */
const RESTORE_ORDER = COLLECTIONS.map((c) => c.name)

const CORE_COLLECTIONS = [
  'bookings',
  'finance_holdings',
  'finance_accounts',
  'finance_snapshots'
]

function collectionNames() {
  return COLLECTIONS.map((c) => c.name)
}

module.exports = {
  COLLECTIONS,
  RESTORE_ORDER,
  CORE_COLLECTIONS,
  collectionNames
}
