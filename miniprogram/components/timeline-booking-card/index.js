Component({
  properties: {
    bookingId: { type: String, value: '' },
    startTime: { type: String, value: '' },
    endTime: { type: String, value: '' },
    /** pending | done | transferred | refunded */
    status: { type: String, value: 'pending' },
    statusLabel: { type: String, value: '' },
    teacherName: { type: String, value: '' },
    teacherInitial: { type: String, value: '?' },
    studentName: { type: String, value: '' },
    subjectName: { type: String, value: '' },
    /** 可选；有则优先，否则用学员|科目拼接 */
    metaLine: { type: String, value: '' }
  },
  data: {
    metaText: ''
  },
  observers: {
    'metaLine, studentName, subjectName': function (metaLine, studentName, subjectName) {
      const fromProp = String(metaLine || '').trim()
      if (fromProp) {
        this.setData({ metaText: fromProp })
        return
      }
      const student = String(studentName || '').trim() || '学员'
      const subject = String(subjectName || '').trim() || '科目'
      this.setData({ metaText: `${student} | ${subject}` })
    }
  },
  methods: {
    onTap() {
      this.triggerEvent('tap', { id: this.data.bookingId })
    }
  }
})
