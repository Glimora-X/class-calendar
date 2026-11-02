const rules = require('../../../domain/finance/accounts/rules')
const vault = require('../../../services/vault')

Page({
  data: {
    loading: true,
    error: '',
    empty: false,
    status: '',
    name: '',
    rows: [],
    spark: [],
    picked: '',
    accountId: ''
  },

  onLoad(query) {
    this.accountId = query.accountId || ''
    this._coords = []
  },

  onShow() {
    this.load()
  },

  async load() {
    this.setData({ loading: true, error: '' })
    try {
      const result = await vault.loadVault()
      const account = (result.accounts || []).find((item) => item.id === this.accountId)
      if (!account) {
        this.setData({ loading: false, error: '找不到这个账户' })
        return
      }
      const timeline = rules.buildTimeline(account, result.accounts || [], result.snapshots || [])
      this.setData({
        loading: false,
        empty: timeline.empty,
        status: timeline.status,
        name: timeline.accountName,
        rows: timeline.rows.map((row, index) => Object.assign({ key: index + '-' + (row.kind || 'point') + '-' + (row.date || '') }, row)),
        spark: timeline.spark,
        accountId: account.id,
        picked: ''
      }, () => this.drawSpark())
    } catch (error) {
      this.setData({ loading: false, error: '历史加载失败' })
    }
  },

  onRetry() {
    this.load()
  },

  drawSpark() {
    const spark = this.data.spark || []
    if (!spark.length) return
    wx.createSelectorQuery().in(this).select('#spark').boundingClientRect((rect) => {
      if (!rect || !rect.width) return
      const ctx = wx.createCanvasContext('spark', this)
      const width = rect.width
      const height = rect.height
      const values = spark.map((point) => point.amount)
      const min = Math.min.apply(null, values)
      const max = Math.max.apply(null, values)
      const span = max - min || 1
      this._coords = spark.map((point, index) => ({
        x: spark.length === 1 ? width / 2 : (width * index) / (spark.length - 1),
        y: height - 16 - ((point.amount - min) / span) * (height - 32)
      }))
      ctx.setStrokeStyle('#3B82F6')
      ctx.setLineWidth(2)
      ctx.beginPath()
      this._coords.forEach((coord, index) => {
        if (index === 0) ctx.moveTo(coord.x, coord.y)
        else ctx.lineTo(coord.x, coord.y)
      })
      ctx.stroke()
      this._coords.forEach((coord) => {
        ctx.beginPath()
        ctx.setFillStyle('#3B82F6')
        ctx.arc(coord.x, coord.y, 4, 0, Math.PI * 2)
        ctx.fill()
      })
      ctx.draw()
    }).exec()
  },

  onSpark(e) {
    const touch = e.touches && e.touches[0]
    if (!touch || !this._coords.length) return
    let best = 0
    let dist = Infinity
    this._coords.forEach((coord, index) => {
      const gap = Math.abs(coord.x - touch.x)
      if (gap < dist) {
        dist = gap
        best = index
      }
    })
    const point = this.data.spark[best]
    if (!point) return
    this.setData({ picked: point.date + '  ' + point.amountText + '  ' + point.marker })
  },

})
