# 日历页 UI 1:1 还原 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按设计图 1:1 还原日历页（月导航、筛选 chips、月历网格+图例、当日约课列表）与底部 Tab/FAB；地点位改显示备注 `note`（空则隐藏）；头像用老师头像。

**Architecture:** 在现有组件上就地改 WXML/WXSS，日历页补传展示字段。将「按日聚合 marks（含多色 tones）」抽到纯函数 `calendar-marks.js` 单测覆盖。不改云函数、不改库表、不改时间线大视觉。

**Tech Stack:** 微信小程序 WXML/WXSS/JS；Node assert 单测（`node miniprogram/utils/*.test.js`）。

**Agreed decisions:**
- 范围：日历页内容 + custom-tab-bar/FAB
- 地点不展示；设计图地点位 → `note`；空备注整块不渲染
- 头像：老师头像（无则首字）
- 方案：组件就地改，不新建平行卡片组件

---

## File map

| 文件 | 职责 |
|------|------|
| `miniprogram/utils/calendar-marks.js` | **新建**：从约课列表生成 marks（tones/count/summary）与图例 |
| `miniprogram/utils/calendar-marks.test.js` | **新建**：marks/图例单测 |
| `miniprogram/pages/calendar/index.js` | 使用 marks 工具；传 note/avatar；生成 legend；去掉 summaryText 展示 |
| `miniprogram/pages/calendar/index.wxml` | 日区操作按钮布局；legend；booking-item 新属性 |
| `miniprogram/pages/calendar/index.wxss` | 日区标题/按钮样式 |
| `miniprogram/components/calendar-grid/*` | 邻月灰字、多色 dots、底部图例 slot/props |
| `miniprogram/components/month-nav/*` | 「月历模式 ▾」文案微调 |
| `miniprogram/components/filter-chips/*` | 未选中浅色底（贴设计） |
| `miniprogram/components/booking-item/*` | 白底左色条布局：时间/头像/标题/老师chip/备注/状态 |
| `miniprogram/custom-tab-bar/*` | 底栏+FAB 贴设计 |
| 云函数 / booking schema | **不改** |
| `timeline-*` | **不改**（时间线模式仅保证可切换） |

---

### Task 1: 纯函数 — 多色 marks 与图例

**Files:**
- Create: `miniprogram/utils/calendar-marks.js`
- Create: `miniprogram/utils/calendar-marks.test.js`

- [ ] **Step 1: 写失败单测**

```js
/**
 * calendar-marks 单元测试
 * 运行: node miniprogram/utils/calendar-marks.test.js
 */
const assert = require('assert')
const {
  tonesFromDayBookings,
  buildMarks,
  buildLegend
} = require('./calendar-marks')

// tones：按首次出现去重，最多 3 个；surface 归一成 primary
assert.deepStrictEqual(
  tonesFromDayBookings([
    { cardTone: 'mint' },
    { cardTone: 'primary' },
    { cardTone: 'mint' },
    { cardTone: 'pro' },
    { cardTone: 'warning' }
  ]),
  ['mint', 'primary', 'pro']
)

assert.deepStrictEqual(
  tonesFromDayBookings([{ cardTone: 'surface' }, { cardTone: '' }]),
  ['primary']
)

// marks：按日聚合；count>2 出 summary，无 tones
const marks = buildMarks(
  [
    { date: '2026-08-05', cardTone: 'mint' },
    { date: '2026-08-05', cardTone: 'pro' },
    { date: '2026-08-05', cardTone: 'primary' },
    { date: '2026-08-01', cardTone: 'primary' }
  ],
  2
)
const m5 = marks.find((m) => m.date === '2026-08-05')
assert.strictEqual(m5.count, 3)
assert.strictEqual(m5.summary, '3节')
assert.deepStrictEqual(m5.tones, [])
assert.strictEqual(m5.tone, 'mint')

const m1 = marks.find((m) => m.date === '2026-08-01')
assert.strictEqual(m1.count, 1)
assert.strictEqual(m1.summary, '')
assert.deepStrictEqual(m1.tones, ['primary'])

// legend：按老师列表 + 色表
assert.deepStrictEqual(
  buildLegend(['天天', '乔姐'], { 天天: 'mint', 乔姐: 'primary' }),
  [
    { name: '天天', tone: 'mint' },
    { name: '乔姐', tone: 'primary' }
  ]
)

console.log('calendar-marks.test.js: OK')
```

