import "dotenv/config";
import { getPayload } from "payload";
import config from "../src/payload.config";
const errors: string[] = [];
if (process.env.APP_ENV !== "production")
  errors.push("APP_ENV 必须明确设为 production");
const origin = process.env.NEXT_PUBLIC_SERVER_URL;
if (
  !origin ||
  !origin.startsWith("https://") ||
  /localhost|example\.|YOUR_|127\.0\.0\.1/i.test(origin)
)
  errors.push("缺少经确认的生产 HTTPS 域名");
if (
  !process.env.PAYLOAD_SECRET ||
  process.env.PAYLOAD_SECRET.length < 32 ||
  /REPLACE|build-only/.test(process.env.PAYLOAD_SECRET)
)
  errors.push("缺少独立生产 PAYLOAD_SECRET");
if (process.env.DB_PUSH === "true") errors.push("生产禁止 DB_PUSH");
if (!process.env.BACKUP_REMOTE) errors.push("异机备份目的地尚未配置");
if (!process.env.SMTP_HOST) errors.push("SMTP 未配置，需要落实账号恢复渠道");
const p = await getPayload({ config });
for (const collection of [
  "games",
  "teams",
  "seasons",
  "honors",
  "events",
  "news",
  "recruitment",
  "albums",
  "pages",
  "media",
] as const) {
  const result = await p.count({
    collection,
    overrideAccess: true,
    where: { demo: { equals: true } },
  });
  if (result.totalDocs)
    errors.push(`${collection} 仍有 ${result.totalDocs} 条演示资料`);
}
const users = await p.count({
  collection: "users",
  overrideAccess: true,
  where: { roles: { contains: "admin" } },
});
if (!users.totalDocs) errors.push("尚未建立系统管理员");
const privacy = await p.count({
  collection: "pages",
  overrideAccess: true,
  where: {
    and: [{ key: { equals: "privacy" } }, { _status: { equals: "published" } }],
  },
});
if (!privacy.totalDocs) errors.push("隐私说明尚未确认发布");
await p.destroy();
console.log(
  errors.length
    ? errors.map((e) => `待办：${e}`).join("\n")
    : "技术预检通过；仍需负责人确认内容、域名主体及生产变更授权。",
);
process.exit(errors.length ? 1 : 0);
