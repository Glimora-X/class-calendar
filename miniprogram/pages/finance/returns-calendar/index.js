const portfolio = require('../../../services/portfolio')
const { showApiError } = require('../../../utils/errors')
const { fmtMoney } = require('../../../utils/finance/money')
const {
  aggregateMonthReturns,
  formatDayReturnSummary
} = require('../../../utils/finance/returns-calendar')

function currentYearMonth() {
  const d = new Date()
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

Page({
  data: {
    year: 2026,
    month: 1,
    holdings: [],
    holdingId: '',
    chips: [],
    filterLabel: '全部产品',
    marks: [],
    monthTotal: 0,
    monthTotalText: '¥0.00',
    monthTone: 'neutral',
    dayCount: 0,
    hasCumulative: false,
    selectedDate: '',
    selectedDayText: '',
    selectedDayTone: 'neutral',
    selectedCumulative: false
  },

  onLoad() {
    const { year, month } = currentYearMonth()
    this.setData({ year, month })
  },

  onShow() {
    this.reload()
  },

  reload() {
    portfolio
      .listHoldings({}, { silent: true })
      .then((res) => {
        const holdings = ((res && res.list) || []).filter(
          (p) => p.status !== 'eliminated'
        )
        this.setData({ holdings })
        this.rebuild()
      })
      .catch((err) => {
        showApiError(err)
        this.setData({ holdings: [] })
        this.rebuild()
      })
  },

  rebuild() {
    const { holdings, year, month, holdingId, selectedDate } = this.data
    const chips = [
      { id: '', label: '全部', active: !holdingId }
    ].concat(
      holdings.map((h) => ({
        id: h._id,
        label: h.name || h.code || '未命名',
        active: holdingId === h._id
      }))
    )

    const agg = aggregateMonthReturns(holdings, { year, month, holdingId })
    const monthTotal = agg.monthTotal
    let monthTone = 'neutral'
    if (monthTotal > 0) monthTone = 'pos'
    else if (monthTotal < 0) monthTone = 'neg'

    const filterLabel = holdingId
      ? (holdings.find((h) => h._id === holdingId) || {}).name || '已选产品'
      : '全部产品'

    const hasCumulative = agg.marks.some((m) => m.isCumulative)

    let selectedDayText = ''
    let selectedDayTone = 'neutral'
    let selectedCumulative = false
    if (selectedDate && agg.dayMap[selectedDate] != null) {
      selectedDayText = formatDayReturnSummary(agg.dayMap[selectedDate])
      const amount = agg.dayMap[selectedDate]
      if (amount > 0) selectedDayTone = 'pos'
      else if (amount < 0) selectedDayTone = 'neg'
      selectedCumulative = !!agg.cumulativeDates[selectedDate]
    }

    const sign = monthTotal > 0 ? '+' : ''
    this.setData({
      chips,
      filterLabel,
      marks: agg.marks,
      monthTotal,
      monthTotalText: sign + '¥' + fmtMoney(monthTotal),
      monthTone,
      dayCount: agg.dayCount,
      hasCumulative,
      selectedDayText,
      selectedDayTone,
      selectedCumulative
    })
  },

  onFilterChange(e) {
    const id = (e.detail && e.detail.id) || ''
    this.setData({ holdingId: id, selectedDate: '' })
    this.rebuild()
  },

  onMonthChange(e) {
    const delta = (e.detail && e.detail.delta) || 0
    let { year, month } = this.data
    month += delta
    while (month < 1) {
      month += 12
      year -= 1
    }
    while (month > 12) {
      month -= 12
      year += 1
    }
    this.setData({ year, month, selectedDate: '' })
    this.rebuild()
  },

  onSelectDate(e) {
    const date = (e.detail && e.detail.date) || ''
    this.setData({ selectedDate: date })
    this.rebuild()
  }
})
