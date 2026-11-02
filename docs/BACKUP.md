# 灾备备份运维说明

验收标准：即使原小程序与原 CloudBase 不可用，只要拥有 **GitHub 密文 + 离线密钥 + 本 CLI + 新环境管理员凭证**，即可恢复约课与理财数据，并保证现有小程序按 `_openid` 正常读写。

## 已敲定配置

| 项 | 取值 |
|----|------|
| 备份目标仓 | **当前代码仓** `Glimora-X/class-calendar`（Private Releases） |
| 不另建备份仓 | 省维护；依赖离线密钥 + 建议月度本地密文副本 |
| Release 标签 | `backup-*` / `backup-latest` / `backup-quarantine-*`（与产品 `v*` 发版分开） |
| 加密 | AES-256-GCM，信封含 `keyId` |
| 云函数 | `cloudfunctions/backup` |
| CLI | `backup-tools/cli.js` |

环境变量模板见 `cloudfunctions/backup/env.example.txt`。

---

## 你需要完成的步骤（按顺序）

代码已在仓库里；下面都是**控制台 / 本机**操作，我无法代你点。

### 1. 确认仓库为 Private

GitHub → `Glimora-X/class-calendar` → Settings → 必须是 **Private**。  
若是 Public，先改私有，再往 Releases 传备份。

### 2. 生成密钥并保存三份

```bash
node backup-tools/cli.js keygen
```

把输出的 `keyId`、`masterKeyHex`：

1. 记入密码管理器 / 加密盘（**离线副本，灾备靠它**）
2. 写入云函数环境变量（下一步）
3. 本机复制 `backup-tools/keys.example.json` → `keys.json` 填入真实值（已在 `.gitignore`）

### 3. 创建 GitHub Fine-grained PAT

1. GitHub → Settings → Developer settings → Fine-grained tokens  
2. Resource owner：能访问 `Glimora-X/class-calendar` 的账号/org  
3. Only select：`class-calendar`  
4. Permissions：能 **创建 Release、上传 Release assets**（以 GitHub 当前权限名为准；常见需 Contents 写和/或相关 Releases 权限）  
5. 复制 Token，只放进云函数环境变量与本机 shell，**不要提交仓库**

### 4. 云开发控制台

1. 数据库新建集合 **`backup_runs`**（仅云函数可写即可）  
2. 上传云函数前在本机执行：

```bash
node scripts/sync-backup-shared.js
```

3. 开发者工具：右键 `cloudfunctions/backup` → **上传并部署：云端安装依赖**  
4. 云函数 `backup` → 配置环境变量（与 `env.example.txt` 一致）：

| 变量 | 值 |
|------|-----|
| `BACKUP_KEY_ID` | keygen 的 keyId |
| `BACKUP_MASTER_KEY` | keygen 的 hex |
| `GITHUB_OWNER` | `Glimora-X` |
| `GITHUB_REPO` | `class-calendar` |
| `GITHUB_TOKEN` | 上一步 PAT |

5. 确认超时建议 ≥ 60s；定时触发已在 `config.json`（每天 3:00），可先关掉触发器、手动跑通后再开。

### 5. 第一次手动备份

云开发控制台 → 云函数 `backup` → 测试 / 触发，入参：

```json
{}
```

成功后到 GitHub → Releases，应看到类似：

- `backup-YYYY-MM-DD`
- `backup-latest`

各含 `.enc.json` + `manifest-*.json`。

### 6. 本机验证「能解、能分析」（闭环）

```bash
export GITHUB_TOKEN=... GITHUB_OWNER=Glimora-X GITHUB_REPO=class-calendar

node backup-tools/cli.js download backup-latest --out ./analysis-workspace/raw
node backup-tools/cli.js verify ./analysis-workspace/raw/backup-latest.enc.json
node backup-tools/cli.js decrypt ./analysis-workspace/raw/backup-latest.enc.json \
  --keys ./keys.json \
  --out ./analysis-workspace/raw/payload.json
node backup-tools/cli.js inspect ./analysis-workspace/raw/payload.json
```

能 decrypt / inspect 出 8 个集合，本阶段验收即通过。  
（恢复到新环境可稍后再做，需要腾讯云 `TCB_SECRET_ID` / `TCB_SECRET_KEY`。）

### 7. 再开定时（可选）

手动备份 + 本机解密都成功后，再依赖每天 3:00 定时。

---

## 架构摘要

| 项 | 方案 |
|----|------|
| 主库 | 微信云开发（8 个业务集合） |
| 备份 | 云函数分页全量导出 |
| 加密 | AES-256-GCM（含 `keyId`） |
| 异地 | 本仓库 Private Releases |
| 恢复 | 独立 CLI；默认 `create-only` |

## 异常与 latest

- 数量异常下降 → 上传 `backup-quarantine-*`，**不更新** `backup-latest`
- 合法清库后首次备份传：`{ "bypassAnomaly": true }`
- 仅加密不上传：`{ "skipUpload": true }`

## 下载后做数据分析

```bash
node backup-tools/cli.js export ./analysis-workspace/raw/backup-latest.enc.json \
  --keys ./keys.json \
  --out ./analysis-workspace/json
```

明文只留在 `analysis-workspace/`（已 gitignore），勿提交。

## 恢复到新环境（阶段二验收）

```bash
cd backup-tools && npm install && cd ..
export TCB_SECRET_ID=... TCB_SECRET_KEY=...
export BACKUP_KEYS_FILE=./keys.json

node backup-tools/cli.js restore ./analysis-workspace/raw/payload.json \
  --env <新环境ID> \
  --mode create-only
```

覆盖模式必须：`--mode replace --confirm --confirm-env <同一环境ID>`。

## 改 shared 后

```bash
node scripts/sync-backup-shared.js
```

再重新上传 `backup` 云函数。

## 测试

```bash
node backup-shared/crypto.test.js
node backup-tools/restorer.test.js
```
