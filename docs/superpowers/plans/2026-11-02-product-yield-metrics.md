# 产品收益能力指标（ProductYieldMetrics）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增独立纯函数 `calcProductYieldMetrics`，在持仓详情「指标」页展示「产品收益能力」估算区块，且不改动 `calcAllMetrics` / `getStable` 算法与 Schema。

**Architecture:** 新建 `miniprogram/utils/finance/product-yield.js`（禁止依赖 `metrics.js`）；详情页并行调用两套指标并上下分区展示。`round2` 仅作用于最终输出；中间单日万份收益保留原始精度再聚合。

**Tech Stack:** 微信小程序（WXML/WXSS/JS）、Node assert 风格单测（与现有 `metrics.test.js` 一致：`node path/to/test.js`）

**Spec:** `docs/superpowers/specs/2026-11-02-product-yield-metrics-design.md`（已冻结）

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `miniprogram/utils/finance/product-yield.js` | **新建** — 分类、前序 EOD、异常标记、聚合；导出 `calcProductYieldMetrics` |
| `miniprogram/utils/finance/product-yield.test.js` | **新建** — 单元 + 真实持仓 fixture |
| `miniprogram/utils/finance/money.js` | **只读复用** — `round2`（product-yield 可 require money，不可 require metrics） |
| `miniprogram/pages/finance/holding-detail/index.js` | **修改** — 调用并组装 `productYieldRows` / 文案 |
| `miniprogram/pages/finance/holding-detail/index.wxml` | **修改** — 「产品收益能力」区块（在「稳仓后」之上） |
| `miniprogram/pages/finance/holding-detail/index.wxss` | **按需微调** — 副文案 / 主数字样式（尽量复用 `.mg`） |

**明确不改：** `metrics.js`、`ledger.js`、云函数、Schema、列表页 `query.js` 卡片。

---

## 实现约束速查（冻结）

1. `classifyByReturn`：`null`→MISSING；`!Number.isFinite`→INVALID；再按符号。  
2. INVALID 两种来源写注释：`RETURN_NOT_FINITE` / `BASE_INVALID`（可用内部字段或注释；对外 `yieldDayType` 仍为 INVALID）。  
3. 不改原数组；副本排序；同日 Map 后写覆盖；同日不互为前序。  
4. 中间不 round；最终 `averagePer10k` / `averagePer10kOnCalendarDays` / `annualizedYield` / `totalReturnOnYieldDays` / 明细 `estimatedPer10k` 输出时 `round2`；聚合用未 round 单日值。  
5. 年化百分数：`rawAveragePer10k * 365 / 100`（不是 `/10000`）。  
6. `TINY_RETURN` 仅有限且非零时 `Math.abs(dailyReturn) < 0.01`。  
7. 禁止 `require('./metrics')`。

---

### Task 1: 脚手架 + 分类/基数单测（TDD）

**Files:**
- Create: `miniprogram/utils/finance/product-yield.test.js`
- Create: `miniprogram/utils/finance/product-yield.js`（先导出最小 API）

- [ ] **Step 1: 写失败测试 — 分类与非有限数**

在 `product-yield.test.js`：

```js
/**
 * product-yield 单元测试
 * 运行: node miniprogram/utils/finance/product-yield.test.js
 */
const assert = require('assert')
const {
  classifyByReturn,
  calcProductYieldMetrics
} = require('./product-yield')

assert.strictEqual(classifyByReturn(null), 'MISSING')
assert.strictEqual(classifyByReturn(9.87), 'POSITIVE')
assert.strictEqual(classifyByReturn(-0.01), 'NEGATIVE')
assert.strictEqual(classifyByReturn(0), 'ZERO')
assert.strictEqual(classifyByReturn(NaN), 'INVALID')
assert.strictEqual(classifyByReturn(Infinity), 'INVALID')

console.log('product-yield.test.js: classify OK')
```

- [ ] **Step 2: 运行确认失败**

