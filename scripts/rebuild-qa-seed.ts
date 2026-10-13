import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { getPayload } from "payload";
import config from "../src/payload.config";
import type { User } from "../src/payload-types";

const url = new URL(process.env.DATABASE_URL || "postgresql://invalid");
const root = process.env.REBUILD_QA_ROOT || "";
if (process.env.APP_ENV !== "development" || process.env.DB_PUSH !== "false" ||
    url.hostname !== "127.0.0.1" || !url.pathname.endsWith("_synthetic") ||
    !root.includes("/.data/rebuild-qa-20261013") || process.env.SMTP_HOST ||
    process.env.S3_BUCKET || process.env.QUESTIONNAIRE_AI_API_KEY)
  throw new Error("Only the isolated synthetic rebuild environment may be seeded");
const resolved = await config;
resolved.typescript.autoGenerate = false;
resolved.admin.importMap.autoGenerate = false;
const payload = await getPayload({ config: resolved });
const password = "Synthetic-Rebuild-Browser-Only-20261013!";
const users: { id: number; name: string; email: string; role: string; password: string }[] = [];
const memberOnly = process.argv.includes("--member-only");
for (const [role, name] of [["member", "合成重构成员"], ["backbone", "合成重构骨干"], ["president", "合成重构社长"]] as const) {
  if (memberOnly && role !== "member") continue;
  const email = `rebuild-${role}@example.invalid`;
  const found = await payload.find({ collection: "users", overrideAccess: true, where: { email: { equals: email } }, limit: 1 });
  const actor = found.docs[0] || await payload.create({ collection: "users", overrideAccess: true,
    context: { system: true }, data: { name, email, password, roles: [role] as User["roles"] } });
  users.push({ id: actor.id, name, email, role, password });
}
await fs.writeFile(path.join(root, "synthetic-browser-users.json"), JSON.stringify({
  syntheticOnly: true, notifications: false, users,
}, null, 2) + "\n", { mode: 0o600 });
await payload.destroy();
console.log(`${users.length} synthetic browser roles ready; account fixture saved only under the current QA directory.`);
process.exit(0);
