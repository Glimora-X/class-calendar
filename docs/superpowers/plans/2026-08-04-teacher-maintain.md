# 维护老师 Implementation Plan

> **For agentic workers:** Execute task-by-task. Commits only if user allows.

**Goal:** 「我的」→ 维护老师列表/编辑；扩展 nameList；时间轴显示 avatarFileID。

**Architecture:** 扩展 `name_lists.teachers`；云函数 `updateTeacher`/`removeTeacher`（改名同步 bookings）；新页 teacher-list / teacher-edit；timeline-booking-card 优先 image。

**Tech Stack:** 微信小程序 + 云开发

**Spec:** `docs/superpowers/specs/2026-08-04-teacher-maintain-design.md`

## Tasks

1. 云函数 nameList：updateTeacher / removeTeacher + 改名同步 bookings  
2. service name-list.js API  
3. pages/teacher-list + teacher-edit + app.json  
4. mine 入口  
5. 时间轴头像匹配与展示  
6. 部署说明勾选验收  

（本会话直接实现，不强制逐步 commit。）