```bash
node miniprogram/utils/finance/product-yield.test.js
```

Expected: `Cannot find module './product-yield'` 或 `classifyByReturn is not a function`

- [ ] **Step 3: 最小实现 classify + 空壳 calc**

`product-yield.js`：

```js
/**
 * 产品收益能力估算（纯函数）
 * 不依赖 metrics.js / getStable；不修改 holding。
 * @see docs/superpowers/specs/2026-11-02-product-yield-metrics-design.md
 */

const { round2 } = require('./money')

/** @param {number|null|undefined} dailyReturn */
function classifyByReturn(dailyReturn) {
  if (dailyReturn == null) return 'MISSING'
  if (!Number.isFinite(dailyReturn)) return 'INVALID' // 来源：收益金额非有限
  if (dailyReturn > 0) return 'POSITIVE'
  if (dailyReturn < 0) return 'NEGATIVE'
  return 'ZERO'
}

function emptyMetrics() {
  return {
    averagePer10k: null,
    averagePer10kOnCalendarDays: null,
    annualizedYield: null,
    yieldDayCount: 0,
    positiveDayCount: 0,
    negativeDayCount: 0,
    zeroYieldDayCount: 0,
    invalidDayCount: 0,
    totalReturnOnYieldDays: 0,
    calculationQuality: 'ESTIMATED',
    period: { startDate: null, endDate: null, recordedDayCount: 0 },
    days: [],
    hasAnomalies: false
  }
}

/** @param {object} holding */
function calcProductYieldMetrics(holding) {
  return emptyMetrics()
}

module.exports = {
  classifyByReturn,
  calcProductYieldMetrics,
  // 测试可选用
  isValidBase,
  round2
}

function isValidBase(x) {
  return x != null && Number.isFinite(x) && x > 0
}
```

- [ ] **Step 4: 再跑分类测试**

```bash
node miniprogram/utils/finance/product-yield.test.js
```

Expected: 打印 `classify OK`

- [ ] **Step 5: Commit（若用户要求提交时再执行）**

```bash
git add miniprogram/utils/finance/product-yield.js miniprogram/utils/finance/product-yield.test.js
git commit -m "$(cat <<'EOF'
feat(finance): scaffold product-yield classify helpers

EOF
)"
```

---

### Task 2: 日分解 + 前序 EOD + 聚合核心

**Files:**
- Modify: `miniprogram/utils/finance/product-yield.js`
- Modify: `miniprogram/utils/finance/product-yield.test.js`

- [ ] **Step 1: 写失败测试 — ZERO 无前序、无效基数、加仓日 previousEod、仅 ZERO**

追加到测试文件（在 classify 断言之后）：

