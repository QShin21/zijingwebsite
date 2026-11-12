# 社群游戏图标

本功能基于 `origin/new@51fead4`，新增网站的社群图标编辑入口。

## 管理员操作

1. 登录后进入“社群”，点击所管理社群卡片下方的“修改社群图标”。社群页顶部也有同名入口。
2. 选择对应游戏的 PNG、JPEG 或 WebP 图片，最大 4 MB，最多 1600 万像素，使用静态图片。
3. 拖动图片，或用“放大”“水平位置”“垂直位置”滑块调整正方形裁切。滑块支持键盘方向键。
4. 检查缩略图，可选填写图片来源，然后点击“保存社群图标”。
5. 再次打开该页面可继续裁切已保存原图，也可选择新的图片替换。保存后社群列表、首页社群卡片和社群页标志同步读取新图标。

权限按数据库中的当前身份判断：在任社群管理员管理自己的社群，社长、副社长管理全部社群。已撤任、停用账号及其他社群的管理员无法修改。平台的历史 `communityAdmin` 标记按现有项目规则不单独授予社群范围。

编辑地址为 `/community/<社群标识>/appearance`。同时打开页面的管理员会遇到版本冲突提示，刷新后可基于最新图标继续编辑。

## 展示与默认素材

优先展示管理员保存的图标。截图中的五款游戏在首次上传前显示下表所列的游戏标志。其他游戏继续使用已有 CMS 封面；没有封面时显示通用游戏社群符号。

默认图片采用下列游戏方资源，由本站的 `/api/game-icons/default/<游戏标识>` 返回。图片居中并带透明留白，方便小程序的横向卡片完整展示游戏标志。小程序首页和社群列表刷新后即可读取默认图标和管理员上传的图片。仓库保存资源 URL 与代码。

| 游戏 | 来源页 | 默认图片 |
| --- | --- | --- |
| 王者荣耀 | [腾讯游戏官网](https://pvp.qq.com/) | [页面公共页头标志](https://game.gtimg.cn/images/yxzj/pvpcommonimage/header/logo.png) |
| CS2 | [Valve 的 Steam 页面](https://store.steampowered.com/app/730/CounterStrike_2/) | [游戏标志](https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/730/logo.png) |
| 星露谷物语 | [开发者的 Steam 页面](https://store.steampowered.com/app/413150/Stardew_Valley/) | [游戏标志](https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/413150/logo.png) |
| 蛋仔派对 | [网易游戏官网](https://party.163.com/) | [游戏图标](https://webinput.nie.netease.com/img/party/icon.png/128) |
| 英雄联盟 | [腾讯游戏官网](https://lol.qq.com/main.shtml) | [游戏标志](https://game.gtimg.cn/images/lol/v3/logo-public.png) |

## 实现与发布

- 新增独立的 `community-icons` 集合，一个社群一条图标记录。原图规范化为最长边 2048 像素的 WebP，保留透明通道；展示图为 512 × 512 WebP。重新裁切复用保存的原图，避免反复压缩原图。
- 上传校验以实际解码结果为准；拒绝 SVG、伪造扩展类型、动画、超出大小或像素上限的图片。服务端检查裁切范围。
- 修改在串行化事务中重新读取账号权限并核对版本。集合原始写接口关闭，网站服务在权限验证后通过 Local API 的 `overrideAccess:false` 写入。
- 普通浏览只查询版本号并投影图标 URL。原图、修改人、裁切参数由管理员读取。公开图片接口 `/api/game-icons/<社群标识>` 只返回已发布社群的裁切成品，并在生产环境排除演示社群。
- 新迁移 `20261112_020000_community_icons` 仅增加图标表、索引和后台文档锁关系。社群正文及现有待审草稿沿用原记录。
- 发布时先运行已有迁移命令，再启动新构建。回退应用时保留新增表和图片数据。

功能已上线至紫荆网站。实际验证范围见 [本地验收](evidence/community-icons-20261112.json) 和 [部署记录](evidence/icons-admin-reset-deployment-20261112.json)。
