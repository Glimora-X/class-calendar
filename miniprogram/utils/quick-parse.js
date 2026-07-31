/**
 * 快捷解析（契约 §4.1）
 * 姓名/科目优先匹配 knownNames，匹配不到再兜底
 */

const { DEFAULT_SUBJECT_NAME } = require('./constants')
const { pad } = require('./format')

const DATE_RE = /(\d{1,2})[.月](\d{1,2})号?/
const TIME_RE = /(\d{1,2}):(\d{2})\s*[-~至]\s*(\d{1,2}):(\d{2})/

/**
 * @typedef {object} KnownNames
 * @property {string[]} students
 * @property {string[]} teachers
 * @property {string[]} subjects
 */

/**
 * @param {string} text
 * @param {number} viewingYear
 * @param {KnownNames} knownNames
 * @returns {{ ok: true, data: object } | { ok: false, error: string }}
 */
function parseQuickInput(text, viewingYear, knownNames) {
  const names = knownNames || { students: [], teachers: [], subjects: [] }
  const dateMatch = text.match(DATE_RE)
  const timeMatch = text.match(TIME_RE)
  if (!dateMatch || !timeMatch) {
    return { ok: false, error: '没识别出日期或时间，请检查格式' }
  }

  const month = dateMatch[1]
  const day = dateMatch[2]
  const sh = timeMatch[1]
  const sm = timeMatch[2]
  const eh = timeMatch[3]
  const em = timeMatch[4]

  const matchedTeacher = (names.teachers || []).find((t) => text.indexOf(t) !== -1)
  const matchedSubject = (names.subjects || []).find((s) => text.indexOf(s) !== -1)
  const matchedStudent = (names.students || []).find((s) => text.indexOf(s) !== -1)

  let studentName = matchedStudent || ''
  if (!studentName) {
    let stripped = text.replace(DATE_RE, '').replace(TIME_RE, '')
    if (matchedTeacher) stripped = stripped.split(matchedTeacher).join('')
    if (matchedSubject) stripped = stripped.split(matchedSubject).join('')
    studentName = stripped.replace(/[约，,。.\s]/g, '').trim()
  }

  return {
    ok: true,
    data: {
      date: `${viewingYear}-${pad(month)}-${pad(day)}`,
      startTime: `${pad(sh)}:${sm}`,
      endTime: `${pad(eh)}:${em}`,
      studentName: studentName || '',
      teacherName: matchedTeacher || '',
      subjectName: matchedSubject || DEFAULT_SUBJECT_NAME
    }
  }
}

module.exports = {
  parseQuickInput
}
