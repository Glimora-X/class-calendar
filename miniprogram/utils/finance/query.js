/**
 * 筛选 / 排序 / 列表视图模型
 */

const { fmtMoney, fmtPct, todayStr } = require('./money')
const { calcAllMetrics, getCumProfit, getLatestEOD, getStable } = require('./metrics')
const { calcAdvice } = require('./advice')
const { getEffectivePrincipal } = require('./ledger')

const SORT_KEYS = [
  { k: 'score', l: '决策分' },
  { k: 'name', l: '名称' },
  { k: 'principal', l: '本金' },
  { k: 'latestEOD', l: '最新余额' },
  { k: 'cumulativeProfit', l: '累计收益' },
  { k: 'holdingDays', l: '持有天数' },
  { k: 'cumulativeReturnRate', l: '持有收益率' },
  { k: 'simpleAnnualized', l: '单利年化' },
  { k: 'stableAnnualized', l: '稳仓后年化' },
  { k: 'expectedAnnual', l: '预期年化' },
  { k: 'endDate', l: '到期日' },
  { k: 'tag', l: '标签' }
]

const DEFAULT_FILTERS = {
  platform: 'all',
  type: 'all',
  status: 'all',
  advice: 'all',
  profit: 'all',
  tag: 'all'
}

function createDefaultFilters() {
  return Object.assign({}, DEFAULT_FILTERS)
}

function filterCount(filters) {
  let c = 0
  Object.keys(DEFAULT_FILTERS).forEach((k) => {
    if (filters[k] !== 'all') c++
  })
  return c
}

function getFiltered(holdings, filters, asOf) {
  const f = filters || DEFAULT_FILTERS
  return (holdings || []).filter((p) => {
    if (f.status !== 'all' && p.status !== f.status) return false
    if (f.status === 'all' && p.status === 'eliminated') return false
    if (f.platform !== 'all') {
      if (f.platform === 'none' && p.platform) return false
      if (f.platform !== 'none' && p.platform !== f.platform) return false
    }
    if (f.type !== 'all') {
      if (f.type === 'none' && p.type) return false
      if (f.type !== 'none' && p.type !== f.type) return false
    }
    if (f.advice !== 'all') {
      if (calcAdvice(p, asOf).advice !== f.advice) return false
    }
    if (f.profit !== 'all') {
      const pr = getCumProfit(p)
      if (f.profit === 'profit' && pr <= 0) return false
      if (f.profit === 'loss' && pr > 0) return false
    }
    if (f.tag !== 'all') {
      const tags = p.tags || []
      if (f.tag === 'none' && tags.length > 0) return false
      if (f.tag !== 'none' && tags.indexOf(f.tag) === -1) return false
    }
    return true
  })
}

function sortHoldings(list, sortKey, sortDir, asOf) {
  const dir = sortDir === 'asc' ? 'asc' : 'desc'
  const sk = SORT_KEYS.find((x) => x.k === sortKey) || SORT_KEYS[0]
  const arr = list.slice()
  arr.sort((a, b) => {
    let va
    let vb
    if (sk.k === 'score') {
      va = calcAdvice(a, asOf).score
      vb = calcAdvice(b, asOf).score
    } else if (sk.k === 'name') {
      return dir === 'desc'
        ? b.name.localeCompare(a.name, 'zh')
        : a.name.localeCompare(b.name, 'zh')
    } else if (sk.k === 'latestEOD') {
      va = getLatestEOD(a)
      vb = getLatestEOD(b)
    } else if (sk.k === 'cumulativeProfit') {
      va = getCumProfit(a)
      vb = getCumProfit(b)
    } else if (sk.k === 'holdingDays') {
      va = calcAllMetrics(a, asOf).holdingDays
      vb = calcAllMetrics(b, asOf).holdingDays
    } else if (sk.k === 'cumulativeReturnRate') {
      va = calcAllMetrics(a, asOf).cumulativeReturnRate
      vb = calcAllMetrics(b, asOf).cumulativeReturnRate
    } else if (sk.k === 'simpleAnnualized') {
      va = calcAllMetrics(a, asOf).simpleAnnualized
      vb = calcAllMetrics(b, asOf).simpleAnnualized
      if (va == null) va = -9999
      if (vb == null) vb = -9999
    } else if (sk.k === 'stableAnnualized') {
      const sa = getStable(a, asOf)
      const sb = getStable(b, asOf)
      va = sa && sa.stableAnnualized != null ? sa.stableAnnualized : -9999
      vb = sb && sb.stableAnnualized != null ? sb.stableAnnualized : -9999
    } else if (sk.k === 'expectedAnnual') {
      va = a.expectedAnnual || 0
      vb = b.expectedAnnual || 0
    } else if (sk.k === 'endDate') {
      va = a.endDate || '9999-99-99'
      vb = b.endDate || '9999-99-99'
      return dir === 'desc' ? (va < vb ? 1 : va > vb ? -1 : 0) : va > vb ? 1 : va < vb ? -1 : 0
    } else if (sk.k === 'tag') {
      va = (a.tags && a.tags[0]) || 'zzz'
      vb = (b.tags && b.tags[0]) || 'zzz'
      return dir === 'desc' ? (va < vb ? 1 : va > vb ? -1 : 0) : va > vb ? 1 : va < vb ? -1 : 0
    } else {
      va = a[sk.k] || 0
      vb = b[sk.k] || 0
    }
    return dir === 'desc' ? vb - va : va - vb
  })
  return arr
}

