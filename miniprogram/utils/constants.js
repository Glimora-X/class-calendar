/**
 * 业务常量（色板、默认科目、缓存 key 前缀）
 */

const { addMinutesToTime } = require('./format')

const TEACHER_COLOR_PALETTE = ['accent', 'pro', 'success', 'warning']

const DEFAULT_SUBJECT_NAME = '英语'

/** 新建约课默认时长（分钟）：结束时间 = 开始时间 + 该值 */
const DEFAULT_CLASS_DURATION_MINUTES = 25

/** 月历格子：单日约课超过该数时显示「N节」摘要 */
const DAY_CELL_SUMMARY_THRESHOLD = 2

const DEFAULT_TIME = {
  startTime: '19:30',
  endTime: addMinutesToTime('19:30', DEFAULT_CLASS_DURATION_MINUTES)
}

const WEEKDAY_CN = ['日', '一', '二', '三', '四', '五', '六']

/** 其他安排事由最长字数 */
const HOLD_REASON_MAX = 20

const CACHE_KEYS = {
  monthBookings: (monthKey) => `bookings:${monthKey}`,
  monthHolds: (monthKey) => `holds:${monthKey}`,
  lastSubjectId: 'pref:lastSubjectId',
  nameLists: 'cache:nameLists'
}

const CLOUD_FUNCTIONS = {
  bookingList: 'bookingList',
  bookingUpsert: 'bookingUpsert',
  bookingDelete: 'bookingDelete',
  bookingBatchCreate: 'bookingBatchCreate',
  bookingBatchDelete: 'bookingBatchDelete',
  bookingClearAll: 'bookingClearAll',
  nameList: 'nameList',
  subjectList: 'subjectList',
  subjectUpsert: 'subjectUpsert',
  reminderTick: 'reminderTick',
  dayHold: 'dayHold'
}

/** 课前提醒提前分钟数（与云函数一致） */
const REMIND_MINUTES_BEFORE = 10

/** 订阅消息「日程提醒」模板 ID（与 reminderTick / env.js 保持一致） */
const SUBSCRIBE_TMPL_ID = 'kB65FXHwme7-n-p-ilFQb4Ow35xBLM9Is7DjdAm9KiY'

module.exports = {
  TEACHER_COLOR_PALETTE,
  DEFAULT_SUBJECT_NAME,
  DEFAULT_CLASS_DURATION_MINUTES,
  DAY_CELL_SUMMARY_THRESHOLD,
  HOLD_REASON_MAX,
  DEFAULT_TIME,
  WEEKDAY_CN,
  CACHE_KEYS,
  CLOUD_FUNCTIONS,
  REMIND_MINUTES_BEFORE,
  SUBSCRIBE_TMPL_ID
}
