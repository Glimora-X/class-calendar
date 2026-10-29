const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const { seedOpeningLedger } = require('./ledger')

function pickArchive(event) {
  let expectedAnnual = null
  if (event.expectedAnnual != null && event.expectedAnnual !== '') {
    const n = Number(event.expectedAnnual)
    if (Number.isFinite(n)) expectedAnnual = n
  }
  return {
    name: String(event.name || '').trim(),
    code: String(event.code || '').trim(),
    institution: String(event.institution || '').trim(),
    platform: String(event.platform || '').trim(),
    type: String(event.type || '').trim(),
    risk: String(event.risk || 'PR2').trim() || 'PR2',
    principal: Number(event.principal) || 0,
    currency: String(event.currency || 'CNY').trim() || 'CNY',
    startDate: String(event.startDate || '').trim(),
    endDate: String(event.endDate || '').trim(),
    expectedAnnual,
    minDays:
      event.minDays == null || event.minDays === ''
        ? 0
        : Number(event.minDays) || 0,
    summary: String(event.summary || ''),
    notes: String(event.notes || ''),
    tags: Array.isArray(event.tags)
      ? event.tags.map((t) => String(t))
      : []
  }
}

function validate(fields) {
  if (!fields.name) return '请填写产品名称'
  if (!fields.code) return '请填写产品编号'
  if (!fields.platform) return '请选择购买平台'
  if (!fields.principal || fields.principal <= 0) return '本金必须大于 0'
  if (!fields.startDate) return '请选择起息日'
  return null
}

/**
 * 入参: 档案字段 + 可选 _id / lateDate / lateReturn / cashflows /
 *       replaceEliminatedId（编号撞已淘汰时确认后传入）
 * 出参: { code: 'OK', _id } | { code: 'CODE_CONFLICT', conflict }
 */
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const payload = event || {}
  const fields = pickArchive(payload)
  const err = validate(fields)
  if (err) return { code: 'INVALID_PARAM', message: err }

  const col = db.collection('finance_holdings')
  const now = new Date().toISOString()

  try {
    const conflictRes = await col
      .where({ _openid: OPENID, code: fields.code })
      .limit(5)
      .get()
    const conflicts = (conflictRes.data || []).filter(
      (x) => x._id !== payload._id
    )
    const activeConflict = conflicts.find((x) => x.status !== 'eliminated')
    if (activeConflict) {
      return {
        code: 'INVALID_PARAM',
        message: '编号 ' + fields.code + ' 已存在（' + activeConflict.name + '）'
      }
    }
    const elimConflict = conflicts.find((x) => x.status === 'eliminated')
    if (elimConflict) {
      if (payload.replaceEliminatedId !== elimConflict._id) {
        return {
          code: 'CODE_CONFLICT',
          message: '编号与已淘汰产品冲突',
          conflict: {
            _id: elimConflict._id,
            name: elimConflict.name,
            code: elimConflict.code
          }
        }
      }
      await col.doc(elimConflict._id).remove()
    }

    if (payload._id) {
      const doc = await col.doc(payload._id).get().catch(() => null)
      if (!doc || !doc.data) return { code: 'NOT_FOUND', message: '记录不存在' }
      if (doc.data._openid !== OPENID) {
        return { code: 'FORBIDDEN', message: '无权操作' }
      }
      // 编辑只改档案；本金/起息变更时不重建流水（与约定一致）
      await col.doc(payload._id).update({
        data: Object.assign({}, fields, { updatedAt: now })
      })
      return { code: 'OK', _id: payload._id }
    }

    let cashflows = Array.isArray(payload.cashflows) ? payload.cashflows : []
    const seeded = seedOpeningLedger({
      principal: fields.principal,
      startDate: fields.startDate,
      cashflows,
      lateDate: payload.lateDate,
      lateReturn: payload.lateReturn
    })
    const addRes = await col.add({
      data: Object.assign({}, fields, {
        _openid: OPENID,
        status: 'active',
        wasEliminated: false,
        eliminatedReason: '',
        eliminatedDate: '',
        restoredNote: '',
        restoredDate: '',
        eliminationHistory: [],
        cashflows: seeded.cashflows,
        dailyEntries: seeded.dailyEntries,
        createdAt: now,
        updatedAt: now
      })
    })
    return { code: 'OK', _id: addRes._id }
  } catch (e) {
    console.error('holdingUpsert', e)
    return { code: 'SYNC_FAILED', message: '同步失败，请重试' }
  }
}
