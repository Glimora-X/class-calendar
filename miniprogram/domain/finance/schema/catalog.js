/**
 * 平台 / 类型 / 标签配置库
 */

const DEFAULT_PLATFORMS = [
  '工商银行',
  '中国银行',
  '建设银行',
  '中邮理财',
  '民生银行',
  '招商银行'
]

const DEFAULT_TYPES = ['固收', '固收+', '混合', '现金管理', '权益']

const DEFAULT_TAGS = ['可加仓', '可赎回', '可清仓', '观望中', '长线持有']

/**
 * @returns {{ platforms: string[], types: string[], tags: string[] }}
 */
function createDefaultCatalog() {
  return {
    platforms: DEFAULT_PLATFORMS.slice(),
    types: DEFAULT_TYPES.slice(),
    tags: DEFAULT_TAGS.slice()
  }
}

/**
 * @param {object} raw
 * @returns {{ platforms: string[], types: string[], tags: string[] }}
 */
function normalizeCatalog(raw) {
  const d = createDefaultCatalog()
  if (!raw || typeof raw !== 'object') return d
  return {
    platforms: Array.isArray(raw.platforms)
      ? raw.platforms.map((x) => String(x).trim()).filter(Boolean)
      : d.platforms,
    types: Array.isArray(raw.types)
      ? raw.types.map((x) => String(x).trim()).filter(Boolean)
      : d.types,
    tags: Array.isArray(raw.tags)
      ? raw.tags.map((x) => String(x).trim()).filter(Boolean)
      : d.tags
  }
}

module.exports = {
  DEFAULT_PLATFORMS,
  DEFAULT_TYPES,
  DEFAULT_TAGS,
  createDefaultCatalog,
  normalizeCatalog
}
