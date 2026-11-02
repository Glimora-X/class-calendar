# 产品收益能力指标（ProductYieldMetrics）设计说明

**日期：** 2026-11-02  
**状态：** 已冻结（可进入 implementation plan）  
**范围：** 第一阶段 — 在不改 Schema、不改 `getStable` / 现有 `calcAllMetrics` 算法的前提下，新增独立的「估算产品万份收益」分析能力；**仅持仓详情页**分区展示。

---

## 1. 目标

同时回答两个不同问题，且指标语义不可混用：

| 问题 | 现有/新增 | 指标 |
|------|-----------|------|
| 我的资金投入后实际赚了多少？ | 现有 `calcAllMetrics` + `getStable` | 累计收益、TWR、IRR、稳仓元/万/日… |
| 这款产品本身赚钱能力怎么样？ | **新增** `calcProductYieldMetrics` | 估算收益日均万份收益、简单年化估算… |

三层概念（本阶段只落地产品层 + 沿用已有稳仓层）：

| 层 | 回答 |
|----|------|
| 产品收益能力 | 估算万份收益 — 产品每天的收益表现 |
| 个人持仓收益 | 累计收益 / TWR / IRR — 自己的资金实际赚了多少 |
| 稳仓表现 | `getStable` — 末次现金流之后的持仓表现 |

**非目标（第一阶段不做）：**

- 宣称或展示「银行官方万份收益」
- 修改日收益 / 现金流录入 Schema
- 修改 `getStable` 定义或自然日稳仓口径
- 引入产品主数据、份额、净值字段
- 实现完整 `HoldingYieldMetrics` 中间层（仅预留分层概念）
- **列表页展示产品万份收益**（等详情页验证后再议）

**第一阶段硬约束（优先于「与银行逐日一致」）：**

1. 算法不得污染现有个人持仓收益与稳仓指标。  
2. 所有估算结果必须有明确、可解释的数据来源。  
3. 数据不足时返回 `null` / `INVALID`，**绝不猜测补齐**。

---

## 2. 已确认决策

| 项 | 决策 |
|----|------|
| 数据来源 | 仅用现有 `dailyEntries(dailyReturn, eodBalance)`（现金流不参与当日基数） |
| Schema | **不改** |
| `calcAllMetrics` 现有字段算法 | **不改**；也不把产品收益字段塞进其返回值 |
| `getStable` | **完全保留** |
| 产品收益模块 | 独立 `product-yield.js`，**禁止** `require('./metrics')` |
| 函数形态 | 纯函数 `calcProductYieldMetrics(holding)`：不读库、不改 holding、不依赖「今天」 |
| 计息基数 | **严格早于当日的最近一条** `dailyEntries` 的 `eodBalance`（可跨缺失自然日）；**不含当日现金流** |
| 前序 EOD 无效 | 缺失 / null / 非有限数 / ≤0 → 基数无效；**禁止**跳过无效记录再向前找更早余额 |
| 当日申购/赎回 | 申购不加入当日基数；赎回第一阶段也不调整基数 |
| 结果性质 | 恒为 **ESTIMATED** |
| 收益日符号分类 | 先按金额符号分类；再对非零日校验基数 |
| ZERO | 分类保留 ZERO，**不因缺基数改为 INVALID**；不计入收益日均；自然日日均按 0 |
| INVALID | 收益非有限，**或**非零收益但前序基数无效（注释区分两种来源） |
| 年化公式 | 百分数 = `rawAveragePer10k × 365 / 100`（与 metrics 百分数约定一致） |
| ε 阈值 | **不参与**收益日判定；仅用于 `TINY_RETURN` 异常标记 |
| 主展示指标 | `averagePer10k`（收益日均估算万份收益） |
| 年化精度 | **先用未舍入均值算年化，再分别 `round2`** |
| `totalReturnOnYieldDays` | **仅**累计真正进入 `averagePer10k` 的有效收益日 |
| `period` | 参与自然日日均的首/末日；不是原始 entries 首尾，也不是查询区间 |
| UI | 仅详情页；产品能力与稳仓上下分区；文案标明估算 |
| 列表页 | 第一阶段不展示 |