```js
// ZERO 无前序 EOD：仍为 ZERO，计入自然日日均
{
  const m = calcProductYieldMetrics({
    dailyEntries: [{ date: '2026-10-14', dailyReturn: 0, eodBalance: 100000 }]
  })
  assert.strictEqual(m.days[0].yieldDayType, 'ZERO')
  assert.strictEqual(m.zeroYieldDayCount, 1)
  assert.strictEqual(m.averagePer10k, null)
  assert.strictEqual(m.annualizedYield, null)
  assert.strictEqual(m.averagePer10kOnCalendarDays, 0)
  assert.strictEqual(m.period.startDate, '2026-10-14')
  assert.strictEqual(m.period.recordedDayCount, 1)
}

// 非零收益 + 无前序 → INVALID（BASE_INVALID）
{
  const m = calcProductYieldMetrics({
    dailyEntries: [{ date: '2026-10-14', dailyReturn: 10, eodBalance: 100010 }]
  })
  assert.strictEqual(m.days[0].yieldDayType, 'INVALID')
  assert.strictEqual(m.invalidDayCount, 1)
  assert.strictEqual(m.yieldDayCount, 0)
  assert.strictEqual(m.totalReturnOnYieldDays, 0)
}

// 前序 EOD <=0：不向前跳过
{
  const m = calcProductYieldMetrics({
    dailyEntries: [
      { date: '2026-10-14', dailyReturn: 0, eodBalance: 0 },
      { date: '2026-10-15', dailyReturn: 5, eodBalance: 5 }
    ]
  })
  assert.strictEqual(m.days[1].yieldDayType, 'INVALID')
  assert.strictEqual(m.days[1].previousEodBalance, 0)
}

// 加仓日：previousEod 必须是前序 EOD，不是当日 eodBalance
{
  const m = calcProductYieldMetrics({
    dailyEntries: [
      { date: '2026-10-21', dailyReturn: 9.88, eodBalance: 100049.36 },
      { date: '2026-10-22', dailyReturn: 9.87, eodBalance: 107359.23 }
    ]
  })
  const d22 = m.days.find((d) => d.date === '2026-10-22')
  assert.strictEqual(d22.previousEodBalance, 100049.36)
  assert.ok(Math.abs(d22.estimatedPer10k - round2((9.87 / 100049.36) * 10000)) < 0.001)
}

// 不修改原数组
{
  const entries = [
    { date: '2026-10-16', dailyReturn: 1, eodBalance: 100001 },
    { date: '2026-10-15', dailyReturn: 0, eodBalance: 100000 }
  ]
  const freeze = JSON.stringify(entries)
  calcProductYieldMetrics({ dailyEntries: entries })
  assert.strictEqual(JSON.stringify(entries), freeze)
}

// 输入顺序无关
{
  const a = calcProductYieldMetrics({
    dailyEntries: [
      { date: '2026-10-15', dailyReturn: 0, eodBalance: 100000 },
      { date: '2026-10-16', dailyReturn: 10, eodBalance: 100010 }
    ]
  })
  const b = calcProductYieldMetrics({
    dailyEntries: [
      { date: '2026-10-16', dailyReturn: 10, eodBalance: 100010 },
      { date: '2026-10-15', dailyReturn: 0, eodBalance: 100000 }
    ]
  })
  assert.strictEqual(a.averagePer10k, b.averagePer10k)
  assert.strictEqual(a.yieldDayCount, b.yieldDayCount)
}

// TINY_RETURN 仍计入平均；非有限不跑 abs
{
  const m = calcProductYieldMetrics({
    dailyEntries: [
      { date: '2026-10-15', dailyReturn: 0, eodBalance: 100000 },
      { date: '2026-10-16', dailyReturn: -0.01, eodBalance: 99999.99 }
    ]
  })
  assert.strictEqual(m.days[1].yieldDayType, 'NEGATIVE')
  assert.deepStrictEqual(m.days[1].anomalyFlags, ['TINY_RETURN'])
  assert.strictEqual(m.yieldDayCount, 1)
  assert.strictEqual(m.hasAnomalies, true)
}

{
  const m = calcProductYieldMetrics({
    dailyEntries: [{ date: '2026-10-14', dailyReturn: NaN, eodBalance: 1 }]
  })
  assert.strictEqual(m.days[0].yieldDayType, 'INVALID')
  assert.deepStrictEqual(m.days[0].anomalyFlags, [])
}

const { round2 } = require('./money')
```

注意：把 `const { round2 } = require('./money')` 挪到文件顶部，避免重复。

- [ ] **Step 2: 运行确认失败**

```bash
node miniprogram/utils/finance/product-yield.test.js
```

Expected: 空壳导致 `days[0]` 相关断言失败

- [ ] **Step 3: 实现完整 `calcProductYieldMetrics`**

实现要点（写进 `product-yield.js`）：

