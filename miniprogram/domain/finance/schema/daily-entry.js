/**
 * 日流水契约
 */

/**
 * @param {object} raw
 * @returns {{ date: string, dailyReturn: number, eodBalance: number }|null}
 */
function normalizeDailyEntry(raw) {
  if (!raw) return null
  const date = String(raw.date || '').trim()
  if (!date) return null
  const dailyReturn = Number(raw.dailyReturn)
  const eodBalance = Number(raw.eodBalance)
  return {
    date,
    dailyReturn: Number.isFinite(dailyReturn) ? round2(dailyReturn) : 0,
    eodBalance: Number.isFinite(eodBalance) ? round2(eodBalance) : 0
  }
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100
}

/**
 * @param {Array} list
 * @returns {Array}
 */
function normalizeDailyEntries(list) {
  if (!Array.isArray(list)) return []
  return list
    .map(normalizeDailyEntry)
    .filter(Boolean)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

module.exports = {
  normalizeDailyEntry,
  normalizeDailyEntries,
  round2
}
