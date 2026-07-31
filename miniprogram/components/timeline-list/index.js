Component({
  properties: {
    /** [{ dateLabel, weekdayLabel, items: booking[] }] */
    groups: { type: Array, value: [] }
  },
  methods: {
    onTapItem(e) {
      this.triggerEvent('itemtap', { id: e.detail.id })
    }
  }
})