```js
function calcProductYieldMetrics(holding) {
  const raw = (holding && holding.dailyEntries) || []
  // 1) 副本 + 按 date 升序；同日后写覆盖进 Map；再取出排序数组
  // 2) 对每个 date：
  //    type0 = classifyByReturn(dailyReturn)
  //    prev = 严格早于 date 的最近一条（数组前驱即可，因已一天一条）
  //    previousEodBalance = prev ? prev.eodBalance : null
  //    若 type0 为 POSITIVE/NEGATIVE：
  //      若 !isValidBase(previousEodBalance) → INVALID（注释：BASE_INVALID）
  //      否则 rawPer10k = dailyReturn / previousEodBalance * 10000
  //    若 type0 为 ZERO → rawPer10k 对聚合贡献 0，不要求 base
  //    若 type0 已是 INVALID（非有限）→ 保持，anomalyFlags=[]
  //    TINY_RETURN 仅 Number.isFinite(dailyReturn) && !==0 && abs<0.01
  // 3) 聚合：用 rawPer10k（未 round）累加
  // 4) annualized = rawAvg * 365 / 100
  // 5) 输出 round2；days[].estimatedPer10k = raw==null?null:round2(raw)
  // 6) yieldDayCount === positiveDayCount + negativeDayCount
  // 7) totalReturnOnYieldDays 仅有效收益日
  // 8) period 取参与自然日日均的首尾
}
```

完整推荐结构见下方参考实现骨架（实现时展开，勿留半截）：

```js
function normalizeEntries(dailyEntries) {
  const copy = Array.isArray(dailyEntries) ? dailyEntries.slice() : []
  copy.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const byDate = new Map()
  copy.forEach((e) => {
    if (!e || !e.date) return
    byDate.set(e.date, e) // 后写覆盖
  })
  return Array.from(byDate.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([, e]) => e)
}

function calcProductYieldMetrics(holding) {
  const entries = normalizeEntries(holding && holding.dailyEntries)
  const days = []
  let sumYieldPer = 0
  let yieldDayCount = 0
  let positiveDayCount = 0
  let negativeDayCount = 0
  let zeroYieldDayCount = 0
  let invalidDayCount = 0
  let sumCalPer = 0
  let recordedDayCount = 0
  let totalReturnOnYieldDays = 0
  let hasAnomalies = false
  let periodStart = null
  let periodEnd = null

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]
    const dailyReturn = e.dailyReturn == null ? null : Number(e.dailyReturn)
    let yieldDayType = classifyByReturn(dailyReturn)
    const prev = i > 0 ? entries[i - 1] : null
    const previousEodBalance = prev ? Number(prev.eodBalance) : null
    let rawPer10k = null
    const anomalyFlags = []

    if (yieldDayType === 'POSITIVE' || yieldDayType === 'NEGATIVE') {
      if (!isValidBase(previousEodBalance)) {
        // INVALID 来源：前序计息基数无效
        yieldDayType = 'INVALID'
      } else {
        rawPer10k = (dailyReturn / previousEodBalance) * 10000
      }
    }

    if (
      Number.isFinite(dailyReturn) &&
      dailyReturn !== 0 &&
      Math.abs(dailyReturn) < 0.01
    ) {
      anomalyFlags.push('TINY_RETURN')
      hasAnomalies = true
    }

    if (yieldDayType === 'POSITIVE') {
      positiveDayCount++
      yieldDayCount++
      sumYieldPer += rawPer10k
      totalReturnOnYieldDays += dailyReturn
      recordedDayCount++
      sumCalPer += rawPer10k
      if (!periodStart) periodStart = e.date
      periodEnd = e.date
    } else if (yieldDayType === 'NEGATIVE') {
      negativeDayCount++
      yieldDayCount++
      sumYieldPer += rawPer10k
      totalReturnOnYieldDays += dailyReturn
      recordedDayCount++
      sumCalPer += rawPer10k
      if (!periodStart) periodStart = e.date
      periodEnd = e.date
    } else if (yieldDayType === 'ZERO') {
      zeroYieldDayCount++
      recordedDayCount++
      // sumCalPer += 0
      if (!periodStart) periodStart = e.date
      periodEnd = e.date
    } else if (yieldDayType === 'INVALID') {
      invalidDayCount++
    }

    days.push({
      date: e.date,
      dailyReturn: Number.isFinite(dailyReturn) ? dailyReturn : dailyReturn,
      previousEodBalance:
        previousEodBalance == null || !Number.isFinite(previousEodBalance)
          ? previousEodBalance
          : previousEodBalance,
      estimatedPer10k: rawPer10k == null ? null : round2(rawPer10k),
      yieldDayType,
      anomalyFlags
    })
  }

  const rawAvg = yieldDayCount > 0 ? sumYieldPer / yieldDayCount : null
  const rawAnn = rawAvg == null ? null : (rawAvg * 365) / 100
  const rawCal = recordedDayCount > 0 ? sumCalPer / recordedDayCount : null

  return {
    averagePer10k: rawAvg == null ? null : round2(rawAvg),
    averagePer10kOnCalendarDays: rawCal == null ? null : round2(rawCal),
    annualizedYield: rawAnn == null ? null : round2(rawAnn),
    yieldDayCount,
    positiveDayCount,
    negativeDayCount,
    zeroYieldDayCount,
    invalidDayCount,
    totalReturnOnYieldDays: round2(totalReturnOnYieldDays),
    calculationQuality: 'ESTIMATED',
    period: {
      startDate: periodStart,
      endDate: periodEnd,
      recordedDayCount
    },
    days,
    hasAnomalies
  }
}
```

