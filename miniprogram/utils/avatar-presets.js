/**
 * 老师默认头像（本地静态资源）
 */

const TEACHER_AVATAR_PRESETS = [
  { id: 't1', src: '/assets/avatars/teacher-1.jpg', label: '1' },
  { id: 't2', src: '/assets/avatars/teacher-2.jpg', label: '2' },
  { id: 't3', src: '/assets/avatars/teacher-3.jpg', label: '3' },
  { id: 't4', src: '/assets/avatars/teacher-4.jpg', label: '4' },
  { id: 't5', src: '/assets/avatars/teacher-5.jpg', label: '5' }
]

/**
 * @param {string} [presetId]
 * @returns {string}
 */
function teacherPresetSrc(presetId) {
  const id = String(presetId || '').trim()
  if (!id) return ''
  const hit = TEACHER_AVATAR_PRESETS.find((p) => p.id === id)
  return hit ? hit.src : ''
}

/**
 * 优先云文件 URL，其次默认头像
 * @param {{ avatarFileID?: string, avatarPreset?: string }} teacher
 * @param {Record<string, string>} [urlMap] fileID → tempURL
 * @returns {string}
 */
function resolveTeacherAvatarUrl(teacher, urlMap) {
  if (!teacher) return ''
  const fid = teacher.avatarFileID
  if (fid && urlMap && urlMap[fid]) return urlMap[fid]
  return teacherPresetSrc(teacher.avatarPreset)
}

module.exports = {
  TEACHER_AVATAR_PRESETS,
  teacherPresetSrc,
  resolveTeacherAvatarUrl
}
