# 维护老师（名单扩展）设计

**日期：** 2026-08-04  
**状态：** 已确认并实现  
**方案：** A — 扩展 `name_lists.teachers` + 扩展 `nameList` 云函数

## 1. 目标

在「我的」提供 **维护老师** 入口：列表查看、新增/编辑老师（名字、头像、主科、备注）；改名时同步历史约课 `teacherName`；时间轴若有头像则展示真图。

## 2. 已确认决策

| 项 | 选择 |
|----|------|
| 科目 | 一位老师一门 **主科**（单选，关联现有科目库） |
| 头像 | 选图 → 云存储，存 `avatarFileID`；无图用首字 |
| 单价 | 老师默认 `pricePerLesson`（元/节）；约课可覆盖 `price` |
| 改名 | **同步** 该用户全部约课中旧 `teacherName` → 新名 |
| 存储 | 不新建集合，扩展 `name_lists.teachers[]` |
| 时间轴 | 有 `avatarFileID` 则显示头像（小增强） |

## 3. 非目标

- 不新建 `teachers` 集合
- 不维护学生档案（可另开）
- 删除老师 **不** 级联删除约课
- 不改约课表单里选老师的主流程（仍可按名字；名单更丰富即可）

## 4. 数据模型

`name_lists.teachers` 条目（向后兼容：旧数据仅有 `name`/`color`）：

```js
{
  name: string,              // 必填，用户内唯一
  color: string,             // 保留现有色板，新增时自动分配
  avatarFileID?: string,     // 云文件 ID
  subjectId?: string,        // 主科
  subjectName?: string,      // 冗余展示
  pricePerLesson?: number,   // 默认单价（元/节）
  note?: string              // ≤200 字
}
```

## 5. 云函数 `nameList`

扩展入参（保持旧 `{ type, name }` append 可用）：

| action | 说明 |
|--------|------|
| （空 / list） | 返回 `{ teachers, students }`（与现一致） |
| append（现有） | `{ type, name }` 按名去重追加 |
| `updateTeacher` | `{ action, fromName, teacher: { name, avatarFileID, subjectId, subjectName, note, color? } }`：按 `fromName` 定位；若改名则批量更新 bookings |
| `removeTeacher` | `{ action, name }`：从 teachers 数组移除；**不**改 bookings |

改名同步：`bookings` where `_openid` + `teacherName == fromName` → `teacherName = newName`（可 `db.command` 批量；量大时循环 update，老师数通常很少）。

失败返回 `{ code, message }`。

## 6. 前端

### 路由

- `pages/teacher-list/index` — 列表  
- `pages/teacher-edit/index` — 新增/编辑（query: `name` 可选）  
- `app.json` 注册；「我的」功能区增加入口（建议在「批量约课」之上）

### 列表

- 头像 / 首字 + 姓名 + 主科 + 备注一行摘要  
- 下拉刷新；空态引导新增  
- 点行进编辑；右上角或底栏「新增」

### 编辑

- 头像：点击 → `chooseMedia`/`chooseImage` → `wx.cloud.uploadFile`（路径如 `teacher-avatars/{openid}/{ts}.jpg`）→ 写 `avatarFileID`  
- 名字：必填  
- 科目：ActionSheet/picker 单选 `listSubjects`  
- 备注：textarea，max 200  
- 保存：`updateTeacher` 或新增时先 append 再 update / 云函数支持 upsert  
- 删除：确认后 `removeTeacher`

### Service

扩展 `miniprogram/services/name-list.js`：`updateTeacher` / `removeTeacher`，写后 `invalidateNameListCache()`。

### 时间轴小增强

- `decorateBooking` / timeline 组装：按 `teacherName` 从当前 `teachers` 名单匹配 `avatarFileID`  
- `timeline-booking-card`：有 fileID 则 `<image>`，否则首字圆  
- 名单缓存未命中时仅首字，不阻塞列表

## 7. 验收

- [ ] 「我的」可进入维护老师列表  
- [ ] 可新增老师并填名字/头像/主科/备注  
- [ ] 可编辑并保存；改名后约课筛选/时间轴老师名一致  
- [ ] 删除只影响名单  
- [ ] 时间轴：有头像显示图，无头像仍首字  
- [ ] 旧老师仅 name/color 的数据仍可展示与编辑  

## 8. 部署注意

需重新上传部署云函数 `nameList`；云存储需对用户开放上传（沿用现有云开发配置）。