---

## 3. 架构

### 3.1 模块边界

```
miniprogram/utils/finance/
├── metrics.js              # 现有；算法不变；product-yield 不依赖本文件
├── product-yield.js        # 新增：calcProductYieldMetrics（纯函数）
└── product-yield.test.js   # 新增：验收用例
```

调用层（持仓详情）提供同一份快照、分别计算：

```js
const metrics = calcAllMetrics(holding, asOf)
const productYield = calcProductYieldMetrics(holding)
```

原则：

- `product-yield.js` **不得** `require` `metrics.js`（含 `getStable`）。
- 两套指标不得互相引用对方的派生口径。
- 第一阶段 **不**扩展 `calcAllMetrics` 返回值。
- 第一阶段 **不**在列表卡展示产品万份收益，避免再次混淆。

### 3.2 长期分层（仅概念）

```
ProductYieldMetrics     产品收益能力（本阶段）
        │
HoldingYieldMetrics     个人持仓收益（未来）
        │
StableMetrics           稳仓表现（已有 getStable）
```

---

## 4. 计算口径

### 4.1 前序 EOD（`previousEodBalance`）

第一阶段采用 **「前一条录入记录」**，不是严格「前一自然日」：

```text
previousEntry = 按 date 升序后，严格早于当前 date 的最近一条 dailyEntries
previousEodBalance = previousEntry.eodBalance
```

**排序与同日记录（实现约束）：**

- **不修改**传入的 `holding.dailyEntries` 原数组；仅对副本排序/建索引。
- 现有写入路径（`upsertDailyReturn`）按 `date` 覆盖，**一天一条**；本模块依赖该约束，不引入业务级合并逻辑。
- 防御性：若脏数据出现同日多条，按日期建 `Map` 时 **后写覆盖**（与 upsert 语义一致）；同日记录 **不得**互为前序。
- 不同输入顺序经规范化后必须得到相同聚合结果。

约束：

| 规则 | 说明 |
|------|------|
| 可跨缺失自然日 | 例：10-23/24 无行时，10-26 可用 10-22 的 EOD |
| 禁止使用当日 EOD | 分母绝不能取当天 `eodBalance`（当天已含收益/现金流） |
| 禁止跳过无效前序 | 若最近前序的 `eodBalance` 缺失、`null`、非有限数（NaN/±Infinity）或 ≤0，则 **基数无效**；**不得**再向前找更早一条「碰巧有效」的余额 |
| 期间现金流 | 若跨日期间发生申购/赎回，因无起息日仍按估算处理（质量仍为 ESTIMATED） |

有效基数判定：

```text
isValidBase(x) =
  x != null && Number.isFinite(x) && x > 0
```

### 4.2 单日估算万份收益

```text
estimatedPer10k =
  dailyReturn / previousEodBalance × 10000
```

仅在「非零收益 + 有效基数」时计算；否则为 `null`。

| 场景 | 处理 |
|------|------|
| 普通收益日 | 使用前序有效 EOD |
| 当日发生申购 | **不**加入当日计息基数 |
| 当日发生赎回 | 第一阶段 **不**调整基数 |
| 无前序记录 | 非零日 → INVALID；零收益日 → 仍为 ZERO |
| 前序 EOD 无效 | 同上 |

### 4.3 分类优先级（`yieldDayType`）

**第一步：输入校验 + 按金额符号分类**

```js
function classifyByReturn(dailyReturn) {
  if (dailyReturn == null) return 'MISSING'
  if (!Number.isFinite(dailyReturn)) return 'INVALID' // 原因：收益金额非有限数
  if (dailyReturn > 0) return 'POSITIVE'
  if (dailyReturn < 0) return 'NEGATIVE'
  return 'ZERO'
}
```

> `NaN` 不得落入 ZERO（`NaN > 0` / `< 0` 均为 false）。

