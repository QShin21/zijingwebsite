import { getPayload } from "payload";
import config from "../src/payload.config";

const url = new URL(process.env.DATABASE_URL!);
if (process.env.QUIZ_TEST !== "isolated" || url.hostname !== "127.0.0.1" || url.pathname !== "/quiz_synthetic")
  throw new Error("Synthetic quiz database required");
const payload = await getPayload({ config });
try { await payload.db.migrate(); }
finally { await payload.destroy(); }
process.exit(0);