修正明细字段：`dailyReturn` 对 NaN 原样保留为 `NaN` 或规范为 `null`——建议非有限时存 `null`，避免 JSON 丢失；测试用 `yieldDayType` 断言即可。

- [ ] **Step 4: 跑测试至通过**

```bash
node miniprogram/utils/finance/product-yield.test.js
```

Expected: 全部 assert 通过

- [ ] **Step 5: Commit（可选）**

```bash
git add miniprogram/utils/finance/product-yield.js miniprogram/utils/finance/product-yield.test.js
git commit -m "$(cat <<'EOF'
feat(finance): implement estimated product yield metrics

EOF
)"
```

---

### Task 3: 真实持仓验收 fixture + getStable 回归

**Files:**
- Modify: `miniprogram/utils/finance/product-yield.test.js`
- Read-only: `miniprogram/utils/finance/ledger.js`, `metrics.js`

- [ ] **Step 1: 追加 fixture 测试**

```js
const { rebuildLedger } = require('./ledger')
const { getStable } = require('./metrics')

function buildWenxiangHolding() {
  const holding = {
    startDate: '2026-10-14',
    principal: 100000,
    cashflows: [
      { date: '2026-10-14', type: 'buy', amount: 100000 },
      { date: '2026-10-22', type: 'buy', amount: 7300 },
      { date: '2026-10-28', type: 'buy', amount: 80000 }
    ],
    dailyEntries: [
      { date: '2026-10-14', dailyReturn: 0 },
      { date: '2026-10-15', dailyReturn: 0 },
      { date: '2026-10-16', dailyReturn: 19.74 },
      { date: '2026-10-19', dailyReturn: 9.87 },
      { date: '2026-10-20', dailyReturn: 9.87 },
      { date: '2026-10-21', dailyReturn: 9.88 },
      { date: '2026-10-22', dailyReturn: 9.87 },
      { date: '2026-10-23', dailyReturn: -0.01 },
      { date: '2026-10-26', dailyReturn: 10.6 },
      { date: '2026-10-27', dailyReturn: 0 },
      { date: '2026-10-28', dailyReturn: 10.59 },
      { date: '2026-10-29', dailyReturn: 10.59 },
      { date: '2026-10-30', dailyReturn: 36.96 },
      { date: '2026-11-02', dailyReturn: 0 }
    ]
  }
  const rebuilt = rebuildLedger(holding)
  return Object.assign({}, holding, { dailyEntries: rebuilt.dailyEntries })
}

{
  const h = buildWenxiangHolding()
  const m = calcProductYieldMetrics(h)
  assert.strictEqual(m.calculationQuality, 'ESTIMATED')
  assert.strictEqual(m.yieldDayCount, 10)
  assert.strictEqual(m.positiveDayCount, 9)
  assert.strictEqual(m.negativeDayCount, 1)
  assert.strictEqual(m.zeroYieldDayCount, 4)
  assert.strictEqual(m.yieldDayCount, m.positiveDayCount + m.negativeDayCount)
  assert.strictEqual(m.averagePer10k, 1.04)
  assert.strictEqual(m.annualizedYield, 3.81)
  assert.strictEqual(m.averagePer10kOnCalendarDays, 0.75)
  assert.strictEqual(m.totalReturnOnYieldDays, 127.96)
  assert.strictEqual(m.period.startDate, '2026-10-14')
  assert.strictEqual(m.period.endDate, '2026-11-02')
  assert.strictEqual(m.period.recordedDayCount, 14)

  const d22 = m.days.find((d) => d.date === '2026-10-22')
  assert.strictEqual(d22.previousEodBalance, 100049.36)
  const d28 = m.days.find((d) => d.date === '2026-10-28')
  assert.strictEqual(d28.previousEodBalance, 107369.82)

  const s = getStable(h, '2026-11-02')
  assert.strictEqual(s.per10kPerDay, 0.51)
  assert.strictEqual(s.stableDays, 5)
}
```

