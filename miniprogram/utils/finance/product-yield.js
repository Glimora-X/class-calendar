/**
 * 产品收益能力估算（纯函数）
 * 不依赖 metrics.js / getStable；不修改 holding。
 * @see docs/superpowers/specs/2026-11-02-product-yield-metrics-design.md
 */

const { round2 } = require('./money')

/** 收益日均 / 年化展示所需最少有效收益日（不含迟录入） */
const MIN_YIELD_DAYS_FOR_AVERAGE = 5

/**
 * @param {number|null|undefined} dailyReturn
 * @returns {'MISSING'|'INVALID'|'POSITIVE'|'NEGATIVE'|'ZERO'}
 */
function classifyByReturn(dailyReturn) {
  if (dailyReturn == null) return 'MISSING'
  // INVALID 来源：收益金额非有限（NaN / ±Infinity）
  if (!Number.isFinite(dailyReturn)) return 'INVALID'
  if (dailyReturn > 0) return 'POSITIVE'
  if (dailyReturn < 0) return 'NEGATIVE'
  return 'ZERO'
}

/**
 * @param {unknown} x
 * @returns {boolean}
 */
function isValidBase(x) {
  return x != null && Number.isFinite(x) && x > 0
}

/**
 * @param {object} entry
 * @returns {boolean}
 */
function isLateEntry(entry) {
  return !!(entry && entry.source === 'late')
}

/**
 * 不修改原数组；按 date 升序；同日后写覆盖。
 * @param {Array|undefined|null} dailyEntries
 * @returns {Array}
 */
function normalizeEntries(dailyEntries) {
  const copy = Array.isArray(dailyEntries) ? dailyEntries.slice() : []
  copy.sort((a, b) => {
    const da = a && a.date != null ? String(a.date) : ''
    const db = b && b.date != null ? String(b.date) : ''
    if (da < db) return -1
    if (da > db) return 1
    return 0
  })
  const byDate = new Map()
  copy.forEach((e) => {
    if (!e || e.date == null || e.date === '') return
    byDate.set(String(e.date), e)
  })
  return Array.from(byDate.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([, e]) => e)
}

function emptyMetrics() {
  return {
    averagePer10k: null,
    averagePer10kOnCalendarDays: null,
    annualizedYield: null,
    yieldDayCount: 0,
    positiveDayCount: 0,
    negativeDayCount: 0,
    zeroYieldDayCount: 0,
    invalidDayCount: 0,
    lateExcludedDayCount: 0,
    totalReturnOnYieldDays: 0,
    calculationQuality: 'ESTIMATED',
    sampleInsufficient: true,
    minYieldDaysRequired: MIN_YIELD_DAYS_FOR_AVERAGE,
    period: { startDate: null, endDate: null, recordedDayCount: 0 },
    days: [],
    hasAnomalies: false
  }
}

/**
 * @param {{ dailyEntries?: Array }} holding
 */
