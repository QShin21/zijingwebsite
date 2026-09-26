"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { login, logout } from "@payloadcms/next/auth";
import config from "@payload-config";
import { cms } from "@/lib/content";
import {
  consumeCode,
  issueCode,
  schoolEmail,
  validPassword,
} from "@/lib/verification";
import { nicknameKey, validNickname } from "@/lib/nickname";

const field = (form: FormData, key: string) =>
  String(form.get(key) ?? "").trim();
const errorURL = (page: string, message: string) =>
  `${page}?message=${encodeURIComponent(message)}`;
const ownerEmail = (email: string) =>
  Boolean(
    process.env.PRESIDENT_CLAIM_EMAIL &&
      email === process.env.PRESIDENT_CLAIM_EMAIL.trim().toLowerCase(),
  );
export async function sendCodeAction(form: FormData) {
  const email = schoolEmail(field(form, "email"));
  const purpose = "password";
  if (!email) redirect(errorURL("/account/reset", "请使用清华师生或校友邮箱"));
  const p = await cms();
  const existing = await p.find({
    collection: "users",
    overrideAccess: true,
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
  });
  const page = "/account/reset";
  // Reset responses do not reveal whether an account exists.
  if (purpose === "password" && !existing.docs.length)
    redirect(`${page}?sent=1`);
  try {
    const h = await headers();
    await issueCode(
      p,
      email,
      purpose,
      h.get("x-real-ip") ||
        h.get("x-forwarded-for")?.split(",")[0] ||
        "unknown",
    );
  } catch (error) {
    const message =
      error instanceof Error && /频繁|60 秒/.test(error.message)
        ? error.message
        : "邮件暂不可用，请稍后联系网站管理员";
    redirect(errorURL(page, message));
  }
  redirect(`${page}?sent=1`);
}
async function registrationDetails(form: FormData) {
  const email = schoolEmail(
    `${field(form, "emailPrefix")}@${field(form, "emailDomain")}`,
  );
  const name = field(form, "name");
  const password = String(form.get("password") ?? "");
  if (
    !email ||
    !validNickname(name) ||
    !validPassword(password) ||
    password !== form.get("confirm")
  )
    return {
      error:
        "请核对清华邮箱、昵称和密码；密码至少 12 位且含字母及数字，两次输入需一致。",
    } as const;
  const p = await cms();
  const claim = ownerEmail(email);
  const existing = await p.find({
    collection: "users",
    overrideAccess: true,
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
  });
  if (existing.docs[0] && !claim)
    return { error: "该邮箱已注册，请登录或找回密码" } as const;
  const sameName = await p.find({
    collection: "users",
    overrideAccess: true,
    where: { nameKey: { equals: nicknameKey(name) } },
    limit: 1,
    depth: 0,
    select: { email: true },
  });
  if (
    sameName.docs[0] &&
    !(claim && sameName.docs[0].id === existing.docs[0]?.id)
  )
    return { error: "该昵称已被使用，请更换昵称" } as const;
  return { p, email, name, password, claim, existing: existing.docs[0] };
}

export async function beginRegistrationAction(
  form: FormData,
): Promise<{ error: string } | { email: string }> {
  try {
    const details = await registrationDetails(form);
    if ("error" in details) return { error: details.error! };
    const h = await headers();
    await issueCode(
      details.p,
      details.email,
      "register",
      h.get("x-real-ip") ||
        h.get("x-forwarded-for")?.split(",")[0] ||
        "unknown",
    );
    return { email: details.email };
  } catch (error) {
    return {
      error:
        error instanceof Error && /频繁|60 秒/.test(error.message)
          ? error.message
          : "验证码发送失败，请稍后重试或联系网站管理员。",
    };
  }
}

export async function registerAction(
  form: FormData,
): Promise<{ error: string } | { success: true }> {
  try {
    const details = await registrationDetails(form);
    if ("error" in details) return { error: details.error! };
    const { p, email, name, password, claim, existing } = details;
    if (!(await consumeCode(email, "register", field(form, "code"))))
      return { error: "验证码错误、过期或尝试次数过多，请核对或重新发送。" };
    // No user record or password is persisted until the email code is verified.
    if (existing) {
      await p.update({
        collection: "users",
        id: existing.id,
        overrideAccess: true,
        context: { system: true, ownerClaimVerified: true },
        data: { name, password, roles: ["president"], accountStatus: "active" },
      });
    } else {
      await p.create({
        collection: "users",
        overrideAccess: true,
        context: { signupVerified: true, presidentClaim: claim },
        data: { email, name, password, roles: ["member"] },
      });
    }
    return { success: true };
  } catch {
    return {
      error: "注册未完成，邮箱或昵称可能已被使用。请返回检查后重新验证。",
    };
  }
}
export async function loginAction(form: FormData) {
  const identifier = field(form, "identifier");
  try {
    let email = identifier.toLowerCase();
    if (!identifier.includes("@")) {
      if (!validNickname(identifier)) throw new Error("Invalid nickname");
      const users = await (
        await cms()
      ).find({
        collection: "users",
        overrideAccess: true,
        where: { nameKey: { equals: nicknameKey(identifier) } },
        limit: 1,
        depth: 0,
        select: { email: true },
      });
      if (!users.docs[0]) throw new Error("Unknown nickname");
      email = users.docs[0].email;
    }
    await login({
      config,
      collection: "users",
      email,
      password: String(form.get("password") ?? ""),
    });
  } catch {
    redirect(errorURL("/login", "昵称、邮箱或密码错误"));
  }
  redirect("/account");
}
export async function logoutAction() {
  await logout({ config, allSessions: false });
  redirect("/");
}
export async function resetAction(form: FormData) {
  const email = schoolEmail(field(form, "email"));
  const password = String(form.get("password") ?? "");
  if (!email || !validPassword(password) || password !== form.get("confirm"))
    redirect(errorURL("/account/reset", "邮箱或新密码格式不正确"));
  if (!(await consumeCode(email, "password", field(form, "code"))))
    redirect(errorURL("/account/reset", "验证码错误、过期或尝试次数过多"));
  const p = await cms();
  const result = await p.find({
    collection: "users",
    overrideAccess: true,
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
  });
  if (result.docs[0])
    await p.update({
      collection: "users",
      id: result.docs[0].id,
      overrideAccess: true,
      context: { verifiedPasswordChange: true },
      data: { password },
    });
  redirect("/login?reset=1");
}