说明：测试文件 **可以** require `metrics` / `ledger`；`product-yield.js` **不可以**。

- [ ] **Step 2: 跑通**

```bash
node miniprogram/utils/finance/product-yield.test.js
node miniprogram/utils/finance/metrics.test.js
```

Expected: 两个文件均 OK；`getStable.per10kPerDay === 0.51`

- [ ] **Step 3: 静态检查依赖隔离**

```bash
! grep -n "require('./metrics')" miniprogram/utils/finance/product-yield.js
```

Expected: 无输出（exit 0 if using `grep -L` carefully；或 `rg` 无匹配）

- [ ] **Step 4: Commit（可选）**

```bash
git add miniprogram/utils/finance/product-yield.test.js
git commit -m "$(cat <<'EOF'
test(finance): lock product-yield fixture and stable regression

EOF
)"
```

---

### Task 4: 持仓详情 UI

**Files:**
- Modify: `miniprogram/pages/finance/holding-detail/index.js`
- Modify: `miniprogram/pages/finance/holding-detail/index.wxml`
- Modify: `miniprogram/pages/finance/holding-detail/index.wxss`（仅必要时）

- [ ] **Step 1: 在 `applyHolding` 中计算并组装展示行**

```js
const { calcProductYieldMetrics } = require('../../../utils/finance/product-yield')

// 在 applyHolding 内，calcAllMetrics 之后：
const py = calcProductYieldMetrics(holding)
const productYieldHero =
  py.averagePer10k == null ? '—' : fmtMoney(py.averagePer10k)
const productYieldRows = []
if (py.annualizedYield != null) {
  productYieldRows.push({
    label: '估算年化收益率',
    value: fmtPct(py.annualizedYield)
  })
}
productYieldRows.push({
  label: '有效收益日',
  value: py.yieldDayCount + '天'
})
productYieldRows.push({
  label: '正 / 负 / 零收益日',
  value:
    py.positiveDayCount +
    ' / ' +
    py.negativeDayCount +
    ' / ' +
    py.zeroYieldDayCount
})
// setData 增加：
// productYieldHero, productYieldRows, productYieldHasAnomalies: py.hasAnomalies,
// productYieldEmpty: py.averagePer10k == null && py.zeroYieldDayCount === 0 && py.invalidDayCount >= 0 && py.period.recordedDayCount === 0
```

空态：无任何 recorded 日时，区块显示「暂无足够日收益数据」。

- [ ] **Step 2: WXML — 放在「稳仓后」之前**

