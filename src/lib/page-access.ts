const publicPaths = ["/events", "/announcements", "/login", "/register", "/account/reset", "/privacy"];
export function isGuestPage(path: string) {
  return publicPaths.some(root => path === root || path.startsWith(`${root}/`));
}

// Retired URLs remain closed for guests and authenticated callers, including old clients.
export function isRemovedCommunityChatPath(path: string) {
  return /^\/community\/[^/]+\/chat(?:\/|$)/.test(path) ||
    /^\/community\/(chat-images|stickers)(?:\/|$)/.test(path) ||
    /^\/api\/community-messages(?:\/|$)/.test(path) ||
    /^\/admin\/collections\/community-messages(?:\/|$)/.test(path);
}
