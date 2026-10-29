Component({
  properties: {
    filterCount: { type: Number, value: 0 },
    summary: { type: Object, value: {} },
    sortLabel: { type: String, value: '决策分 ↓' }
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
    }
  }
})
