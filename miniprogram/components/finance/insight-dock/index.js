Component({
  properties: {
    dock: { type: Object, value: {} }
  },
  methods: {
    onOpen() {
      if (this.data.dock.openable || this.data.dock.variant === 'eliminated') {
        this.triggerEvent('open', { id: this.data.dock.id, variant: this.data.dock.variant })
      }
    }
  }
})
