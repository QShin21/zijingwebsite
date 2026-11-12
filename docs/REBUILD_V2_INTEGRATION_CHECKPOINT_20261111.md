# V2 双端整合检查点

核查时间：2026-11-11 19:08 UTC。本文件为协调者实际执行记录；Opus 前端状态文档中的“未运行”指其自身权限，以下检查由协调者补做。

## 当前状态

网站与原生小程序主体、内页和复杂任务布局已由 Claude Code Opus 5.5 max 实现，后端由 GPT-6.1 Sol max 按 Opus 提示实现。当前 `new` 分支仍未提交、未推送、未部署。

第四轮前后端接口整合被 Opus 五小时额度中断，预计 2026-11-11 22:30 UTC（北京时间 12 日 06:30）恢复。不能将当前成果称为最终完成。没有用其他模型代写前端，也未删除旧资源。

## 实际验证

| 检查 | 结果 | 范围与限制 |
|---|---|---|
| TypeScript、全仓 ESLint、tokens 一致性、diff whitespace | 通过 | 当前整合中间态 |
| 原生静态检查 | 通过 | 28 页、195 文件、865,677 字节；不等于微信编译 |
| 14 文件定向前端测试 | 311 通过 / 1 失败，另 1 未处理错误 | 签名图代码已改，测试仍使用旧 JWT 下载替身，待 Opus 完成迁移；不能记作通过 |
| 较早一轮全量合成测试 | 1769 通过 / 44 失败 / 66 跳过 | 对照旧基线修复 3 个签名、新增 4 个 V2 社群 VM 替身适配失败；在第四轮接口整合之前运行，不代表当前全量结果 |
| 当前合成数据库迁移 + 生产构建 | 通过 | BUILD_ID `CvNTGMeb8KMV2Hy9NXtds`；只使用 loopback 合成库、空环境哨兵，无生产凭据/邮件/S3 |
| 合成 HTTP 冒烟 | 11 条请求均无 5xx | 首页、日程、公告、关于、隐私、登录和开放日程 API 返回 200；成员区保留登录重定向。未用真实账号或内容 |
| 浏览器视觉 / axe / 微信编译 | 未通过验收 | 云 Chromium socket EPERM；官方浏览器无法访问命令环境 loopback；无可用微信开发者工具。不绕过限制 |

HTTP 返回的原始 HTML 可能含 React Suspense 流式占位与替换节点，文本计数不等于最终浏览器 DOM，不能替代真实视觉/无障碍验收。

## 待接续

1. 核完 S1–S7 双端接口接入，尤其小程序日程 `signupOpen`、队列 `webOnly`。
2. 修复 `/teams/apply#team-applications-title`、`/community/apply#my-applications-title` 原生跳转映射并增加回归。
3. 签名图片测试改为新批量签名接口，保留过期/换号/隐藏迟到回复、授权边界与批量上限覆盖，不持久化签名 URL。
4. 修复 4 个 `miniapp-community-flows` 的 V2 替身映射与生命周期回归，不削弱断言。
5. 最终整合态重新执行完整检查、全量测试、构建及能获准运行的浏览器/原生验收，然后才考虑推送 `new`。

## 索引

- 产品设计：`REBUILD_V2_PRODUCT_DESIGN.md`
- 前端实施明细：`REBUILD_V2_FRONTEND_STATUS.md`
- 初始后端状态：`REBUILD_V2_BACKEND_STATUS.md`
- Opus 给 Sol 的后续说明：`REBUILD_V2_SOL_TASKS_20261112.md`
- Sol 后续完成情况：`REBUILD_V2_SOL_FOLLOWUPS_20261112.md`
- 本次机器可读证据：`evidence/rebuild-v2-integration-checkpoint-20261111.json`

最终交付还需刷新全量变更文件索引，避免将后续新增文件遗漏在溯源材料外。
