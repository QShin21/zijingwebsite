import "dotenv/config";
import net from "node:net";
import { randomInt } from "node:crypto";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { getPayload, type Payload } from "payload";
import config from "../../src/payload.config";

let p: Payload;
const mails: string[] = [];
let rejectNext = false;
const sockets = new Set<net.Socket>();
const smtp = net.createServer((socket) => {
  sockets.add(socket);
  socket.on("close", () => sockets.delete(socket));
  // Transport verification may disconnect while the loopback receiver is replying.
  socket.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "ECONNRESET" || error.code === "EPIPE") socket.destroy();
    else throw error;
  });
  socket.setEncoding("utf8");
  socket.write("220 localhost test SMTP\r\n");
  let buffer = "",
    inData = false,
    body = "";
  socket.on("data", (chunk) => {
    buffer += chunk;
    while (buffer.includes("\r\n")) {
      const pos = buffer.indexOf("\r\n"),
        line = buffer.slice(0, pos);
      buffer = buffer.slice(pos + 2);
      if (inData) {
        if (line === ".") {
          inData = false;
          if (rejectNext) {
            rejectNext = false;
            socket.write("550 Test delivery rejected\r\n");
          } else {
            mails.push(body);
            socket.write("250 Accepted\r\n");
          }
          body = "";
        } else body += line + "\r\n";
      } else if (/^EHLO|^HELO/.test(line))
        socket.write("250-localhost\r\n250 AUTH PLAIN\r\n");
      else if (line.startsWith("AUTH")) socket.write("235 Authenticated\r\n");
      else if (line === "DATA") {
        inData = true;
        socket.write("354 Send message\r\n");
      } else if (line === "QUIT") socket.end("221 Bye\r\n");
      else socket.write("250 OK\r\n");
    }
  });
});
const suffix = Date.now();
const names = [
  `SignupShin-${suffix}`,
  `Cancelled-${suffix}`,
  `Failed-${suffix}`,
];
const password = String(randomInt(10_000_000, 100_000_000));
test.beforeAll(async () => {
  if (process.env.APP_ENV !== "development")
    throw new Error("Local development only");
  p = await getPayload({ config, key: "registration-flow" });
  await new Promise<void>((resolve, reject) => {
    smtp.once("error", reject);
    smtp.listen(2526, "127.0.0.1", resolve);
  });
});
test.afterAll(async () => {
  if (p) {
    await p.delete({
      collection: "users",
      overrideAccess: true,
      context: { system: true },
      where: { name: { in: names } },
    });
    await p.destroy();
  }
  for (const socket of sockets) socket.destroy();
  await new Promise<void>((resolve) => smtp.close(() => resolve()));
});

async function fill(page: import("@playwright/test").Page, name: string) {
  await page.goto("/register");
  await page.getByLabel("邮箱前缀").fill(name.toLowerCase());
  await page.locator('input[name="name"]').fill(name);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByLabel("确认密码", { exact: true }).fill(password);
}
const count = async (name: string) =>
  (
    await p.count({
      collection: "users",
      overrideAccess: true,
      where: { name: { equals: name } },
    })
  ).totalDocs;

test("点击注册后弹窗验证，错误验证码不入库，正确验证码才创建用户", async ({
  page,
}) => {
  await fill(page, names[0]);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const before = mails.length;
  await page.getByRole("button", { name: "验证并注册", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "验证邮箱", exact: true });
  await expect(dialog).toBeVisible();
  await expect.poll(() => mails.length).toBe(before + 1);
  expect(await count(names[0])).toBe(0);
  await expect(
    dialog.getByRole("button", { name: /秒后可重发/ }),
  ).toBeDisabled();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  const message = mails.at(-1)!;
  const body = message.split("\r\n\r\n").slice(1).join("\r\n\r\n");
  const decoded = /Content-Transfer-Encoding: base64/i.test(message)
    ? Buffer.from(body.replace(/\s/g, ""), "base64").toString("utf8")
    : body;
  const code = decoded.match(/\d{6}/)?.[0];
  expect(code).toMatch(/^\d{6}$/);
  await dialog
    .getByLabel("六位验证码")
    .fill(code === "000000" ? "999999" : "000000");
  await dialog.getByRole("button", { name: "确认验证码并完成注册" }).click();
  await expect(dialog.getByRole("alert")).toContainText("验证码错误");
  expect(await count(names[0])).toBe(0);
  await dialog.getByLabel("六位验证码").fill(code!);
  await dialog.getByRole("button", { name: "确认验证码并完成注册" }).click();
  await expect(page).toHaveURL(/\/login\?registered=1$/);
  expect(await count(names[0])).toBe(1);
  await page.getByLabel("昵称或邮箱").fill(names[0].toUpperCase());
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  const profile = page.getByRole("region", { name: "账号资料", exact: true });
  await expect(profile.getByText(names[0], { exact: true })).toBeVisible();
  await expect(profile.getByText(`${names[0].toLowerCase()}@mails.tsinghua.edu.cn`, { exact: true })).toBeVisible();
});

test("关闭弹窗保留输入且不创建账号，重发限制在服务端执行", async ({ page }) => {
  await fill(page, names[1]);
  await page.getByRole("button", { name: "验证并注册", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator('input[name="name"]')).toHaveValue(names[1]);
  await expect(page.getByLabel("密码", { exact: true })).toHaveValue(password);
  expect(await count(names[1])).toBe(0);
  await page.getByRole("button", { name: "验证并注册", exact: true }).click();
  await expect(
    page.getByRole("main").getByRole("alert"),
  ).toContainText("60 秒");
});

test("发送失败保留资料且不创建账号", async ({ page }) => {
  await fill(page, names[2]);
  rejectNext = true;
  await page.getByRole("button", { name: "验证并注册", exact: true }).click();
  await expect(
    page.getByRole("main").getByRole("alert"),
  ).toContainText("验证码发送失败");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator('input[name="name"]')).toHaveValue(names[2]);
  expect(await count(names[2])).toBe(0);
});