```xml
    <view class="mg">
      <view class="mgt">产品收益能力</view>
      <view class="py-hero">
        <text class="py-hero-num">{{productYieldHero}}</text>
        <text class="py-hero-unit">元</text>
      </view>
      <view class="mrf py-sub">平均每万元每日收益（收益日均 · 估算）</view>
      <view class="mrf py-sub">根据每日收益及前序持仓余额估算，不代表产品官方万份收益。</view>
      <view wx:if="{{productYieldHasAnomalies}}" class="mrf py-sub">存在微小收益调整日，已计入统计，可核对原始收益。</view>
      <view wx:for="{{productYieldRows}}" wx:key="label" class="mr">
        <text class="mrl">{{item.label}}</text>
        <text class="mrv">{{item.value}}</text>
      </view>
    </view>
    <view class="mg">
      <view class="mgt">稳仓后</view>
      ...
```

文案禁用「官方万份收益」作为指标名；仅在副文案中出现「不代表…官方…」。

- [ ] **Step 3: 样式**

在 `index.wxss` 增加轻量样式，例如：

```css
.py-hero {
  display: flex;
  align-items: baseline;
  padding: 8rpx 0 4rpx;
}
.py-hero-num {
  font-size: 48rpx;
  font-weight: 600;
}
.py-hero-unit {
  margin-left: 8rpx;
  font-size: 24rpx;
  opacity: 0.7;
}
.py-sub {
  display: block;
  margin-bottom: 6rpx;
}
```

- [ ] **Step 4: 手工验收清单**

- 打开该持仓详情 → 「产品收益能力」主数字约 **1.04**，估算年化约 **3.81%**  
- 「稳仓后」元/万/日仍为 **0.51**  
- 两区块上下分离，不混在一组  

- [ ] **Step 5: Commit（可选）**

```bash
git add miniprogram/pages/finance/holding-detail/index.js \
  miniprogram/pages/finance/holding-detail/index.wxml \
  miniprogram/pages/finance/holding-detail/index.wxss
git commit -m "$(cat <<'EOF'
feat(finance): show estimated product yield on holding detail

EOF
)"
```

---

### Task 5: 最终回归

- [ ] **Step 1: 跑相关测试**

```bash
node miniprogram/utils/finance/product-yield.test.js
node miniprogram/utils/finance/metrics.test.js
node miniprogram/utils/finance/ledger.test.js
```

Expected: 全部 OK

- [ ] **Step 2: 确认未改 metrics 算法**

```bash
git diff --stat -- miniprogram/utils/finance/metrics.js
```

Expected: 无 diff（或仅无关空白——应避免）

- [ ] **Step 3: 自检清单**

- [ ] `product-yield.js` 无 `require('./metrics')`  
- [ ] 未改 Schema / 云函数  
- [ ] 列表页未展示产品万份收益  
- [ ] 未为 HoldingYieldMetrics 增加抽象层  

---

## 验收数字速查（稳享 fixture）

| 字段 | 期望 |
|------|------|
| `averagePer10k` | `1.04` |
| `annualizedYield` | `3.81`（百分数） |
| `averagePer10kOnCalendarDays` | `0.75` |
| `yieldDayCount` | `10` |
| `positiveDayCount` / `negative` / `zero` | `9` / `1` / `4` |
| `totalReturnOnYieldDays` | `127.96` |
| 10-22 `previousEodBalance` | `100049.36` |
| 10-28 `previousEodBalance` | `107369.82` |
| `getStable(...).per10kPerDay` | `0.51` |

> 10-29 估算约 `0.57`：前序 EOD 已含 10-28 申购、份额尚未起息——属设计已知边界，不是 bug。

---

## 架构原则（实现中禁止违反）

1. **新增指标能力，不改造**现有财务计算体系。  
2. **不要**顺手重构 `metrics.js`。  
3. **不要**提前引入 `HoldingYieldMetrics` 抽象层。  
4. 数据不足 → `null` / `INVALID`，禁止猜测补齐。
