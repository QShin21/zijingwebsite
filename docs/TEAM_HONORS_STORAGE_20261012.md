# 代表队荣誉私有媒体备份、恢复与回滚门禁 · 2026-10-12

本补丁补齐荣誉冻结提交 `196ebf841c77f7a725ed6b41100cd66b341faea5` 与现有运维脚本的存储合同。荣誉 HTTP、公开 Media 文件入口及标记读取保护由总集成任务另行验证。这里只使用临时目录中的合成文件和合成数据库读取结果；没有读取真实媒体、连接数据库或运行生产操作。

## 备份 manifest v3

`scripts/backup.mjs create` 保留原数据库全表内容摘要、数据库 dump 哈希及备份期间写入检测，并明确记录以下 SHA-256 文件清单：

| manifest 字段 | 来源 | 备份目录 |
| --- | --- | --- |
| `media` | `MEDIA_BACKUP_SOURCE`，未指定时为 `MEDIA_DIR` | `media/` |
| `localVideos` | `MEDIA_DIR/.showcase-videos`，包含永久标记子目录 | `local-videos/` |
| `localHonorVideos` | `MEDIA_DIR/.team-honor-videos` | `local-honor-videos/` |
| `honorVideoReservations` | `.showcase-videos/.team-honor-reserved` 的独立清单 | 保留在 `local-videos/.team-honor-reserved/` |

S3 对象镜像与本地 `MEDIA_DIR` 分离时，后两类本地存储仍独立备份。普通本地模式可能在 `media/` 内同时保存这些目录；两份清单中重叠文件的哈希必须一致。复制后的备份文件再次核对；源目录在备份前后变化、权限或 I/O 读取失败、符号链接或特殊文件均阻止生成可用 manifest。数据库内的荣誉图片、批准快照和历史继续随 dump 保存。

## 恢复与原目录映射

`pnpm restore:verify <备份目录>` 先核对备份媒体与 manifest，再使用既有隔离数据库恢复流程。恢复文件统一放入报告中的 `mediaDirectory`，该路径可作为隔离应用的 `MEDIA_DIR`：

```text
mediaDirectory/
  <公开媒体文件>
  .showcase-videos/
    <原风采视频 UUID>.mp4
    .team-honor-reserved/<永久隔离 UUID>.mp4
  .team-honor-videos/<私有荣誉视频 UUID>.mp4
```

恢复不会覆盖现有媒体目录。对象镜像与本地视频的重叠文件有冲突时停止；完成后核对合并文件清单、私有视频及永久标记哈希。报告增加 `localHonorVideoFiles`、`honorVideoReservations` 和 `honorStorageVerified`。永久标记属于隔离状态，清理荣誉当前或历史引用后仍须保留。

v1/v2 manifest 仅在没有荣誉记录、私有视频或永久标记证据时继续兼容。旧清单或备份目录含这些数据时拒绝确认完整性；旧版本允许恢复时，`honorStorageVerified:false`。旧备份不能代替包含荣誉存储的 v3 备份。

## 旧应用回滚门禁

`scripts/club-operations-rollback-check.ts` 保留原有角色、任职、私人报名、名片、升推和骨干批次/申请检查，增加 `honor_records`、`honor_private_files`、`honor_video_reservations`。任何一项非零都阻止回退到旧基线；即使数据库已无荣誉引用，剩余私有文件或永久标记也要求保留荣誉隔离检查的兼容构建。

缺少尚未创建的荣誉表或媒体目录可记为零；数据库查询失败、无效计数、目录权限/I/O 错误或符号链接不能记为零。CLI 返回 `compatibleWithBaseline:false`、`checksComplete:false` 和非零退出码，不批准回滚。此门禁不会删除表、记录、视频或永久标记；迁移 down 的拒删约束保持。

## 实际验证与剩余边界

定向合成测试覆盖本地与 S3 镜像分离模式的备份/恢复、原目录映射、哈希及私有文件权限、篡改/缺失/冲突拒绝、旧 manifest 限制、所有既有回滚计数、仅剩永久标记、数据库及目录读取失败。测试导入脚本不会加载 `.env` 或连接数据库。

```sh
pnpm exec vitest run tests/backup-private-videos.test.ts tests/club-operations-rollback-check.test.ts
pnpm exec eslint scripts/backup.mjs scripts/club-operations-rollback-check.ts tests/backup-private-videos.test.ts tests/club-operations-rollback-check.test.ts
```

实际数据库 dump/restore、恢复后的荣誉 HTTP 权限和旧应用隔离演练由总集成任务继续执行。通过本文件的合成测试不代表生产备份、S3 同步、异机保存或应用回滚已经验证。
