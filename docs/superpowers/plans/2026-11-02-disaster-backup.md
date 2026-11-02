# 灾备备份 Implementation Plan

> **For agentic workers:** 按任务顺序实现；验收以「离线密钥 + GitHub 密文 + CLI + 新环境凭证可恢复」为准。

**Goal:** 微信云开发全量加密备份到 GitHub Releases，并提供独立 Node CLI 解密/校验/恢复。

**Architecture:** CloudBase 主库 → 云函数分页导出 → AES-256-GCM 信封加密 → Private Releases；恢复与备份解耦，默认 `create-only`。

**Tech Stack:** wx-server-sdk、Node crypto、GitHub REST API、@cloudbase/node-sdk（CLI 恢复）

---

## 目录

- `backup-shared/` 纯逻辑（集合清单、序列化、加密、manifest、异常判定）
- `cloudfunctions/backup/` 定时/手动备份（部署时同步 shared）
- `backup-tools/` 独立 CLI
- `docs/BACKUP.md` 运维说明

## 阶段

- [x] P0 共享库 + 云函数导出/加密/上传
- [x] P1 CLI download/decrypt/verify/inspect/export/restore
- [ ] P3 定时触发、告警（配置预留，按需开启）
