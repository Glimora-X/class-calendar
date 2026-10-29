const portfolio = require('../../../services/portfolio')
const { showApiError, showWriteError } = require('../../../utils/errors')

Page({
  data: { platforms: [], types: [] },

  onShow() {
    this.reload()
  },

  reload() {
    portfolio
      .listCatalog({ silent: true })
      .then((c) => {
        this.setData({
          platforms: (c && c.platforms) || [],
          types: (c && c.types) || []
        })
      })
      .catch(showApiError)
  },

  apply(c) {
    this.setData({
      platforms: (c && c.platforms) || [],
      types: (c && c.types) || []
    })
  },

  onAdd(e) {
    const field = e.currentTarget.dataset.field
    wx.showModal({
      title: field === 'platforms' ? '新增平台' : '新增类型',
      editable: true,
      placeholderText: '名称',
      success: (r) => {
        if (!r.confirm) return
        const value = (r.content || '').trim()
        if (!value) return
        portfolio
          .catalogAdd(field, value)
          .then((c) => this.apply(c))
          .catch(showWriteError)
      }
    })
  },

  onUpdate(e) {
    const field = e.currentTarget.dataset.field
    const i = Number(e.currentTarget.dataset.i)
    const value = (e.detail.value || '').trim()
    if (!value) return
    portfolio
      .catalogUpdate(field, i, value)
      .then((c) => this.apply(c))
      .catch(showWriteError)
  },

  onRemove(e) {
    const field = e.currentTarget.dataset.field
    const i = Number(e.currentTarget.dataset.i)
    portfolio
      .catalogRemove(field, i)
      .then((c) => this.apply(c))
      .catch(showWriteError)
  }
})