function calcProductYieldMetrics(holding) {
  const entries = normalizeEntries(holding && holding.dailyEntries)
  if (!entries.length) return emptyMetrics()

  const days = []
  let sumYieldPer = 0
  let yieldDayCount = 0
  let positiveDayCount = 0
  let negativeDayCount = 0
  let zeroYieldDayCount = 0
  let invalidDayCount = 0
  let lateExcludedDayCount = 0
  let sumCalPer = 0
  let recordedDayCount = 0
  let totalReturnOnYieldDays = 0
  let hasAnomalies = false
  let periodStart = null
  let periodEnd = null

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]
    const date = String(e.date)
    const late = isLateEntry(e)
    const rawReturn = e.dailyReturn
    const dailyReturn =
      rawReturn == null || rawReturn === '' ? null : Number(rawReturn)

    let yieldDayType = classifyByReturn(dailyReturn)
    const prev = i > 0 ? entries[i - 1] : null
    let previousEodBalance = null
    if (prev && prev.eodBalance != null && prev.eodBalance !== '') {
      previousEodBalance = Number(prev.eodBalance)
    }

    let rawPer10k = null

    if (yieldDayType === 'POSITIVE' || yieldDayType === 'NEGATIVE') {
      if (!isValidBase(previousEodBalance)) {
        // INVALID 来源：前序计息基数无效（禁止向前跳过）
        yieldDayType = 'INVALID'
      } else {
        rawPer10k = (dailyReturn / previousEodBalance) * 10000
      }
    }

    const anomalyFlags = []
    // 阈值含 0.01：验收样例 -0.01 需标记 TINY_RETURN（abs === 0.01）
    if (
      Number.isFinite(dailyReturn) &&
      dailyReturn !== 0 &&
      Math.abs(dailyReturn) <= 0.01
    ) {
      anomalyFlags.push('TINY_RETURN')
      hasAnomalies = true
    }
    if (late) {
      anomalyFlags.push('LATE_ENTRY')
      hasAnomalies = true
    }

    // 迟录入：可分类/可算单日估算，但不进入收益日均 / 自然日日均 / 计数闸门
    const excludeFromAverage =
      late &&
      (yieldDayType === 'POSITIVE' ||
        yieldDayType === 'NEGATIVE' ||
        yieldDayType === 'ZERO')

    if (excludeFromAverage) {
      lateExcludedDayCount++
      // 仍记入 period 可视范围（有记录），但不进 recordedDayCount 的日均分母
      if (!periodStart) periodStart = date
      periodEnd = date
    } else if (yieldDayType === 'POSITIVE') {
      positiveDayCount++
      yieldDayCount++
      sumYieldPer += rawPer10k
      totalReturnOnYieldDays += dailyReturn
      recordedDayCount++
      sumCalPer += rawPer10k
      if (!periodStart) periodStart = date
      periodEnd = date
    } else if (yieldDayType === 'NEGATIVE') {
      negativeDayCount++
      yieldDayCount++
      sumYieldPer += rawPer10k
      totalReturnOnYieldDays += dailyReturn
      recordedDayCount++
      sumCalPer += rawPer10k
      if (!periodStart) periodStart = date
      periodEnd = date
    } else if (yieldDayType === 'ZERO') {
      zeroYieldDayCount++
      recordedDayCount++
      if (!periodStart) periodStart = date
      periodEnd = date
    } else if (yieldDayType === 'INVALID') {
      invalidDayCount++
    }

    days.push({
      date,
      dailyReturn: Number.isFinite(dailyReturn) ? dailyReturn : null,
      previousEodBalance: Number.isFinite(previousEodBalance)
        ? previousEodBalance
        : previousEodBalance == null
          ? null
          : previousEodBalance,
      estimatedPer10k: rawPer10k == null ? null : round2(rawPer10k),
      yieldDayType,
      anomalyFlags,
      excludedFromAverage: !!excludeFromAverage
    })
  }

  const sampleInsufficient = yieldDayCount < MIN_YIELD_DAYS_FOR_AVERAGE
  const rawAvg =
    !sampleInsufficient && yieldDayCount > 0
      ? sumYieldPer / yieldDayCount
      : null
  const rawAnn = rawAvg == null ? null : (rawAvg * 365) / 100

  // 有效收益日达标才展示自然日日均；仅有 ZERO 日时为 0；有收益但样本不足 → null
  let averagePer10kOnCalendarDays = null
  if (!sampleInsufficient && recordedDayCount > 0) {
    averagePer10kOnCalendarDays = round2(sumCalPer / recordedDayCount)
  } else if (yieldDayCount === 0 && recordedDayCount > 0) {
    averagePer10kOnCalendarDays = 0
  }

  return {
    averagePer10k: rawAvg == null ? null : round2(rawAvg),
    averagePer10kOnCalendarDays,
    annualizedYield: rawAnn == null ? null : round2(rawAnn),
    yieldDayCount,
    positiveDayCount,
    negativeDayCount,
    zeroYieldDayCount,
    invalidDayCount,
    lateExcludedDayCount,
    totalReturnOnYieldDays: round2(totalReturnOnYieldDays),
    calculationQuality: 'ESTIMATED',
    sampleInsufficient,
    minYieldDaysRequired: MIN_YIELD_DAYS_FOR_AVERAGE,
    period: {
      startDate: periodStart,
      endDate: periodEnd,
      recordedDayCount
    },
    days,
    hasAnomalies
  }
}

module.exports = {
  classifyByReturn,
  isValidBase,
  isLateEntry,
  normalizeEntries,
  calcProductYieldMetrics,
  MIN_YIELD_DAYS_FOR_AVERAGE
}