**第二步：仅对 POSITIVE / NEGATIVE 做基数校验**

```text
金额非有限 → INVALID（原因：dailyReturn 非有限；不跑 Math.abs 异常检测）
POSITIVE / NEGATIVE + 基数无效 → INVALID（原因：前序计息基数无效），estimatedPer10k = null
POSITIVE / NEGATIVE + 基数有效 → 保持 POSITIVE/NEGATIVE，计算 estimatedPer10k
ZERO                            → 保持 ZERO；estimatedPer10k 视为 0（不要求基数）
MISSING                         → 不参与任何统计
```

语义：`INVALID` 有两种来源，实现注释须区分：
1. 收益金额非有限，无法分类；
2. 非零收益存在，但前序计息基数无效。

零收益不需要万份收益公式，故 **不因缺基数改为 INVALID**。

**硬约束：** 负收益日在基数有效时必须参与平均值；不得因金额小而排除。

### 4.4 统计参与矩阵（锁定）

| 类型 | 收益日均 | 自然日日均 | 计数 |
|------|----------|------------|------|
| POSITIVE（基数有效） | 是 | 是（用 estimatedPer10k） | `positiveDayCount`、`yieldDayCount` |
| NEGATIVE（基数有效） | 是 | 是 | `negativeDayCount`、`yieldDayCount` |
| ZERO | 否 | 是（按 0） | `zeroYieldDayCount`；计入 `recordedDayCount` |
| MISSING | 否 | 否 | 不计数 |
| INVALID | 否 | 否 | `invalidDayCount` |

**计数一致性：** `positiveDayCount` / `negativeDayCount` 只统计 **基数有效、真正进入收益日均** 的日，与 `yieldDayCount` 对齐：

```text
yieldDayCount === positiveDayCount + negativeDayCount
```

不得出现「金额为正的有 5 天，但其中 2 天无有效基数 → positiveDayCount=5、yieldDayCount=3」。

### 4.5 异常标记（`anomalyFlags`）

异常检测 **不得**改写 `yieldDayType`，也 **不得**把该日踢出统计。

| Flag | 条件 | 含义 |
|------|------|------|
| `TINY_RETURN` | 仅当 `Number.isFinite(dailyReturn) && dailyReturn !== 0 && Math.abs(dailyReturn) <= 0.01` | 微小收益/调整，待核查（含 ±0.01） |

（可在 POSITIVE/NEGATIVE 日标记；对「收益非有限」的 INVALID **禁止**对 `dailyReturn` 做 `Math.abs`；ZERO/MISSING 不标。同日脏数据后写覆盖，不互为前序。）

### 4.6 聚合与精度顺序

**收益日均（主指标）**

```text
有效收益日 = yieldDayType ∈ {POSITIVE, NEGATIVE}（已含基数有效前提）
rawAveragePer10k = sum(estimatedPer10k) / yieldDayCount
averagePer10k = round2(rawAveragePer10k)   // yieldDayCount===0 → null
```

**自然日日均（有记录日口径）**

```text
参与日 = POSITIVE | NEGATIVE | ZERO（同上表）
rawAveragePer10kOnCalendarDays = sum(per10k 或 0) / recordedDayCount
averagePer10kOnCalendarDays = round2(...)  // recordedDayCount===0 → null
```

周末无录入行不进入分母（不补齐日历空洞）。UI 可轻提示「按已录入日期统计」。

**简单年化（先未舍入均值）**

语义：万份收益 \(r\) 元 ⇒ 日收益率 \(r/10000\) ⇒ 简单年化百分数 \(r/10000 \times 365 \times 100 = r \times 365 / 100\)。

```js
const rawAveragePer10k = sumPer10k / yieldDayCount
// 与 metrics.js 一致：存百分数（4.02 表示 4.02%），不是小数 0.0402
const rawAnnualizedYield = (rawAveragePer10k * 365) / 100
return {
  averagePer10k: round2(rawAveragePer10k),
  annualizedYield: round2(rawAnnualizedYield)
}
```

