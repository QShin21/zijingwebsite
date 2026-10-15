# 原生0.5.0逐页适用状态矩阵

2026-10-15，阶段 E。保留 A–D 的209个合成状态，追加186个，共395个、25页。四个宽度320/375/390/430px与浅深两主题共3160个计划布局组合；实际执行结果见[实施进度](MINIPROGRAM_0_5_0_PROGRESS.md)。

来源为`miniapp-050-stage-e-fixtures.mjs`及复用的A–D构造器。追加状态使用`e-`前缀。L表示页面实际可见的读取状态，empty/error/success/long分别是实际空分支、错误反馈、正常和长内容。对共用页面的mode/kind/collection按真实WXML分支展开；由同一条件完全隐藏的正文复用相同反馈样例，等价范围写在表中。

所有数据都是合成资料。构造器只读取真实Page初始data和纯投影，不执行生命周期、业务事件、网络、真实媒体或微信授权。静态成功回执只证明排版，不能证明实际写入成功。

| 页面 | E 总数（新增） | 适用状态与最小补充 / 复用理由 |
| --- | --- | --- |
| home | 11（1） | L/empty/error/long 复用 home-*；新增 e-home-anonymous-content，覆盖匿名有内容。公开首页没有未登录拒绝分支。 |
| events | 14（7） | events 原 L/empty/error/long 与页错保留；announcements 新增 L/empty/error/分页在途/分页失败五态；活动另增分页在途和推荐错误。两个 mode 都有正常长内容。公开列表无初始登录阻断。 |
| communities | 9（3） | 原 L/error/login/正常长名称保留；新增无已公开项目的 empty、分页在途、推荐局部错误。搜索空和初始空使用不同文案。 |
| explore | 2（0） | 正常静态入口和 login 复用；源码无网络列表、L/error/empty 分支，这三项 N/A。成功导航必须动态核验。 |
| account | 6（2） | e-account-refreshing 对应真实 refreshing 可见条；e-account-long-name；已有成员/管理能力/未登录/error。列表 empty 不适用于账户入口页。 |
| list | 58（41） | 11 collection 全部具有正常与 empty/L/error 代表；7 个非公开 collection 的 login 缺项补齐，news 已有。publicCollections 的初始登录拒绝 N/A。新增 loadingMore 和招新三种选中分类。club-showcase 无分页，N/A。 |
| detail | 25（7） | 补 announcements/games/pages 长正文，以及 community-posts event/notice、社群活动报名失败/仅名单能力。所有 collection 的 L/error/login 共用 detail-* feedback：WXML 在这些状态隐藏完整 collection 正文，没有新增每类型的重复反馈图。实际查无记录走 error，成功 empty 内容 N/A。公开 collection 初始登录拒绝 N/A。 |
| fixed | 35（24） | 七个 key 全有 L/empty/error；六个受限 key 全有 login（about 复用）；privacy 允许匿名，登录阻断 N/A。原正常合成长正文保留。 |
| auth | 10（5） | 三种 mode 正常/失败/验证码回执/busy 的实际分支覆盖，补注册初始、重设初始/sent/busy、登录 busy。无列表 L/empty 字段，N/A；成功是 toast/离页，需要官方动态验证。 |
| community | 29（16） | contacts/updates/showcase 三 area 的 L/error/login；补 updates empty、两种内容区局部读取/错误、有正文及荣誉摘要的 showcase、荣誉加载/错误、名片/进度读取、展开长简介。已有联系人/人工进群各状态与授权图错保留。 |
| applications | 15（5） | submit/edit/card 正常、长内容、回执 empty、busy、确认后 error、login 原有；补初始 L/error、分页读取、社群选项 error、图片读取 busy。动作结果需动态验证。 |
| review | 12（4） | 原 success/long/empty/denied/login/busy 保留；补初始 L/error、分页读取和名片读取 busy。 |
| signup | 29（15） | 活动、staff、team、manage 各可见反馈标题的 L/error/login；view 与 manage 在反馈时同为 edit:true，复用同图。新增未启用/未开始/已截止无回执、名单 busy、community-posts 表单标题；原16题型、长回执、保存成功/未知、名单 empty 保留。events/community-posts 请求路由不可由静态图证明。 |
| activity-manage | 9（4） | community-posts/events 各 success/long/empty/L/error；补全另一 kind 的缺项和 login。授权撤回真实响应仍由行为/原生测试验证。 |
| staff | 8（1） | 原公开访客、普通成员/审核能力、L/empty/error/long及本人回执错误；补本人回执独立 loading。公开批次的全页 login 拒绝 N/A，匿名与清空私有记录后的页面使用访客 fixture。 |
| staff-review | 13（2） | 原 success/long/empty/L/login/403/保存后错误/未知/busy；补首次普通网络 error 和分页 L。 |
| community-joins | 10（3） | 原五种业务状态、长处理说明、empty/denied/login/busy/确认后 error；补初始 L/error 与分页 L。 |
| team | 17（9） | 四种 view 都有 success/long/empty/L/error；login 隐藏全部 view 导航和正文、标题相同，复用 team-login，不创建三张重复图。 |
| team-apply | 9（3） | 新建/改稿/待定位/无权空/busy/确认后 error 原有；补 L/login/首次 error。真实保存成功和已确认回执图只表示静态展示。 |
| team-review | 14（7） | join/establishment 各 success/long/empty/L/error/login/denied；建立申请审核缺项通过真实 mode 字段补齐；原完整问卷/receiptError 保留。 |
| team-members | 8（3） | 原 success/long/empty/denied/busy/确认后 error；补 L/login/首次 error。 |
| team-honors | 6（0） | 公开批准/历史、L/empty/error/媒体错误原有；包含长标题/材料。公开档案的全页 login 拒绝 N/A，管理入口登录和导航须动态核验。 |
| team-profiles | 13（6） | 原正常长名单、无资格、编辑/显示隐藏预览/周期锁/确认后 error；补 L/login/首次 error、空公开名单、保存 busy、头像失败。 |
| team-honor-workspace | 18（11） | mine/review 各 L/login/首次 error；补 review empty/denied、审核 busy、本人分页入口、证据读取失败。原长材料、有限能力、批准后隐藏、确认后 error 保留。 |
| team-honor-edit | 15（7） | 原新建空表单、长退回材料/已批、409/未知、视频待上传/100%待ACK、确认后 error；补 L/login/首次 error、无有效队伍、45%上传、媒体/隐私错误、普通保存 busy。 |

未将不可见 data 标记计为新增覆盖：explore 未伪造 loading/error，auth 以真实 busy/sent 展示状态计数；detail 不新增不存在的成功 empty 页面。对被同一 WXML 条件完全隐藏的模式内容，复用同一个 feedback fixture，并在本表说明等价范围。

完整布局入口：

```sh
node scripts/rebuild-native-preview.mjs --suite stage-e --browser <本机Chromium路径>
```

逐组合保存fixture、主题、宽度、来源哈希、测量、HTML及全页/首屏PNG。横溢出、44px命中区、正文/辅助文字、裁切、浏览器异常与外部请求沿用原阈值。底部20px安全区为明确模拟；截图不含微信导航、胶囊、系统tab、原生键盘或自定义隐私组件。

会话失效、换号/换路由、迟到回调、分页、断网、重复写入、CAS、完整16题型及受控媒体由行为/数据库测试另行验证。官方编译、导航返回、键盘/安全区、同意按钮、媒体播放/清理和真机操作仍须对应原生证据；不能从这份表或浏览器映射推定通过。
