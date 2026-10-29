/**
 * 理财持仓档案契约
 */

const HOLDING_STATUS = {
  active: 'active',
  matured: 'matured',
  eliminated: 'eliminated'
}

const RISK_LEVELS = ['PR1', 'PR2', 'PR3', 'PR4', 'PR5']

const CURRENCIES = ['CNY', 'USD', 'HKD']

/**
 * @returns {object}
 */
function createEmptyHolding() {
  return {
    name: '',
    code: '',
    institution: '',
    platform: '',
    type: '',
    risk: 'PR2',
    principal: 0,
    currency: 'CNY',
    startDate: '',
    endDate: '',
    expectedAnnual: null,
    minDays: 14,
    summary: '',
    notes: '',
    tags: [],
    status: HOLDING_STATUS.active,
    wasEliminated: false,
    eliminatedReason: '',
    eliminatedDate: '',
    restoredNote: '',
    restoredDate: '',
    eliminationHistory: [],
    cashflows: [],
    dailyEntries: []
  }
}

/**
 * @param {object} raw
 * @returns {object}
 */
function normalizeHolding(raw) {
  const base = createEmptyHolding()
  if (!raw || typeof raw !== 'object') return base
  return Object.assign({}, base, raw, {
    name: String(raw.name || '').trim(),
    code: String(raw.code || '').trim(),
    institution: String(raw.institution || '').trim(),
    platform: String(raw.platform || '').trim(),
    type: String(raw.type || '').trim(),
    risk: String(raw.risk || 'PR2').trim() || 'PR2',
    principal: Number(raw.principal) || 0,
    currency: String(raw.currency || 'CNY').trim() || 'CNY',
    startDate: String(raw.startDate || '').trim(),
    endDate: String(raw.endDate || '').trim(),
    expectedAnnual:
      raw.expectedAnnual == null || raw.expectedAnnual === ''
        ? null
        : Number(raw.expectedAnnual),
    minDays: raw.minDays == null || raw.minDays === '' ? 0 : Number(raw.minDays) || 0,
    summary: String(raw.summary || ''),
    notes: String(raw.notes || ''),
    tags: Array.isArray(raw.tags) ? raw.tags.map((t) => String(t)) : [],
    status: raw.status || HOLDING_STATUS.active,
    wasEliminated: !!raw.wasEliminated,
    eliminationHistory: Array.isArray(raw.eliminationHistory)
      ? raw.eliminationHistory
      : [],
    cashflows: Array.isArray(raw.cashflows) ? raw.cashflows : [],
    dailyEntries: Array.isArray(raw.dailyEntries) ? raw.dailyEntries : []
  })
}

/**
 * @param {object} fields
 * @returns {{ ok: boolean, message?: string }}
 */
function validateHoldingArchive(fields) {
  if (!fields || !String(fields.name || '').trim()) {
    return { ok: false, message: '请填写产品名称' }
  }
  if (!String(fields.code || '').trim()) {
    return { ok: false, message: '请填写产品编号' }
  }
  if (!String(fields.platform || '').trim()) {
    return { ok: false, message: '请选择购买平台' }
  }
  const principal = Number(fields.principal)
  if (!Number.isFinite(principal) || principal <= 0) {
    return { ok: false, message: '本金必须大于 0' }
  }
  if (!String(fields.startDate || '').trim()) {
    return { ok: false, message: '请选择起息日' }
  }
  return { ok: true }
}

module.exports = {
  HOLDING_STATUS,
  RISK_LEVELS,
  CURRENCIES,
  createEmptyHolding,
  normalizeHolding,
  validateHoldingArchive
}