**禁止**先 `round2(averagePer10k)` 再算年化。

**精度推广（整个模块）：**

- 单日 `estimatedPer10k`：中间保留完整浮点精度，**不对单日先 round2**。
- 收益日均 / 自然日日均：用原始单日值求和再除。
- 年化：用原始收益日均（未 round）计算。
- **仅最终返回**的 `averagePer10k`、`averagePer10kOnCalendarDays`、`annualizedYield`、`totalReturnOnYieldDays` 等对外数字按现有 `round2`（`miniprogram/utils/finance/money.js`）处理。
- `days[]` 明细中的 `estimatedPer10k` 亦对外 `round2`（便于展示）；但聚合 **不得**用已 round 的明细回算。

`yieldDayCount === 0` 时：`averagePer10k`、`annualizedYield` 均为 `null`。  
若仅有 ZERO 日：`averagePer10k`/`annualizedYield` 为 `null`，`averagePer10kOnCalendarDays === 0`。

**`totalReturnOnYieldDays`**

仅累加真正进入 `averagePer10k` 的有效收益日之 `dailyReturn`。  
INVALID 日的收益金额 **不**计入该字段。第一阶段不增加 `totalReturnOnRecordedDays`。

### 4.7 `period`

```text
startDate = 参与自然日日均的首条日期（POSITIVE | NEGATIVE | ZERO）
endDate   = 参与自然日日均的末条日期
recordedDayCount = 上述参与日数量
```

- **不要**直接用原始 `dailyEntries` 首尾（可能夹杂日后扩展的无效语义）。  
- **不要**把 `period` 当成用户查询区间；若未来有查询区间，另参传入，不复用本字段。  
- 无参与日时：`startDate`/`endDate` 为 `null`，`recordedDayCount === 0`。

### 4.8 可信度

```text
calculationQuality: 'ESTIMATED'
```

第一阶段恒为此值。

### 4.9 已知近似边界

1. 无份额、无净值、无起息日 → 始终估算。  
2. 前序 EOD 已含「已确认未起息」资金时，可能高估分母、低估万份收益。  
3. 不含当日现金流通常更贴近「申购日未起息」产品，但非普遍计息模型。  
4. 赎回日基数暂不调整。  
5. 跨缺失日沿用更早 EOD 时，期间现金流起息不明，仍只标 ESTIMATED，不猜测补数。

---

## 5. 返回数据结构

```ts
type YieldDayType = 'POSITIVE' | 'NEGATIVE' | 'ZERO' | 'MISSING' | 'INVALID'
type AnomalyFlag = 'TINY_RETURN'

interface ProductYieldDayBreakdown {
  date: string
  dailyReturn: number | null
  previousEodBalance: number | null
  estimatedPer10k: number | null
  yieldDayType: YieldDayType
  anomalyFlags: AnomalyFlag[]
}

interface ProductYieldMetrics {
  /** 收益日均估算万份收益 — 主指标；round2 后 */
  averagePer10k: number | null
  /** 有记录自然日日均；round2 后 */
  averagePer10kOnCalendarDays: number | null
  /** 简单年化估算（百分数）；由未舍入均值算出后再 round2 */
  annualizedYield: number | null
  yieldDayCount: number
  positiveDayCount: number
  negativeDayCount: number
  zeroYieldDayCount: number
  invalidDayCount: number
  /** 仅有效收益日（进入 averagePer10k 者）的 dailyReturn 合计 */
  totalReturnOnYieldDays: number
  calculationQuality: 'ESTIMATED'
  period: {
    startDate: string | null
    endDate: string | null
    recordedDayCount: number
  }
  days: ProductYieldDayBreakdown[]
  hasAnomalies: boolean
}
```

---

## 6. UI（持仓详情 · 仅此）

独立区块「产品收益能力」，与「稳仓表现」上下分区：

