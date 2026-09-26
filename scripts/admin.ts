import "dotenv/config";
import { getPayload } from "payload";
import config from "../src/payload.config";
const email = process.env.ADMIN_EMAIL,
  password = process.env.ADMIN_PASSWORD;
if (!email || !password || password.length < 8)
  throw new Error("通过环境变量提供 ADMIN_EMAIL 和至少 8 位 ADMIN_PASSWORD");
const p = await getPayload({ config });
const existing = await p.count({ collection: "users", overrideAccess: true });
if (existing.totalDocs)
  throw new Error("已有后台用户；请由系统管理员创建账号，初始化已关闭");
await p.create({
  collection: "users",
  overrideAccess: true,
  context: { system: true },
  data: { email, password, roles: ["vicePresident"], name: "网站管理员" },
});
console.log("首位管理员已创建；凭据未输出。");
await p.destroy();

process.exit(0);