- [ ] **Step 2: 跑测确认失败**

Run: `node miniprogram/utils/calendar-marks.test.js`  
Expected: `Cannot find module './calendar-marks'`

- [ ] **Step 3: 实现工具**

```js
/** 月历日标记与图例（纯函数，供日历页与单测） */

function normalizeTone(tone) {
  const t = tone || 'primary'
  return t === 'surface' ? 'primary' : t
}

/**
 * @param {Array<{ cardTone?: string }>} items
 * @param {number} [max=3]
 * @returns {string[]}
 */
function tonesFromDayBookings(items, max) {
  const limit = max == null ? 3 : max
  const out = []
  ;(items || []).forEach((b) => {
    const tone = normalizeTone(b && b.cardTone)
    if (out.indexOf(tone) === -1) out.push(tone)
  })
  return out.slice(0, limit)
}

/**
 * @param {Array<{ date: string, cardTone?: string }>} bookings 已按筛选过滤、已 decorate
 * @param {number} summaryThreshold 超过则显示「N节」且 tones 为空
 * @returns {Array<{ date: string, tone: string, count: number, summary: string, tones: string[] }>}
 */
function buildMarks(bookings, summaryThreshold) {
  const byDate = {}
  ;(bookings || []).forEach((b) => {
    if (!b || !b.date) return
    if (!byDate[b.date]) byDate[b.date] = []
    byDate[b.date].push(b)
  })
  return Object.keys(byDate).map((date) => {
    const items = byDate[date]
    const count = items.length
    const tonesAll = tonesFromDayBookings(items)
    const tone = tonesAll[0] || 'primary'
    const useSummary = count > summaryThreshold
    return {
      date,
      tone,
      count,
      summary: useSummary ? `${count}节` : '',
      tones: useSummary ? [] : tonesAll
    }
  })
}

/**
 * @param {string[]} teacherNames
 * @param {Record<string, string>} teacherColorMap
 */
function buildLegend(teacherNames, teacherColorMap) {
  const map = teacherColorMap || {}
  return (teacherNames || []).map((name) => ({
    name,
    tone: normalizeTone(map[name])
  }))
}

module.exports = {
  normalizeTone,
  tonesFromDayBookings,
  buildMarks,
  buildLegend
}
```

- [ ] **Step 4: 跑测确认通过**

Run: `node miniprogram/utils/calendar-marks.test.js`  
Expected: `calendar-marks.test.js: OK`

- [ ] **Step 5: Commit**（仅当用户要求提交时执行；否则跳过所有 Commit 步）

```bash
git add miniprogram/utils/calendar-marks.js miniprogram/utils/calendar-marks.test.js
git commit -m "$(cat <<'EOF'
feat: add calendar marks helper for multi-tone day dots

EOF
)"
```

---

### Task 2: calendar-grid — 邻月灰字 + 多色点 + 图例

**Files:**
- Modify: `miniprogram/components/calendar-grid/index.js`
- Modify: `miniprogram/components/calendar-grid/index.wxml`
- Modify: `miniprogram/components/calendar-grid/index.wxss`
- Modify: `miniprogram/components/calendar-grid/index.json`（若无需改则跳过）

- [ ] **Step 1: 扩展 properties 与 buildCells**

