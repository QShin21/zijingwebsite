const publicPaths = ["/events", "/announcements", "/login", "/register", "/account/reset", "/privacy"];
export function isGuestPage(path: string) {
  return publicPaths.some(root => path === root || path.startsWith(`${root}/`));
}
