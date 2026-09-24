import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import type { Payload } from "payload";
import { consumeCode, issueCode } from "../src/lib/verification";
const sent: string[] = [];
const mail = { sendEmail: async ({ text }: { text: string }) => { sent.push(text); } } as unknown as Payload;
const saved = {
  host: process.env.SMTP_HOST, from: process.env.SMTP_FROM,
  user: process.env.SMTP_USER, password: process.env.SMTP_PASSWORD,
};
afterAll(() => {
  for (const [key, original] of Object.entries({
    SMTP_HOST: saved.host, SMTP_FROM: saved.from,
    SMTP_USER: saved.user, SMTP_PASSWORD: saved.password,
  })) {
    if (original === undefined) delete process.env[key]; else process.env[key] = original;
  }
});
describe("PostgreSQL 验证码生命周期", () => {
  it("只有正确六位码可消费一次；错误尝试受到限制", async () => {
    if (process.env.APP_ENV !== "development") throw new Error("Development database required");
    Object.assign(process.env, {
      SMTP_HOST: "test.invalid", SMTP_FROM: "test@example.invalid",
      SMTP_USER: "test", SMTP_PASSWORD: "test",
    });
    const email = `otp-${Date.now()}@mails.tsinghua.edu.cn`;
    await issueCode(mail, email, "register", "test-client");
    expect(sent).toHaveLength(1);
    const code = sent[0].match(/\d{6}/)?.[0];
    expect(code).toMatch(/^\d{6}$/);
    expect(await consumeCode(email, "register", "xxxxxx")).toBe(false);
    expect(await consumeCode(email, "register", code)).toBe(true);
    expect(await consumeCode(email, "register", code)).toBe(false);
    await expect(issueCode(mail, email, "register", "test-client")).rejects.toThrow("60 秒");
    const locked = `locked-${Date.now()}@mails.tsinghua.edu.cn`;
    await issueCode(mail, locked, "password", "test-client");
    const actual = sent[1].match(/\d{6}/)?.[0];
    const wrong = actual === "000000" ? "999999" : "000000";
    for (let i = 0; i < 5; i++) expect(await consumeCode(locked, "password", wrong)).toBe(false);
    expect(await consumeCode(locked, "password", actual)).toBe(false);
  });
});
