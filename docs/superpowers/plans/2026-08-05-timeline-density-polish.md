# 时间轴密度精修 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 仅时间轴视图压卡高、缩小斜切丝带、加深轴线、日期字号微调，并给今天日期组加轻量「今天」提示；筛选/月历/日列表不动。

**Architecture:** 纯视觉与组装字段精修。`timeline-booking-card` 只改 wxss（压 padding/gap、缩丝带约 30%、取消 space-between）。`timeline-list` 改竖线色、日期字号，并按 `isToday` 渲染「今天」。`pages/calendar` 的 `timelineGroups` 用已有 `formatDate(new Date())` 写入 `isToday`。不改色表、不改节点形态、不改星期文案。

**Tech Stack:** 微信小程序 WXML/WXSS/JS；本轮无新纯函数单测（逻辑仅一行日期比较）；真机/模拟器目视验收。

**Spec:** `docs/superpowers/specs/2026-08-05-timeline-density-polish-design.md`

---

## File map

| 文件 | 职责 |
|------|------|
| `miniprogram/components/timeline-booking-card/index.wxss` | 压卡高、缩斜切丝带 |
| `miniprogram/components/timeline-list/index.wxml` | 日期列增加「今天」 |
| `miniprogram/components/timeline-list/index.wxss` | 日期字号、竖线 `#CBD5E1`、今天样式 |
| `miniprogram/pages/calendar/index.js` | `timelineGroups` 补 `isToday` |
| `miniprogram/components/booking-item/*` | **不改** |
| `miniprogram/components/filter-chips/*` | **不改** |
| `miniprogram/utils/booking-status.js` | **不改** |

---

### Task 1: 压卡高 + 缩斜切丝带

**Files:**
- Modify: `miniprogram/components/timeline-booking-card/index.wxss`

- [ ] **Step 1: 替换卡片容器与丝带尺寸**

将 `.tbc` 与 `.tbc__ribbon`（及紧随的 row gap 相关）改为：

```css
.tbc {
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
  /* 贴合内容，避免 space-between 虚高；视觉目标约 88–96px */
  min-height: 0;
  padding: 24rpx 24rpx;
  padding-right: 56rpx;
  border-radius: 24rpx;
  margin-bottom: 12rpx;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 12rpx;
}

/* 右上角斜向角标：相对原尺寸约缩小 30% */
.tbc__ribbon {
  position: absolute;
  top: 12rpx;
  right: -28rpx;
  z-index: 2;
  width: 98rpx;
  height: 28rpx;
  line-height: 28rpx;
  text-align: center;
  font-size: 16rpx;
  font-weight: 600;
  color: #fff;
  letter-spacing: 0.04em;
  transform: rotate(45deg);
  box-shadow: 0 2rpx 8rpx rgba(27, 36, 48, 0.1);
  pointer-events: none;
}

.tbc__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}
```

保持 `.tbc__time` 为 `36rpx` / `600`（≈18px）。

将 `.tbc__meta` / `.tbc__teacher-name` 字号改为 `26rpx`（已是 ≈13px，可不动字号）；把 `.tbc__meta` 默认色贴近 `#344054`：

```css
.tbc__meta {
  flex: 1;
  min-width: 120rpx;
  font-size: 26rpx;
  font-weight: 500;
  line-height: 1.3;
  color: #344054;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

头像略收：

```css
.tbc__avatar {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background: rgba(29, 41, 57, 0.08);
  color: inherit;
  font-size: 20rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  flex-shrink: 0;
  overflow: hidden;
}
```

**不要**改四态背景色 / 时间色 / 丝带色规则（`.tbc--pending` 等整块保留）。

- [ ] **Step 2: 目视核对（开发者工具）**

打开日历页 → 切到时间线视图，确认：

1. 斜切丝带仍在右上角，但更小，不抢过时间
2. 卡片更扁，一屏课程数多于改前
3. 第二行仍是左 `学员|科目`、右头像+老师名
4. 四态颜色未变

- [ ] **Step 3: Commit**

```bash
git add miniprogram/components/timeline-booking-card/index.wxss
git commit -m "$(cat <<'EOF'
style(timeline): compress booking cards and shrink status ribbon

EOF
)"
```

---

### Task 2: 日期字号 + 竖线加深

**Files:**
- Modify: `miniprogram/components/timeline-list/index.wxss`

- [ ] **Step 1: 更新日期列与轴线样式**

将 `.tl__day` / `.tl__wd` / `.tl__line` 改为：

```css
.tl__day {
  font-size: 40rpx;
  font-weight: 700;
  line-height: 1;
}

.tl__wd {
  font-size: 22rpx;
  font-weight: 400;
  color: #8b95a5;
}

