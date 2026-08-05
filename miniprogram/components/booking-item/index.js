Component({
  properties: {
    bookingId: { type: String, value: '' },
    studentName: { type: String, value: '' },
    teacherName: { type: String, value: '' },
    subjectName: { type: String, value: '' },
    startTime: { type: String, value: '' },
    endTime: { type: String, value: '' },
    /** primary | mint | surface | pro | warning */
    tone: { type: String, value: 'primary' },
    /** 老师标签色，与筛选 chip 一致 */
    teacherTone: { type: String, value: 'primary' },
    dateLabel: { type: String, value: '' },
    statusLabel: { type: String, value: '' },
    /** pending | done | transferred | refunded */
    status: { type: String, value: 'pending' },
    teacherAvatarUrl: { type: String, value: '' },
    teacherInitial: { type: String, value: '' },
    note: { type: String, value: '' }
  },
  methods: {
    onTap() {
      this.triggerEvent('tap', { id: this.data.bookingId })
    }
  }
})