function buildCard(holding, asOf) {
  const m = calcAllMetrics(holding, asOf)
  const ad = calcAdvice(holding, asOf)
  const wanshou =
    m.stable && m.stable.per10kPerDay != null ? m.stable.per10kPerDay : null

  const tags = []
  if (holding.risk) tags.push({ text: holding.risk, tone: 'risk' })
  if (holding.platform) tags.push({ text: holding.platform, tone: 'ch' })
  if (holding.type) tags.push({ text: holding.type, tone: 'cu' })
  if (holding.minDays) tags.push({ text: '≥' + holding.minDays + '天', tone: 'rt' })
  ;(holding.tags || []).forEach((t) => tags.push({ text: t, tone: 'cu' }))
  if (holding.wasEliminated) tags.push({ text: '曾被淘汰', tone: 'we' })

  const metrics = []
  if (m.showAnnualized && m.simpleAnnualized != null) {
    metrics.push({
      label: '持仓年化',
      value: (m.simpleAnnualized >= 0 ? '+' : '') + m.simpleAnnualized.toFixed(2) + '%',
      tone: m.simpleAnnualized >= 0 ? 'pos' : 'neg'
    })
  } else {
    metrics.push({ label: '持仓年化', value: '不足7天', tone: 'neutral' })
  }
  if (wanshou != null) {
    metrics.push({
      label: '万收(稳仓)',
      value: (wanshou >= 0 ? '+' : '') + wanshou.toFixed(2),
      tone: wanshou >= 0 ? 'pos' : 'neg'
    })
  } else {
    metrics.push({ label: '万收(稳仓)', value: '—', tone: 'neutral' })
  }
  metrics.push({
    label: '持仓天数',
    value: m.holdingDays + '天',
    tone: 'neutral',
    shortCycle: m.holdingDays >= 7 && m.holdingDays < 30
  })

  const foot = []
  foot.push({ text: '余额¥' + fmtMoney(m.latestEOD), tone: 'muted' })
  foot.push({
    text: (m.cumulativeProfit >= 0 ? '+' : '') + fmtMoney(m.cumulativeProfit),
    tone: m.cumulativeProfit >= 0 ? 'pos' : 'neg'
  })
  if (m.expected) {
    const st = m.expected.status
    foot.push({
      text: st === 'target' ? '达标' : st === 'near' ? '接近' : '未达标',
      tone: st === 'target' ? 'pos' : st === 'near' ? 'muted' : 'neg'
    })
  }
  if (m.distToMaturity != null && m.distToMaturity <= 7 && m.distToMaturity >= 0) {
    foot.push({ text: m.distToMaturity + '天后到期', tone: 'warn' })
  } else if (m.distToMaturity != null && m.distToMaturity < 0) {
    foot.push({ text: '已到期', tone: 'muted' })
  }
  foot.push({ text: '分' + ad.score, tone: 'hi' })

  return {
    id: holding._id,
    name: holding.name,
    tags,
    advice: { code: ad.advice, label: ad.advice },
    metrics,
    foot
  }
}

