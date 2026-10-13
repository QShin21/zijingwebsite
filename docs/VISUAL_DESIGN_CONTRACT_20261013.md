# 紫荆视觉改版共同约定 · 2026-10-13

协作基线为 main / littleapp `383215e88379662ca6f59aefb5f724f688ef5e91`。仅根集成任务写远端，三个并行任务不建分支、不推送，以 Library 源码补丁、实际本地截图和验证报告交付。补丁只含负责模块，不捆绑公共样式或其他任务文件；保留既有异步用户/权限/真实状态及业务接口。

## 主方向：紫荆赛场编辑部 / Field Notes

品牌页用深墨色舞台、紫荆紫金属折带原创主视觉和大中文标题；内容/操作页用暖纸色、细分隔线、清晰行列和小面积紫色动作。去除重复玻璃面板、泛化霓虹、每段同款圆角卡片。不同游戏和合成条目可以有图文节奏，但不编造真实社群、成员、荣誉、活动、数量或成立年份。静态海报 fallback 是原创界面图形，不能冒充赛事/官方标志或照片。

官方参考为 https://www.razer.com/ 与 https://rog.asus.com/（2026-10-13 云端 Chromium145 实际浏览）。借鉴大图/留白、标题层级、整屏到列表的节奏、明确动作及细节统一；不复制商标、字体文件、产品图、品牌素材或网页代码。官网截图仅作内部审视，不进入素材交付。

## 公共 tokens（web --z-* / native 同值）

| 名称 | 值 | 用途 |
| --- | --- | --- |
| --z-paper | #f4f1ea | 全站暖纸底 |
| --z-surface | #fffdf8 | 表单与阅读表面 |
| --z-ink | #211e27 | 正文/主标题 |
| --z-muted | #625c68 | 说明/辅助信息 |
| --z-dark | #17151c | 品牌舞台/头尾 |
| --z-dark-muted | #bdb6c7 | 深底辅助信息 |
| --z-purple | #6839ae | 主动作/选中状态 |
| --z-lilac | #c6a5ef | 深底品牌强调/主视觉 |
| --z-amber | #edb353 | 深底聚焦/少量信号 |
| --z-line | #d9d3dc | 暖纸分隔线 |
| --z-radius | 6px | 操作/媒体容器；不普遍大圆角 |
| --z-gutter | clamp(22px,5.5vw,88px) | 公共页面水平留白 |
| --z-max | 1440px | 阅读/列表最大宽度 |

中文/英文字体：Arial, "PingFang SC", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif；不引入远程字体。数字/小标签："SFMono-Regular", Consolas, "Liberation Mono", monospace。中文正文16px/1.7（native28–30rpx），辅助文本至少12px（native24rpx），不以英文大标题代替主要中文信息。大品牌标题桌面80–108px/1.1、移动47–60px/1.14；模块标题桌面36–46px、移动28–34px；表单/审核标题桌面32–46px、移动28–32px；主字重700–900、正文400、动作600。英文 kicker 10–12px/.12em，只作次层标签。常规内容不采用过密斜体/窄体中文。

间距用4px基数，区块间桌面64–88px、移动40–54px；内容采用12列思想，桌面列表3列，长表单主区+280–340px侧说明，移动单栏。响应式重点320/390/768/1440。点击触达至少44×44 CSS px（native88rpx）。表单实际label、错误、hint、fieldset和语义顺序保留，不用placeholder替代label，不拆散联系方式必选同意。

正文对比目标WCAG AA 4.5:1，界面边界/焦点3:1；状态同时有文字，不仅靠颜色。深底focus用amber，浅底用purple，outline3px/offset5px。普通hover/focus过渡160–180ms；不自动轮播/自动视频、无滚动劫持、无常驻装饰动画。prefers-reduced-motion关闭非必要动画/过渡和smooth scroll。native无Web伪元素/滤镜/hover依赖，WXSS使用rpx、真实image/text/button、等价有限状态。

## 图片与公共组件接口

根任务提供原创本地主视觉：`public/design/zijing-stage.webp` 与 `zijing-stage-mobile.webp`。图由本任务生成、无真人/商标/他校图；用于品牌/社群舞台，已有CMS真实且获授权公开图片优先。图片保留aspect-ratio/明确尺寸，LCP图仅首屏priority，其他lazy；无重复大图/全屏视频。小程序素材由native任务按包大小裁切/导出并保留来源说明，不读取用户私有媒体。

根任务负责 `src/components/visual-direction/DesignUI.tsx`：`DesignHeader({name,signedIn})`、`DesignFooter()`、`StageArt({className?,priority?})`、`SectionHeading({index,en,title,href?,action?})`、`DemoTag({demo?})`、`EmptyState({title?,description?,href?,action?})`、`EventCard({doc,index?,collection?})`；新预览base为 `/design-preview`，复用现有数据/组件，不放宽权限。并行任务不依赖这些尚在实现的组件，可使用独立模块组件；最终由根任务适配。

## 文件边界

- 根集成：首页 `src/app/(frontend)/page.tsx`、`src/app/(design)/**` 既有隔离草稿、公共layout/style、SiteHeader/PageHeading/Identity/Content、`src/components/visual-direction/**`、`public/design/**`、公共设计文档和最终类型/验证整合。持有所有既有隔离预览草稿，不要求worker覆盖它们。
- 活动任务：活动列表/详情、报名呈现、通知/动态/风采呈现及其局部CSS Modules（新子目录推荐 `src/components/events-v4/`）；不改公共Content/Identity/PageHeading、问卷引擎、Server Actions、API服务、collection/schema/权限、通用导航。需要公共组件调整则报告，由根任务整合。
- 社群/代表队任务：游戏社群目录/详情/加入进度及代表队/成员简介/荣誉/审核局部呈现，推荐 `src/components/community-v4/`、`src/components/teams-v4/`；不改公共layout/style、首页、业务hooks或角色/状态机。社群详情应强调人工进群，审核/私人数据不进入公开投影。
- native任务：`miniprogram/src` 下原生样例和已有页面WXSS/WXML视觉（公共app.wxss原生主题归该任务），保留JS业务/生命周期及同意/隐私/16题型；不改web。允许原生局部视觉数据映射，但网络/身份/请求与复写保护原样，必要改动单独列证据。不新增开发分支。

web worker局部CSS用CSS Modules或唯一模块class，token采用 `var(--z-paper,#f4f1ea)` 等fallback；不要写全局body/root/reset/公共.button/.panel。根任务统一引入tokens与总样式。没有接口更改可直接保留现有props；重复查询优先沿用真实已公开最小投影，禁止fixture硬编码进运行页。

## 必保留的功能与验收

API/直接访问的ACL、匿名与登录边界、已撤下历史本人回执、原草稿/私有名片/荣誉视频限制、跨社群授权、平台角色与任职分离、人工入微信群、录用不授予角色、升推不迁移game/复制报名、revision/formVersion/事务CAS、16类问卷、明确布尔同意门禁、已批准卡隐藏及平台隐私前置全部保持。CMS正文仍draft/editing，不发布或改变真实内容。

worker交付应注明准确baseSHA/变更文件、type/lint与相关回归、真实云端浏览器截图的路线/尺寸/状态/角色、空/加载/错误/无脚本或reduced-motion适用边界、资源来源和大小。只用合成隔离数据，截图无真人资料；HTML近似原生渲染必须标明不是官方微信GUI/真机验证。CI配额状态不能用本地绿灯替代，不部署/发布CMS/上传微信。
