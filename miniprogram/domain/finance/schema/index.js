const holding = require('./holding')
const cashflow = require('./cashflow')
const dailyEntry = require('./daily-entry')
const catalog = require('./catalog')

module.exports = {
  ...holding,
  ...cashflow,
  ...dailyEntry,
  ...catalog
}
