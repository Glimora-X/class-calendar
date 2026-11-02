const { CORE_COLLECTIONS } = require('./collections')

/**
 * 对比本次与上次成功备份的数量，拦截「空库覆盖」。
 * @param {Array<{name:string,count:number}>} currentStats
 * @param {Array<{name:string,count:number}>|null} previousStats
 * @param {{ dropRatio?: number, bypass?: boolean }} opts
 */
function detectAnomaly(currentStats, previousStats, opts) {
  const options = opts || {}
  if (options.bypass) {
    return { anomalous: false, reasons: [], bypass: true }
  }
  if (!previousStats || !previousStats.length) {
    return { anomalous: false, reasons: [], firstRun: true }
  }

  const dropRatio = options.dropRatio != null ? options.dropRatio : 0.5
  const prevMap = {}
  previousStats.forEach((row) => {
    prevMap[row.name] = row.count
  })
  const curMap = {}
  currentStats.forEach((row) => {
    curMap[row.name] = row.count
  })

  const reasons = []
  const prevTotal = previousStats.reduce((s, r) => s + r.count, 0)
  const curTotal = currentStats.reduce((s, r) => s + r.count, 0)

  if (prevTotal > 0 && curTotal === 0) {
    reasons.push('总记录从 ' + prevTotal + ' 降为 0')
  } else if (prevTotal > 0 && curTotal / prevTotal <= 1 - dropRatio) {
    const pct = Math.round((1 - curTotal / prevTotal) * 100)
    reasons.push('总记录下降 ' + pct + '%（' + prevTotal + ' → ' + curTotal + '）')
  }

  CORE_COLLECTIONS.forEach((name) => {
    const prev = prevMap[name] || 0
    const cur = curMap[name] || 0
    if (prev > 0 && cur === 0) {
      reasons.push('核心集合 ' + name + ' 为空（此前 ' + prev + ' 条）')
    }
  })

  return {
    anomalous: reasons.length > 0,
    reasons,
    previousTotal: prevTotal,
    currentTotal: curTotal
  }
}

module.exports = { detectAnomaly }
