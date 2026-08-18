const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

Component({
  properties: {
    year: { type: Number, value: 2026 },
    month: { type: Number, value: 1 },
    /** YYYY-MM-DD */
    selectedDate: { type: String, value: '' },
    /**
     * 有课日期标记
     * [{ date, tone, count?, summary?, tones?: string[] }]
     */
    marks: { type: Array, value: [] },
    /** { 'YYYY-MM-DD': '国庆' } */
    holidays: { type: Object, value: {} },
    /** { 'YYYY-MM-DD': reason } 其他安排 */
    holds: { type: Object, value: {} },
    /** [{ name, tone }] */
    legend: { type: Array, value: [] }
  },
  data: {
    weekdays: WEEKDAYS,
    cells: []
  },
  observers: {
    'year, month, selectedDate, marks, holidays, holds': function () {
      this.buildCells()
    }
  },
  lifetimes: {
    attached() {
      this.buildCells()
    }
  },
  methods: {
    buildCells() {
      const year = this.data.year
      const month = this.data.month
      const selectedDate = this.data.selectedDate
      const markMap = {}
      ;(this.data.marks || []).forEach((m) => {
        if (!m || !m.date) return
        markMap[m.date] = m
      })
      const holidayMap = this.data.holidays || {}
      const holdMap = this.data.holds || {}

      const first = new Date(year, month - 1, 1)
      const startWeekday = first.getDay()
      const daysInMonth = new Date(year, month, 0).getDate()
      const prevDays = new Date(year, month - 1, 0).getDate()
      const today = new Date()
      const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(
        today.getDate()
      )}`

      const cells = []
      for (let i = 0; i < startWeekday; i++) {
        const day = prevDays - startWeekday + i + 1
        cells.push({
          key: `p-${day}`,
          empty: false,
          otherMonth: true,
          disabled: true,
          day,
          date: '',
          tone: '',
          count: 0,
          summary: '',
          dots: [],
          holiday: '',
          isHold: false,
          selected: false,
          isToday: false
        })
      }
      for (let d = 1; d <= daysInMonth; d++) {
        const date = `${year}-${pad(month)}-${pad(d)}`
        const mark = markMap[date]
        const holiday = holidayMap[date] || ''
        const isHold = Object.prototype.hasOwnProperty.call(holdMap, date)
        const count = mark ? Number(mark.count) || 0 : 0
        const summary = (mark && mark.summary) || ''
        let dots = []
        if (!summary && mark) {
          if (Array.isArray(mark.tones) && mark.tones.length) {
            dots = mark.tones.map((t) => ({ tone: t || 'primary' }))
          } else if (count > 0) {
            const tone = (mark && mark.tone) || 'primary'
            dots = count === 1 ? [{ tone }] : [{ tone }, { tone }]
          }
        }
        cells.push({
          key: date,
          empty: false,
          otherMonth: false,
          disabled: false,
          day: d,
          date,
          tone: (mark && mark.tone) || '',
          count,
          summary,
          dots,
          holiday,
          isHold,
          selected: date === selectedDate,
          isToday: date === todayStr
        })
      }
      let nextDay = 1
      while (cells.length % 7 !== 0) {
        cells.push({
          key: `n-${nextDay}`,
          empty: false,
          otherMonth: true,
          disabled: true,
          day: nextDay,
          date: '',
          tone: '',
          count: 0,
          summary: '',
          dots: [],
          holiday: '',
          isHold: false,
          selected: false,
          isToday: false
        })
        nextDay += 1
      }
      this.setData({ cells })
    },
    onSelect(e) {
      const { date, empty, disabled } = e.currentTarget.dataset
      if (empty || disabled || !date) return
      this.triggerEvent('select', { date })
    }
  }
})

function pad(n) {
  return n < 10 ? `0${n}` : String(n)
}
