const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const { rebuildLedger, round2 } = require('./ledger')

async function loadOwned(col, _id, OPENID) {
  const doc = await col.doc(_id).get().catch(() => null)
  if (!doc || !doc.data) return { error: { code: 'NOT_FOUND', message: '记录不存在' } }
  if (doc.data._openid !== OPENID) {
    return { error: { code: 'FORBIDDEN', message: '无权操作' } }
  }
  return { holding: doc.data }
}

/**
 * 入参 action:
 *   dailyUpsert: { _id, date, dailyReturn } | { items: [{_id,date,dailyReturn}] }
 *   dailyRemove: { _id, date }
 *   cashflowBatch: { _id, rows: [{date,type,amount,remark}] }
 *   cashflowRemove: { _id, index }
 */
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const payload = event || {}
  const action = String(payload.action || '').trim()
  const col = db.collection('finance_holdings')
  const now = new Date().toISOString()

  try {
    if (action === 'dailyUpsert') {
      const items = Array.isArray(payload.items)
        ? payload.items
        : [
            {
              _id: payload._id,
              date: payload.date,
              dailyReturn: payload.dailyReturn
            }
          ]
      if (!items.length) {
        return { code: 'INVALID_PARAM', message: '请至少填写一条日收益' }
      }
      const ids = []
      for (let i = 0; i < items.length; i++) {
        const it = items[i]
        const date = String(it.date || '').trim()
        const ret = Number(it.dailyReturn)
        if (!it._id || !date || !Number.isFinite(ret)) continue
        const loaded = await loadOwned(col, it._id, OPENID)
        if (loaded.error) return loaded.error
        const h = loaded.holding
        const entries = (h.dailyEntries || []).slice()
        const idx = entries.findIndex((e) => e.date === date)
        const row = { date, dailyReturn: round2(ret), eodBalance: 0 }
        if (idx >= 0) entries[idx] = row
        else entries.push(row)
        const rebuilt = rebuildLedger({
          principal: h.principal,
          cashflows: h.cashflows,
          dailyEntries: entries
        })
        await col.doc(it._id).update({
          data: { dailyEntries: rebuilt.dailyEntries, updatedAt: now }
        })
        ids.push(it._id)
      }
      return { code: 'OK', count: ids.length, ids }
    }

    if (action === 'dailyRemove') {
      const _id = payload._id
      const date = String(payload.date || '').trim()
      if (!_id || !date) {
        return { code: 'INVALID_PARAM', message: '缺少 _id/date' }
      }
      const loaded = await loadOwned(col, _id, OPENID)
      if (loaded.error) return loaded.error
      const h = loaded.holding
      const entries = (h.dailyEntries || []).filter((e) => e.date !== date)
      const rebuilt = rebuildLedger({
        principal: h.principal,
        cashflows: h.cashflows,
        dailyEntries: entries
      })
      await col.doc(_id).update({
        data: { dailyEntries: rebuilt.dailyEntries, updatedAt: now }
      })
      return { code: 'OK', _id }
    }

    if (action === 'cashflowBatch') {
      const _id = payload._id
      const rows = Array.isArray(payload.rows) ? payload.rows : []
      if (!_id) return { code: 'INVALID_PARAM', message: '缺少 _id' }
      const valid = rows
        .map((r) => {
          const date = String(r.date || '').trim()
          const amount = Number(r.amount)
          if (!date || !Number.isFinite(amount) || amount <= 0) return null
          return {
            date,
            type: r.type === 'redeem' || r.type === '赎回' ? 'redeem' : 'buy',
            amount: round2(amount),
            remark: String(r.remark || '').trim()
          }
        })
        .filter(Boolean)
      if (!valid.length) {
        return { code: 'INVALID_PARAM', message: '请至少填写一条有效现金流' }
      }
      const loaded = await loadOwned(col, _id, OPENID)
      if (loaded.error) return loaded.error
      const h = loaded.holding
      const cashflows = (h.cashflows || []).concat(valid)
      const rebuilt = rebuildLedger({
        principal: h.principal,
        cashflows,
        dailyEntries: h.dailyEntries
      })
      await col.doc(_id).update({
        data: {
          cashflows,
          dailyEntries: rebuilt.dailyEntries,
          updatedAt: now
        }
      })
      return { code: 'OK', _id, count: valid.length }
    }

    if (action === 'cashflowRemove') {
      const _id = payload._id
      const index = Number(payload.index)
      if (!_id || !Number.isFinite(index) || index < 0) {
        return { code: 'INVALID_PARAM', message: '缺少 _id/index' }
      }
      const loaded = await loadOwned(col, _id, OPENID)
      if (loaded.error) return loaded.error
      const h = loaded.holding
      const cashflows = (h.cashflows || []).slice()
      if (index >= cashflows.length) {
        return { code: 'INVALID_PARAM', message: '索引无效' }
      }
      cashflows.splice(index, 1)
      const rebuilt = rebuildLedger({
        principal: h.principal,
        cashflows,
        dailyEntries: h.dailyEntries
      })
      await col.doc(_id).update({
        data: {
          cashflows,
          dailyEntries: rebuilt.dailyEntries,
          updatedAt: now
        }
      })
      return { code: 'OK', _id }
    }

    return { code: 'INVALID_PARAM', message: '未知 action' }
  } catch (e) {
    console.error('holdingFlow', e)
    return { code: 'SYNC_FAILED', message: '同步失败，请重试' }
  }
}
