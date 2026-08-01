# 云开发开通清单

本仓库无法代替你在微信控制台点按钮；按下列步骤做完后，P0 CRUD 即可联调。

## 1. 开通环境

1. 微信开发者工具打开本项目根目录  
2. 点击 **云开发** → 开通（按提示创建环境）  
3. 复制环境 ID（形如 `cloud1-xxxxx`）

## 2. 写入小程序 env

编辑 [`miniprogram/app.js`](../miniprogram/app.js)：

```js
wx.cloud.init({
  env: '你的环境ID',
  traceUser: true
})
```

也可复制 [`miniprogram/config/env.example.js`](../miniprogram/config/env.example.js) → `env.js`：

```js
module.exports = {
  envId: '你的环境ID',
  subscribeTmplId: '订阅消息模板ID' // 课前提醒用，可先留空
}
```

## 3. 上传云函数

对 `cloudfunctions/` 下每个目录右键 → **上传并部署：云端安装依赖**：

- `bookingList`
- `bookingUpsert`
- `bookingDelete`
- `bookingBatchCreate`
- `bookingClearAll`（清空当前用户全部约课）
- `nameList`
- `subjectList`
- `subjectUpsert`
- `reminderTick`（课前提醒；需配置模板 ID + 定时触发器）

## 4. 建集合与权限

云开发控制台 → 数据库，新建：

| 集合 | 权限 |
|------|------|
| `bookings` | 仅创建者可读写 |
| `subjects` | 仅创建者可读写 |
| `name_lists` | 仅创建者可读写 |

## 5. 索引

`bookings` 集合 → 索引管理：

1. 组合索引：`_openid` 升序、`date` 升序、`startTime` 升序（月历查询）  
2. 单字段：`remindAt` 升序（课前提醒扫描）

## 6. 课前提醒（订阅消息）

### 6.1 申请模板

1. 微信公众平台 → 功能 → 订阅消息  
2. 选用课前提醒类模板（建议含：课程/科目、开课时间、温馨提示）  
3. 记下模板 ID，写入：
   - 小程序：`miniprogram/config/env.js` 的 `subscribeTmplId`  
   - 云函数：编辑 `cloudfunctions/reminderTick/index.js` 顶部 `TEMPLATE_ID`

当前模板「日程提醒」字段映射（已写入代码）：

| 关键词 | 字段名 | 内容 |
|--------|--------|------|
| 提醒人 | `name1` | 学员名 |
| 上课时间 | `time15` | `yyyy年M月d日 HH:mm` |
| 课程名称 | `thing17` | 科目 |
| 提醒事项 | `thing3` | 如「乔姐的课约10分钟后开始」 |

模板 ID：`kB65FXHwme7-n-p-ilFQb4Ow35xBLM9Is7DjdAm9KiY`（写入 `reminderTick` 与 `env.js` 的 `subscribeTmplId`）

个人主体若发送失败：**小程序内课前提醒（打开日历弹窗）仍可用**。

### 6.2 部署定时器

1. 上传 `reminderTick`（云端安装依赖）  
2. 确认函数配置含定时触发器（仓库内 `config.json` 为每分钟：`0 * * * * * *`）  
3. 云函数权限需允许 `subscribeMessage.send`（`config.json` 已声明 `openapi`）

### 6.3 行为说明

- 保存/批量创建未来约课时写入 `remindAt`（开课前 N 分钟，N 来自「我的」设置，默认 10；**按北京时间**算成 UTC ISO）  
- 「我的」可设置默认课程时长、提前提醒分钟（本地偏好，退出登录不清除）  
- 保存成功后弹出订阅授权（需已配置 `subscribeTmplId`）  
- 定时云函数扫描到期未发送且仍为「待上」的课，发订阅消息并写 `remindSentAt`  
- 已转/已退不提醒；打开日历时，若 10 分钟内有待上课会 Modal 一次  
- 例：开课 `12:55`（北京）→ `remindAt` 应为 `04:45Z`（当天），**不是** `12:45Z`；若旧数据写错，编辑重存一次即可  


## 7. 自检

- 日历页翻月无报错，空月显示空态（非示意 demo）  
- FAB → 新增约课 → 科目默认「英语」可见 → 保存成功 → 月历出现  
- 点卡片进入编辑 → 可删除  
- 新建未来约课 → 授权订阅 → 可「立即试发」验证微信通知；或等课前 10 分钟由定时器发送  
- 云库该条 `remindAt` 应为开课北京时间减 10 分钟对应的 UTC（例开课 12:55 → `04:45Z`，不是 `12:45Z`）  
- `reminderTick` 云端测试可传：`{"action":"diagnose","_id":"记录ID"}` 或 `{"action":"send","_id":"记录ID","force":true}`  

> **注意**：云函数写库不会自动带 `_openid`，本仓库各写库云函数已显式写入。若控制台里已有记录缺 `_openid`，列表按 `_openid` 过滤会查不到——需补字段或删后重存。

详见根目录 `STACK.md`（原生栈锁定）。
