# V3「黑曜竞技场」生成资产说明（≤3 项，可选增强）

2026-11-12，Claude Opus 5.5（唯一前端作者）。站点与小程序已用**原创矢量竞技场**（`src/components/v2/ArenaArt.tsx`、`miniprogram/src/components/zj-stage`）完成主视觉，下列资产只作照片级增强：文件放到指定路径后，服务端在渲染时检测存在才叠加（`src/components/v2/art.ts`）；缺失不影响构建、不产生 404。

共同约束（三项都必须遵守）：
- 无人物、无人脸、无观众剪影、无手；无文字、数字、标志、校徽、队徽、奖杯造型或任何真实品牌；无显示具体比赛画面的屏幕。
- 不要「霓虹赛博城市」、不要彩虹 RGB 灯带、不要光球/镜头光斑堆叠、不要粒子噪点墙。
- 色彩：黑曜石黑 / 深靛 / 清华紫 `#660874` 的光（含其提亮的 `#D69BE3` 边缘光）/ 银白冷光；仅少量冠军金 `#E3B04B` 点缀（≤5% 画面）。
- 质感：CGI 写实、电影级、低饱和、高动态范围，轻雾与体积光；细颗粒胶片质感；无 AI 常见扭曲（弯曲直线、融化结构）。
- 交付：WebP（质量 80 左右），sRGB，无透明。生成后请人工检查线条笔直、无伪文字。

## 1. `arena-hero.webp` —— 网站主场横幅（必要）
- 放置：`public/visual-v3/arena-hero.webp`
- 尺寸：3360×1440（21:9），≤ 450 KB
- 使用方式：首页舞台 `Stage`，`background-size: cover; background-position: 68% 60%`，`mix-blend-mode: lighten`，不透明度 0.78；左侧 18%→52% 渐隐、底部 22% 渐隐，覆盖在矢量竞技场上。
- 构图：**主体（圆形赛台）位于水平 55%–80%、垂直 50%–70%**；左侧 40% 必须暗且细节少，用于大标题；地平线约在 60% 高度。
- 英文提示词：
  > Cinematic wide shot of an empty professional esports arena at night, seen from slightly above the floor. A circular competition stage with concentric engraved rings sits right of centre, framed by two tall monolithic pylons of brushed obsidian metal with thin silver rim light. Volumetric light beams fall from the ceiling rigging through light haze onto the stage. Deep black and indigo environment, glow in Tsinghua purple (#660874) with pale lilac highlights, cool silver-white key light, a few tiny warm gold accents on the stage edge. Left 40% of the frame falls into deep shadow with minimal detail. Photoreal CGI, 35mm lens, high dynamic range, subtle film grain, restrained saturation. No people, no audience, no text, no logos, no screens, no trophies.
- 负面提示：people, crowd, faces, text, letters, numbers, logo, emblem, trophy, neon city, rainbow RGB, lens flare spam, bokeh orbs, cartoon, low detail, warped lines.

## 2. `arena-portrait.webp` —— 手机端舞台竖版（推荐）
- 放置：`public/visual-v3/arena-portrait.webp`（网站手机宽度 ≤640px 自动替换横版）
- 尺寸：1080×1920（9:16），≤ 260 KB
- 使用方式：`background-position: 68% 100%`，底部 60% 可见、向上渐隐，`lighten` 混合，不透明度 0.8。
- 构图：**赛台位于水平 55%–80%、垂直 70%–88%**；上方 45% 留暗用于标题与按钮；两侧立碑可裁出画面。
- 英文提示词：
  > Vertical cinematic view of an empty esports arena stage at night. A circular competition stage with engraved concentric rings in the lower right third, one tall brushed obsidian metal monolith rising beside it with a silver edge highlight, volumetric purple light beams descending from above through soft haze. Top half of the frame is deep black-indigo with minimal detail. Palette: obsidian, deep indigo, Tsinghua purple (#660874) glow, pale lilac and silver highlights, tiny gold accents. Photoreal CGI, high dynamic range, subtle grain. No people, no text, no logos, no screens.
- 小程序：当前原生舞台由 `zj-stage` Canvas 原创绘制，**不依赖此图**；如后续要放入小程序包，请另存 720×1280、≤160 KB 版本并单独评估主包体积（当前约 870 KB）。

## 3. `monolith-detail.webp` —— 材质特写（可选）
- 放置：`public/visual-v3/monolith-detail.webp`
- 尺寸：1600×1200（4:3），≤ 220 KB
- 使用方式：首页「关于紫荆」黑曜面板右侧 60%，`cover`、向左渐隐，不透明度 0.7。
- 构图：抽象特写，主体偏右；左侧 40% 为几乎纯黑的渐暗区域。
- 英文提示词：
  > Abstract macro close-up of the bevelled edge of a brushed obsidian metal monolith in a dark studio. A thin silver rim light traces the edge, a soft Tsinghua purple (#660874) glow reflects across the brushed surface, one small warm gold glint near the top. Shallow depth of field, very dark background, the left 40% fades to near black. Photoreal product photography, high detail metal texture, no text, no logos.

## 不需要生成的部分
- 社群、队伍、荣誉无图时的兜底由 CSS 原创竞技场环纹 + 六边形徽面生成（随社群色相变化），不需要逐项生成图。
- 真实活动、队伍、荣誉照片只来自 CMS 上传；不得用生成图冒充真实赛事或获奖。
