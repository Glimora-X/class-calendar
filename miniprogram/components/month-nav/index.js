Component({
  properties: {
    year: { type: Number, value: 2026 },
    month: { type: Number, value: 1 },
    summaryText: { type: String, value: '' },
    mode: { type: String, value: 'calendar' } // calendar | timeline
  },
  methods: {
    onPrev() {
      this.triggerEvent('change', { delta: -1 })
    },
    onNext() {
      this.triggerEvent('change', { delta: 1 })
    },
    onToggleMode() {
      const next = this.data.mode === 'calendar' ? 'timeline' : 'calendar'
      this.triggerEvent('modechange', { mode: next })
    }
  }
})
