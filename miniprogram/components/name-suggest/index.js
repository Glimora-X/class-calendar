Component({
  properties: {
    value: { type: String, value: '' },
    /** string[] */
    suggestions: { type: Array, value: [] },
    placeholder: { type: String, value: '' },
    label: { type: String, value: '' }
  },
  data: {
    filtered: [],
    open: false
  },
  observers: {
    'value, suggestions': function (value, suggestions) {
      this.refreshFilter(value, suggestions)
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
        open: !!(q && filtered.length && filtered.indexOf(q) === -1)
      })
    },
    onInput(e) {
      const value = e.detail.value
      this.triggerEvent('input', { value })
      this.refreshFilter(value, this.data.suggestions)
      const q = String(value || '').trim()
      const filtered = this.data.filtered
      this.setData({
        open: !!(q && filtered.length)
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
      setTimeout(() => this.setData({ open: false }), 180)
    },
    onPick(e) {
      const name = e.currentTarget.dataset.name
      if (!name) return
      this.triggerEvent('input', { value: name })
      this.triggerEvent('select', { value: name })
      this.setData({ open: false })
    }
  }
})
