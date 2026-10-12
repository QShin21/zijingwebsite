# 竞在紫荆小程序导入包 · 平台代码修复后

原生代码完整来源：`e3a935c33d4a79695fa656cb51a0977a72117465`。
基线：`6f862c7bb876db658ab7c961bf55979cfa276482`。客户端版本0.3.1，25页、15种问卷题型加段落共16种、复杂分支与5–6人组队均保留。

这是代码审阅与导入包，releaseReady=false。已修复原生PATCH改稿及首次隐私文档/正式按钮机制。交给用户测试线上写入前，负责人必须整合网站兼容、核定发布非空隐私正文、核对已有微信平台配置并完成官方工具/真机检查。随包草案未发布，不代替正式网站说明或微信平台隐私指引。

## 必须先整合的网站小补丁

依次cherry-pick：

```sh
git cherry-pick 46a750699e6189bae2770d210abb93d01bba152c
git cherry-pick e3a935c33d4a79695fa656cb51a0977a72117465
```

46a7506只有两条现有报名/骨干路由的POST action=edit兼容及真实HTTP测试；复用原PATCH服务，保持权限、版本、修订、截止。没有collection/迁移改动。网站补丁未由本任务部署，包内不含网站后端。

## 导入

解压后在负责人已有合法微信开发者工具会话中导入 `miniprogram/`：project.config.json 的公开AppID `wxccf9f8fc9515ebd5`，源码 `src/`，基础库配置 `3.16.0`，域名校验开启。无原生npm依赖或云函数；不含密钥、私有项目配置、node_modules、缓存、生产数据或正式上传产物。

API源码地址保持 `https://home.thuzijing.top`；该值不能证明当前后台合法域名/TLS/重定向已配置。没有适用的获准隔离服务时，先验收编译与合成测试，不向生产发送报名、申请或媒体写入。

## 已执行

22个纯原生合成测试文件799/799，新增真实loopback HTTP/JWT/SQL19/19，独立隐私14/14；全仓lint/typecheck/diff/miniappcheck通过。当前25页146份源文件474072字节。原始微信官方历史wcc/wcsc编译29 WXML/27 WXSS成功；该历史工具版本0.2.3不改变客户端0.3.1，也不代表现代DevTools/基础库/真机或审核成功。

查阅 `READINESS.json` 与 `SOURCE_MANIFEST.json` 的来源和字节摘要；按 `ACCEPTANCE_CHECKLIST.md` 记录未验证现场项。`PRIVACY_DRAFT_UNPUBLISHED.md` 只列三组运营者需核定事实。正文未发布/为空时主动媒体选择会明确关闭并提供重试/拒绝，不能把静态草案当同意依据。

本轮无生产访问、部署、微信登录/preview/upload/审核、新权限或真实订阅消息。