```
产品收益能力
  主数字：{averagePer10k} 元
  说明：平均每万元每日收益（收益日均 · 估算）
  副文案：根据每日收益及前序持仓余额估算，不代表产品官方万份收益。

  估算年化收益率    {annualizedYield}%
  有效收益日        {yieldDayCount}天
  正 / 负 / 零收益日  {positive}/{negative}/{zero}

  ── 分割 ──

稳仓表现（现有 stableRows）
  元/万/日、稳仓天数、稳仓 TWR…
```

`hasAnomalies` 时轻提示：微小收益调整日已计入统计，可核对原始收益。  
禁用词：官方万份收益、真实万份收益。

---

## 7. 验收案例（稳享灵动慧利日开128号）

### 7.1 输入摘要

- 现金流：10-14 买 100000；10-22 买 7300；10-28 买 80000  
- 日收益：截图序列（含 10-23=-0.01，10-27/11-02=0）  
- 账本 EOD 由现有 `rebuildLedger` 产生后传入（`calcProductYieldMetrics` 只读 `dailyEntries`）

### 7.2 单日与加仓回归

| 日期 | dailyReturn | yieldDayType | anomaly | 断言重点 |
|------|-------------|--------------|---------|----------|
| 10-22 | 9.87 | POSITIVE | — | **`previousEodBalance` = 10-21 的 EOD**（不含当日 +7300）；per10k≈1 |
| 10-23 | -0.01 | NEGATIVE | TINY_RETURN | 计入收益日均 |
| 10-28 | 10.59 | POSITIVE | — | **`previousEodBalance` = 10-27 的 EOD**（不含当日 +80000）；per10k≈1 |
| 10-30 | 36.96 | POSITIVE | — | per10k≈2 |

加仓日测试须 **直接断言 `previousEodBalance`**，不能只断言 per10k≈1。

### 7.3 聚合

- `calculationQuality === 'ESTIMATED'`
- `yieldDayCount === positiveDayCount + negativeDayCount`
- `averagePer10k` 含 -0.01 样本（非剔异常后的口头「约 1.10」）
- 并行调用 `getStable` → `per10kPerDay` 仍约 **0.51**

---

## 8. 测试要求

`product-yield.test.js` 至少覆盖：

1. 收益日分类：正 / 负 / 零 / 缺失  
2. `TINY_RETURN` 标记且仍计入平均  
3. 加仓日：断言 `previousEodBalance` 为前序 EOD（10-22 / 10-28）  
4. 非零收益且无前序记录 → INVALID  
5. 与 `getStable` 并行：稳仓 `per10kPerDay` 不变（测试文件可 require metrics，实现文件不可）  
6. 全量验收 fixture → 锁定 `averagePer10k` / `annualizedYield` / counts  
7. **ZERO 日无前序 EOD**：仍为 ZERO，计入自然日日均（贡献 0）  
8. **前序 EOD 为 0 / 负数 / null**：非零日 → INVALID；且不向前跳过  
9. **NaN / Infinity** 前序或收益：不得污染平均值  
10. **仅有 ZERO 日**：`averagePer10k`/`annualizedYield` 为 `null`，`averagePer10kOnCalendarDays === 0`

---

## 9. 未来扩展（非本阶段）

- `cashflows[].settleDate?: string`  
- 日录入可选份额 / 净值  
- `HoldingYieldMetrics`  
- 赎回日基数规则  
- 列表摘要（需验证详情页语义不被误读后再做）

---

## 10. ADR 摘要

**Context：** 银行万份收益与 App 稳仓元/万/日被混读；模型无份额/起息日。  

**Decision：** 独立纯函数 `calcProductYieldMetrics`；前序有效 EOD 为基数；ESTIMATED；符号分类 + 非零日基数校验；异常独立；年化用未舍入均值；仅详情页。  

**Alternatives：** 改 getStable（拒）；ε 过滤（拒）；跳过无效前序找更早 EOD（拒）；第一阶段 settleDate（延后）；列表展示（延后）。  

**Trade-offs：** 可跨缺失日沿用更早 EOD，期间现金流起息不明时仍有偏差；但拒绝猜测补数。  

**Future：** settleDate / 份额净值精确链路。
