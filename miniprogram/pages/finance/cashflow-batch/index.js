const portfolio = require('../../../services/portfolio')
const { showApiError, showWriteError } = require('../../../utils/errors')
const { todayStr } = require('../../../utils/finance/money')

Page({
  data: {
    lockedId: '',
    holdings: [],
    productNames: [],
    productIndex: 0,
    types: ['申购', '赎回'],
    rows: [{ date: todayStr(), typeIndex: 0, amount: '', remark: '' }]
  },

  onLoad(query) {
    const id = (query && query.id) || ''
    this.setData({ lockedId: id })
    portfolio
      .listHoldings({}, { silent: true })
      .then((res) => {
        const holdings = ((res && res.list) || []).filter(
          (p) => p.status !== 'eliminated'
        )
        const productNames = holdings.map((p) => p.name.substring(0, 18))
        let productIndex = 0
        if (id) {
          const i = holdings.findIndex((p) => p._id === id)
          if (i >= 0) productIndex = i
        }
        this.setData({ holdings, productNames, productIndex })
      })
      .catch(showApiError)
  },

  onProduct(e) {
    this.setData({ productIndex: Number(e.detail.value) })
  },

  onAddRow() {
    const rows = this.data.rows.concat([
      { date: todayStr(), typeIndex: 0, amount: '', remark: '' }
    ])
    this.setData({ rows })
  },

  onDelRow(e) {
    const i = Number(e.currentTarget.dataset.i)
    const rows = this.data.rows.slice()
    rows.splice(i, 1)
    this.setData({ rows: rows.length ? rows : [{ date: todayStr(), typeIndex: 0, amount: '', remark: '' }] })
  },

  onRowDate(e) {
    const i = Number(e.currentTarget.dataset.i)
    this.setData({ ['rows[' + i + '].date']: e.detail.value })
  },
  onRowType(e) {
    const i = Number(e.currentTarget.dataset.i)
    this.setData({ ['rows[' + i + '].typeIndex']: Number(e.detail.value) })
  },
  onRowAmount(e) {
    const i = Number(e.currentTarget.dataset.i)
    this.setData({ ['rows[' + i + '].amount']: e.detail.value })
  },
  onRowRemark(e) {
    const i = Number(e.currentTarget.dataset.i)
    this.setData({ ['rows[' + i + '].remark']: e.detail.value })
  },

  onCancel() {
    wx.navigateBack()
  },

  onSave() {
    const h = this.data.holdings[this.data.productIndex]
    if (!h) {
      wx.showToast({ title: '请先选择产品', icon: 'none' })
      return
    }
    const rows = this.data.rows
      .map((r) => ({
        date: r.date,
        type: r.typeIndex === 1 ? 'redeem' : 'buy',
        amount: Number(r.amount),
        remark: r.remark
      }))
      .filter((r) => r.date && r.amount > 0)
    if (!rows.length) {
      wx.showToast({ title: '请至少填写一条', icon: 'none' })
      return
    }
    portfolio
      .batchCashflow({ _id: h._id, rows })
      .then(() => {
        wx.showToast({ title: '已保存', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 400)
      })
      .catch(showWriteError)
  }
})
