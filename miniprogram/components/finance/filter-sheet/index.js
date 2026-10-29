Component({
  properties: {
    open: { type: Boolean, value: false },
    groups: { type: Array, value: [] }
  },
  methods: {
    onClose() {
      this.triggerEvent('close')
    },
    onReset() {
      this.triggerEvent('reset')
    },
    onPick(e) {
      const { key, value } = e.currentTarget.dataset
      this.triggerEvent('change', { key, value })
    },
    noop() {}
  }
})
