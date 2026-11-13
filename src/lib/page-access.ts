const publicPaths = ["/events", "/announcements", "/login", "/register", "/account/reset", "/privacy", "/about", "/contact"];
const publicCommunityDetail = /^\/community\/[a-z0-9-]+\/updates\/[1-9]\d*\/?$/;
export function isGuestPage(path: string) {
  return path === "/" || path === "/join" || publicCommunityDetail.test(path) ||
    publicPaths.some(root => path === root || path.startsWith(`${root}/`));
}

export function isCampusPage(path: string) {
  return /^\/(teams|honors|recruitment|staff|news|gallery|design-preview)(\/|$)/.test(path) ||
    /^\/join\/(staff|members|teams)(\/|$)/.test(path) ||
    (/^\/community(\/|$)/.test(path) && !publicCommunityDetail.test(path));
}

export function isLegacyPublicRead(path: string, method: string, key: string | null) {
  if (method !== "GET") return false;
  const route = path.replace(/\/$/, "");
  return route === "/api/events" || route === "/api/announcements" ||
    route === "/api/pages" && key !== null && ["privacy", "about", "contact", "join"].includes(key);
}

export function isCampusAPI(path: string) {
  return /^\/api\/(events|announcements|games|teams|seasons|honors|news|albums|recruitment|pages|community-[^/]+|team-[^/]+|staff|staff-batches|staff-applications|pending-uploads|redirects|globals|content-promotions|showcase-videos|private-team-honor-videos|graphql)(\/|$)/.test(path) ||
    /^\/api\/media(?:$|\/(?!file\/))/i.test(path);
}

// Retired URLs remain closed for guests and authenticated callers, including old clients.
export function isRemovedCommunityChatPath(path: string) {
  return /^\/community\/[^/]+\/chat(?:\/|$)/.test(path) ||
    /^\/community\/(chat-images|stickers)(?:\/|$)/.test(path) ||
    /^\/api\/community-messages(?:\/|$)/.test(path) ||
    /^\/admin\/collections\/community-messages(?:\/|$)/.test(path);
}

export function isRemovedCommunityInteractionPath(path: string) {
  return /^\/community\/[^/]+\/forum(?:\/|$)/.test(path) ||
    /^\/(?:api|admin\/collections)\/(?:forum-posts|comments|community-reactions)(?:\/|$)/.test(path) ||
    /^\/api\/miniapp\/reactions(?:\/|$)/.test(path);
}
