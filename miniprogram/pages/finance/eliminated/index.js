const portfolio = require('../../../services/portfolio')
const { showApiError, showWriteError } = require('../../../utils/errors')

Page({
  data: { list: [] },

  onShow() {
    this.reload()
  },

  reload() {
    portfolio
      .listHoldings({ status: 'eliminated' }, { silent: true })
      .then((res) => {
        this.setData({ list: (res && res.list) || [] })
      })
      .catch(showApiError)
  },

  onEdit(e) {
    wx.navigateTo({
      url: '/pages/finance/holding-form/index?id=' + e.currentTarget.dataset.id
    })
  },

  onRestore(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '还原产品',
      editable: true,
      placeholderText: '还原原因（必填）',
      success: (r) => {
        if (!r.confirm) return
        const note = (r.content || '').trim()
        if (!note) {
          wx.showToast({ title: '请填写还原备注', icon: 'none' })
          return
        }
        portfolio
          .setHoldingStatus({ action: 'restore', _id: id, note })
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
