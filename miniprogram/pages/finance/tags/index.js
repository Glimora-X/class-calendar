const portfolio = require('../../../services/portfolio')
const { showApiError, showWriteError } = require('../../../utils/errors')

Page({
  data: { tags: [] },

  onShow() {
    this.reload()
  },

  reload() {
    portfolio
      .listCatalog({ silent: true })
      .then((c) => this.setData({ tags: (c && c.tags) || [] }))
      .catch(showApiError)
  },

  onAdd() {
    wx.showModal({
      title: '新增标签',
      editable: true,
      placeholderText: '标签名称',
      success: (r) => {
        if (!r.confirm) return
        const value = (r.content || '').trim()
        if (!value) return
        portfolio
          .catalogAdd('tags', value)
          .then((c) => this.setData({ tags: c.tags || [] }))
          .catch(showWriteError)
      }
    })
  },

  onUpdate(e) {
    const i = Number(e.currentTarget.dataset.i)
    const value = (e.detail.value || '').trim()
    if (!value) return
    portfolio
      .catalogUpdate('tags', i, value)
      .then((c) => this.setData({ tags: c.tags || [] }))
      .catch(showWriteError)
  },

  onRemove(e) {
    const i = Number(e.currentTarget.dataset.i)
    portfolio
      .catalogRemove('tags', i)
      .then((c) => this.setData({ tags: c.tags || [] }))
      .catch(showWriteError)
  }
})
