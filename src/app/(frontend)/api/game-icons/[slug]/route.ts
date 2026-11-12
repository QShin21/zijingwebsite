import { cms } from "@/lib/content";
import { readCommunityIcon } from "@/lib/community-icons";

export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const icon = await readCommunityIcon(await cms(), slug);
    return new Response(new Uint8Array(icon.bytes), {
      headers: {
        "Content-Type": "image/webp",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=0, must-revalidate",
        ETag: `"${icon.revision}"`,
      },
    });
  } catch (error) {
    const status =
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 404
        ? 404
        : 503;
    return new Response(status === 404 ? "图标不存在" : "图片暂时无法读取", {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
