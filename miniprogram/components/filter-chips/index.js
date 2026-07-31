Component({
  properties: {
    /** [{ id, label, active }] */
    items: { type: Array, value: [] }
  },
  methods: {
    onTap(e) {
      const id = e.currentTarget.dataset.id
      this.triggerEvent('change', { id })
    }
  }
})
