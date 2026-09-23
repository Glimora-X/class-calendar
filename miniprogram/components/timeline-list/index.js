Component({
  properties: {
    /** [{ dateLabel, weekdayLabel, items: booking[] }] */
    groups: { type: Array, value: [] },
    selecting: { type: Boolean, value: false },
    selectedMap: { type: Object, value: {} }
  },
  methods: {
    onTapItem(e) {
      this.triggerEvent('itemtap', { id: e.detail.id })
    }
  }
})