function buildSummary(holdings, asOf) {
  const active = (holdings || []).filter((p) => p.status !== 'eliminated')
  const byCur = {}
  active.forEach((p) => {
    const c = p.currency || 'CNY'
    if (!byCur[c]) byCur[c] = { principal: 0, eod: 0, profit: 0 }
    byCur[c].principal += Number(p.principal) || 0
    byCur[c].eod += getLatestEOD(p)
    byCur[c].profit += getCumProfit(p)
  })
  const keys = Object.keys(byCur)
  const c = keys[0] || 'CNY'
  const d = byCur[c] || { principal: 0, eod: 0, profit: 0 }
  return {
    count: active.length,
    multiCurrency: keys.length > 1,
    currencies: keys,
    principalText: fmtMoney(d.principal),
    eodText: fmtMoney(d.eod),
    profitText: fmtMoney(Math.abs(d.profit)),
    profitTone: d.profit >= 0 ? 'pos' : 'neg',
    profitSign: d.profit >= 0 ? '+' : '-'
  }
}

function buildPlatformSummary(holdings) {
  const pm = {}
  ;(holdings || []).forEach((p) => {
    if (p.status === 'eliminated') return
    const pl = p.platform || '未填写'
    const c = p.currency || 'CNY'
    if (!pm[pl]) pm[pl] = {}
    pm[pl][c] = (pm[pl][c] || 0) + (Number(p.principal) || 0)
  })
  const items = []
  Object.keys(pm).forEach((pl) => {
    Object.keys(pm[pl]).forEach((c) => {
      items.push({
        id: pl + ':' + c,
        label: pl,
        amountText: c + ' ' + fmtMoney(pm[pl][c])
      })
    })
  })
  return items
}

function buildFilterGroups(holdings, catalog, filters, asOf) {
  const active = (holdings || []).filter((p) => p.status !== 'eliminated')
  const cnt = (fn) => active.filter(fn).length
  const f = filters || DEFAULT_FILTERS
  const platforms = (catalog && catalog.platforms) || []
  const types = (catalog && catalog.types) || []
  const tags = (catalog && catalog.tags) || []

  function opts(key, allCount, extra) {
    const list = [{ value: 'all', label: '全部', count: allCount, active: f[key] === 'all' }]
    ;(extra || []).forEach((o) => {
      if (o.count > 0 || o.value === 'all') {
        list.push({
          value: o.value,
          label: o.label,
          count: o.count,
          active: f[key] === o.value
        })
      }
    })
    return list
  }

  const groups = [
    {
      key: 'platform',
      label: '购买平台',
      options: opts(
        'platform',
        active.length,
        platforms
          .map((p) => ({ value: p, label: p, count: cnt((x) => x.platform === p) }))
          .concat([
            { value: 'none', label: '未填写', count: cnt((x) => !x.platform) }
          ])
      )
    },
    {
      key: 'type',
      label: '所属类型',
      options: opts(
        'type',
        active.length,
        types
          .map((t) => ({ value: t, label: t, count: cnt((x) => x.type === t) }))
          .concat([{ value: 'none', label: '未填写', count: cnt((x) => !x.type) }])
      )
    },
    {
      key: 'status',
      label: '状态',
      options: opts('status', active.length, [
        { value: 'active', label: '持有中', count: cnt((x) => x.status === 'active') },
        { value: 'matured', label: '已到期', count: cnt((x) => x.status === 'matured') }
      ])
    },
    {
      key: 'advice',
      label: '建议',
      options: opts(
        'advice',
        active.length,
        ['ADD', 'HOLD', 'REDUCE', 'EXIT', 'WATCH'].map((a) => ({
          value: a,
          label: a,
          count: cnt((x) => calcAdvice(x, asOf).advice === a)
        }))
      )
    },
    {
      key: 'profit',
      label: '收益',
      options: opts('profit', active.length, [
        { value: 'profit', label: '盈利', count: cnt((x) => getCumProfit(x) > 0) },
        { value: 'loss', label: '亏损', count: cnt((x) => getCumProfit(x) <= 0) }
      ])
    },
    {
      key: 'tag',
      label: '标签',
      options: opts(
        'tag',
        active.length,
        tags
          .map((t) => ({
            value: t,
            label: t,
            count: cnt((x) => (x.tags || []).indexOf(t) !== -1)
          }))
          .concat([
            {
              value: 'none',
              label: '无标签',
              count: cnt((x) => !(x.tags || []).length)
            }
          ])
      )
    }
  ]
  return groups
}

