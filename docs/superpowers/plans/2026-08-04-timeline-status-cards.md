# 时间轴状态色矮卡 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 仅时间轴视图改为「浅状态色矮卡」：时间第一、角标右上、左学员|科目 / 右老师首字头像，节点色跟状态；月历日列表与老师色大卡不变。

**Architecture:** 在 `booking-status.js` 增加 `statusVisual` / `teacherInitial` 纯函数集中色与首字；新建 `timeline-booking-card` 组件专供时间轴；`timeline-list` 改用该组件并用 `statusDotClass`；`calendar` 组装 groups 时写入 `resolvedStatus`、`metaLine`、`teacherInitial`，圆点取当日最早一节状态。`booking-item` 不改，避免月历日列表串样。

**Tech Stack:** 微信小程序；Node assert 单测（现有 `*.test.js` 风格）；无新云字段。

**Spec:** `docs/superpowers/specs/2026-08-04-timeline-status-cards-design.md`

---

## File map

| 文件 | 职责 |
|------|------|
| `miniprogram/utils/booking-status.js` | 新增 `statusVisual(status)`、`teacherInitial(name)` |
| `miniprogram/utils/booking-status.test.js` | 覆盖四态 visual + 首字 |
| `miniprogram/components/timeline-booking-card/*` | 时间轴专用矮卡（新建） |
| `miniprogram/components/timeline-list/*` | 改用新卡；圆点 class 改状态色 |
| `miniprogram/pages/calendar/index.js` | `decorateBooking` / `timelineGroups` 补字段；组级 `statusDotClass` |
| `miniprogram/components/booking-item/*` | **不改** |

---

### Task 1: `statusVisual` + `teacherInitial`

**Files:**
- Modify: `miniprogram/utils/booking-status.js`
- Modify: `miniprogram/utils/booking-status.test.js`

- [ ] **Step 1: 写失败单测**

在 `booking-status.test.js` 末尾、`console.log` 之前追加：

```js
const { statusVisual, teacherInitial } = require('./booking-status')

const pendingV = statusVisual(BOOKING_STATUS.pending)
assert.strictEqual(pendingV.statusClass, 'st-pending')
assert.strictEqual(pendingV.cardBg, '#F0F6FF')
assert.strictEqual(pendingV.badgeBg, '#3B82F6')
assert.strictEqual(pendingV.timeColor, '#2563EB')
assert.strictEqual(pendingV.dotColor, '#3B82F6')
assert.strictEqual(pendingV.label, '待上')

assert.strictEqual(statusVisual(BOOKING_STATUS.done).statusClass, 'st-done')
assert.strictEqual(statusVisual(BOOKING_STATUS.done).badgeBg, '#52A878')
assert.strictEqual(statusVisual(BOOKING_STATUS.transferred).statusClass, 'st-transferred')
assert.strictEqual(statusVisual(BOOKING_STATUS.transferred).badgeBg, '#8B5CF6')
assert.strictEqual(statusVisual(BOOKING_STATUS.refunded).statusClass, 'st-refunded')
assert.strictEqual(statusVisual(BOOKING_STATUS.refunded).badgeBg, '#9AA1AA')
assert.strictEqual(statusVisual(BOOKING_STATUS.refunded).cardBg, '#F6F7F8')
// 未知状态回落待上
assert.strictEqual(statusVisual('nope').statusClass, 'st-pending')

assert.strictEqual(teacherInitial('然泽'), '然')
assert.strictEqual(teacherInitial('  Jo  '), 'J')
assert.strictEqual(teacherInitial(''), '?')
assert.strictEqual(teacherInitial(null), '?')
```

- [ ] **Step 2: 跑测确认失败**

Run:

```bash
node miniprogram/utils/booking-status.test.js
```

Expected: FAIL（`statusVisual` / `teacherInitial` 未导出）

- [ ] **Step 3: 实现并导出**

在 `booking-status.js` 的 `STATUS_LABELS` 后增加：