在 `index.js`：
- `marks` 注释改为支持 `{ date, tone, count?, summary?, tones?: string[] }`
- 新增 `legend: { type: Array, value: [] }` — `[{ name, tone }]`
- `buildCells`：
  - 月初前：填上月日期，`otherMonth: true`，`empty: false` 但 `disabled: true`（不可选）
  - 月末后：补齐到完整周（`cells.length % 7 === 0`），下月日期同样 `otherMonth: true`
  - 当月：`dots` 改为 `mark.tones` 映射为 `{ tone }` 对象数组；无 tones 时回退旧 count 逻辑但 tone 用 `mark.tone`
  - 选中态仍可点；`otherMonth` 点击不触发 select

示意（邻月填充核心）：

```js
const prevDays = new Date(year, month - 1, 0).getDate()
for (let i = 0; i < startWeekday; i++) {
  const day = prevDays - startWeekday + i + 1
  cells.push({
    key: `p-${day}`,
    empty: false,
    otherMonth: true,
    disabled: true,
    day,
    date: '',
    tone: '',
    dots: [],
    summary: '',
    holiday: '',
    selected: false,
    isToday: false
  })
}
// ... 当月循环：dots = (mark.tones || []).map(t => ({ tone: t }))
while (cells.length % 7 !== 0) {
  const day = cells.length % 7 === 0 ? 1 : /* next month day counter */
  // 用递增 nextDay 填充
}
```

点击：

```js
onSelect(e) {
  const { date, empty, disabled } = e.currentTarget.dataset
  if (empty || disabled || !date) return
  this.triggerEvent('select', { date })
}
```

- [ ] **Step 2: 更新 wxml**

```xml
<view class="cal">
  <view class="cal__weekdays">
    <text wx:for="{{weekdays}}" wx:key="*this" class="cal__wd">{{item}}</text>
  </view>
  <view class="cal__grid">
    <view
      wx:for="{{cells}}"
      wx:key="key"
      class="cal__cell {{item.otherMonth ? 'is-other' : ''}} {{item.selected ? 'is-selected' : ''}} {{item.tone && !item.otherMonth ? 'has-mark tone-' + item.tone : ''}} {{item.isToday ? 'is-today' : ''}} {{item.summary ? 'has-summary' : ''}}"
      data-date="{{item.date}}"
      data-empty="{{item.empty}}"
      data-disabled="{{item.disabled}}"
      bindtap="onSelect"
    >
      <view wx:if="{{!item.empty}}" class="cal__inner">
        <text class="cal__day">{{item.day}}</text>
        <text wx:if="{{item.summary}}" class="cal__summary">{{item.summary}}</text>
        <text wx:elif="{{item.holiday}}" class="cal__holiday">{{item.holiday}}</text>
        <view wx:elif="{{item.dots.length}}" class="cal__dots">
          <view
            wx:for="{{item.dots}}"
            wx:for-item="dot"
            wx:key="tone"
            class="cal__dot tone-{{dot.tone}}"
          />
        </view>
      </view>
    </view>
  </view>
  <view wx:if="{{legend.length}}" class="cal__legend">
    <view wx:for="{{legend}}" wx:key="name" class="cal__legend-item">
      <view class="cal__legend-dot tone-{{item.tone}}"></view>
      <text class="cal__legend-name">{{item.name}}</text>
    </view>
  </view>
</view>
```

- [ ] **Step 3: 更新 wxss**

关键要点：
- `.cal__cell.is-other .cal__day { color: #c5cdd8; }` 无选中底、无 mark 阴影
- 每个 `.cal__dot.tone-primary|mint|pro|warning` 独立背景色（不要依赖父 cell 的 tone）
- **选中日圆点保持老师色**（删除或覆盖 `.is-selected .cal__dot { background:#fff }`，改为各 tone 色）
- `.cal__legend`：横向居中/左对齐 flex，gap，顶部 border 或 padding；dot 8rpx + 名字 22rpx muted

- [ ] **Step 4: 模拟器目视**

打开日历月历模式：邻月灰字、多老师日多色点、选中日点仍彩色、底图例可见。

- [ ] **Step 5: Commit**（用户要求时）

```bash
git add miniprogram/components/calendar-grid
git commit -m "$(cat <<'EOF'
feat: calendar grid multi-tone dots, adjacent days, legend

EOF
)"
```

