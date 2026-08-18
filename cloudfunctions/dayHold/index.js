const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const REASON_MAX = 20
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function normalizeReason(raw) {
  const reason = String(raw == null ? '' : raw).trim()
  if (!reason) return { ok: false, message: '写一下事由吧' }
  if (reason.length > REASON_MAX) {
    return { ok: false, message: `事由最多${REASON_MAX}个字` }
  }
  return { ok: true, reason }
}

/**
 * 入参:
 *   { action: 'list', start, end }
 *   { action: 'upsert', date, reason }
 *   { action: 'remove', date } | { action: 'remove', _id }
 * 出参: { list } | { code: 'OK', _id, date, reason } | 错误
 */
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const payload = event || {}
  const action = String(payload.action || 'list').trim()
  const col = db.collection('day_holds')

  try {
    if (action === 'list') {
      const { start, end } = payload
      if (!start || !end) {
        return { code: 'INVALID_PARAM', message: '缺少 start/end' }
      }
      const res = await col
        .where({
          _openid: OPENID,
          date: _.gte(start).and(_.lte(end))
        })
        .orderBy('date', 'asc')
        .limit(100)
        .get()
      return {
        list: (res.data || []).map((row) => ({
          _id: row._id,
          date: row.date,
          reason: row.reason || ''
        }))
      }
    }

    if (action === 'upsert') {
      const date = String(payload.date || '').trim()
      if (!DATE_RE.test(date)) {
        return { code: 'INVALID_PARAM', message: '日期不正确' }
      }
      const parsed = normalizeReason(payload.reason)
      if (!parsed.ok) {
        return { code: 'INVALID_PARAM', message: parsed.message }
      }
      const now = new Date().toISOString()
      const found = await col.where({ _openid: OPENID, date }).limit(1).get()
      const existing = found.data && found.data[0]
      if (existing && existing._id) {
        await col.doc(existing._id).update({
          data: {
            reason: parsed.reason,
            updatedAt: now
          }
        })
        return { code: 'OK', _id: existing._id, date, reason: parsed.reason }
      }
      const addRes = await col.add({
        data: {
          _openid: OPENID,
          date,
          reason: parsed.reason,
          createdAt: now,
          updatedAt: now
        }
      })
      return { code: 'OK', _id: addRes._id, date, reason: parsed.reason }
    }

    if (action === 'remove') {
      const now = new Date().toISOString()
      if (payload._id) {
        const doc = await col.doc(payload._id).get().catch(() => null)
        if (!doc || !doc.data) {
          return { code: 'NOT_FOUND', message: '记录不存在' }
        }
        if (doc.data._openid !== OPENID) {
          return { code: 'FORBIDDEN', message: '无权操作' }
        }
        await col.doc(payload._id).remove()
        return { code: 'OK', _id: payload._id, date: doc.data.date || '', removedAt: now }
      }
      const date = String(payload.date || '').trim()
      if (!DATE_RE.test(date)) {
        return { code: 'INVALID_PARAM', message: '日期不正确' }
      }
      const found = await col.where({ _openid: OPENID, date }).limit(1).get()
      const existing = found.data && found.data[0]
      if (!existing || !existing._id) {
        return { code: 'OK', date, removed: false }
      }
      await col.doc(existing._id).remove()
      return { code: 'OK', _id: existing._id, date, removed: true }
    }

    return { code: 'INVALID_PARAM', message: '未知 action' }
  } catch (e) {
    console.error('dayHold', e)
    return { code: 'SYNC_FAILED', message: '同步失败，请重试' }
  }
}
