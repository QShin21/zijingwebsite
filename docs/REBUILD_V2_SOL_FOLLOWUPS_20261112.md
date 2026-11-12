# V2 后端 S1–S8 衔接与安全记录

按 `REBUILD_V2_SOL_TASKS_20261112.md` 处理。仅修改后端、合同、合成测试及本记录；未提交、推送、部署或操作生产资料。已有前端/小程序改动保持。

## 实际处理

| 项目 | 结果 | 客户端衔接/边界 |
| --- | --- | --- |
| S1 可报名 | `getCalendar({signupOpen:true})` 和 `GET /api/v2/calendar?signupOpen=1` 已实现 | 按有效 `signup.state` 先筛后分页，返回总数随筛选变化；`false`/`0` 不限制，仅接受明确布尔值或 1/0/true/false。沿用原身份可见范围、月份与每来源最多 500 候选的聚合上限。 |
| S2 社群头 | `getCommunityHeader({slug})`、`GET /api/v2/communities/:slug/header` | 返回 `{card,viewer}`，`card` 含社群引用/色相/简介/封面/计数，`viewer` 与详情复用同一实现。不读正文、名片或活动/通知/风采/队伍列表。头投影只作一次社群查询及安全计数，布局需使用此入口以免继续请求完整详情。 |
| S3 受控图 | 新增批量短时对象票据；旧 JWT/Cookie 图片端点保留 | 详见下方安全说明。所有受控图缓存改为 `private, no-store`，防止一年 immutable 缓存绕过撤权。 |
| S4 原生能力 | `ApplicationItem`、`ManageQueue` 及 `TodoItem` 增加必填 `webOnly` | 升推审核、活动问卷工作台和 CMS 队列为 true，其余现有原生已支持入口为 false。客户端依据服务字段提示网页办理，不维护路径白名单。 |
| S5 slug | teams 字段校验与 collection beforeChange 双层拒绝 apply/honors/manage/profiles/recruitment | 中文提示；覆盖普通、草稿及自动保存路径。已有碰撞且 slug 未改动时可继续编辑，不擅自改名。只读审计仅在隔离合成库执行，碰撞 0；生产现存资料未读取，生产审计/必要迁移未执行。 |
| S6 升推 | `HomeResponse.promoted = {events,notices,showcases}` 独立投影 | 每类至多 6 项，与日程前六条及通知前四条解耦，无时间/旧时间活动仍可进入。来源须当前可见且批准版本匹配，原内容改稿/隐藏后撤下。风采访客为 null，访客只获明确升推的活动/通知摘要；父社群未发布或生产 demo 不进入。 |
| S7 CMS | 新增 `site.homeSections`、`HomeResponse.sections` 与 additive 迁移 | 新字段控制 V2 区块顺序、标题、启停。旧 `site.modules` 原样保留、仍不驱动 V2；不擅自迁移运营意图。前端须按 sections 渲染，配置不会授予内容访问权。 |
| S8 历史深链 | 无后端修改 | 保留现有申请服务；前端继续将历史深链映射到我的申请及原锚点。 |

## S3：票据合同与安全界线

```
POST /api/v2/images/sign
Content-Type: application/json
Authorization: JWT <当前 Payload 登录令牌>

{"sources":["原 ImageRef.src"]}
```

同源 Cookie 也支持。返回 `{images:[{src,url,expiresAt}],expiresAt}`。批次 1–20 项，按原始 src 去重；任何一项不合法或无权则整批失败，不返回部分票据。仅接受服务器生成格式的站内受控图路径及确切图片版本，不接受外链、任意参数、客户端用户 ID 或到期时间。

- 默认 60 秒，且不超过原 Payload session 到期时间。HMAC 有独立用途前缀、常量时间验签；绑定用户、账号 revision、活跃 session、完整对象路径与图片版本。
- `<image>` 使用返回的 `url`，无需另附 JWT；票据是单图片短时 bearer 凭证，不是公开匿名地址，也不能当成登录令牌。
- 每次 GET（含 304）都重读当前账号与 session、重新执行原对象 ACL；注销、停用、撤权、内容撤下、名片撤回同意、换图、上传被消费等立即阻止之后读取。签名、版本或时间不符返回通用 404。
- 客户端只可短时内存保存，账号变化/注销时清除，临近到期重新批量申请；不得写日志或持久化票据。未来发布时，网关和应用访问日志须避免记录 ticket 参数。
- 任何拿到票据的人可能在剩余有效期内使用它。无 Authorization 的原生图片请求无法证明设备身份；已被用户下载或显示的像素也不能远程收回。此方案不扩大原账号的授权范围，不承诺减少图片网络请求数，主要减少逐图下载临时文件的客户端管理开销。
- HTTP 图片分支另修正异步授权错误的 await：原服务拒绝现在被统一安全错误封装捕获，不会向路由抛出内部异常。

## S7：新主场区块配置

`site.homeSections` 为可拖拽数组，每项 `{kind,enabled,title}`。允许七种 kind，重复项被拒绝：

1. `upcoming` 接下来的赛程
2. `open` 正在招募
3. `notices` 社团公告
4. `promoted` 社团精选
5. `communities` 游戏社群
6. `highlights` 赛场高光
7. `about` 关于紫荆

`HomeResponse.sections` 输出归一化的完整有序数组。已配置项按数组顺序排列，未配置项按默认顺序追加；标题留空使用默认，最多 60 字；明确 `enabled:false` 才隐藏。清空数组恢复全默认。首屏标题、图片、按钮和焦点活动沿用原独立配置。

迁移 `20261112_000000_v2_home_sections` 仅增加新 enum/table/index，不改旧 site、modules 或内容数据。自动 down 拒绝删除运营设置，应用回滚可保留新增结构。生产未执行该迁移。

## 验证

最终 17 文件 245 项全部通过，其中 `v2-backend.integration.test.ts` 17 项使用真实 Payload + PostgreSQL；另含六组保留的旧服务端合同。全仓 TypeScript、改动文件 ESLint、生成类型一致性及 `git diff --check` 均通过。本轮没有重跑全仓测试或生产构建。

独立审查指出的升推内存回归已修复：500 项日程/动态在每页各对象验证后即转轻量投影，不跨页保留 base64 来源；主场完整来源硬上限六项。修复后重新通过上述 245 项。

实际执行结果与最终文件摘要见 `evidence/rebuild-v2-backend-followups-20261112.json`。使用全新建立、随后仅装入合成测试资料的独立 PostgreSQL；只监听 loopback，关闭 Unix socket。迁移、类型生成和测试在同一执行沙箱内串行运行，结束后停止自己的 PostgreSQL。没有读取生产环境、邮件、S3、真人资料或向真人触达。

验证包括服务端/HTTP/权限、真实 Payload session 签发及注销、名片同意撤回、升推改稿/隐藏、CMS 顺序/启停及访问、slug 草稿防绕过，并保留六组旧服务端合同。前端布局/浏览器、微信官方工具/真机和生产运行仍须各自整合验证，不能以服务测试替代。
