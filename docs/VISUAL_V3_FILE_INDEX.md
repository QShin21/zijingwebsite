# V3 文件介绍与索引

## 设计与来源
- `VISUAL_V3_ASSET_BRIEF.md`：Opus 艺术指导、美术约束、构图方案。
- `VISUAL_V3_ASSET_PROVENANCE.md`：生成美术来源、尺寸、编码处理及内容哈希。
- `VISUAL_V3_STATUS.md`：Opus 实现清单与尚待确认事项。
- `VISUAL_V3_VALIDATION_20261112.md`：验证过程及边界；初轮失败不是最终通过结论。
- `evidence/visual-v3-initial-validation-20261112.json`：初轮自动化结果与失败签名。
- `evidence/visual-v3-final-validation-20261112.json`：最终全量基线比对与36张实际静态视觉回归结论。

## 网页视觉实现
- `src/design/tokens.json`：日夜配色与共享设计来源；`src/app/(frontend)/tokens.css`、小程序主题/原生导航颜色为生成物。
- `src/components/v2/ArenaArt.tsx`、`arena.module.css`：原创竞技场矢量构图。
- `src/components/v2/Stage.tsx`、`StageCanvas.tsx`、`stage.module.css`：品牌舞台、客户端装饰粒子和适应布局。
- `src/components/v2/art.ts`：服务端检测静态艺术资产是否存在；不请求第三方渲染服务。
- `public/visual-v3/*`：三张体积受控的生成背景，不承载业务文本。
- `src/components/v2/*module.css`：卡片、导航、页头、表单及日夜内容层级。
- `src/app/(design)/design-preview/visual/page.tsx`：仅非生产且登录后可看的合成组件样张，不读真实业务内容。

## 小程序
- `miniprogram/src/components/zj-stage/index.js`：原生 Canvas 舞台构图与暂停生命周期。
- `miniprogram/src/templates/v2.wxss` 及相关页面 WXSS：卡片、标题、舞台与双主题视觉。
- `miniprogram/src/assets/*`：共享令牌重新生成的原生标签图标。
- `tests/miniapp-theme.test.ts`：新原生导航配色的期望值，保留原断言结构。

## 独立后端整合
- `V2_DATABASE_COMPATIBILITY_20261112.md` 与对应 evidence：Astra 数据库兼容工作、合成迁移与非破坏验证。
- `tests/nickname-db.test.ts`：保留旧数字账号字段的无损迁移验证，API 不暴露旧字段的断言仍在。

本轮工作仅面向 `new` 分支，不含生产部署、真实数据库写入或生产备份恢复。
