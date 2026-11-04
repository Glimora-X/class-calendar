Component({
  properties: {
    filterCount: { type: Number, value: 0 },
    summary: { type: Object, value: {} },
    sortLabel: { type: String, value: '决策分 ↓' },
    platformChips: { type: Array, value: [] }
  },
  methods: {
    onFilter() {
      this.triggerEvent('filter')
    },
    onToggleSummary() {
      this.triggerEvent('toggleSummary')
    },
    onSort() {
      this.triggerEvent('sort')
    },
    onPlatform(e) {
      const id = e.currentTarget.dataset.id
      if (id == null || id === '') return
      this.triggerEvent('platform', { id: String(id) })
    },
    onDaily() {
      this.triggerEvent('daily')
    },
    onReturns() {
      this.triggerEvent('returns')
    }
  }
})
