const { fetchNameList } = require('../../services/name-list')
const { teacherInitial } = require('../../utils/booking-status')
const { showApiError } = require('../../utils/errors')

Page({
  data: {
    loading: true,
    students: []
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
      const students = await this.decorateStudents(res.students || [])
      this.setData({ students, loading: false })
    } catch (err) {
      this.setData({ loading: false })
      showApiError(err)
    }
  },

  async decorateStudents(list) {
    const rows = (list || [])
      .map((s) => {
        if (typeof s === 'string') return { name: s }
        return s || {}
      })
      .filter((s) => s.name)
      .slice()
      .sort((a, b) =>
        String(a.name || '').localeCompare(String(b.name || ''), 'zh')
      )
    const withFile = rows.filter((s) => s.avatarFileID)
    let urlMap = {}
    if (withFile.length && wx.cloud && wx.cloud.getTempFileURL) {
      try {
        const r = await wx.cloud.getTempFileURL({
          fileList: withFile.map((s) => s.avatarFileID)
        })
        ;(r.fileList || []).forEach((f) => {
          if (f.fileID && f.tempFileURL) urlMap[f.fileID] = f.tempFileURL
        })
      } catch (e) {
        /* 无头像 URL 时退回首字 */
      }
    }
    return rows.map((s) =>
      Object.assign({}, s, {
        initial: teacherInitial(s.name),
        avatarUrl: (s.avatarFileID && urlMap[s.avatarFileID]) || '',
        note: s.note ? String(s.note).slice(0, 40) : ''
      })
    )
  },

  onAdd() {
    wx.navigateTo({ url: '/pages/student-edit/index' })
  },

  onOpen(e) {
    const name = (e.currentTarget.dataset && e.currentTarget.dataset.name) || ''
    if (!name) return
    wx.navigateTo({
      url: `/pages/student-edit/index?name=${encodeURIComponent(name)}`
    })
  }
})
