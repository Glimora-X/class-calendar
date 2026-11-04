const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const { buildClosePatch, buildReopenPatch } = require('./close-holding')

function todayChina() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date())
  const y = parts.find((p) => p.type === 'year').value
  const m = parts.find((p) => p.type === 'month').value
  const d = parts.find((p) => p.type === 'day').value
  return `${y}-${m}-${d}`
}

/**
 * 入参:
 *   { action: 'mature', _id }
 *   { action: 'close', _id }
 *   { action: 'eliminate', _id, reason }
 *   { action: 'restore', _id, note }  // 淘汰还原；已清仓还原可不填 note
 */
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const payload = event || {}
  const action = String(payload.action || '').trim()
  const _id = payload._id
  if (!_id) return { code: 'INVALID_PARAM', message: '缺少 _id' }
  if (!action) return { code: 'INVALID_PARAM', message: '缺少 action' }

  const col = db.collection('finance_holdings')
  const now = new Date().toISOString()
  const today = todayChina()

  try {
    const doc = await col.doc(_id).get().catch(() => null)
    if (!doc || !doc.data) return { code: 'NOT_FOUND', message: '记录不存在' }
    if (doc.data._openid !== OPENID) {
      return { code: 'FORBIDDEN', message: '无权操作' }
    }
    const p = doc.data
    const history = Array.isArray(p.eliminationHistory)
      ? p.eliminationHistory.slice()
      : []

    if (action === 'mature') {
      if (p.status === 'closed' || p.status === 'eliminated') {
        return { code: 'INVALID_PARAM', message: '当前状态不可标记到期' }
      }
      await col.doc(_id).update({
        data: { status: 'matured', updatedAt: now }
      })
      return { code: 'OK', _id, status: 'matured' }
    }

    if (action === 'close') {
      if (p.status === 'closed') {
        return { code: 'OK', _id, status: 'closed', realizedProfit: p.realizedProfit }
      }
      if (p.status === 'eliminated') {
        return { code: 'INVALID_PARAM', message: '已淘汰产品请先还原再清仓' }
      }
      const patch = buildClosePatch(p, today)
      history.push({
        type: 'close',
        date: today,
        reason: '清仓',
        realizedProfit: patch.realizedProfit
      })
      await col.doc(_id).update({
        data: {
          status: patch.status,
          realizedProfit: patch.realizedProfit,
          closedDate: patch.closedDate,
          cashflows: patch.cashflows,
          dailyEntries: patch.dailyEntries,
          eliminationHistory: history,
          updatedAt: now
        }
      })
      return {
        code: 'OK',
        _id,
        status: 'closed',
        realizedProfit: patch.realizedProfit
      }
    }

    if (action === 'eliminate') {
      const reason = String(payload.reason || '').trim()
      if (!reason) return { code: 'INVALID_PARAM', message: '请填写淘汰原因' }
      history.push({ type: 'eliminate', date: today, reason })
      await col.doc(_id).update({
        data: {
          status: 'eliminated',
          eliminatedReason: reason,
          eliminatedDate: today,
          eliminationHistory: history,
          updatedAt: now
        }
      })
      return { code: 'OK', _id, status: 'eliminated' }
    }

    if (action === 'restore') {
      if (p.status === 'closed') {
        const patch = buildReopenPatch(p)
        history.push({
          type: 'reopen',
          date: today,
          reason: String(payload.note || '还原清仓').trim() || '还原清仓'
        })
        await col.doc(_id).update({
          data: {
            status: patch.status,
            realizedProfit: patch.realizedProfit,
            closedDate: patch.closedDate,
            cashflows: patch.cashflows,
            dailyEntries: patch.dailyEntries,
            eliminationHistory: history,
            updatedAt: now
          }
        })
        return { code: 'OK', _id, status: 'active' }
      }

      const note = String(payload.note || '').trim()
      if (!note) return { code: 'INVALID_PARAM', message: '请填写还原备注' }
      history.push({ type: 'restore', date: today, reason: note })
      await col.doc(_id).update({
        data: {
          status: 'active',
          wasEliminated: true,
          restoredNote: note,
          restoredDate: today,
          eliminationHistory: history,
          updatedAt: now
        }
      })
      return { code: 'OK', _id, status: 'active' }
    }

    return { code: 'INVALID_PARAM', message: '未知 action' }
  } catch (e) {
    console.error('holdingStatus', e)
    return { code: 'SYNC_FAILED', message: '同步失败，请重试' }
  }
}