```js
const STATUS_VISUAL = {
  [BOOKING_STATUS.pending]: {
    statusClass: 'st-pending',
    cardBg: '#F0F6FF',
    badgeBg: '#3B82F6',
    badgeText: '#FFFFFF',
    mainText: '#1D2939',
    metaText: '#667085',
    timeColor: '#2563EB',
    dotColor: '#3B82F6'
  },
  [BOOKING_STATUS.done]: {
    statusClass: 'st-done',
    cardBg: '#F3F7F5',
    badgeBg: '#52A878',
    badgeText: '#FFFFFF',
    mainText: '#34483D',
    metaText: '#718078',
    timeColor: '#438A62',
    dotColor: '#52A878'
  },
  [BOOKING_STATUS.transferred]: {
    statusClass: 'st-transferred',
    cardBg: '#F7F3FF',
    badgeBg: '#8B5CF6',
    badgeText: '#FFFFFF',
    mainText: '#49356B',
    metaText: '#81758F',
    timeColor: '#7C4DDB',
    dotColor: '#8B5CF6'
  },
  [BOOKING_STATUS.refunded]: {
    statusClass: 'st-refunded',
    cardBg: '#F6F7F8',
    badgeBg: '#9AA1AA',
    badgeText: '#FFFFFF',
    mainText: '#667085',
    metaText: '#98A2B3',
    timeColor: '#7B8490',
    dotColor: '#9AA1AA'
  }
}

/**
 * @param {string} status
 * @returns {{
 *   statusClass: string,
 *   cardBg: string,
 *   badgeBg: string,
 *   badgeText: string,
 *   mainText: string,
 *   metaText: string,
 *   timeColor: string,
 *   dotColor: string,
 *   label: string
 * }}
 */
function statusVisual(status) {
  const key = STATUS_VISUAL[status] ? status : BOOKING_STATUS.pending
  const v = STATUS_VISUAL[key]
  return Object.assign({}, v, { label: STATUS_LABELS[key] })
}

/**
 * @param {string} name
 * @returns {string}
 */
function teacherInitial(name) {
  const s = String(name || '').trim()
  if (!s) return '?'
  return s.charAt(0).toUpperCase()
}
```

`module.exports` 增加：`statusVisual`, `teacherInitial`。

- [ ] **Step 4: 跑测确认通过**

Run:

```bash
node miniprogram/utils/booking-status.test.js
```

Expected: `all tests passed`

- [ ] **Step 5: Commit**（若用户允许提交）

```bash
git add miniprogram/utils/booking-status.js miniprogram/utils/booking-status.test.js
git commit -m "$(cat <<'EOF'
feat(status): add statusVisual and teacherInitial for timeline cards

EOF
)"
```

---

### Task 2: 新建 `timeline-booking-card` 组件

**Files:**
- Create: `miniprogram/components/timeline-booking-card/index.js`
- Create: `miniprogram/components/timeline-booking-card/index.json`
- Create: `miniprogram/components/timeline-booking-card/index.wxml`
- Create: `miniprogram/components/timeline-booking-card/index.wxss`

- [ ] **Step 1: 创建 `index.json`**

```json
{
  "component": true,
  "usingComponents": {}
}
```

- [ ] **Step 2: 创建 `index.js`**

```js
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
    /** 已拼好的「学员 | 科目」 */
    metaLine: { type: String, value: '' }
  },
  methods: {
    onTap() {
      this.triggerEvent('tap', { id: this.data.bookingId })
    }
  }
})
```

- [ ] **Step 3: 创建 `index.wxml`**

```xml
<view class="tbc tbc--{{status || 'pending'}}" bindtap="onTap">
  <view class="tbc__row tbc__row--top">
    <text class="tbc__time">{{startTime}} — {{endTime}}</text>
    <text class="tbc__badge">{{statusLabel}}</text>
  </view>
  <view class="tbc__row tbc__row--bottom">
    <text class="tbc__meta">{{metaLine}}</text>
    <view class="tbc__teacher">
      <view class="tbc__avatar">{{teacherInitial}}</view>
      <text class="tbc__teacher-name">{{teacherName}}</text>
    </view>
  </view>
</view>
```

- [ ] **Step 4: 创建 `index.wxss`（色值与 spec 一致；高度约 160rpx）**

```css
.tbc {
  box-sizing: border-box;
  min-height: 152rpx;
  padding: 20rpx 22rpx;
  border-radius: 24rpx;
  margin-bottom: 16rpx;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 16rpx;
}

.tbc__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.tbc__time {
  font-size: 36rpx;
  font-weight: 600;
  line-height: 1.2;
  flex: 1;
  min-width: 0;
}

.tbc__badge {
  flex-shrink: 0;
  height: 44rpx;
  line-height: 44rpx;
  padding: 0 16rpx;
  border-radius: 22rpx;
  font-size: 22rpx;
  font-weight: 500;
  color: #fff;
}

.tbc__meta {
  flex: 1;
  min-width: 0;
  font-size: 24rpx;
  font-weight: 400;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tbc__teacher {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10rpx;
  max-width: 45%;
}

.tbc__avatar {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: rgba(29, 41, 57, 0.08);
  color: inherit;
  font-size: 22rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  flex-shrink: 0;
}

.tbc__teacher-name {
  font-size: 28rpx;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* —— 四态 —— */
.tbc--pending {
  background: #f0f6ff;
  color: #1d2939;
}
.tbc--pending .tbc__time { color: #2563eb; }
.tbc--pending .tbc__badge { background: #3b82f6; }
.tbc--pending .tbc__meta { color: #667085; }

.tbc--done {
  background: #f3f7f5;
  color: #34483d;
}
.tbc--done .tbc__time { color: #438a62; }
.tbc--done .tbc__badge { background: #52a878; }
.tbc--done .tbc__meta { color: #718078; }

.tbc--transferred {
  background: #f7f3ff;
  color: #49356b;
}
.tbc--transferred .tbc__time { color: #7c4ddb; }
.tbc--transferred .tbc__badge { background: #8b5cf6; }
.tbc--transferred .tbc__meta { color: #81758f; }

.tbc--refunded {
  background: #f6f7f8;
  color: #667085;
}
.tbc--refunded .tbc__time { color: #7b8490; }
.tbc--refunded .tbc__badge { background: #9aa1aa; }
.tbc--refunded .tbc__meta { color: #98a2b3; }
```

