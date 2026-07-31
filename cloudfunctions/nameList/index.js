const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const COLOR_PALETTE = ['accent', 'pro', 'success', 'warning']

/**
 * 入参: {} | { type: 'student'|'teacher', name }
 * 出参: { teachers, students }
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

    const type = payload.type
    const name = String(payload.name || '').trim()

    if (type && name) {
      if (type === 'teacher') {
        const teachers = record.teachers || []
        if (!teachers.find((t) => t.name === name)) {
          teachers.push({
            name,
            color: COLOR_PALETTE[teachers.length % COLOR_PALETTE.length]
          })
          record.teachers = teachers
        }
      } else if (type === 'student') {
        const students = record.students || []
        if (students.indexOf(name) === -1) {
          students.push(name)
          record.students = students
        }
      }

      const now = new Date().toISOString()
      if (found.data && found.data[0] && found.data[0]._id) {
        await col.doc(found.data[0]._id).update({
          data: {
            students: record.students || [],
            teachers: record.teachers || [],
            updatedAt: now
          }
        })
      } else {
        await col.add({
          data: {
            _openid: OPENID,
            students: record.students || [],
            teachers: record.teachers || [],
            updatedAt: now
          }
        })
      }
    }

    return {
      teachers: record.teachers || [],
      students: record.students || []
    }
  } catch (e) {
    console.error('nameList', e)
    return { code: 'SYNC_FAILED', message: '同步失败，请重试' }
  }
}
