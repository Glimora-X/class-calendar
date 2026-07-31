const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

Component({
  properties: {
    year: { type: Number, value: 2026 },
    month: { type: Number, value: 1 },
    /** YYYY-MM-DD */
    selectedDate: { type: String, value: '' },
    /**
     * 有课日期标记
     * [{ date: 'YYYY-MM-DD', tone: 'primary'|'mint' }]
     */
    marks: { type: Array, value: [] }
  },
  data: {
    weekdays: WEEKDAYS,
    cells: []
  },
  observers: {
    'year, month, selectedDate, marks': function () {
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
        markMap[m.date] = m.tone || 'primary'
      })

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
        const tone = markMap[date]
        cells.push({
          key: date,
          empty: false,
          day: d,
          date,
          tone: tone || '',
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