.tl__line {
  flex: 1;
  width: 4rpx;
  background: #cbd5e1;
  opacity: 1;
  margin-top: -2rpx;
}
```

可选收紧日期组卡片区底距（帮助密度）：

```css
.tl__cards {
  flex: 1;
  min-width: 0;
  padding-bottom: 24rpx;
}
```

**不要**改 `.tl__dot` 形态（保持空心圆 + 状态边框）；**不要**改 `.tl__wd` 的数据源（仍显示「星期六」全称）。

- [ ] **Step 2: 目视核对**

确认竖线比改前更深、日期仍是「01 / 星期六」、节点仍是空心圆。

- [ ] **Step 3: Commit**

```bash
git add miniprogram/components/timeline-list/index.wxss
git commit -m "$(cat <<'EOF'
style(timeline): deepen rail and tighten date typography

EOF
)"
```

---

### Task 3: 今天锚点（`isToday` + 「今天」文案）

**Files:**
- Modify: `miniprogram/pages/calendar/index.js`
- Modify: `miniprogram/components/timeline-list/index.wxml`
- Modify: `miniprogram/components/timeline-list/index.wxss`

- [ ] **Step 1: 组装 `isToday`**

在 `recomputeViews` 里，构建 `timelineGroups` 之前取今天字符串（文件顶部已 `require` `formatDate`）：

```js
const todayStr = formatDate(new Date())
```

在 `.map((date) => { ... return { ... }})` 的返回对象中增加：

```js
return {
  date,
  day: pad(d.getDate()),
  weekdayLabel: WEEKDAY_CN[d.getDay()],
  isToday: date === todayStr,
  statusDotClass,
  items
}
```

完整片段应类似：

```js
const todayStr = formatDate(new Date())
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
      isToday: date === todayStr,
      statusDotClass,
      items
    }
  })
```

- [ ] **Step 2: 日期列渲染「今天」**

把 `timeline-list/index.wxml` 的日期列改为：

```xml
<view class="tl__date">
  <text class="tl__day">{{item.day}}</text>
  <text class="tl__wd">{{item.weekdayLabel}}</text>
  <text wx:if="{{item.isToday}}" class="tl__today">今天</text>
</view>
```

- [ ] **Step 3: 「今天」样式**

在 `timeline-list/index.wxss` 的 `.tl__wd` 后追加：

```css
.tl__today {
  font-size: 22rpx;
  font-weight: 400;
  color: #94a3b8;
  line-height: 1.2;
}
```

- [ ] **Step 4: 目视核对**

1. 本月若有今天的约课：该日组日期列显示 `日号 / 星期六 / 今天`，无色块背景
2. 非今天日期组无「今天」
3. 月历格子的 today 样式未变

- [ ] **Step 5: Commit**

```bash
git add miniprogram/pages/calendar/index.js \
  miniprogram/components/timeline-list/index.wxml \
  miniprogram/components/timeline-list/index.wxss
git commit -m "$(cat <<'EOF'
feat(timeline): mark today's date group lightly

EOF
)"
```

---

### Task 4: Spec 验收对照

**Files:** 无代码；对照 `docs/superpowers/specs/2026-08-05-timeline-density-polish-design.md` §10

- [ ] **Step 1: 逐条勾选**

| 验收项 | 预期 |
|--------|------|
| 卡高更扁，一屏课更多 | 约 88–96px 量级观感 |
| 斜切丝带仍在且更小 | 约缩小 30%，不抢时间 |
| 第二行布局 | 左学员\|科目，右老师；无「老师」二字 |
| 日期文案 | 仍「星期六」，非「六」 |
| 轴线 / 节点 | 线 `#CBD5E1`；空心圆 + 状态边框 |
| 今天 | 轻量「今天」，无大色块 |
| 筛选 / 月历 / 日列表 | 外观与行为不变 |
| 点击卡片 | 仍进编辑 |

- [ ] **Step 2: 若有微调，再 commit**

仅当目视后需微调 rpx 数值时改对应 wxss，然后：

```bash
git add miniprogram/components/timeline-booking-card/index.wxss \
  miniprogram/components/timeline-list/index.wxss
git commit -m "$(cat <<'EOF'
style(timeline): tweak density after visual check

EOF
)"
```

若无需微调，跳过本 step。

---

## Spec coverage (self-review)

| Spec 要求 | Task |
|-----------|------|
| 压卡高 / 取消虚高呼吸感 | Task 1 |
| 斜切丝带缩小约 30%（不改胶囊） | Task 1 |
| meta / 老师层级与布局保持 | Task 1（结构未改） |
| 星期仍三字全称 | Task 2 / 3（不改 `WEEKDAY_CN`） |
| 竖线 `#CBD5E1` | Task 2 |
| 节点保持空心圆 | Task 2（不改 dot） |
| 今天轻提示 | Task 3 |
| 不做筛选重构 | 全计划未触碰 filter-chips 逻辑 |

无 TBD/占位步骤。
