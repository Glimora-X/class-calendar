Component({
  properties: {
    value: { type: String, value: '' },
    /** string[] */
    suggestions: { type: Array, value: [] },
    placeholder: { type: String, value: '' },
    label: { type: String, value: '' },
    /** 半宽并排时缩短标签宽度 */
    compact: { type: Boolean, value: false },
    /**
     * 布局：row（输入联想）| stack（点选优先，适合约课卡片）
     */
    layout: { type: String, value: 'row' },
    /** stack 模式下左侧色块：purple|green|blue|orange|yellow */
    iconTone: { type: String, value: 'blue' },
    /** stack 图标内文字 */
    iconText: { type: String, value: '' },
    showChevron: { type: Boolean, value: true }
  },
  data: {
    filtered: [],
    open: false,
    /** 手动输入弹层 */
    showManual: false,
    draftName: '',
    manualFocus: false
  },
  observers: {
    'value, suggestions': function (value, suggestions) {
      if (this.data.layout === 'stack') return
      this.refreshFilter(value, suggestions)
    },
    layout: function (layout) {
      if (layout === 'stack') {
        this.setData({ open: false, showManual: false, manualFocus: false })
      }
    }
  },
  methods: {
    refreshFilter(value, suggestions) {
      const q = String(value || '').trim()
      const list = suggestions || []
      let filtered = list
      if (q) {
        filtered = list.filter((n) => String(n).indexOf(q) !== -1)
      }
      filtered = filtered.slice(0, 8)
      this.setData({
        filtered,
        open: !!(filtered.length && (!q || filtered.indexOf(q) === -1))
      })
    },

    /** stack：点整行 → ActionSheet 选人 / 手动输入弹层 */
    onTapField() {
      if (this.data.showManual) return
      const list = (this.data.suggestions || []).filter(Boolean).slice(0, 6)
      if (!list.length) {
        this.openManualModal()
        return
      }
      const itemList = list.concat(['＋ 手动输入'])
      wx.showActionSheet({
        itemList,
        success: (res) => {
          const idx = res.tapIndex
          if (idx === itemList.length - 1) {
            // 等 ActionSheet 完全收起再弹层，否则键盘/焦点会失效
            setTimeout(() => this.openManualModal(), 320)
            return
          }
          const name = list[idx]
          if (!name) return
          this.triggerEvent('input', { value: name })
          this.triggerEvent('select', { value: name })
        }
      })
    },

    openManualModal() {
      this.setData({
        showManual: true,
        draftName: this.data.value || '',
        manualFocus: false
      })
      setTimeout(() => {
        this.setData({ manualFocus: true })
      }, 80)
    },

    onDraftInput(e) {
      this.setData({ draftName: e.detail.value })
    },

    onManualCancel() {
      this.setData({ showManual: false, manualFocus: false, draftName: '' })
    },

    onManualOk() {
      const name = String(this.data.draftName || '').trim()
      if (!name) {
        wx.showToast({ title: `请输入${this.data.label || '名称'}`, icon: 'none' })
        return
      }
      this.triggerEvent('input', { value: name })
      this.triggerEvent('select', { value: name })
      this.setData({ showManual: false, manualFocus: false, draftName: '' })
    },

    onMaskTap() {
      // 点遮罩不关闭，避免误触丢输入；只能取消/确定
    },

    onInput(e) {
      const value = e.detail.value
      this.triggerEvent('input', { value })
      this.refreshFilter(value, this.data.suggestions)
      const filtered = this.data.filtered
      this.setData({
        open: !!(filtered && filtered.length)
      })
    },

    onFocus() {
      this.refreshFilter(this.data.value, this.data.suggestions)
      const q = String(this.data.value || '').trim()
      const list = this.data.suggestions || []
      const filtered = q
        ? list.filter((n) => String(n).indexOf(q) !== -1).slice(0, 8)
        : list.slice(0, 8)
      this.setData({
        filtered,
        open: filtered.length > 0
      })
    },

    onBlur() {
      setTimeout(() => this.setData({ open: false }), 280)
    },

    onPickTouch(e) {
      const name = e.currentTarget.dataset.name
      if (!name) return
      this.triggerEvent('input', { value: name })
      this.triggerEvent('select', { value: name })
      this.setData({ open: false })
    },

    onPick(e) {
      this.onPickTouch(e)
    }
  }
})
