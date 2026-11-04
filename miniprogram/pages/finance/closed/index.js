const portfolio = require('../../../services/portfolio')
const { showApiError, showWriteError } = require('../../../utils/errors')
const { fmtMoney } = require('../../../utils/finance/money')
const { getReportedProfit } = require('../../../utils/finance/close-holding')

Page({
  data: { list: [] },

  onShow() {
    this.reload()
  },

  reload() {
    portfolio
      .listHoldings({ status: 'closed' }, { silent: true })
      .then((res) => {
        const raw = (res && res.list) || []
        const list = raw.map((item) => {
          const profit = getReportedProfit(item)
          return Object.assign({}, item, {
            profitText: (profit >= 0 ? '+' : '') + '¥' + fmtMoney(profit),
            profitTone: profit >= 0 ? 'pos' : 'neg'
          })
        })
        this.setData({ list })
      })
      .catch(showApiError)
  },

  onOpen(e) {
    wx.navigateTo({
      url: '/pages/finance/holding-detail/index?id=' + e.currentTarget.dataset.id
    })
  },

  onRestore(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '还原清仓',
      content: '将撤销清仓赎回，产品回到持有中。',
      success: (r) => {
        if (!r.confirm) return
        portfolio
          .setHoldingStatus({ action: 'restore', _id: id })
          .then(() => {
            wx.showToast({ title: '已还原', icon: 'success' })
            this.reload()
          })
          .catch(showWriteError)
      }
    })
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '永久删除',
      content: '此操作不可恢复，确认删除？',
      success: (r) => {
        if (!r.confirm) return
        portfolio
          .deleteHolding(id)
          .then(() => {
            wx.showToast({ title: '已删除', icon: 'success' })
            this.reload()
          })
          .catch(showWriteError)
      }
    })
  }
})
