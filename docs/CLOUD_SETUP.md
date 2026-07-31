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

也可在 [`miniprogram/app.js`](../miniprogram/app.js) 顶部常量 `CLOUD_ENV_ID` 直接填写。参考模板：[`miniprogram/config/env.example.js`](../miniprogram/config/env.example.js)。

## 3. 上传云函数

对 `cloudfunctions/` 下每个目录右键 → **上传并部署：云端安装依赖**：

- `bookingList`
- `bookingUpsert`
- `bookingDelete`
- `bookingBatchCreate`
- `nameList`
- `subjectList`
- `subjectUpsert`

## 4. 建集合与权限

云开发控制台 → 数据库，新建：

| 集合 | 权限 |
|------|------|
| `bookings` | 仅创建者可读写 |
| `subjects` | 仅创建者可读写 |
| `name_lists` | 仅创建者可读写 |

## 5. 索引

`bookings` 集合 → 索引管理 → 添加组合索引：

- 字段：`_openid` 升序、`date` 升序、`startTime` 升序  
- 用途：月历 `where + orderBy`

## 6. 自检

- 日历页翻月无报错，空月显示空态（非示意 demo）  
- FAB → 新增约课 → 科目默认「英语」可见 → 保存成功 → 月历出现  
- 点卡片进入编辑 → 可删除  

详见根目录 `STACK.md`（原生栈锁定）。
