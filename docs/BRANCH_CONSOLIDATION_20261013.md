# 紫荆分支同步、清理与恢复 · 2026-10-13

用户最新要求：最新完整功能进入原有main与littleapp，删除多余分支，后续直接在原分支分小步提交，不再新建topic/codex分支。生产部署、CMS发布与小程序上传已取消；视觉重设计需求保留，但未完成草稿不混入已验证运行源码。

main旧tip：2ce3ad87cac78ce97002881469ab5cbaad6b1308。littleapp旧tip：80a0129d3ea27d564fc456642619239b70a0f819。两者均为完整交付323aadebe3897167462e0147f82129400a9b9d0b的祖先，没有独有内容需要冲突解决；两者原本都包含网站和miniprogram的完整仓库结构。采用正常fast-forward、一次atomic普通推送，远端回读均为323aade；本次记录尾提交也同步两者，准确最终SHA由交付回复/远端ref给出。无force、无PR或保护设置修改。

## 保留位置与恢复

删除前自包含Git bundle保留所有26个旧远端tip、完整独有历史和暂停视觉stash；在独立mirror中fsck并逐ref核对通过。恢复包：[下载分支历史与暂停视觉草稿](https://chatgpt.com/api/library/files/libfile_a3fc69d086288191808cf0faef0e35a7/download)，Library ID libfile_a3fc69d086288191808cf0faef0e35a7，版本0，6837005字节，SHA256 2e1a71c11c083c8f2ef82b6e5b42b9bf64c6e0b78b47f7b10805ea06ee4f8e1e。精确file/version回读的字节和所有成员摘要已核对，完整bundle再次验证通过。备份仅包含原仓库跟踪历史和明确原创草稿，没有运行构建包、环境、凭据、本地DB/媒体或真实成员数据。

在新目录解压恢复包后，运行 git clone --mirror zijing-all-branches-before-cleanup-20261013.bundle recovered.git 得到完整独立对象库。通过 git --git-dir=recovered.git show-ref 查看准确旧refs，再读取需要的旧提交/文件；恢复动作不自动运行或覆盖main/littleapp。暂停的11个视觉源码/图像文件位于bundle的refs/stash，SHA a0ce19a7a7093d5090387ba81ac409f23113f22b，第三parent保存未跟踪内容。其CSS/小程序样屏、类型、功能和响应式尚未完成，不能作为可运行结果；恢复方式详见包内RESTORE.md。原始生成主视觉也已保存，官网参考截图不对外分发。

## 已删除的24个远端临时分支

| 原分支 | 删除前SHA | 保留位置 |
| --- | --- | --- |
| `codex/activity-signups` | `89a76f4cfee44046bae3dc41697b2673eab066ef` | main / littleapp 的祖先；恢复包同时保存 |
| `codex/club-integration-20261012` | `323aadebe3897167462e0147f82129400a9b9d0b` | main / littleapp 的祖先；恢复包同时保存 |
| `codex/club-operations-recovery` | `ed965ef457b5913d4590753c9d931e82811244b9` | main / littleapp 的祖先；恢复包同时保存 |
| `codex/club-operations-vnext` | `8ec605a6d29257430718fbd598a458c8b402e846` | main / littleapp 的祖先；恢复包同时保存 |
| `codex/community-contact-consent-20261013` | `3a3c83a7af3a1def623db6cfdc0b55d0168e54bb` | 完整旧历史在恢复包 `refs/remotes/origin/codex/community-contact-consent-20261013` |
| `codex/fix-video-fixture-20261012` | `1d57dfb5abbe0ed9c88b097d2478f1495a87b99f` | main / littleapp 的祖先；恢复包同时保存 |
| `codex/inline-bilibili-preview` | `f9f992840fb2c4d8c1b713e409ddb670f8fe0d53` | main / littleapp 的祖先；恢复包同时保存 |
| `codex/join-showcase-video` | `7e6bb47f30ee595cea2aa3fca53acadbcfacd2bd` | main / littleapp 的祖先；恢复包同时保存 |
| `codex/miniapp-club-flows-20261012` | `816bf555a592f47b78380aa5e57b6dc2d1751f89` | 完整旧历史在恢复包 `refs/remotes/origin/codex/miniapp-club-flows-20261012` |
| `codex/miniapp-platform-fixes-20261012` | `c28efb1fe18a047256a43a51af1f8482c9b4d9d0` | 完整旧历史在恢复包 `refs/remotes/origin/codex/miniapp-platform-fixes-20261012` |
| `codex/miniapp-preview-brand` | `fb6cc229169f2904ce9445ad2b9a2065c8441cca` | main / littleapp 的祖先；恢复包同时保存 |
| `codex/privacy-retention-review-20261013` | `f849e18fc2cd1987e8c3bc02817d9811cfc10d4a` | 完整旧历史在恢复包 `refs/remotes/origin/codex/privacy-retention-review-20261013` |
| `codex/questionnaire-ai-reliability` | `324034500aa1457231329f0887965586a1ee493f` | main / littleapp 的祖先；恢复包同时保存 |
| `codex/questionnaire-export` | `2ce3ad87cac78ce97002881469ab5cbaad6b1308` | main / littleapp 的祖先；恢复包同时保存 |
| `codex/questionnaire-flow-ai` | `13544d9ff1162a4e145d63f276bbf68b4646f035` | main / littleapp 的祖先；恢复包同时保存 |
| `codex/questionnaire-improvements` | `aadecde3d26d70ca844c658541e5b06b0c5c990e` | main / littleapp 的祖先；恢复包同时保存 |
| `codex/questionnaire-platform` | `d83e5a3facb8dd39093dd2fc72c3b634abcb2bf3` | main / littleapp 的祖先；恢复包同时保存 |
| `codex/remove-community-chat` | `94ea4aeb1ef07b12de5d554640fffead7feb4305` | main / littleapp 的祖先；恢复包同时保存 |
| `codex/remove-forum-miniapp-readonly` | `8aeb9c783310bd6a354fd1c7b7e1ecf39b456d9d` | main / littleapp 的祖先；恢复包同时保存 |
| `codex/remove-retired-domains` | `fb51bbb71009aec66395fb2892402d814ddca744` | main / littleapp 的祖先；恢复包同时保存 |
| `codex/restore-thuzijing-domain` | `0e13faf7c970e4e9675926f7d6ab63484cc5d293` | main / littleapp 的祖先；恢复包同时保存 |
| `codex/team-core-20261012` | `bf6665c57d83ffa269845c76ff6903d23e0510de` | main / littleapp 的祖先；恢复包同时保存 |
| `codex/team-honors-20261012` | `196ebf841c77f7a725ed6b41100cd66b341faea5` | main / littleapp 的祖先；恢复包同时保存 |
| `codex/team-profiles-20261012` | `3ba056c3dde350b51f28ea72792fe17d54e96b84` | main / littleapp 的祖先；恢复包同时保存 |

所有分支删除前tip再次与备份清单核对；main/littleapp已同步且开放PR为0，24项atomic正常删除成功。仓库唯一工作流为质量检查，不含部署/微信上传或指定topic分支的外部步骤；外部托管/真人服务未访问。本地已删除完成被main包含的integration、未推送design和旧work别名；stash保留且备份可下载。远端仅剩main/littleapp。

## 验证与边界

同步后Node24.12.0/Linux x64/glibc2.36、network=none、只读源码/依赖执行：148/148针对测试（联系组件20、原生明确同意27、POST方法13、WXML绑定33、隐私正文6、保留工具49），全仓tsc --noEmit --incremental false、ESLint、原生静态均通过。小程序保持0.3.1、25页/146文件/475772字节，16类问卷和已有17迁移不变。两分支运行内容与323aade完全一致，本次尾提交只改规则和记录文档，没有重新构建、重复全量基线或生产迁移。

此前已执行的135fea43生产构建、实际解压Next/JWT/SQL 27项与POST34项记录保留于community-contact-consent-integration证据；本次没有重跑，不能作为新CI。运行源码Actions38344701122仍为runnerID=0、steps=[]的failure；此文档尾提交含[skip ci]，无新CI成功声明。微信现代官方工具、基础库3.16、真机及平台审核仍未验收。本次未部署、发布CMS、上传微信或触达真人。

后续网站/共用服务修改在main，原生修改在littleapp；相关共用变更用普通merge/fast-forward/cherry-pick同步，不覆盖两者后续独有内容、不新开开发分支，保留小切片回退能力。最新规则写入AGENTS.md。
