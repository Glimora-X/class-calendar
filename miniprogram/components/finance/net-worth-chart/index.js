function round2(n) {
  return Math.round(Number(n) * 100) / 100
}

function formatNet(n) {
  const v = round2(Number(n) || 0)
  return '¥' + v.toFixed(2)
}

function formatSigned(n) {
  const v = round2(Number(n) || 0)
  if (v > 0) return '+¥' + v.toFixed(2)
  if (v < 0) return '-¥' + Math.abs(v).toFixed(2)
  return '¥0.00'
}

function toneOf(n) {
  const v = Number(n) || 0
  if (v > 0) return 'pos'
  if (v < 0) return 'neg'
  return 'neutral'
}

function presentPoint(point) {
  if (!point) {
    return {
      dateText: '',
      netText: '',
      hasDelta: false,
      deltaText: '',
      deltaTone: 'neutral',
      investText: '',
      investTone: 'neutral',
      otherText: '',
      otherTone: 'neutral'
    }
  }
  return {
    dateText: point.date || '',
    netText: formatNet(point.net),
    hasDelta: !!point.hasDelta,
    deltaText: point.hasDelta ? formatSigned(point.deltaNet) : '',
    deltaTone: point.hasDelta ? toneOf(point.deltaNet) : 'neutral',
    investText: point.hasDelta ? formatSigned(point.investProfit) : '',
    investTone: point.hasDelta ? toneOf(point.investProfit) : 'neutral',
    otherText: point.hasDelta ? formatSigned(point.other) : '',
    otherTone: point.hasDelta ? toneOf(point.other) : 'neutral'
  }
}

Component({
  properties: {
    points: { type: Array, value: [] },
    investUnavailable: { type: Boolean, value: false }
  },

  data: {
    selectedIndex: -1,
    selected: presentPoint(null),
    canChart: false,
    empty: true
  },

  lifetimes: {
    ready() {
      this.syncFromPoints(this.data.points)
    }
  },

  observers: {
    points(points) {
      this.syncFromPoints(points)
    }
  },

  methods: {
    syncFromPoints(points) {
      const list = points || []
      const empty = list.length === 0
      const canChart = list.length >= 2
      const selectedIndex = list.length ? list.length - 1 : -1
      this.setData({
        empty,
        canChart,
        selectedIndex,
        selected: presentPoint(list[selectedIndex])
      }, () => {
        if (canChart) this.drawChart()
      })
    },

    selectIndex(index) {
      const list = this.data.points || []
      if (index < 0 || index >= list.length) return
      this.setData({
        selectedIndex: index,
        selected: presentPoint(list[index])
      }, () => this.drawChart())
    },

    drawChart() {
      const points = this.data.points || []
      if (points.length < 2) return
      wx.createSelectorQuery()
        .in(this)
        .select('#nw-canvas')
        .boundingClientRect((rect) => {
          if (!rect || !rect.width) return
          const ctx = wx.createCanvasContext('nw-canvas', this)
          const width = rect.width
          const height = rect.height
          const padX = 12
          const padY = 16
          const values = points.map((p) => Number(p.net) || 0)
          const min = Math.min.apply(null, values)
          const max = Math.max.apply(null, values)
          const span = max - min || 1
          this._coords = points.map((point, index) => ({
            x:
              points.length === 1
                ? width / 2
                : padX + ((width - padX * 2) * index) / (points.length - 1),
            y: height - padY - ((Number(point.net) || 0) - min) / span * (height - padY * 2)
          }))

          ctx.clearRect(0, 0, width, height)

          // baseline
          ctx.setStrokeStyle('rgba(59, 130, 246, 0.12)')
          ctx.setLineWidth(1)
          ctx.beginPath()
          ctx.moveTo(padX, height - padY)
          ctx.lineTo(width - padX, height - padY)
          ctx.stroke()

          ctx.setStrokeStyle('#3B82F6')
          ctx.setLineWidth(2)
          ctx.beginPath()
          this._coords.forEach((coord, index) => {
            if (index === 0) ctx.moveTo(coord.x, coord.y)
            else ctx.lineTo(coord.x, coord.y)
          })
          ctx.stroke()

          const selectedIndex = this.data.selectedIndex
          this._coords.forEach((coord, index) => {
            const active = index === selectedIndex
            ctx.beginPath()
            ctx.setFillStyle(active ? '#1D4ED8' : '#3B82F6')
            ctx.arc(coord.x, coord.y, active ? 5 : 3.5, 0, Math.PI * 2)
            ctx.fill()
            if (active) {
              ctx.beginPath()
              ctx.setStrokeStyle('rgba(29, 78, 216, 0.35)')
              ctx.setLineWidth(2)
              ctx.arc(coord.x, coord.y, 9, 0, Math.PI * 2)
              ctx.stroke()
            }
          })
          ctx.draw()
        })
        .exec()
    },

    onTouch(e) {
      const touch = e.touches && e.touches[0]
      if (!touch || !this._coords || !this._coords.length) return
      let best = 0
      let dist = Infinity
      this._coords.forEach((coord, index) => {
        const gap = Math.abs(coord.x - touch.x)
        if (gap < dist) {
          dist = gap
          best = index
        }
      })
      this.selectIndex(best)
    }
  }
})
