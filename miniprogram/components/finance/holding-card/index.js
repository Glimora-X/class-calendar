Component({
  properties: {
    card: { type: Object, value: {} }
  },
  methods: {
    onOpen() {
      this.triggerEvent('open', { id: this.data.card.id })
    }
  }
})
