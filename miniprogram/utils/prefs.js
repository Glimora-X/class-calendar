/**
 * 本地偏好：课程时长、提前提醒分钟
 */

const {
  DEFAULT_CLASS_DURATION_MINUTES,
  REMIND_MINUTES_BEFORE
} = require('./constants')

const STORAGE_KEY = 'pref:appSettings'

const DURATION_OPTIONS = [15, 20, 25, 30, 40, 45, 50, 60, 90]
const REMIND_OPTIONS = [5, 10, 15, 20, 30, 45, 60]

function clampDuration(n) {
  const v = Math.round(Number(n))
  if (!Number.isFinite(v)) return DEFAULT_CLASS_DURATION_MINUTES
  return Math.min(180, Math.max(5, v))
}

function clampRemind(n) {
  const v = Math.round(Number(n))
  if (!Number.isFinite(v)) return REMIND_MINUTES_BEFORE
  return Math.min(120, Math.max(1, v))
}

function readRaw() {
  try {
    const raw = wx.getStorageSync(STORAGE_KEY)
    return raw && typeof raw === 'object' ? raw : {}
  } catch (e) {
    return {}
  }
}

function getSettings() {
  const raw = readRaw()
  return {
    classDurationMinutes: clampDuration(
      raw.classDurationMinutes != null
        ? raw.classDurationMinutes
        : DEFAULT_CLASS_DURATION_MINUTES
    ),
    remindMinutesBefore: clampRemind(
      raw.remindMinutesBefore != null
        ? raw.remindMinutesBefore
        : REMIND_MINUTES_BEFORE
    )
  }
}

function getClassDurationMinutes() {
  return getSettings().classDurationMinutes
}

function getRemindMinutesBefore() {
  return getSettings().remindMinutesBefore
}

/**
 * @param {{ classDurationMinutes?: number, remindMinutesBefore?: number }} patch
 */
function setSettings(patch) {
  const cur = getSettings()
  const next = {
    classDurationMinutes:
      patch && patch.classDurationMinutes != null
        ? clampDuration(patch.classDurationMinutes)
        : cur.classDurationMinutes,
    remindMinutesBefore:
      patch && patch.remindMinutesBefore != null
        ? clampRemind(patch.remindMinutesBefore)
        : cur.remindMinutesBefore
  }
  try {
    wx.setStorageSync(STORAGE_KEY, next)
  } catch (e) {
    console.warn('[prefs] setSettings failed', e)
  }
  return next
}

function durationOptionIndex(minutes) {
  const v = clampDuration(minutes)
  const idx = DURATION_OPTIONS.indexOf(v)
  return idx >= 0 ? idx : DURATION_OPTIONS.indexOf(DEFAULT_CLASS_DURATION_MINUTES)
}

function remindOptionIndex(minutes) {
  const v = clampRemind(minutes)
  const idx = REMIND_OPTIONS.indexOf(v)
  return idx >= 0 ? idx : REMIND_OPTIONS.indexOf(REMIND_MINUTES_BEFORE)
}

module.exports = {
  DURATION_OPTIONS,
  REMIND_OPTIONS,
  getSettings,
  getClassDurationMinutes,
  getRemindMinutesBefore,
  setSettings,
  durationOptionIndex,
  remindOptionIndex
}
