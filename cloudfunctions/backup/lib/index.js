/** AUTO-SYNCED from backup-shared/index.js — 勿手改；运行 node scripts/sync-backup-shared.js */
module.exports = {
  ...require('./collections'),
  ...require('./schema-version'),
  ...require('./serialize'),
  ...require('./crypto'),
  ...require('./manifest'),
  ...require('./anomaly')
}
