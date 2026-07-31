# 约课 class-calendar

**仓库**：[github.com/Glimora-X/class-calendar](https://github.com/Glimora-X/class-calendar) · `git clone git@github.com:Glimora-X/class-calendar.git`

个人主体微信小程序：微信登录 + 云开发同步，记录「谁、跟谁、哪天、几点、什么科目上课」。

技术栈锁定见 [`STACK.md`](STACK.md)（**原生小程序 + 云开发**，不迁 uni-app/Taro）。  
云环境步骤见 [`docs/CLOUD_SETUP.md`](docs/CLOUD_SETUP.md)。

配套文档（Obsidian）：PRD v3 / 技术方案 v2 / API 契约 v1.2；视觉见 `PRODUCT.md` / `DESIGN.md`。

## 当前进度

- Soft UI：月历 / 时间线 / FAB / 表单软卡片（日期时间用系统 picker，外皮自定义）
- P0 云函数已按契约实现真写库：`bookingList|Upsert|Delete`、`subjectList|Upsert`、`nameList`、`bookingBatchCreate`
- 日历接云端列表；失败时空态 + toast（已去掉示意 demo）

## 本地联调

1. 开发者工具导入本仓库根目录，填真实 AppID  
2. 开通云开发，按 `docs/CLOUD_SETUP.md` 配 `env`、上传云函数、建集合与索引  
3. 可选：复制 `miniprogram/config/env.example.js` → `env.js` 写入环境 ID  

## 目录

```
miniprogram/   pages · components · services · utils · custom-tab-bar
cloudfunctions/  7 个云函数（契约实现）
docs/          CLOUD_SETUP.md
```
