import type { ImageRef } from "./v2/types";

// Fixed publisher assets; uploaded artwork takes precedence. Sources: docs/COMMUNITY_ICONS.md.
const icons = [
  {
    titles: ["王者荣耀"],
    slugs: ["honor-of-kings", "hok", "wzry"],
    src: "https://game.gtimg.cn/images/yxzj/pvpcommonimage/header/logo.png",
  },
  {
    titles: ["cs2", "counter-strike 2", "反恐精英2"],
    slugs: ["cs2", "counter-strike-2", "csgo"],
    src: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/730/logo.png",
  },
  {
    titles: ["星露谷物语", "stardew valley"],
    slugs: ["stardew-valley", "stardew"],
    src: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/413150/logo.png",
  },
  {
    titles: ["蛋仔派对"],
    slugs: ["eggy-party", "eggy", "party"],
    src: "https://webinput.nie.netease.com/img/party/icon.png/128",
  },
  {
    titles: ["英雄联盟", "league of legends"],
    slugs: ["league-of-legends", "lol"],
    src: "https://game.gtimg.cn/images/lol/v3/logo-public.png",
  },
];
export function defaultGameIcon(title: string, slug: string): ImageRef | null {
  const match = icons.find(
    (icon) =>
      icon.titles.includes(title.trim().toLowerCase()) ||
      icon.slugs.includes(slug.toLowerCase()),
  );
  return match
    ? { src: match.src, width: null, height: null, alt: `${title}游戏图标` }
    : null;
}