- [ ] **Step 5: Commit**（若用户允许）

```bash
git add miniprogram/components/timeline-booking-card
git commit -m "$(cat <<'EOF'
feat(timeline): add timeline-booking-card status compact layout

EOF
)"
```

---

### Task 3: `timeline-list` 接入新卡 + 状态圆点

**Files:**
- Modify: `miniprogram/components/timeline-list/index.json`
- Modify: `miniprogram/components/timeline-list/index.wxml`
- Modify: `miniprogram/components/timeline-list/index.wxss`

- [ ] **Step 1: `index.json` 改用新组件**

```json
{
  "component": true,
  "usingComponents": {
    "timeline-booking-card": "/components/timeline-booking-card/index"
  }
}
```

- [ ] **Step 2: 替换 `index.wxml` 卡片与圆点 class**

将 `.tl__dot` 的 `tone-{{item.tone}}` 改为 `st-{{item.statusDotClass}}`（或直接 `{{item.statusDotClass}}` 已含 `st-` 前缀时用 `item.statusDotClass`）。

卡片循环改为：

```xml
<timeline-booking-card
  wx:for="{{item.items}}"
  wx:for-item="b"
  wx:key="_id"
  bookingId="{{b._id}}"
  startTime="{{b.startTime}}"
  endTime="{{b.endTime}}"
  status="{{b.status}}"
  statusLabel="{{b.statusLabel}}"
  teacherName="{{b.teacherName}}"
  teacherInitial="{{b.teacherInitial}}"
  metaLine="{{b.metaLine}}"
  bind:tap="onTapItem"
/>
```

完整 `index.wxml`：

```xml
<view class="tl">
  <view wx:for="{{groups}}" wx:key="date" class="tl__row">
    <view class="tl__date">
      <text class="tl__day">{{item.day}}</text>
      <text class="tl__wd">{{item.weekdayLabel}}</text>
    </view>
    <view class="tl__rail">
      <view class="tl__dot tl__dot--{{item.statusDotClass || 'pending'}}"></view>
      <view class="tl__line"></view>
    </view>
    <view class="tl__cards">
      <timeline-booking-card
        wx:for="{{item.items}}"
        wx:for-item="b"
        wx:key="_id"
        bookingId="{{b._id}}"
        startTime="{{b.startTime}}"
        endTime="{{b.endTime}}"
        status="{{b.status}}"
        statusLabel="{{b.statusLabel}}"
        teacherName="{{b.teacherName}}"
        teacherInitial="{{b.teacherInitial}}"
        metaLine="{{b.metaLine}}"
        bind:tap="onTapItem"
      />
    </view>
  </view>
</view>
```

- [ ] **Step 3: 更新 `index.wxss` 圆点/竖线为中性竖线 + 四态圆点**

替换 `.tl__dot` 及相关 `tone-*` 为：

```css
.tl__dot {
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
  border: 4rpx solid #3b82f6;
  background: #fff;
  margin-top: 18rpx;
  z-index: 1;
  box-sizing: border-box;
}

.tl__dot--pending { border-color: #3b82f6; }
.tl__dot--done { border-color: #52a878; }
.tl__dot--transferred { border-color: #8b5cf6; }
.tl__dot--refunded { border-color: #9aa1aa; }

.tl__line {
  flex: 1;
  width: 4rpx;
  background: #d0d5dd;
  opacity: 0.9;
  margin-top: -2rpx;
}

.tl__cards {
  flex: 1;
  min-width: 0;
  padding-bottom: 36rpx;
}

.tl__row {
  display: flex;
  align-items: stretch;
  gap: 12rpx;
  min-height: 120rpx;
  margin-bottom: 8rpx;
}
```

