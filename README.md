# 约课 class-calendar

**仓库**：[github.com/Glimora-X/class-calendar](https://github.com/Glimora-X/class-calendar) · `git clone git@github.com:Glimora-X/class-calendar.git`

个人主体微信小程序：微信登录 + 云开发同步，记录「谁、跟谁、哪天、几点、什么科目上课」。

配套文档（Obsidian）：

- `# 约课小程序 PRD（v3）`
- `# 约课小程序 技术方案（v2）`
- `# 约课小程序 API 契约（v1）`（当前 v1.2）

## 当前进度

**Soft UI 日历壳 + API 契约骨架**

- 视觉：参考 Soft daylight planner（天蓝主色 / 薄荷绿高亮 / 白卡片轻阴影）
- 交互：月历网格 + 当日约课卡；点标题可切时间线；老师筛选 chips；中间 FAB 新建
- 数据：云未就绪时日历页有示意数据，方便看 UI；契约与云函数占位不变

详见根目录 `PRODUCT.md` / `DESIGN.md`。

## 目录

```
miniprogram/
  components/     # empty-state / month-nav / subject-picker / booking-item
  pages/          # calendar / booking-edit / mine
  services/       # 云函数门面（页面不直接拼函数名）
  utils/          # request / cache / date-utils / quick-parse / format / errors / constants
cloudfunctions/  # 7 个契约云函数占位
```

## 抽象约定

| 层 | 职责 |
|----|------|
| `utils/request` | 唯一 `callFunction`；`code !== 'OK'` 统一 reject |
| `utils/errors` | 错误码 → 文案；页面只 `showApiError` |
| `services/*` | 按领域封装云函数调用 |
| `components/*` | UI 复用；科目选择器始终可见可切换/新增 |
| 云函数 | 鉴权用 `OPENID` + `_openid`；禁止手写 `_openid` |

## 本地打开

1. 用微信开发者工具导入本仓库根目录
2. 填写真实 `appid`，开通云开发并配置 `env`
3. 在 `miniprogram/app.js` 中设置 `wx.cloud.init({ env: '...' })`
4. 上传并部署 `cloudfunctions/*`（云端安装依赖）
5. 控制台建集合 `bookings` / `subjects` / `name_lists`，权限「仅创建者可读写」；`bookings` 建联合索引 `_openid + date + startTime`

## 建议实现顺序

F4 鉴权收敛 → F1/F5/F12 CRUD+同步+科目 → F2 月历 → F7 快捷解析 → F11 复制上月 → F8 批量 → F9/F10
