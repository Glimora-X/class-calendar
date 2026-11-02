const https = require('https')

function request(method, urlPath, token, body, headers) {
  const payload = body == null ? null : Buffer.from(body)
  const opts = {
    hostname: 'api.github.com',
    path: urlPath,
    method,
    headers: Object.assign(
      {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer ' + token,
        'User-Agent': 'class-calendar-backup',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      headers || {}
    )
  }
  if (payload) {
    opts.headers['Content-Length'] = payload.length
    if (!opts.headers['Content-Type']) {
      opts.headers['Content-Type'] = 'application/json'
    }
  }

  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        const raw = Buffer.concat(chunks)
        const text = raw.toString('utf8')
        let json = null
        try {
          json = text ? JSON.parse(text) : null
        } catch (e) {
          json = null
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode, json, raw, headers: res.headers })
          return
        }
        const msg =
          (json && (json.message || json.error)) ||
          text ||
          'HTTP ' + res.statusCode
        const err = new Error('GitHub API: ' + msg)
        err.status = res.statusCode
        err.body = json || text
        reject(err)
      })
    })
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

function uploadUrlHost(uploadUrlBase) {
  // upload_url like https://uploads.github.com/repos/.../releases/1/assets{?name,label}
  const cleaned = String(uploadUrlBase).replace(/\{[^}]*\}/g, '')
  const u = new URL(cleaned)
  return u
}

function uploadAsset(uploadUrlBase, token, fileName, buffer, contentType) {
  const base = uploadUrlHost(uploadUrlBase)
  const pathWithQuery =
    base.pathname +
    (base.search ? base.search + '&' : '?') +
    'name=' +
    encodeURIComponent(fileName)

  const opts = {
    hostname: base.hostname,
    path: pathWithQuery,
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token,
      'User-Agent': 'class-calendar-backup',
      'Content-Type': contentType || 'application/octet-stream',
      'Content-Length': buffer.length,
      'X-GitHub-Api-Version': '2022-11-28'
    }
  }

  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        let json = null
        try {
          json = text ? JSON.parse(text) : null
        } catch (e) {
          json = null
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(json)
          return
        }
        reject(
          new Error(
            'GitHub upload asset failed: ' +
              ((json && json.message) || text || res.statusCode)
          )
        )
      })
    })
    req.on('error', reject)
    req.write(buffer)
    req.end()
  })
}

async function getReleaseByTag(owner, repo, tag, token) {
  try {
    const res = await request(
      'GET',
      '/repos/' + owner + '/' + repo + '/releases/tags/' + encodeURIComponent(tag),
      token
    )
    return res.json
  } catch (e) {
    if (e.status === 404) return null
    throw e
  }
}

async function createRelease(owner, repo, token, opts) {
  const res = await request(
    'POST',
    '/repos/' + owner + '/' + repo + '/releases',
    token,
    JSON.stringify({
      tag_name: opts.tag,
      name: opts.name || opts.tag,
      body: opts.body || '',
      draft: false,
      prerelease: !!opts.prerelease
    })
  )
  return res.json
}

async function deleteReleaseAsset(owner, repo, token, assetId) {
  await request(
    'DELETE',
    '/repos/' + owner + '/' + repo + '/releases/assets/' + assetId,
    token
  )
}

/**
 * 创建（或复用）Release，并上传 .enc + manifest.json。
 * 若同名 asset 已存在且允许替换，先删再传（需要 delete 权限；失败则换文件名）。
 */
async function publishBackupRelease(opts) {
  const owner = opts.owner
  const repo = opts.repo
  const token = opts.token
  const tag = opts.tag
  let release = await getReleaseByTag(owner, repo, tag, token)
  if (!release) {
    release = await createRelease(owner, repo, token, {
      tag,
      name: opts.name || tag,
      body: opts.body || '',
      prerelease: opts.prerelease
    })
  }

  const assets = release.assets || []
  async function ensureUpload(fileName, buf, type) {
    const existing = assets.find((a) => a.name === fileName)
    if (existing) {
      try {
        await deleteReleaseAsset(owner, repo, token, existing.id)
      } catch (e) {
        // 无删除权限时换名上传
        fileName =
          fileName.replace(/(\.\w+)$/, '-' + Date.now() + '$1')
      }
    }
    return uploadAsset(release.upload_url, token, fileName, buf, type)
  }

  const encName = opts.encFileName || 'backup.enc.json'
  const manName = opts.manifestFileName || 'manifest.json'
  const encAsset = await ensureUpload(
    encName,
    opts.encBuffer,
    'application/json'
  )
  const manAsset = await ensureUpload(
    manName,
    opts.manifestBuffer,
    'application/json'
  )

  return {
    releaseId: release.id,
    tag: release.tag_name || tag,
    htmlUrl: release.html_url,
    encAsset,
    manAsset
  }
}

async function downloadReleaseAsset(owner, repo, token, tag, fileName) {
  const release = await getReleaseByTag(owner, repo, tag, token)
  if (!release) throw new Error('Release 不存在: ' + tag)
  const asset = (release.assets || []).find((a) => a.name === fileName)
  if (!asset) throw new Error('Asset 不存在: ' + fileName)

  // API asset URL 需 Accept: application/octet-stream
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path: '/repos/' + owner + '/' + repo + '/releases/assets/' + asset.id,
      method: 'GET',
      headers: {
        Accept: 'application/octet-stream',
        Authorization: 'Bearer ' + token,
        'User-Agent': 'class-calendar-backup',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }
    const req = https.request(opts, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        https
          .get(res.headers.location, (res2) => {
            const chunks = []
            res2.on('data', (c) => chunks.push(c))
            res2.on('end', () => resolve(Buffer.concat(chunks)))
          })
          .on('error', reject)
        return
      }
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(Buffer.concat(chunks))
          return
        }
        reject(new Error('download asset HTTP ' + res.statusCode))
      })
    })
    req.on('error', reject)
    req.end()
  })
}

module.exports = {
  request,
  getReleaseByTag,
  createRelease,
  publishBackupRelease,
  downloadReleaseAsset
}
