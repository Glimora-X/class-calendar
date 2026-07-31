/**
 * 快捷解析（契约 §4.1）
 * 姓名/科目优先匹配 knownNames，匹配不到再兜底
 */

const { DEFAULT_SUBJECT_NAME } = require('./constants')
const { pad, formatDate } = require('./format')

const DATE_RE = /(\d{1,2})[.月](\d{1,2})号?/
const REL_DATE_RE = /(大后天|后天|明天|今天)/
const TIME_RE = /(\d{1,2})\s*[:：]\s*(\d{1,2})\s*[-~至]\s*(\d{1,2})\s*[:：]\s*(\d{1,2})/
const NOISE_RE = /[约，,。.\s]/g

const REL_OFFSET = {
  今天: 0,
  明天: 1,
  后天: 2,
  大后天: 3
}

/**
 * @typedef {object} KnownNames
 * @property {string[]} students
 * @property {string[]} teachers
 * @property {string[]} subjects
 */

/**
 * 长名优先，避免短名误伤
 * @param {string[]} list
 * @param {string} text
 * @returns {string}
 */
function matchLongest(list, text) {
  const sorted = (list || []).slice().sort((a, b) => b.length - a.length)
  return sorted.find((n) => n && text.indexOf(n) !== -1) || ''
}

/**
 * @param {string} text
 * @param {number} viewingYear
 * @param {Date} now
 * @returns {{ date: string, strip: (s: string) => string } | null}
 */
function extractDate(text, viewingYear, now) {
  const rel = text.match(REL_DATE_RE)
  if (rel) {
    const offset = REL_OFFSET[rel[1]]
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
    return {
      date: formatDate(d),
      strip: (s) => s.replace(REL_DATE_RE, '')
    }
  }

  const num = text.match(DATE_RE)
  if (num) {
    return {
      date: `${viewingYear}-${pad(num[1])}-${pad(num[2])}`,
      strip: (s) => s.replace(DATE_RE, '')
    }
  }

  return null
}

/**
 * 从去掉日期/时间/科目后的文本里拆学员与老师
 * 支持：空格分隔、「约」连接
 * @param {string} remnant
 * @returns {{ studentName: string, teacherName: string }}
 */
function splitStudentTeacher(remnant) {
  const raw = String(remnant || '').trim()
  if (!raw) return { studentName: '', teacherName: '' }

  if (raw.indexOf('约') !== -1) {
    const parts = raw.split('约')
    const studentName = (parts[0] || '').replace(NOISE_RE, '').trim()
    const teacherName = parts
      .slice(1)
      .join('')
      .replace(NOISE_RE, '')
      .trim()
    return { studentName, teacherName }
  }

  const tokens = raw.split(/\s+/).filter(Boolean)
  if (tokens.length >= 2) {
    return {
      studentName: tokens[0].replace(NOISE_RE, '').trim(),
      teacherName: tokens
        .slice(1)
        .join('')
        .replace(NOISE_RE, '')
        .trim()
    }
  }

  return {
    studentName: raw.replace(NOISE_RE, '').trim(),
    teacherName: ''
  }
}

/**
 * @param {string} text
 * @param {number} viewingYear
 * @param {KnownNames} knownNames
 * @param {Date} [now] 相对日期锚定，默认当前时间
 * @returns {{ ok: true, data: object } | { ok: false, error: string }}
 */
function parseQuickInput(text, viewingYear, knownNames, now) {
  const names = knownNames || { students: [], teachers: [], subjects: [] }
  const ref = now instanceof Date ? now : new Date()
  const dateInfo = extractDate(text, viewingYear, ref)
  const timeMatch = text.match(TIME_RE)
  if (!dateInfo || !timeMatch) {
    return { ok: false, error: '没识别出日期或时间，请检查格式' }
  }

  const sh = timeMatch[1]
  const sm = timeMatch[2]
  const eh = timeMatch[3]
  const em = timeMatch[4]

  const matchedTeacher = matchLongest(names.teachers, text)
  const matchedSubject = matchLongest(names.subjects, text)
  const matchedStudent = matchLongest(names.students, text)

  let studentName = matchedStudent || ''
  let teacherName = matchedTeacher || ''

  if (!studentName || !teacherName) {
    let stripped = dateInfo.strip(text).replace(TIME_RE, '')
    if (matchedSubject) stripped = stripped.split(matchedSubject).join('')
    if (matchedTeacher) stripped = stripped.split(matchedTeacher).join('')
    if (matchedStudent) stripped = stripped.split(matchedStudent).join('')

    if (studentName && !teacherName) {
      teacherName = stripped.replace(NOISE_RE, '').trim()
    } else if (teacherName && !studentName) {
      studentName = stripped.replace(NOISE_RE, '').trim()
    } else {
      const split = splitStudentTeacher(stripped)
      studentName = split.studentName
      teacherName = split.teacherName
    }
  }

  return {
    ok: true,
    data: {
      date: dateInfo.date,
      startTime: `${pad(sh)}:${pad(sm)}`,
      endTime: `${pad(eh)}:${pad(em)}`,
      studentName: studentName || '',
      teacherName: teacherName || '',
      subjectName: matchedSubject || DEFAULT_SUBJECT_NAME
    }
  }
}

module.exports = {
  parseQuickInput
}
