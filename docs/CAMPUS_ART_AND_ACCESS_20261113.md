# 首页插画与邮箱身份

## 首页风格

| 风格 | 首页大图 |
| --- | --- |
| 清华经典 | 清华二校门正面，按用户提供的照片重绘 |
| 清凉夏夜 | 清华近春园荷塘月色 |
| 温煦冬日 | 清华大礼堂雪景 |
| 简约 | 沿用简约主题的首页样式 |

三张地标插画使用 ImageGen 绘制。二校门参考照片仅用于绘图。网页版素材为 1440 × 720 WebP，小程序使用 720 × 360 WebP。[二校门](https://www.tsinghua.edu.cn/info/1360/1397.htm) · [近春园](https://www.tsinghua.edu.cn/info/1360/1403.htm) · [大礼堂](https://www.tsinghua.edu.cn/info/1966/76622.htm)

## 账号和发布范围

| 内容或操作 | 清华用户 | 友校学生 | 校外人士 | 未登录访客 |
| --- | --- | --- | --- | --- |
| 仅清华的活动和通知 | 可看 | — | — | — |
| 清华和友校的活动和通知 | 可看 | 可看 | — | — |
| 所有人可见的活动和通知 | 可看 | 可看 | 可看 | 可看 |
| 活动报名 | 按可见范围和报名要求 | 按可见范围和报名要求 | 按可见范围和报名要求 | 登录后报名 |
| 代表队、社群目录和招新 | 按清华账号原有角色权限 | — | — | — |

注册时验证邮箱，由服务端根据域名确定身份。清华用户涵盖系统认可的学生、教职工和校友邮箱。教育邮箱依据受管理的域名后缀识别，遇到使用其他后缀的学校，可通过服务器环境变量 `EDUCATION_EMAIL_DOMAINS` 添加完整域名，以逗号分隔。其他通过邮箱验证的账号为校外人士。已存在的账号沿用清华身份。

在 CMS 的「活动」「通知」「社群动态」中，编辑有权限的记录并发布，即可更新「可见范围」。社群活动或通知也可在网页的发布和编辑表单中调整范围。既有和新建内容默认「仅清华」。收回开放范围后，对应身份无法再访问活动详情和报名表，已有报名保留在本人记录和管理端。

## 插画生成记录

### 清华二校门

Use case: style-transfer. Asset type: landscape 2:1 hero illustration for the 清华经典 theme on web and WeChat. Input image 1 is the authoritative front elevation and exact architectural reference of 清华大学二校门. Pixelize this same photographed real gate with very high architectural fidelity. Preserve its near-straight-on frontal view, ratios of width and height, the full sculpted ivory masonry silhouette, central tall semicircular arch, its small central keystone, exactly two much lower and narrower side arches at ground level, the four tall pale round columns as TWO pairs flanking the central arch, thin dark recessed gaps in each pair, dark horizontal gray masonry bands in the sides, broad flat layered cornice, rectangular central raised attic with two square end caps, curving concave wing walls and prominent circular scrolls at both ends, and the original plaque above the central opening. Keep the original calligraphy placement and visual order exactly as the photo, with the three historical glyphs visually left-to-right 園 華 清 (reads 清華園 right-to-left). Preserve the open view through the arch and front planters. Match the exact contours and masses of the photo; no fantasy design, sloped roof, pointed pediment, large central block or extra tower. Convert the scene into clean, deliberately gridded 16-bit square-pixel art in an atmospheric muted Tsinghua plum and gold dusk palette, stone still recognizable as ivory, dark framing campus trees and subtle warm path lighting. Widen the scene with dark quiet trees on the left for interface text; place the complete gate around 65% across and 55% down, with clear breathing room, occupying about 47% of the banner width and 58% of its height. Keep the full width and base of the gate fully visible at both wide and moderate crops. No other text, no UI, no figures, no watermark.

### 近春园荷塘

Use case: stylized-concept. Asset type: wide landscape hero background for the Tsinghua University esports club site and mini-program. Create an original crisp 16-bit pixel-art summer moonlit view of Tsinghua's Jinchun Garden lotus pond (近春园荷塘月色). A grove and low island linked to the shore by a small white marble Chinese single arch pedestrian bridge, a discreet old-style covered walkway through the trees, dark jade water with identifiable broad round lotus leaves and a handful of pale pink lotus blossoms, moonlight reflected along water. Bridge, pond and lotus blooms compose a compact central-right focal scene around 65% across; quiet shaded dark teal left third for white interface text, with cool turquoise and mint moonlight toward the right. Landscape panorama about 2:1 with a shallow hero crop in mind. Hand-placed square pixels, limited cool palette and distinct silhouettes. No people, no giant temple, no mountain, no lettering, no interface, no logo, no watermark.

### 清华大礼堂

Use case: stylized-concept. Asset type: wide landscape hero background for the Tsinghua University esports club site and mini-program. Create an original crisp 16-bit pixel-art winter scene of Tsinghua University's distinctive Grand Auditorium (清华大学大礼堂) seen near front-on from the lawn. Brick-red classical auditorium with a wide pale triangular pediment over four tall pale Corinthian columns, arched windows and a single broad low rounded Byzantine dome rising behind the portico. Snow on the dome, stairs and lawn, a few drifting snow pixels, soft winter daylight and a little honey light at the windows. Winter blue, warm ivory, muted brick red and evergreen. Landmark centered at about 65% across and compact vertically so the complete dome and portico remain readable in a shallow crop, snowy path and quiet pale fog in the left third for dark interface text. Wide landscape panorama about 2:1. Use clean hand-placed square pixels and carefully simplified real proportions. No spire, second dome, people, lettering, game UI, logos or watermark.
