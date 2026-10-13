import { proxyMember } from "@/lib/proxy-member";
import { canParticipate } from "@/lib/rules";
import { isGuestPage, isRemovedCommunityChatPath, isRemovedCommunityInteractionPath } from "@/lib/page-access";
import { NextResponse, type NextRequest } from "next/server";
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (isRemovedCommunityChatPath(path) || isRemovedCommunityInteractionPath(path)) return NextResponse.json({ error: "此社群互动功能已移除" }, {
    status: 404, headers: { "Cache-Control": "private, no-store" },
  });
  const privateAPI = /^\/api\/(games|teams|seasons|honors|news|albums|recruitment|community-[^/]+|graphql)(\/|$)/.test(path);
  if (privateAPI || (!isGuestPage(path) && !path.startsWith("/admin") && !path.startsWith("/preview") && !path.startsWith("/api/") && path !== "/favicon.ico")) {
    let user;
    try { user = await proxyMember(request.headers); }
    catch { return NextResponse.json({ error: "暂时无法验证登录状态，请稍后重试" }, { status: 503, headers: { "Cache-Control": "private, no-store" } }); }
    if (!canParticipate(user)) {
      if (privateAPI || /\/(contacts|qr)$/.test(path)) return NextResponse.json({ error: "请先登录" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
      const target = new URL(path === "/" ? "/events" : "/login", request.url);
      if (path !== "/") {
        target.searchParams.set("message", "请登录后访问此栏目");
        target.searchParams.set("returnTo", path + request.nextUrl.search);
      }
      const response = NextResponse.redirect(target);
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }
  }
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const dev = process.env.NODE_ENV === "development";
  const policy = `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; frame-src 'self' https://player.bilibili.com; media-src 'self' https:;  connect-src 'self'${dev ? " ws:" : ""}; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self';`;
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  if (
    request.nextUrl.pathname.startsWith("/preview") ||
    request.nextUrl.pathname.startsWith("/admin")
  ) {
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|icon.svg|robots.txt|sitemap.xml|health).*)",
  ],
};