function buildDocks(holdings, asOf) {
  const docks = []
  const g = { EXIT: [], REDUCE: [], ADD: [], WATCH: [], HOLD: [] }
  ;(holdings || []).forEach((p) => {
    if (p.status === 'eliminated') return
    const a = calcAdvice(p, asOf).advice
    if (g[a]) g[a].push(p.name.substring(0, 8))
  })
  const adviceRows = []
  ;['EXIT', 'REDUCE', 'ADD', 'WATCH', 'HOLD'].forEach((a) => {
    if (!g[a].length) return
    adviceRows.push({
      id: a,
      badge: a,
      text: g[a].join('、') + (g[a].length > 3 ? ' 等' + g[a].length + '只' : '')
    })
  })
  const adviceCount =
    g.EXIT.length + g.REDUCE.length + g.ADD.length + g.WATCH.length + g.HOLD.length
  docks.push({
    id: 'advice',
    variant: 'advice',
    title: '今日建议',
    countText: '共 ' + adviceCount + ' 只',
    rows: adviceRows,
    hint: ''
  })

  const ex = []
  ;(holdings || []).forEach((p) => {
    if (p.status !== 'active' || !p.endDate) return
    const m = calcAllMetrics(p, asOf)
    if (m.distToMaturity != null && m.distToMaturity <= 7 && m.distToMaturity >= 0) {
      ex.push({
        id: p._id,
        name: p.name.substring(0, 12),
        days: m.distToMaturity
      })
    }
  })
  if (ex.length) {
    docks.push({
      id: 'expiry',
      variant: 'expiry',
      title: '即将到期（7天内）',
      countText: ex.length + ' 只',
      rows: ex.map((e) => ({
        id: e.id,
        text: e.name + '...',
        right: e.days + '天'
      })),
      hint: ''
    })
  }

  const elimCount = (holdings || []).filter((p) => p.status === 'eliminated').length
  docks.push({
    id: 'eliminated',
    variant: 'eliminated',
    title: '已淘汰产品',
    countText: elimCount + ' 只',
    rows: [],
    hint: '查看已淘汰产品，可还原或永久删除 ›',
    openable: true
  })

  return docks
}

/**
 * @param {{ holdings: Array, catalog: object, filters: object, sortKey: string, sortDir: string, asOf?: string }} input
 */
function buildAssetPageModel(input) {
  const asOf = input.asOf || todayStr()
  const holdings = input.holdings || []
  const filters = input.filters || createDefaultFilters()
  const sortKey = input.sortKey || 'score'
  const sortDir = input.sortDir || 'desc'
  const filtered = getFiltered(holdings, filters, asOf)
  const sorted = sortHoldings(filtered, sortKey, sortDir, asOf)
  const sk = SORT_KEYS.find((x) => x.k === sortKey) || SORT_KEYS[0]

  return {
    asOf,
    filterCount: filterCount(filters),
    summary: buildSummary(holdings, asOf),
    platforms: buildPlatformSummary(holdings),
    sortLabel: sk.l + (sortDir === 'desc' ? ' ↓' : ' ↑'),
    cards: sorted.map((h) => buildCard(h, asOf)),
    filterGroups: buildFilterGroups(holdings, input.catalog, filters, asOf),
    docks: buildDocks(holdings, asOf)
  }
}

module.exports = {
  SORT_KEYS,
  DEFAULT_FILTERS,
  createDefaultFilters,
  filterCount,
  getFiltered,
  sortHoldings,
  buildCard,
  buildSummary,
  buildPlatformSummary,
  buildFilterGroups,
  buildDocks,
  buildAssetPageModel,
  fmtMoney,
  fmtPct,
  getEffectivePrincipal
}
