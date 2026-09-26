import { createHmac, randomInt } from "node:crypto";
import { Pool } from "pg";
import type { Payload } from "payload";

export type Purpose = "register" | "password";
const allowed = new Set([
  "tsinghua.edu.cn",
  "mails.tsinghua.edu.cn",
  "mail.tsinghua.edu.cn",
  "tsinghua.org.cn",
  "mail.tsinghua.org.cn",
]);
export function schoolEmail(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const email = input.trim().toLowerCase();
  if (email.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[a-z0-9.-]+$/.test(email)) return null;
  const domain = email.split("@")[1];
  return allowed.has(domain) ? email : null;
}
export function validPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 12 && value.length <= 128 &&
    /[a-zA-Z]/.test(value) && /\d/.test(value);
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
const digest = (value: string) =>
  createHmac("sha256", process.env.PAYLOAD_SECRET || "missing-server-secret").update(value).digest("hex");

async function countRate(client: import("pg").PoolClient, key: string, max: number) {
  const result = await client.query<{ hits: number }>(`
    INSERT INTO auth_rate_limits (key, window_start, hits) VALUES ($1, now(), 1)
    ON CONFLICT (key) DO UPDATE SET
      hits = CASE WHEN auth_rate_limits.window_start < now() - interval '1 hour'
                  THEN 1 ELSE auth_rate_limits.hits + 1 END,
      window_start = CASE WHEN auth_rate_limits.window_start < now() - interval '1 hour'
                          THEN now() ELSE auth_rate_limits.window_start END
    RETURNING hits`, [digest(key)]);
  if (Number(result.rows[0].hits) > max) throw new Error("请求过于频繁，请稍后再试");
}
export async function issueCode(payload: Payload, email: string, purpose: Purpose, clientIP: string) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD)
    throw new Error("邮件服务尚未配置");
  const key = `${purpose}:${email}`;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [key]);
    await countRate(client, `email:${email}`, 5);
    await countRate(client, `ip:${clientIP}`, 40);
    await client.query("DELETE FROM auth_codes WHERE expires_at < now() - interval '1 day'");
    await client.query("DELETE FROM auth_rate_limits WHERE window_start < now() - interval '1 day'");
    const previous = await client.query<{ last_sent: Date }>(
      "SELECT last_sent FROM auth_codes WHERE key = $1", [key]);
    if (previous.rows[0] && Date.now() - new Date(previous.rows[0].last_sent).getTime() < 60_000)
      throw new Error("请等待 60 秒后再次获取验证码");
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await payload.sendEmail({ to: email, subject: "紫荆电竞社网站验证码",
      text: `验证码：${code}。10 分钟内有效，请勿转发。如非本人操作请忽略。` });
    await client.query(`
      INSERT INTO auth_codes (key, digest, expires_at, last_sent, attempts, consumed_at)
      VALUES ($1, $2, now() + interval '10 minutes', now(), 0, NULL)
      ON CONFLICT (key) DO UPDATE SET digest = EXCLUDED.digest,
        expires_at = EXCLUDED.expires_at, last_sent = EXCLUDED.last_sent,
        attempts = 0, consumed_at = NULL`, [key, digest(`${key}:${code}`)]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function consumeCode(email: string, purpose: Purpose, code: unknown): Promise<boolean> {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) return false;
  const key = `${purpose}:${email}`;
  const result = await pool.query<{ consumed_at: Date | null }>(`
    UPDATE auth_codes SET attempts = attempts + 1,
      consumed_at = CASE WHEN digest = $2 THEN now() ELSE NULL END
    WHERE key = $1 AND consumed_at IS NULL AND attempts < 5 AND expires_at > now()
    RETURNING consumed_at`, [key, digest(`${key}:${code}`)]);
  return Boolean(result.rows[0]?.consumed_at);
}