删除旧的 `.tl__dot.tone-mint` / `tone-pro` / `tone-warning`。

- [ ] **Step 4: Commit**（若用户允许）

```bash
git add miniprogram/components/timeline-list
git commit -m "$(cat <<'EOF'
feat(timeline): wire status cards and status-colored rail dots

EOF
)"
```

---

### Task 4: `calendar` 页组装 timeline 字段

**Files:**
- Modify: `miniprogram/pages/calendar/index.js`

- [ ] **Step 1: 扩展 import**

将：

```js
const { resolveBookingStatus, statusLabel } = require('../../utils/booking-status')
```

改为：

```js
const {
  resolveBookingStatus,
  statusLabel,
  teacherInitial
} = require('../../utils/booking-status')
```

- [ ] **Step 2: 扩展 `decorateBooking`**

替换为：

```js
function decorateBooking(b, teacherColorMap) {
  const map = teacherColorMap || {}
  const fromTeacher = b.teacherName && map[b.teacherName]
  const fallback = ['surface', 'primary', 'mint'][(b.studentName || '').length % 3]
  const resolved = resolveBookingStatus(b)
  const student = String(b.studentName || '').trim() || '学员'
  const subject = String(b.subjectName || '').trim() || '科目'
  return Object.assign({}, b, {
    cardTone: fromTeacher || b.cardTone || fallback,
    status: resolved,
    statusLabel: statusLabel(resolved),
    teacherInitial: teacherInitial(b.teacherName),
    metaLine: `${student} | ${subject}`
  })
}
```

说明：`cardTone` 仍留给月历日列表 `booking-item` 使用；时间轴不再读它。

- [ ] **Step 3: `timelineGroups` 使用当日最早课状态作圆点**

将 `recomputeViews` 内构建 `timelineGroups` 的 map 改为：

```js
const timelineGroups = Object.keys(byDate)
  .sort()
  .map((date) => {
    const d = new Date(date.replace(/-/g, '/'))
    const items = byDate[date].slice().sort(byStartTime)
    const first = items[0]
    const statusDotClass =
      (first && first.status) || 'pending'
    return {
      date,
      day: pad(d.getDate()),
      weekdayLabel: WEEKDAY_CN[d.getDay()],
      statusDotClass,
      items
    }
  })
```

删除对该组 `marks.find(...).tone` 的依赖（仅影响 timeline；`marks` 仍给月历格子用老师色）。

- [ ] **Step 4: 人工验收清单（开发者工具）**

1. 打开日历页 → 切到「时间线」
2. 确认矮卡：时间大、右上角标、左 meta、右首字+老师名
3. 有待上/已上/已转/已退样例时核色（无手动态可临时改数据或等时间过点）
4. 切回月历：日列表卡片仍为老师色旧卡
5. 点时间轴卡片仍进编辑页

- [ ] **Step 5: 再跑状态单测**

```bash
node miniprogram/utils/booking-status.test.js
```

Expected: `all tests passed`

- [ ] **Step 6: Commit**（若用户允许）

```bash
git add miniprogram/pages/calendar/index.js
git commit -m "$(cat <<'EOF'
feat(calendar): feed timeline groups with status meta for compact cards

EOF
)"
```

---

### Task 5: Spec 勾选与收尾

**Files:**
- Modify: `docs/superpowers/specs/2026-08-04-timeline-status-cards-design.md`（验收项打勾）

- [ ] **Step 1: 将 §8 验收标准全部改为 `[x]`（仅在 Task 4 验收通过后）**
- [ ] **Step 2: 可选 commit docs**

```bash
git add docs/superpowers/specs/2026-08-04-timeline-status-cards-design.md docs/superpowers/plans/2026-08-04-timeline-status-cards.md
git commit -m "$(cat <<'EOF'
docs: timeline status cards spec approved and plan

EOF
)"
```

---

## Spec coverage (self-review)

| Spec 要求 | Task |
|-----------|------|
| 四态色表 / 已退不红 | Task 1 + Task 2 CSS |
| 时间第一、角标右 | Task 2 WXML |
| 左学员\|科目、右老师首字 | Task 2 + Task 4 `metaLine` |
| 矮卡 ~80px、卡距 | Task 2 wxss |
| 节点跟最早课状态 | Task 3 + Task 4 |
| 仅时间轴、不动 booking-item | Task 2/3 新建组件；Task 4 保留 cardTone |
| 无过滤 / 无真头像 | 未列入任务（YAGNI） |

无 TBD；命名一致：`status` / `statusLabel` / `teacherInitial` / `metaLine` / `statusDotClass`。
