/**
 * 其他安排（占用日）纯函数
 */

const HOLD_REASON_MAX = 20

/**
 * @param {unknown} raw
 * @returns {{ ok: boolean, reason: string, message: string }}
 */
function normalizeReason(raw) {
  const reason = String(raw == null ? '' : raw).trim()
  if (!reason) {
    return { ok: false, reason: '', message: '写一下事由吧' }
  }
  if (reason.length > HOLD_REASON_MAX) {
    return { ok: false, reason: '', message: `事由最多${HOLD_REASON_MAX}个字` }
  }
  return { ok: true, reason, message: '' }
}

/**
 * @param {Array<{ date?: string, reason?: string }|null|undefined>|null|undefined} list
 * @returns {Record<string, string>}
 */
function holdsToMap(list) {
  const map = {}
  ;(list || []).forEach((row) => {
    if (!row || !row.date) return
    const date = String(row.date).trim()
    if (!date) return
    map[date] = String(row.reason || '').trim()
  })
  return map
}

/**
 * @param {Record<string, string>|null|undefined} holdMap
 * @param {string} date
 */
function isHoldDate(holdMap, date) {
  if (!holdMap || !date) return false
  return Object.prototype.hasOwnProperty.call(holdMap, String(date))
}

/**
 * @param {string} date YYYY-MM-DD
 * @param {string} todayStr YYYY-MM-DD
 */
function isPastDate(date, todayStr) {
  const d = String(date || '')
  const today = String(todayStr || '')
  if (!d || !today) return false
  return d < today
}

/**
 * 复制上月：占用日、已过日期默认不勾选
 * @param {Array<object>|null|undefined} createRows
 * @param {Record<string, string>|null|undefined} holdMap
 * @param {string} [todayStr]
 */
function annotateCopyRows(createRows, holdMap, todayStr) {
  const map = holdMap || {}
  return (createRows || []).map((row) => {
    const date = row && row.date ? String(row.date) : ''
    const hold = isHoldDate(map, date)
    const past = isPastDate(date, todayStr)
    if (!hold && !past) {
      return Object.assign({}, row, { holdReason: '', past: false })
    }
    return Object.assign({}, row, {
      checked: false,
      holdReason: hold ? map[date] || '' : '',
      past
    })
  })
}

/**
 * 批量按星期预览：占用日、已过日期默认不勾选（可勾回）
 * @param {string[]} dates
 * @param {Record<string, string>|null|undefined} holdMap
 * @param {string} [todayStr]
 */
function annotateBatchPreviewRows(dates, holdMap, todayStr) {
  const map = holdMap || {}
  return (dates || []).map((date) => {
    const d = String(date || '')
    const hold = isHoldDate(map, d)
    const past = isPastDate(d, todayStr)
    return {
      date: d,
      holdReason: hold ? map[d] || '' : '',
      past,
      selected: !hold && !past
    }
  })
}

/**
 * 批量按星期：默认排除占用日；includedHoldDates 内的占用日仍写入
 * @param {string[]} dates
 * @param {Record<string, string>|null|undefined} holdMap
 * @param {string[]|null|undefined} includedHoldDates
 * @returns {{ selected: string[], skippedHolds: string[] }}
 */
function partitionBatchDates(dates, holdMap, includedHoldDates) {
  const map = holdMap || {}
  const include = {}
  ;(includedHoldDates || []).forEach((d) => {
    if (d) include[String(d)] = true
  })
  const selected = []
  const skippedHolds = []
  ;(dates || []).forEach((date) => {
    const d = String(date || '')
    if (!d) return
    if (isHoldDate(map, d) && !include[d]) {
      skippedHolds.push(d)
      return
    }
    selected.push(d)
  })
  return { selected, skippedHolds }
}

/**
 * @param {string[]} dates
 * @param {Record<string, string>|null|undefined} holdMap
 * @returns {string[]}
 */
function holdDatesInList(dates, holdMap) {
  const map = holdMap || {}
  const out = []
  ;(dates || []).forEach((date) => {
    const d = String(date || '')
    if (d && isHoldDate(map, d) && out.indexOf(d) === -1) out.push(d)
  })
  return out
}

/**
 * @param {Record<string, string>|null|undefined} holdMap
 * @param {string[]} dates
 */
function formatHoldConfirmContent(holdMap, dates) {
  const map = holdMap || {}
  const list = holdDatesInList(dates, map)
  if (!list.length) return ''
  if (list.length === 1) {
    const reason = map[list[0]] || '有其他安排'
    return `${reason}\n最好别再约。仍要约课吗？`
  }
  const lines = list.map((d) => `${d} ${map[d] || '有其他安排'}`)
  return `${lines.join('\n')}\n最好别再约。仍要约课吗？`
}

module.exports = {
  HOLD_REASON_MAX,
  normalizeReason,
  holdsToMap,
  isHoldDate,
  isPastDate,
  annotateCopyRows,
  annotateBatchPreviewRows,
  partitionBatchDates,
  holdDatesInList,
  formatHoldConfirmContent
}
