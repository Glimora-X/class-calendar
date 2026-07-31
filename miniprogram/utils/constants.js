/**
 * 业务常量（色板、默认科目、缓存 key 前缀）
 */

const TEACHER_COLOR_PALETTE = ['accent', 'pro', 'success', 'warning']

const DEFAULT_SUBJECT_NAME = '英语'

const DEFAULT_TIME = {
  startTime: '19:30',
  endTime: '19:55'
}

const WEEKDAY_CN = ['日', '一', '二', '三', '四', '五', '六']

const CACHE_KEYS = {
  monthBookings: (monthKey) => `bookings:${monthKey}`,
  lastSubjectId: 'pref:lastSubjectId',
  nameLists: 'cache:nameLists'
}

const CLOUD_FUNCTIONS = {
  bookingList: 'bookingList',
  bookingUpsert: 'bookingUpsert',
  bookingDelete: 'bookingDelete',
  bookingBatchCreate: 'bookingBatchCreate',
  nameList: 'nameList',
  subjectList: 'subjectList',
  subjectUpsert: 'subjectUpsert'
}

module.exports = {
  TEACHER_COLOR_PALETTE,
  DEFAULT_SUBJECT_NAME,
  DEFAULT_TIME,
  WEEKDAY_CN,
  CACHE_KEYS,
  CLOUD_FUNCTIONS
}
