const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

Component({
  properties: {
    year: { type: Number, value: 2026 },
    month: { type: Number, value: 1 },
    /** YYYY-MM-DD */
    selectedDate: { type: String, value: '' },
    /**
     * 有课日期标记
     * [{ date, tone, count?, summary? }]
     */
    marks: { type: Array, value: [] },
    /** { 'YYYY-MM-DD': '国庆' } */
    holidays: { type: Object, value: {} }
  },
  data: {
    weekdays: WEEKDAYS,
    cells: []
  },
  observers: {
    'year, month, selectedDate, marks, holidays': function () {
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

      const first = new Date(year, month - 1, 1)
      const startWeekday = first.getDay()
      const daysInMonth = new Date(year, month, 0).getDate()
      const today = new Date()
      const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(
        today.getDate()
      )}`

      const cells = []
      for (let i = 0; i < startWeekday; i++) {
        cells.push({ key: `e-${i}`, empty: true })
      }
      for (let d = 1; d <= daysInMonth; d++) {
        const date = `${year}-${pad(month)}-${pad(d)}`
        const mark = markMap[date]
        const holiday = holidayMap[date] || ''
        const count = mark ? Number(mark.count) || 0 : 0
        const summary = (mark && mark.summary) || ''
        const dots = !summary && count > 0
          ? count === 1
            ? [1]
            : [1, 2]
          : []
        cells.push({
          key: date,
          empty: false,
          day: d,
          date,
          tone: (mark && mark.tone) || '',
          count,
          summary,
          dots,
          holiday,
          selected: date === selectedDate,
          isToday: date === todayStr
        })
      }
      this.setData({ cells })
    },
    onSelect(e) {
      const { date, empty } = e.currentTarget.dataset
      if (empty || !date) return
      this.triggerEvent('select', { date })
    }
  }
})

function pad(n) {
  return n < 10 ? `0${n}` : String(n)
}