---

### Task 3: 日历页接线 — marks / legend / booking 字段

**Files:**
- Modify: `miniprogram/pages/calendar/index.js`
- Modify: `miniprogram/pages/calendar/index.wxml`
- Modify: `miniprogram/pages/calendar/index.wxss`

- [ ] **Step 1: `recomputeViews` 改用 `buildMarks` / `buildLegend`**

```js
const { DAY_CELL_SUMMARY_THRESHOLD } = require('../../utils/constants')
const { buildMarks, buildLegend } = require('../../utils/calendar-marks')
```

在 `data` 增加 `legend: []`。

将现有 marks 手工构造替换为：

```js
const flatForMarks = []
Object.keys(byDate).forEach((date) => {
  ;(byDate[date] || []).forEach((b) => flatForMarks.push(b))
})
const marks = buildMarks(flatForMarks, DAY_CELL_SUMMARY_THRESHOLD)
const teachers = uniqueTeachers(list) // 未筛选的本月老师，与 chips 一致
const legend = buildLegend(teachers, teacherColorMap)
```

注意：`byDate` 已是筛选后；marks/legend 应对齐设计——图例用**本月全部老师**（未筛选 list 的 uniqueTeachers），marks 用筛选后数据。chips 逻辑保持。

`setData` 增加 `legend`，可去掉页面上对 `summaryText` 的展示（data 可暂留不影响）。

- [ ] **Step 2: wxml — grid 传 legend；日区按钮；booking-item 新 props**

```xml
<calendar-grid
  year="{{year}}"
  month="{{month}}"
  selectedDate="{{selectedDate}}"
  marks="{{marks}}"
  holidays="{{holidays}}"
  legend="{{legend}}"
  bind:select="onSelectDate"
/>

<view class="section-head">
  <text class="section-title">{{selectedLabel}}</text>
  <view class="section-actions">
    <view class="section-btn" bindtap="onTapBatch">
      <text class="section-btn__icon">▦</text>
      <text>批量约课</text>
    </view>
    <view class="section-btn" bindtap="onTapCopyMonth">
      <text class="section-btn__icon">⧉</text>
      <text>复制上月</text>
    </view>
  </view>
</view>

<booking-item
  wx:for="{{dayBookings}}"
  wx:key="_id"
  bookingId="{{item._id}}"
  studentName="{{item.studentName}}"
  teacherName="{{item.teacherName}}"
  subjectName="{{item.subjectName}}"
  startTime="{{item.startTime}}"
  endTime="{{item.endTime}}"
  tone="{{item.cardTone}}"
  teacherTone="{{item.cardTone}}"
  statusLabel="{{item.statusLabel}}"
  teacherAvatarUrl="{{item.teacherAvatarUrl}}"
  teacherInitial="{{item.teacherInitial}}"
  note="{{item.note}}"
  bind:tap="onTapBooking"
/>
```

按钮顺序按设计图：**批量约课** 在左，**复制上月** 在右。

- [ ] **Step 3: section 样式**

```css
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
  padding: 0 4rpx;
  gap: 16rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: 700;
  flex-shrink: 0;
}

.section-actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12rpx;
}

.section-btn {
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  height: 52rpx;
  padding: 0 16rpx;
  border-radius: 12rpx;
  border: 1rpx solid #d8dee8;
  background: #fff;
  font-size: 22rpx;
  color: #5b6573;
  font-weight: 500;
}

.section-btn__icon {
  font-size: 20rpx;
  opacity: 0.7;
}
```

删除旧的 `.section-link` / `.section-sub` 纵向布局。

- [ ] **Step 4: Commit**（用户要求时）

```bash
git add miniprogram/pages/calendar
git commit -m "$(cat <<'EOF'
feat: wire calendar marks, legend, and day section actions

EOF
)"
```

---

### Task 4: month-nav + filter-chips 贴设计

