Component({
  properties: {
    bookingId: { type: String, value: '' },
    studentName: { type: String, value: '' },
    teacherName: { type: String, value: '' },
    subjectName: { type: String, value: '' },
    startTime: { type: String, value: '' },
    endTime: { type: String, value: '' },
    /** primary | mint | surface */
    tone: { type: String, value: 'surface' },
    dateLabel: { type: String, value: '' },
    statusLabel: { type: String, value: '' }
  },
  methods: {
    onTap() {
      this.triggerEvent('tap', { id: this.data.bookingId })
    }
  }
})
