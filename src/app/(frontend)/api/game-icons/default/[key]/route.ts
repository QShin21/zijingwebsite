import { readDefaultGameIcon } from "@/lib/default-game-icons";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  try {
    const bytes = await readDefaultGameIcon((await params).key);
    if (!bytes)
      return new Response("图标不存在", {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/png",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new Response("图片暂时无法读取", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
