const publicPaths = [
  "/events",
  "/announcements",
  "/login",
  "/register",
  "/account/reset",
  "/privacy",
  "/about",
  "/contact",
  "/join/staff",
];
export function isGuestPage(path: string) {
  const campusAsset =
    /^\/pixel-campus\/(?:pixel-campus\.jpg|campus-(?:summer|winter)\.webp|fusion-pixel\.woff2|esports-(?:fistbump|match|trophy)\.jpg)$/.test(
      path,
    );
  return (
    campusAsset ||
    path === "/" ||
    path === "/join" ||
    publicPaths.some((root) => path === root || path.startsWith(`${root}/`))
  );
}

// Retired URLs remain closed for guests and authenticated callers, including old clients.
export function isRemovedCommunityChatPath(path: string) {
  return (
    /^\/community\/[^/]+\/chat(?:\/|$)/.test(path) ||
    /^\/community\/(chat-images|stickers)(?:\/|$)/.test(path) ||
    /^\/api\/community-messages(?:\/|$)/.test(path) ||
    /^\/admin\/collections\/community-messages(?:\/|$)/.test(path)
  );
}

export function isRemovedCommunityInteractionPath(path: string) {
  return (
    /^\/community\/[^/]+\/forum(?:\/|$)/.test(path) ||
    /^\/(?:api|admin\/collections)\/(?:forum-posts|comments|community-reactions)(?:\/|$)/.test(
      path,
    ) ||
    /^\/api\/miniapp\/reactions(?:\/|$)/.test(path)
  );
}
