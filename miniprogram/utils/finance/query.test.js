const assert = require('assert')
const {
  filterCount,
  createDefaultFilters,
  buildPlatformChips,
  buildSortOptions,
  buildFilterGroups,
  buildAssetPageModel,
  SORT_KEYS
} = require('./query')

const holdings = [
  {
    _id: '1',
    name: '产品A',
    platform: '北京银行',
    type: '固收',
    status: 'active',
    principal: 10000,
    currency: 'CNY',
    tags: [],
    expectedAnnual: 3,
    dailyEntries: [
      { date: '2026-11-01', dailyReturn: 50, eodBalance: 10050 }
    ]
  },
  {
    _id: '2',
    name: '产品B',
    platform: '工商银行',
    type: '固收+',
    status: 'active',
    principal: 20000,
    currency: 'CNY',
    tags: ['可加仓'],
    expectedAnnual: 4,
    dailyEntries: [
      { date: '2026-11-01', dailyReturn: 100, eodBalance: 20100 }
    ]
  },
  {
    _id: '3',
    name: '已淘汰',
    platform: '北京银行',
    type: '固收',
    status: 'eliminated',
    principal: 5000,
    currency: 'CNY',
    tags: [],
    expectedAnnual: 2,
    dailyEntries: []
  }
]

const catalog = {
  platforms: ['北京银行', '工商银行', '建设银行'],
  types: ['固收', '固收+'],
  tags: ['可加仓']
}

// filterCount 不计购买平台
const filtersPlat = Object.assign(createDefaultFilters(), { platform: '北京银行' })
assert.strictEqual(filterCount(filtersPlat), 0)
const filtersType = Object.assign(createDefaultFilters(), { type: '固收' })
assert.strictEqual(filterCount(filtersType), 1)
const filtersBoth = Object.assign(createDefaultFilters(), {
  platform: '北京银行',
  type: '固收',
  tag: '可加仓'
})
assert.strictEqual(filterCount(filtersBoth), 2)

// 平台 chips：全部 + 有持仓的平台，不含无持仓的建设银行
const chips = buildPlatformChips(holdings, catalog, createDefaultFilters())
assert.strictEqual(chips[0].id, 'all')
assert.strictEqual(chips[0].active, true)
assert.strictEqual(chips[0].count, 2)
const bj = chips.find((c) => c.id === '北京银行')
const icbc = chips.find((c) => c.id === '工商银行')
const ccb = chips.find((c) => c.id === '建设银行')
assert.ok(bj)
assert.strictEqual(bj.count, 1)
assert.ok(icbc)
assert.strictEqual(icbc.count, 1)
assert.strictEqual(ccb, undefined)

const chipsBj = buildPlatformChips(holdings, catalog, filtersPlat)
assert.strictEqual(chipsBj.find((c) => c.id === '北京银行').active, true)
assert.strictEqual(chipsBj[0].active, false)

// 排序选项
const sortOpts = buildSortOptions('score', 'desc')
assert.strictEqual(sortOpts.length, SORT_KEYS.length)
assert.strictEqual(sortOpts[0].active, true)
assert.strictEqual(sortOpts[0].dirLabel, '↓')
const sortAsc = buildSortOptions('name', 'asc')
const nameOpt = sortAsc.find((o) => o.key === 'name')
assert.ok(nameOpt.active)
assert.strictEqual(nameOpt.dirLabel, '↑')

// 抽屉不再含购买平台
const groups = buildFilterGroups(holdings, catalog, createDefaultFilters())
assert.strictEqual(groups.some((g) => g.key === 'platform'), false)
assert.ok(groups.some((g) => g.key === 'type'))

// 页面模型含顶栏数据
const model = buildAssetPageModel({
  holdings,
  catalog,
  filters: filtersPlat,
  sortKey: 'score',
  sortDir: 'desc'
})
assert.ok(Array.isArray(model.platformChips))
assert.ok(model.platformChips.find((c) => c.id === '北京银行').active)
assert.ok(Array.isArray(model.sortOptions))
assert.strictEqual(model.filterCount, 0)
assert.strictEqual(model.cards.length, 1)
assert.strictEqual(model.filterGroups.some((g) => g.key === 'platform'), false)
// 汇总跟随平台筛选（仅北京银行 1 只）
assert.strictEqual(model.summary.count, 1)
assert.strictEqual(model.summary.profitText, '50.00')

const modelAll = buildAssetPageModel({
  holdings,
  catalog,
  filters: createDefaultFilters(),
  sortKey: 'score',
  sortDir: 'desc'
})
assert.strictEqual(modelAll.summary.count, 2)
assert.strictEqual(modelAll.summary.profitText, '150.00')

// 已清仓：不进持仓只数，但冻结损益计入总收益
const holdingsWithClosed = holdings.concat([
  {
    _id: '4',
    name: '已清仓',
    platform: '北京银行',
    type: '固收',
    status: 'closed',
    principal: 3000,
    currency: 'CNY',
    tags: [],
    realizedProfit: -2.94,
    closedDate: '2026-11-05',
    dailyEntries: []
  }
])
const modelClosed = buildAssetPageModel({
  holdings: holdingsWithClosed,
  catalog,
  filters: createDefaultFilters(),
  sortKey: 'score',
  sortDir: 'desc'
})
assert.strictEqual(modelClosed.summary.count, 2)
assert.strictEqual(modelClosed.summary.profitText, '147.06')
assert.strictEqual(modelClosed.summary.profitSign, '+')
assert.strictEqual(
  modelClosed.cards.some((c) => c.id === '4'),
  false
)
assert.ok(modelClosed.docks.some((d) => d.variant === 'closed'))
const statusGroup = modelClosed.filterGroups.find((g) => g.key === 'status')
assert.ok(statusGroup.options.some((o) => o.value === 'closed' && o.count === 1))

const { buildCard } = require('./query')
const card = buildCard(holdings[0], '2026-11-04')
const profitFoot = card.foot.find((f) => String(f.text).indexOf('(') !== -1)
assert.ok(profitFoot)
assert.ok(/\(11\/01\)/.test(profitFoot.text))

const cardNoEntry = buildCard(
  Object.assign({}, holdings[0], { dailyEntries: [] }),
  '2026-11-04'
)
assert.strictEqual(
  cardNoEntry.foot.some((f) => String(f.text).indexOf('(') !== -1),
  false
)

console.log('query.test.js ok')
