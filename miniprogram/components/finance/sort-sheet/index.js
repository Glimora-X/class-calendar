Component({
  properties: {
    open: { type: Boolean, value: false },
    options: { type: Array, value: [] }
  },
  methods: {
    onClose() {
      this.triggerEvent('close')
    },
    onPick(e) {
      const key = e.currentTarget.dataset.key
      if (!key) return
      this.triggerEvent('change', { key: String(key) })
    },
    noop() {}
  }
})
