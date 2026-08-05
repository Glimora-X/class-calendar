const {
  fetchNameList,
  updateStudent,
  removeStudent
} = require('../../services/name-list')
const { teacherInitial } = require('../../utils/booking-status')
const { showApiError } = require('../../utils/errors')

const NOTE_MAX = 200

Page({
  data: {
    isEdit: false,
    fromName: '',
    name: '',
    initial: '?',
    avatarFileID: '',
    avatarUrl: '',
    note: '',
    noteLen: 0,
    noteMax: NOTE_MAX,
    saving: false
  },

  async onLoad(query) {
    const fromName = decodeURIComponent((query && query.name) || '')
    const isEdit = !!fromName
    wx.setNavigationBarTitle({ title: isEdit ? '编辑学员' : '新增学员' })
    this.setData({
      isEdit,
      fromName,
      name: fromName,
      initial: teacherInitial(fromName)
    })

    if (!isEdit) return

    try {
      const listRes = await fetchNameList({ force: true })
      const hit = (listRes.students || []).find((s) => {
        const n = typeof s === 'string' ? s : s && s.name
        return n === fromName
      })
      if (!hit) {
        wx.showToast({ title: '未找到该学员', icon: 'none' })
        return
      }
      await this.applyStudent(typeof hit === 'string' ? { name: hit } : hit)
    } catch (err) {
      showApiError(err)
    }
  },

  async applyStudent(s) {
    const patch = {
      name: s.name || '',
      initial: teacherInitial(s.name),
      avatarFileID: s.avatarFileID || '',
      note: s.note || '',
      noteLen: String(s.note || '').length,
      avatarUrl: ''
    }
    if (s.avatarFileID && wx.cloud && wx.cloud.getTempFileURL) {
      try {
        const r = await wx.cloud.getTempFileURL({ fileList: [s.avatarFileID] })
        const f = r.fileList && r.fileList[0]
        if (f && f.tempFileURL) patch.avatarUrl = f.tempFileURL
      } catch (e) {
        /* ignore */
      }
    }
    this.setData(patch)
  },

  onNameInput(e) {
    const name = e.detail.value || ''
    this.setData({ name, initial: teacherInitial(name) })
  },

  onNoteInput(e) {
    const note = String(e.detail.value || '').slice(0, NOTE_MAX)
    this.setData({ note, noteLen: note.length })
  },

  onPickAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const file = res.tempFiles && res.tempFiles[0]
        if (!file || !file.tempFilePath) return
        this.uploadAvatar(file.tempFilePath)
      },
      fail: () => {
        wx.chooseImage({
          count: 1,
          success: (r) => {
            const path = r.tempFilePaths && r.tempFilePaths[0]
            if (path) this.uploadAvatar(path)
          }
        })
      }
    })
  },

  uploadAvatar(tempFilePath) {
    if (!wx.cloud || !wx.cloud.uploadFile) {
      wx.showToast({ title: '请开通云开发', icon: 'none' })
      return
    }
    wx.showLoading({ title: '上传中', mask: true })
    const cloudPath = `student-avatars/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.jpg`
    wx.cloud.uploadFile({
      cloudPath,
      filePath: tempFilePath,
      success: (up) => {
        const fileID = up.fileID
        this.setData({ avatarFileID: fileID, avatarUrl: tempFilePath })
        wx.hideLoading()
        wx.showToast({ title: '已选头像', icon: 'success' })
      },
      fail: (err) => {
        wx.hideLoading()
        showApiError(err || { message: '上传失败' })
      }
    })
  },

  async onSave() {
    if (this.data.saving) return
    const name = String(this.data.name || '').trim()
    if (!name) {
      wx.showToast({ title: '请填写名字', icon: 'none' })
      return
    }
    this.setData({ saving: true })
    try {
      await updateStudent({
        fromName: this.data.isEdit ? this.data.fromName : '',
        student: {
          name,
          avatarFileID: this.data.avatarFileID || '',
          note: this.data.note || ''
        }
      })
      wx.showToast({ title: '已保存', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 500)
    } catch (err) {
      showApiError(err)
    } finally {
      this.setData({ saving: false })
    }
  },

  onDelete() {
    const name = this.data.fromName
    if (!name) return
    wx.showModal({
      title: '删除学员？',
      content: '仅从名单移除，不会删除已有约课记录。',
      confirmColor: '#ef4444',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await removeStudent(name)
          wx.showToast({ title: '已删除', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 500)
        } catch (err) {
          showApiError(err)
        }
      }
    })
  }
})
