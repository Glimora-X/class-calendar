Component({
  properties: {
    /** 科目列表 [{ _id, name }] */
    subjects: { type: Array, value: [] },
    /** 当前选中 subjectId */
    value: { type: String, value: '' },
    /** 是否允许新增 */
    allowAdd: { type: Boolean, value: true }
  },
  data: {
    currentName: '',
    adding: false,
    newName: ''
  },
  observers: {
    'subjects, value': function (subjects, value) {
      const list = subjects || []
      const hit = list.find((s) => s._id === value)
      this.setData({
        currentName: hit ? hit.name : (list[0] && list[0].name) || '未选择'
      })
    }
  },
  methods: {
    onPick() {
      const list = this.data.subjects || []
      if (!list.length) {
        wx.showToast({ title: '暂无科目', icon: 'none' })
        return
      }
      const names = list.map((s) => s.name)
      if (this.data.allowAdd) names.push('＋ 新增科目')
      wx.showActionSheet({
        itemList: names,
        success: (res) => {
          const idx = res.tapIndex
          if (this.data.allowAdd && idx === names.length - 1) {
            this.setData({ adding: true, newName: '' })
            return
          }
          const selected = list[idx]
          if (selected) {
            this.triggerEvent('change', {
              subjectId: selected._id,
              subjectName: selected.name
            })
          }
        }
      })
    },
    onNewNameInput(e) {
      this.setData({ newName: e.detail.value })
    },
    onCancelAdd() {
      this.setData({ adding: false, newName: '' })
    },
    onConfirmAdd() {
      const name = (this.data.newName || '').trim()
      if (!name) {
        wx.showToast({ title: '请输入科目名', icon: 'none' })
        return
      }
      this.triggerEvent('add', { name })
      this.setData({ adding: false, newName: '' })
    }
  }
})
