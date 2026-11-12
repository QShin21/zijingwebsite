# V2 后端合同衔接记录

2026-11-11，按 Claude Opus 5.5 max 的 `REBUILD_V2_SOL_BACKEND_BRIEF.md` 实现。

## 保持的约定

- `types.ts` 字段与已交付 Opus 的类型保持一致，复杂写流程继续使用旧服务。
- `src/lib/v2/index.ts` 为网站服务端导入入口；小程序使用 `/api/v2/[...path]`。
- 读取与写入不接收客户端权限 context；每次读取当前账号权限，写入在原 serializable 事务内再次核验。
- 旧页面、API、数据库与小程序兼容路由保留。只在新分支制作，不部署、不推送。

## 明确的细化

1. 图片的 `v` 为解码后存储图片字节的 SHA-256 前 16 位；每次服务请求先授权，再处理 ETag/304。媒体库只投影站内相对 URL，外部存储链接不直接输出。
2. 新社群日程的 `startAt`、`endAt`、`location` 纳入升推版本绑定。旧帖三字段均空时保持原 hash；安排变更后原批准自动失效，须重新审核。
3. V2 错误体使用状态对应的简短固定中文文案和 code，不返回底层 SQL、堆栈或身份资料；没有可安全证明的逐字段错误时不返回 fields。
4. JWT 请求在认证前去掉 Cookie，防止无效 Authorization 回退到 Cookie 后跳过 Origin 校验。Cookie POST 先校验本站 Origin；不接受客户端声称的身份或 context。
5. `legacyRoster` 暂为空。现有 Team schema 无单独旧阵容字段；已获授权历史阵容完整放在 `seasons[].members`，不会把跨赛季成员误称为当前阵容。后续若增加独立阵容来源，须另行确认映射。
6. 新日程与上传迁移为 additive；自动 down 明确拒绝删除新列/临时上传。应用回滚时可保留新增结构；任何真实数据清理另行安排。
7. 无效的旧代表队招新表单不投影成开放招新，也不会导致整个目录失败；有效批次继续原归一化和资格规则。
8. 内部 `getCalendar({team})` 在来源查询前筛本队并排除无队伍关联的社群帖子；供队伍详情使用。内部 `getFeed({highlightsOnly:true,promotedOnly:true})` 在分页前筛精选，公共类型不变。

## 有界读取限制

- 日程、动态等聚合先分别取每来源至多 500 候选，再合并分页；JSON limit 默认 12、最高 50。
- 日程月份/过去/未来条件先下推至数据库，避免大量历史数据占满候选。社群无时间活动执行 30 天规则。
- 新闻/影集没有直接 game 列，按其公开关联活动或队伍解析社群；这些来源先读取有界候选再按社群筛选。
- 首页使用至多 50 项聚合日程/招新候选；Site 的最多三项重点活动单独核验，不受该页候选截断影响。大规模资料下完整目录分页仍是查全入口。
- 动态中的荣誉目前复用公开档案服务第一页最多 50 条；完整荣誉目录独立分页。这是聚合视图的已知上限，未承诺跨任意规模全量聚合。

## 2026-11-12：S1–S8 合同补充

详见 [完整衔接记录](REBUILD_V2_SOL_FOLLOWUPS_20261112.md)。新增 `calendar.signupOpen`、`getCommunityHeader` 与 `/communities/:slug/header`、批量 `/images/sign`、申请/队列/待办 `webOnly`、`HomeResponse.promoted` 与 `sections`、`site.homeSections`。旧接口及字段保留；受控图从 immutable 改为 no-store，授权仍先于条件缓存，并新增当前 session 校验的短时对象票据。新 CMS 结构需 additive 迁移后使用，尚未操作生产。
