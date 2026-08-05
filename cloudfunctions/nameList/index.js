const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const COLOR_PALETTE = ['accent', 'pro', 'success', 'warning']
const NOTE_MAX = 200

/**
 * 入参:
 *   {} | { type, name }  — 兼容旧 append
 *   { action: 'updateTeacher', fromName, teacher }
 *   { action: 'removeTeacher', name }
 *   { action: 'updateStudent', fromName, student }
 *   { action: 'removeStudent', name }
 * 出参: { teachers, students } | { code, message }
 */
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const payload = event || {}
  const col = db.collection('name_lists')

  try {
    const found = await col.where({ _openid: OPENID }).limit(1).get()
    let record = found.data && found.data[0]
      ? found.data[0]
      : { students: [], teachers: [] }
    const docId = found.data && found.data[0] && found.data[0]._id

    // 读时规范化：旧 string[] 学员 → 对象
    record.students = normalizeStudentList(record.students)

    const action = payload.action

    if (action === 'updateTeacher') {
      const result = await handleUpdateTeacher(OPENID, record, docId, col, payload)
      if (result.code) return result
      record = result.record
    } else if (action === 'removeTeacher') {
      const result = await handleRemoveTeacher(record, docId, col, payload)
      if (result.code) return result
      record = result.record
    } else if (action === 'updateStudent') {
      const result = await handleUpdateStudent(OPENID, record, docId, col, payload)
      if (result.code) return result
      record = result.record
    } else if (action === 'removeStudent') {
      const result = await handleRemoveStudent(record, docId, col, payload)
      if (result.code) return result
      record = result.record
    } else {
      const type = payload.type
      const name = String(payload.name || '').trim()
      if (type && name) {
        record = await handleAppend(record, docId, col, type, name)
      }
    }

    return {
      teachers: record.teachers || [],
      students: normalizeStudentList(record.students)
    }
  } catch (e) {
    console.error('nameList', e)
    return { code: 'SYNC_FAILED', message: '同步失败，请重试' }
  }
}

async function persist(col, docId, record, OPENID) {
  const now = new Date().toISOString()
  const students = normalizeStudentList(record.students)
  const teachers = record.teachers || []
  if (docId) {
    await col.doc(docId).update({
      data: { students, teachers, updatedAt: now }
    })
  } else {
    const addRes = await col.add({
      data: {
        _openid: OPENID,
        students,
        teachers,
        updatedAt: now
      }
    })
    return addRes._id
  }
  return docId
}

function normalizeStudentList(list) {
  const out = []
  const seen = {}
  ;(list || []).forEach((s) => {
    if (typeof s === 'string') {
      const name = s.trim()
      if (!name || seen[name]) return
      seen[name] = true
      out.push({ name })
      return
    }
    if (!s || typeof s !== 'object') return
    const name = String(s.name || '').trim()
    if (!name || seen[name]) return
    seen[name] = true
    const row = { name }
    const avatarFileID = String(s.avatarFileID || '').trim()
    const note = String(s.note || '').trim().slice(0, NOTE_MAX)
    if (avatarFileID) row.avatarFileID = avatarFileID
    if (note) row.note = note
    out.push(row)
  })
  return out
}

function normalizeStudent(input) {
  const raw = input || {}
  const name = String(raw.name || '').trim()
  const note = String(raw.note || '').trim().slice(0, NOTE_MAX)
  const avatarFileID = String(raw.avatarFileID || '').trim()
  const out = { name }
  if (avatarFileID) out.avatarFileID = avatarFileID
  if (note) out.note = note
  return out
}

async function handleAppend(record, docId, col, type, name) {
  const { OPENID } = cloud.getWXContext()
  if (type === 'teacher') {
    const teachers = (record.teachers || []).slice()
    if (!teachers.find((t) => t.name === name)) {
      teachers.push({
        name,
        color: COLOR_PALETTE[teachers.length % COLOR_PALETTE.length]
      })
      record.teachers = teachers
      await persist(col, docId, record, OPENID)
    }
  } else if (type === 'student') {
    const students = normalizeStudentList(record.students)
    if (!students.find((s) => s.name === name)) {
      students.push({ name })
      record.students = students
      await persist(col, docId, record, OPENID)
    }
  }
  return record
}

function normalizeTeacher(input, fallbackColor) {
  const raw = input || {}
  const name = String(raw.name || '').trim()
  const note = String(raw.note || '').trim().slice(0, NOTE_MAX)
  const subjectId = String(raw.subjectId || '').trim()
  const subjectName = String(raw.subjectName || '').trim()
  const avatarFileID = String(raw.avatarFileID || '').trim()
  const color = String(raw.color || fallbackColor || COLOR_PALETTE[0]).trim()
  const priceRaw = raw.pricePerLesson
  let pricePerLesson = null
  if (priceRaw != null && priceRaw !== '') {
    const n = Math.round(Number(priceRaw) * 10) / 10
    if (Number.isFinite(n) && n >= 0) pricePerLesson = n
  }
  const out = { name, color }
  if (avatarFileID) out.avatarFileID = avatarFileID
  if (subjectId) out.subjectId = subjectId
  if (subjectName) out.subjectName = subjectName
  if (note) out.note = note
  if (pricePerLesson != null) out.pricePerLesson = pricePerLesson
  return out
}