**Files:**
- Modify: `miniprogram/components/month-nav/index.wxml`
- Modify: `miniprogram/components/month-nav/index.wxss`（必要时）
- Modify: `miniprogram/components/filter-chips/index.wxss`

- [ ] **Step 1: month-nav 副文案**

```xml
<text class="month-nav__sub">{{mode === 'calendar' ? '月历模式' : '时间线模式'}} ▾</text>
```

保留 `bindtap="onToggleMode"` 于 center。不必改 JS。

- [ ] **Step 2: filter-chips 未选中浅底**

将未选中老师 chip 从「白底+描边」改为「浅色底+字色」（「全部」未选中保持灰字白底）：

```css
.chip.tone-primary:not(.is-active) {
  color: #2563eb;
  background: rgba(59, 130, 246, 0.12);
  border-color: transparent;
}
.chip.tone-mint:not(.is-active) {
  color: #059669;
  background: rgba(52, 211, 153, 0.16);
  border-color: transparent;
}
.chip.tone-pro:not(.is-active) {
  color: #7c3aed;
  background: rgba(139, 92, 246, 0.14);
  border-color: transparent;
}
.chip.tone-warning:not(.is-active) {
  color: #d97706;
  background: rgba(245, 158, 11, 0.16);
  border-color: transparent;
}
```

「全部」选中仍实心蓝；老师选中仍各 tone 实心。

- [ ] **Step 3: Commit**（用户要求时）

```bash
git add miniprogram/components/month-nav miniprogram/components/filter-chips
git commit -m "$(cat <<'EOF'
style: polish month-nav label and filter chip fills

EOF
)"
```

---

### Task 5: booking-item 白底卡片布局

**Files:**
- Modify: `miniprogram/components/booking-item/index.js`
- Modify: `miniprogram/components/booking-item/index.wxml`
- Modify: `miniprogram/components/booking-item/index.wxss`

- [ ] **Step 1: 扩展 properties**

```js
Component({
  properties: {
    bookingId: { type: String, value: '' },
    studentName: { type: String, value: '' },
    teacherName: { type: String, value: '' },
    subjectName: { type: String, value: '' },
    startTime: { type: String, value: '' },
    endTime: { type: String, value: '' },
    tone: { type: String, value: 'primary' },
    teacherTone: { type: String, value: 'primary' },
    statusLabel: { type: String, value: '' },
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
```

移除对 `dateLabel` 的依赖（日历日列表不需要）；若担心兼容可保留 property 但不渲染。

- [ ] **Step 2: 新 wxml 结构**

```xml
<view class="card tone-{{tone}}" bindtap="onTap">
  <view class="card__accent"></view>
  <view class="card__time">
    <text class="card__time-start">{{startTime}}</text>
    <text class="card__time-sep">—</text>
    <text class="card__time-end">{{endTime}}</text>
  </view>
  <image
    wx:if="{{teacherAvatarUrl}}"
    class="card__avatar"
    src="{{teacherAvatarUrl}}"
    mode="aspectFill"
  />
  <view wx:else class="card__avatar card__avatar--text">{{teacherInitial}}</view>
  <view class="card__body">
    <text class="card__title">{{studentName}} · {{subjectName}}</text>
    <view class="card__meta">
      <text class="card__teacher tone-{{teacherTone || tone}}">{{teacherName}}</text>
      <block wx:if="{{note}}">
        <text class="card__note-icon">⌖</text>
        <text class="card__note">{{note}}</text>
      </block>
    </view>
  </view>
  <text wx:if="{{statusLabel}}" class="card__status tone-{{tone}}">{{statusLabel}}</text>
</view>
```

规则：**`note` 为空不渲染备注块**（含图标）。

- [ ] **Step 3: 重写 wxss（白底 + 左色条，取消整卡渐变）**

