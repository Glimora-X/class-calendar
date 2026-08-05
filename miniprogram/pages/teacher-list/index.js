const { fetchNameList } = require('../../services/name-list')
const { teacherInitial } = require('../../utils/booking-status')
const { showApiError } = require('../../utils/errors')

Page({
  data: {
    loading: true,
    teachers: []
  },

  onShow() {
    this.loadList()
  },

  onPullDownRefresh() {
    this.loadList(true).finally(() => wx.stopPullDownRefresh())
  },

  async loadList(force) {
    this.setData({ loading: true })
    try {
      const res = await fetchNameList({ force: !!force, silent: !force })
      const teachers = await this.decorateTeachers(res.teachers || [])
      this.setData({ teachers, loading: false })
    } catch (err) {
      this.setData({ loading: false })
      showApiError(err)
    }
  },

  async decorateTeachers(list) {
    const rows = (list || []).slice().sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''), 'zh')
    )
    const withFile = rows.filter((t) => t.avatarFileID)
    let urlMap = {}
    if (withFile.length && wx.cloud && wx.cloud.getTempFileURL) {
      try {
        const r = await wx.cloud.getTempFileURL({
          fileList: withFile.map((t) => t.avatarFileID)
        })
        ;(r.fileList || []).forEach((f) => {
          if (f.fileID && f.tempFileURL) urlMap[f.fileID] = f.tempFileURL
        })
      } catch (e) {
        /* 无头像 URL 时退回首字 */
      }
    }
    return rows.map((t) => {
      const price =
        t.pricePerLesson != null && t.pricePerLesson !== ''
          ? Number(t.pricePerLesson)
          : NaN
      const priceLabel = Number.isFinite(price) ? `${price}元/节` : ''
      return Object.assign({}, t, {
        initial: teacherInitial(t.name),
        avatarUrl: (t.avatarFileID && urlMap[t.avatarFileID]) || '',
        note: t.note ? String(t.note).slice(0, 40) : '',
        priceLabel
      })
    })
  },

  onAdd() {
    wx.navigateTo({ url: '/pages/teacher-edit/index' })
  },

  onOpen(e) {
    const name = (e.currentTarget.dataset && e.currentTarget.dataset.name) || ''
    if (!name) return
    wx.navigateTo({
      url: `/pages/teacher-edit/index?name=${encodeURIComponent(name)}`
    })
  }
})
