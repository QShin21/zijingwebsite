import "dotenv/config";
import { randomBytes } from "node:crypto";
import { test, expect } from "@playwright/test";
import { getPayload, type Payload } from "payload";
import config from "../../src/payload.config";
import type { User } from "../../src/payload-types";

let p: Payload;
const stamp = randomBytes(5).toString("hex"),
  password = randomBytes(20).toString("hex");
test.beforeAll(async () => {
  if (
    process.env.APP_ENV !== "development" ||
    !["127.0.0.1", "localhost"].includes(
      new URL(process.env.DATABASE_URL!).hostname,
    )
  )
    throw Error("Synthetic local database only");
  p = await getPayload({ config, key: "admin-password-browser" });
});
test.afterAll(async () => {
  if (p) await p.destroy();
});
async function create(name: string, roles: User["roles"]) {
  return p.create({
    collection: "users",
    overrideAccess: true,
    context: { system: true },
    data: {
      name: name + stamp,
      email: name + stamp + "@example.invalid",
      password,
      roles,
    },
  });
}
for (const role of ["president", "vicePresident"] as const) {
  test(
    role +
      " can use the native CMS password controls without member verification",
    async ({ page }) => {
      const actor = await create("browser-" + role, [role]);
      let target = await create("target-" + role, ["member"]);
      if (role === "vicePresident") {
        const game = await p.create({
          collection: "games",
          overrideAccess: true,
          context: { system: true },
          data: {
            title: "改密页面合成社群" + stamp,
            slug: "password-browser-" + stamp,
            demo: true,
          },
        });
        target = await p.update({
          collection: "users",
          id: target.id,
          overrideAccess: true,
          context: { system: true },
          data: {
            communityOffices: [
              { game: game.id, status: "active", grantedBy: actor.id },
            ],
          },
        });
      }
      const nextPassword = randomBytes(20).toString("hex");
      await page.goto("/admin/login");
      await page.locator('input[name="email"]').fill(actor.email);
      await page.locator('input[name="password"]').fill(password);
      await page.getByRole("button", { name: "登录", exact: true }).click();
      await expect(page).toHaveURL(/\/admin$/);
      await page.goto("/admin/collections/users/" + target.id);
      await expect(page.locator("form[data-form-ready]")).toHaveAttribute(
        "data-form-ready",
        "true",
      );
      await page.getByRole("button", { name: "更改密码", exact: true }).click();
      await page.locator('input[name="password"]').fill(nextPassword);
      await page.locator('input[name="confirm-password"]').fill(nextPassword);
      // Payload throttles field validation and debounces server form state.
      // Allow that native validation to settle before submitting the form.
      await page.waitForTimeout(1200);
      const saving = page.waitForResponse(
        (response) =>
          response.request().method() === "PATCH" &&
          response.url().includes("/api/users/" + target.id),
      );
      await page.getByRole("button", { name: "保存", exact: true }).click();
      const saved = await saving;
      expect(saved.status(), await saved.text()).toBe(200);
      expect(
        (
          await p.login({
            collection: "users",
            data: { email: target.email, password: nextPassword },
          })
        ).user?.id,
      ).toBe(target.id);
      const updated = await p.findByID({
        collection: "users",
        id: target.id,
        overrideAccess: true,
      });
      expect(updated.roles).toEqual(target.roles);
      expect(updated.communityOffices).toEqual(target.communityOffices);
    },
  );
}
