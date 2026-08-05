# 维护学员（名单扩展）设计

**日期：** 2026-08-05  
**状态：** 已确认并实现  
**方案：** A — 扩展 `name_lists.students` + 扩展 `nameList` 云函数；改名同步约课

## 1. 目标

在「我的」提供 **维护学员** 入口：列表查看、新增/编辑学员（名字、头像、备注）；改名时同步历史约课 `studentName`。

## 2. 已确认决策

| 项 | 选择 |
|----|------|
| 字段 | 名字、头像、备注（对齐老师精简版；**无**主科、**无**单价） |
| 头像 | 选图 → 云存储 `student-avatars/`，存 `avatarFileID`；无图用首字 |
| 改名 | **同步** 该用户全部约课中旧 `studentName` → 新名 |
| 存储 | 不新建集合；`students` 由 `string[]` 升级为对象数组（读时兼容旧字符串） |
| 删除 | 仅从名单移除，**不**级联删除约课 |

## 3. 非目标

- 不新建 `students` 集合
- 学员不挂主科 / 单价
- 时间轴暂不展示学员头像（可后续）

## 4. 数据模型

`name_lists.students` 条目：

```js
{
  name: string,           // 必填，用户内唯一
  avatarFileID?: string,
  note?: string           // ≤200 字
}
```

旧数据 `"小明"` 读时规范为 `{ name: "小明" }`；写回后持久化为对象数组。

## 5. 云函数 `nameList`

| action | 说明 |
|--------|------|
| `updateStudent` | `{ fromName, student }` 新增或更新；改名批量更新 `bookings.studentName` |
| `removeStudent` | `{ name }` 从名单删除 |
| 旧 append | `{ type: 'student', name }` 仍可用，写入 `{ name }` |

## 6. 页面

- `pages/student-list`：列表 + 下拉刷新 + 新增
- `pages/student-edit`：头像 / 名字 / 备注；编辑态可删除
- 「我的」→「维护学员」

## 7. 兼容

约课编辑 / 批量 / 快捷解析通过 `studentNames()` 取姓名字符串，兼容对象与旧字符串。