要点：
- `.card`：白底、圆角 ~24rpx、横排 flex、align center、软阴影、padding
- `.card__accent`：绝对定位左侧竖条，按 `.card.tone-* .card__accent` 上色
- 时间列窄、灰字 22–24rpx、竖排
- 头像 64rpx 圆
- 标题 28–30rpx 粗；老师 chip 浅底圆角；备注单行 ellipsis、muted
- `.card__status`：描边/浅底 pill，字色随 tone；`已上课` 可用 mint 外观（若 status 文案含「已」可用单独 class——本期用 tone 即可）
- **删除** 旧的整卡 `linear-gradient` tone 样式与 `···`

- [ ] **Step 4: 模拟器核对**

有备注显示一行；无备注无占位；老师头像/首字；状态在右侧。

- [ ] **Step 5: Commit**（用户要求时）

```bash
git add miniprogram/components/booking-item
git commit -m "$(cat <<'EOF'
feat: restyle booking-item to match calendar design

EOF
)"
```

---

### Task 6: custom-tab-bar + FAB 贴设计

**Files:**
- Modify: `miniprogram/custom-tab-bar/index.wxss`
- Modify: `miniprogram/custom-tab-bar/index.wxml`（若需改图标结构）

- [ ] **Step 1: 底栏形态**

对照设计：
- `tab-shell` 左右 padding 减小（如 `16rpx`），更接近全宽
- `tab-bar`：白底、大圆角（顶部更明显即可）、轻阴影；三等分+中间 FAB 槽
- 选中蓝 `#3b82f6`，未选中 `#8b95a5`
- FAB：直径约 104–112rpx、上浮、蓝渐变+蓝阴影，逻辑已有 `onFab` 不改

若 `app.json` 已配置 png 图标且比 CSS 图标更贴设计，可改为 `<image>`；否则保留 CSS 图标并微调尺寸。

- [ ] **Step 2: 三 Tab 页目视**

日历/概览/我的切换，`selected` 高亮正确；FAB 进新建约课。

- [ ] **Step 3: Commit**（用户要求时）

```bash
git add miniprogram/custom-tab-bar
git commit -m "$(cat <<'EOF'
style: align custom tab bar and FAB with calendar design

EOF
)"
```

---

### Task 7: 回归与验收清单

**Files:** 无新文件

- [ ] **Step 1: 跑相关单测**

```bash
node miniprogram/utils/calendar-marks.test.js
node miniprogram/utils/booking-status.test.js
node miniprogram/utils/overview-stats.test.js
```

Expected: 全部 `OK` / 无 assert 失败。

- [ ] **Step 2: 模拟器对照设计图清单**

| # | 检查项 | 通过 |
|---|--------|------|
| 1 | 月导航「YYYY年M月」+「月历模式 ▾」+ 圆形左右键 | |
| 2 | 「全部」实心蓝；老师 chip 浅色底 | |
| 3 | 邻月日期灰色 | |
| 4 | 多老师日多色点；选中日点仍彩色 | |
| 5 | 月历底图例 | |
| 6 | 日区：批量约课 / 复制上月 描边按钮 | |
| 7 | 约课卡：白底左色条、时间、老师头像、学员·科目、老师 chip | |
| 8 | 有 note 显示；无 note 不占位 | |
| 9 | 状态 pill 在右侧 | |
| 10 | Tab + FAB 贴设计；时间线模式仍可切换 | |

- [ ] **Step 3: 最终 Commit**（用户要求时，可 squash 或一次提交本日改动）

---

## Self-review

1. **Spec coverage:** 月导航/chips/月历多色点+邻月+图例/日区按钮/约课卡备注与老师头像/Tab+FAB/不改库表 — 均有对应 Task。时间线大改明确不做。
2. **Placeholders:** 无 TBD；邻月填充在 Task 2 给出算法要点。
3. **Consistency:** `tones` / `legend` / `note` / `teacherAvatarUrl` 命名在 Task 1→5 贯穿一致；summary 阈值仍用 `DAY_CELL_SUMMARY_THRESHOLD`。

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-05-calendar-ui-1to1.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — 每 Task 派生子代理，Task 间复审  
2. **Inline Execution** — 本会话按 executing-plans 连续执行并设检查点  

Which approach?
