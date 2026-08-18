Component({
  properties: {
    year: { type: Number, value: 2026 },
    month: { type: Number, value: 1 },
    summaryText: { type: String, value: '' },
    mode: { type: String, value: 'calendar' }, // calendar | timeline
    /** 是否显示学员轮换（名单 ≥2） */
    showStudentCycle: { type: Boolean, value: false },
    /** 当前学员文案：全部 / 姓名 */
    studentLabel: { type: String, value: '全部' }
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
    },
    onCycleStudent() {
      this.triggerEvent('studentcycle')
    }
  }
})
