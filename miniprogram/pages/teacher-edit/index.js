const {
  fetchNameList,
  updateTeacher,
  removeTeacher
} = require('../../services/name-list')
const { listSubjects } = require('../../services/subject')
const { teacherInitial } = require('../../utils/booking-status')
const { showApiError } = require('../../utils/errors')
const { parsePriceInput, formatPriceInput } = require('../../utils/price')

const NOTE_MAX = 200

Page({
  data: {
    isEdit: false,
    fromName: '',
    name: '',
    initial: '?',
    avatarFileID: '',
    avatarUrl: '',
    subjectId: '',
    subjectName: '',
    priceText: '',
    note: '',
    noteLen: 0,
    noteMax: NOTE_MAX,
    subjects: [],
    saving: false,
    color: ''
  },

  async onLoad(query) {
    const fromName = decodeURIComponent((query && query.name) || '')
    const isEdit = !!fromName
    wx.setNavigationBarTitle({ title: isEdit ? '编辑老师' : '新增老师' })
    this.setData({ isEdit, fromName, name: fromName, initial: teacherInitial(fromName) })

    try {
      const [listRes, subRes] = await Promise.all([
        fetchNameList({ force: true }),
        listSubjects({ silent: true })
      ])
      const subjects = (subRes && subRes.list) || []
      this.setData({ subjects })

      if (isEdit) {
        const hit = (listRes.teachers || []).find((t) => t.name === fromName)
        if (!hit) {
          wx.showToast({ title: '未找到该老师', icon: 'none' })
          return
        }
        await this.applyTeacher(hit)
      }
    } catch (err) {
      showApiError(err)
    }
  },

  async applyTeacher(t) {
    const patch = {
      name: t.name || '',
      initial: teacherInitial(t.name),
      avatarFileID: t.avatarFileID || '',
      subjectId: t.subjectId || '',
      subjectName: t.subjectName || '',
      priceText: formatPriceInput(t.pricePerLesson),
      note: t.note || '',
      noteLen: String(t.note || '').length,
      color: t.color || '',
      avatarUrl: ''
    }
    if (t.avatarFileID && wx.cloud && wx.cloud.getTempFileURL) {
      try {
        const r = await wx.cloud.getTempFileURL({ fileList: [t.avatarFileID] })
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

  onPriceInput(e) {
    this.setData({ priceText: e.detail.value || '' })
  },

  onPickSubject() {
    const subjects = this.data.subjects || []
    if (!subjects.length) {
      wx.showToast({ title: '暂无科目，请先在约课中新增', icon: 'none' })
      return
    }
    const names = subjects.map((s) => s.name)
    names.push('清除主科')
    wx.showActionSheet({
      itemList: names,
      success: (res) => {
        const idx = res.tapIndex
        if (idx === names.length - 1) {
          this.setData({ subjectId: '', subjectName: '' })
          return
        }
        const s = subjects[idx]
        if (s) this.setData({ subjectId: s._id, subjectName: s.name })
      }
    })
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
        // 低版本兜底
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
    const cloudPath = `teacher-avatars/${Date.now()}-${Math.random()
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
      const parsedPrice = parsePriceInput(this.data.priceText)
      if (
        this.data.priceText !== '' &&
        this.data.priceText != null &&
        parsedPrice === null
      ) {
        wx.showToast({ title: '单价格式不正确', icon: 'none' })
        return
      }
      const teacher = {
        name,
        color: this.data.color || undefined,
        avatarFileID: this.data.avatarFileID || '',
        subjectId: this.data.subjectId || '',
        subjectName: this.data.subjectName || '',
        note: this.data.note || '',
        pricePerLesson:
          this.data.priceText === '' || this.data.priceText == null
            ? ''
            : parsedPrice
      }
      await updateTeacher({
        fromName: this.data.isEdit ? this.data.fromName : '',
        teacher
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
      title: '删除老师？',
      content: '仅从名单移除，不会删除已有约课记录。',
      confirmColor: '#ef4444',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await removeTeacher(name)
          wx.showToast({ title: '已删除', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 500)
        } catch (err) {
          showApiError(err)
        }
      }
    })
  }
})
