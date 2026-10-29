const portfolio = require('../../../services/portfolio')
const { showApiError, showWriteError } = require('../../../utils/errors')
const { todayStr, fmtMoney, fmtPct } = require('../../../utils/finance/money')
const { calcAllMetrics } = require('../../../utils/finance/metrics')
const { calcAdvice } = require('../../../utils/finance/advice')

Page({
  data: {
    id: '',
    holding: null,
    tab: 'metrics',
    principalText: '',
    resultRows: [],
    fullRows: [],
    stableRows: [],
    advice: { code: 'HOLD', score: 0, reasons: [] },
    dailyList: [],
    dailyCount: 0,
    cashflowList: [],
    cashflowCount: 0
  },

  onLoad(query) {
    this.setData({ id: (query && query.id) || '' })
  },

  onShow() {
    if (this.data.id) this.reload()
  },

  reload() {
    portfolio
      .getHolding(this.data.id)
      .then((res) => {
        const holding = res.holding
        if (!holding) {
          wx.showToast({ title: '记录不存在', icon: 'none' })
          return
        }
        this.applyHolding(holding)
      })
      .catch(showApiError)
  },

  applyHolding(holding) {
    const asOf = todayStr()
    const m = calcAllMetrics(holding, asOf)
    const advice = calcAdvice(holding, asOf)

    const resultRows = [
      { label: '最新余额', value: '¥' + fmtMoney(m.latestEOD) },
      {
        label: '有效本金',
        value: '¥' + fmtMoney(m.effectivePrincipal),
        hint: '= 申购 − 赎回'
      },
      { label: '净现金流', value: '¥' + fmtMoney(m.netCashflow) },
      {
        label: '累计收益',
        value: (m.cumulativeProfit >= 0 ? '+' : '') + '¥' + fmtMoney(m.cumulativeProfit)
      },
      { label: '持有收益率', value: fmtPct(m.cumulativeReturnRate) },
      { label: '持有天数', value: m.holdingDays + '天' }
    ]
    if (m.distToMaturity != null) {
      resultRows.push({
        label: '距到期',
        value:
          m.distToMaturity >= 0
            ? m.distToMaturity + '天'
            : '已到期' + Math.abs(m.distToMaturity) + '天'
      })
    }

    const fullRows = []
    if (m.twr != null) fullRows.push({ label: 'TWR', value: fmtPct(m.twr) })
    if (m.twrAnnualized != null) {
      fullRows.push({ label: '全周期年化', value: fmtPct(m.twrAnnualized) })
    }
    if (m.simpleAnnualized != null) {
      fullRows.push({ label: '单利年化', value: fmtPct(m.simpleAnnualized) })
    }
    if (m.complexAnnualized != null) {
      fullRows.push({ label: '复利年化', value: fmtPct(m.complexAnnualized) })
    }
    if (m.irr != null) fullRows.push({ label: 'IRR', value: fmtPct(m.irr) })
    if (m.recent7Day != null) {
      fullRows.push({ label: '近7日涨跌', value: fmtPct(m.recent7Day) })
    }

    const s = m.stable || {}
    const stableRows = [
      { label: '稳仓锚点日', value: s.anchorDate || '—' },
      { label: '锚点 EOD', value: '¥' + fmtMoney(s.anchorEOD) },
      { label: '稳仓天数', value: (s.stableDays || 0) + '天' }
    ]
    if (s.stableTWR != null) {
      stableRows.push({ label: '稳仓 TWR', value: fmtPct(s.stableTWR) })
    }
    if (s.stableAnnualized != null) {
      stableRows.push({ label: '稳仓后年化', value: fmtPct(s.stableAnnualized) })
    }
    if (s.per10kPerDay != null) {
      stableRows.push({ label: '元/万/日', value: fmtMoney(s.per10kPerDay) })
    }

    const dailyEntries = (holding.dailyEntries || []).slice().reverse().slice(0, 60)
    const dailyList = dailyEntries.map((e) => ({
      date: e.date,
      eodText: fmtMoney(e.eodBalance),
      retText: (e.dailyReturn >= 0 ? '+' : '') + Number(e.dailyReturn).toFixed(2),
      retTone: e.dailyReturn >= 0 ? 'pos' : 'neg'
    }))

    const cashflows = holding.cashflows || []
    const cashflowList = cashflows.map((cf, index) => ({
      index,
      date: cf.date,
      type: cf.type,
      remark: cf.remark || '',
      amountText: (cf.type === 'buy' ? '+' : '-') + '¥' + fmtMoney(cf.amount),
      tone: cf.type === 'buy' ? 'pos' : 'neg'
    }))

    this.setData({
      holding,
      principalText: fmtMoney(holding.principal),
      resultRows,
      fullRows,
      stableRows,
      advice: {
        code: advice.advice,
        score: advice.score,
        reasons: advice.reasons
      },
      dailyList,
      dailyCount: (holding.dailyEntries || []).length,
      cashflowList,
      cashflowCount: cashflows.length
    })
  },

  onTab(e) {
    this.setData({ tab: e.currentTarget.dataset.t })
  },

  onEdit() {
    wx.navigateTo({
      url: '/pages/finance/holding-form/index?id=' + this.data.id
    })
  },

  onDaily() {
    wx.navigateTo({
      url: '/pages/finance/daily-entry/index?id=' + this.data.id
    })
  },

  onCashflow() {
    wx.navigateTo({
      url: '/pages/finance/cashflow-batch/index?id=' + this.data.id
    })
  },

  onMature() {
    portfolio
      .setHoldingStatus({ action: 'mature', _id: this.data.id })
      .then(() => {
        wx.showToast({ title: '已标记到期', icon: 'success' })
        this.reload()
      })
      .catch(showWriteError)
  },

  onEliminate() {
    wx.showModal({
      title: '淘汰产品',
      editable: true,
      placeholderText: '请填写淘汰原因（必填）',
      success: (r) => {
        if (!r.confirm) return
        const reason = (r.content || '').trim()
        if (!reason) {
          wx.showToast({ title: '请填写淘汰原因', icon: 'none' })
          return
        }
        portfolio
          .setHoldingStatus({
            action: 'eliminate',
            _id: this.data.id,
            reason
          })
          .then(() => {
            wx.showToast({ title: '已淘汰', icon: 'success' })
            setTimeout(() => wx.navigateBack(), 400)
          })
          .catch(showWriteError)
      }
    })
  },

  onDelete() {
    wx.showModal({
      title: '删除产品',
      content: '将连同日流水、现金流一并删除，不可恢复。确认？',
      success: (r) => {
        if (!r.confirm) return
        portfolio
          .deleteHolding(this.data.id)
          .then(() => {
            wx.showToast({ title: '已删除', icon: 'success' })
            setTimeout(() => wx.navigateBack(), 400)
          })
          .catch(showWriteError)
      }
    })
  },

  onDelDaily(e) {
    const date = e.currentTarget.dataset.date
    wx.showModal({
      title: '删除日流水',
      content: '确认删除 ' + date + ' 的日流水？',
      success: (r) => {
        if (!r.confirm) return
        portfolio
          .removeDaily({ _id: this.data.id, date })
          .then(() => this.reload())
          .catch(showWriteError)
      }
    })
  },

  onDelCf(e) {
    const index = Number(e.currentTarget.dataset.index)
    wx.showModal({
      title: '删除现金流',
      content: '确认删除该笔记录？',
      success: (r) => {
        if (!r.confirm) return
        portfolio
          .removeCashflow({ _id: this.data.id, index })
          .then(() => this.reload())
          .catch(showWriteError)
      }
    })
  }
})
