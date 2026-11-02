const path = require('path')
const uploader = require(path.join(
  __dirname,
  '..',
  'cloudfunctions',
  'backup',
  'github-uploader.js'
))

function githubConfig(opts) {
  const owner = (opts && opts.owner) || process.env.GITHUB_OWNER
  const repo = (opts && opts.repo) || process.env.GITHUB_REPO
  const token = (opts && opts.token) || process.env.GITHUB_TOKEN
  if (!owner || !repo || !token) {
    throw new Error('需要 GITHUB_OWNER / GITHUB_REPO / GITHUB_TOKEN')
  }
  return { owner, repo, token }
}

async function downloadTag(tag, outDir, opts) {
  const fs = require('fs')
  const cfg = githubConfig(opts)
  const release = await uploader.getReleaseByTag(
    cfg.owner,
    cfg.repo,
    tag,
    cfg.token
  )
  if (!release) throw new Error('找不到 Release: ' + tag)

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  const saved = []
  const assets = release.assets || []
  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i]
    const buf = await uploader.downloadReleaseAsset(
      cfg.owner,
      cfg.repo,
      cfg.token,
      tag,
      asset.name
    )
    const dest = path.join(outDir, asset.name)
    fs.writeFileSync(dest, buf)
    saved.push(dest)
  }
  return { release, saved }
}

async function listRecentReleases(opts, limit) {
  const cfg = githubConfig(opts)
  const res = await uploader.request(
    'GET',
    '/repos/' +
      cfg.owner +
      '/' +
      cfg.repo +
      '/releases?per_page=' +
      (limit || 20),
    cfg.token
  )
  return (res.json || []).map((r) => ({
    tag: r.tag_name,
    name: r.name,
    prerelease: r.prerelease,
    publishedAt: r.published_at,
    assets: (r.assets || []).map((a) => a.name)
  }))
}

module.exports = {
  githubConfig,
  downloadTag,
  listRecentReleases,
  getReleaseByTag: uploader.getReleaseByTag,
  downloadReleaseAsset: uploader.downloadReleaseAsset
}