async function handleUpdateTeacher(OPENID, record, docId, col, payload) {
  const fromName = String(payload.fromName || '').trim()
  const next = normalizeTeacher(
    payload.teacher,
    COLOR_PALETTE[(record.teachers || []).length % COLOR_PALETTE.length]
  )
  if (!next.name) {
    return { code: 'INVALID_PARAM', message: '请填写老师姓名' }
  }

  let teachers = (record.teachers || []).slice()
  let idx = -1
  if (fromName) {
    idx = teachers.findIndex((t) => t.name === fromName)
  }

  if (idx < 0) {
    if (teachers.find((t) => t.name === next.name)) {
      return { code: 'DUPLICATE', message: '已存在同名老师' }
    }
    if (!next.color) {
      next.color = COLOR_PALETTE[teachers.length % COLOR_PALETTE.length]
    }
    teachers.push(next)
  } else {
    const dup = teachers.find((t, i) => i !== idx && t.name === next.name)
    if (dup) {
      return { code: 'DUPLICATE', message: '已存在同名老师' }
    }
    const prev = teachers[idx] || {}
    teachers[idx] = Object.assign({}, prev, next)
    const raw = payload.teacher || {}
    if (raw.avatarFileID === '') delete teachers[idx].avatarFileID
    if (raw.subjectId === '') {
      delete teachers[idx].subjectId
      delete teachers[idx].subjectName
    }
    if (raw.note === '') delete teachers[idx].note
    if (raw.pricePerLesson === '' || raw.pricePerLesson == null) {
      if (raw.pricePerLesson === '') delete teachers[idx].pricePerLesson
    }

    if (fromName && next.name !== fromName) {
      await renameBookingsField(OPENID, 'teacherName', fromName, next.name)
    }
  }

  record.teachers = teachers
  await persist(col, docId, record, OPENID)
  return { record }
}

async function handleUpdateStudent(OPENID, record, docId, col, payload) {
  const fromName = String(payload.fromName || '').trim()
  const next = normalizeStudent(payload.student)
  if (!next.name) {
    return { code: 'INVALID_PARAM', message: '请填写学员姓名' }
  }

  let students = normalizeStudentList(record.students)
  let idx = -1
  if (fromName) {
    idx = students.findIndex((s) => s.name === fromName)
  }

  if (idx < 0) {
    if (students.find((s) => s.name === next.name)) {
      return { code: 'DUPLICATE', message: '已存在同名学员' }
    }
    students.push(next)
  } else {
    const dup = students.find((s, i) => i !== idx && s.name === next.name)
    if (dup) {
      return { code: 'DUPLICATE', message: '已存在同名学员' }
    }
    const prev = students[idx] || {}
    students[idx] = Object.assign({}, prev, next)
    const raw = payload.student || {}
    if (raw.avatarFileID === '') delete students[idx].avatarFileID
    if (raw.note === '') delete students[idx].note

    if (fromName && next.name !== fromName) {
      await renameBookingsField(OPENID, 'studentName', fromName, next.name)
    }
  }

  record.students = students
  await persist(col, docId, record, OPENID)
  return { record }
}

async function renameBookingsField(OPENID, field, fromName, toName) {
  const where = { _openid: OPENID }
  where[field] = fromName
  const data = {}
  data[field] = toName

  const MAX = 100
  let skip = 0
  for (;;) {
    const res = await db
      .collection('bookings')
      .where(where)
      .skip(skip)
      .limit(MAX)
      .get()
    const rows = (res && res.data) || []
    if (!rows.length) break
    await Promise.all(
      rows.map((row) =>
        db.collection('bookings').doc(row._id).update({ data })
      )
    )
    if (rows.length < MAX) break
    skip += rows.length
  }
}

async function handleRemoveTeacher(record, docId, col, payload) {
  const { OPENID } = cloud.getWXContext()
  const name = String(payload.name || '').trim()
  if (!name) {
    return { code: 'INVALID_PARAM', message: '缺少老师姓名' }
  }
  const teachers = (record.teachers || []).filter((t) => t.name !== name)
  if (teachers.length === (record.teachers || []).length) {
    return { code: 'NOT_FOUND', message: '未找到该老师' }
  }
  record.teachers = teachers
  await persist(col, docId, record, OPENID)
  return { record }
}

async function handleRemoveStudent(record, docId, col, payload) {
  const { OPENID } = cloud.getWXContext()
  const name = String(payload.name || '').trim()
  if (!name) {
    return { code: 'INVALID_PARAM', message: '缺少学员姓名' }
  }
  const students = normalizeStudentList(record.students)
  const next = students.filter((s) => s.name !== name)
  if (next.length === students.length) {
    return { code: 'NOT_FOUND', message: '未找到该学员' }
  }
  record.students = next
  await persist(col, docId, record, OPENID)
  return { record }
}
