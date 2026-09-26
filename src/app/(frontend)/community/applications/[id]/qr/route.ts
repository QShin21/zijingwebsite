import { cms } from "@/lib/content";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  const p = await cms();
  const { user } = await p.auth({ headers: request.headers });
  const id = Number((await params).id);
  if (
    !user ||
    user.accountStatus === "suspended" ||
    !Number.isSafeInteger(id) ||
    id <= 0
  )
    return new Response(null, { status: 404, headers });
  const application = await p
    .findByID({
      collection: "community-applications",
      id,
      overrideAccess: false,
      user,
      depth: 0,
      select: { wechatQr: true },
    })
    .catch(() => null);
  const data = application?.wechatQr;
  if (!data?.startsWith("data:image/png;base64,"))
    return new Response(null, { status: 404, headers });
  return new Response(
    new Uint8Array(Buffer.from(data.split(",")[1], "base64")),
    {
      headers: {
        ...headers,
        "Content-Type": "image/png",
        "Content-Disposition": 'inline; filename="wechat-card.png"',
      },
    },
  );
}
