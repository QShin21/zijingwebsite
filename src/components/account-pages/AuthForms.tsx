"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  requestPasswordCodeAction,
  signInAction,
  signOutAction,
  updatePasswordAction,
} from "@/app/(frontend)/account/actions";
import { FormFeedback, PasswordField } from "./AuthFields";
import { safeReturnPath } from "./auth-return";
import styles from "./AccountPages.module.css";
import { useT } from "../i18n/LocaleProvider";
import type { Translate } from "@/lib/i18n/locale";

const subscribe = () => () => {};
const useReady = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
const uncertainText = (t: Translate) =>
  t("请求结果暂时无法确认，请重试。已填写的内容仍保留在当前页面。", "The result could not be confirmed. Please try again; your input is still on this page.");

export function LoginForm({
  message = "",
  success = false,
  returnTo = "/account",
}: {
  message?: string;
  success?: boolean;
  returnTo?: string;
}) {
  const t = useT(),
    uncertain = uncertainText(t);
  const ready = useReady();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(message);
  const [failed, setFailed] = useState(!success && Boolean(message));
  return (
    <form
      className={styles.form}
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        const form = event.currentTarget;
        const data = new FormData(form);
        setBusy(true);
        setFeedback("");
        try {
          const result = await signInAction(data);
          if ("error" in result) {
            setFailed(true);
            setFeedback(result.error);
          } else {
            form.reset();
            window.location.assign(result.redirect || "/account");
          }
        } catch {
          setFailed(true);
          setFeedback(uncertain);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className={styles.formTitle}>{t("欢迎回来", "Welcome back")}</h2>
      <FormFeedback message={feedback} error={failed} focus={failed} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <fieldset disabled={!ready || busy}>
        <label>
          {t("昵称或邮箱", "Nickname or email")}
          <input
            name="identifier"
            required
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
          />
        </label>
        <PasswordField
          label={t("密码", "Password")}
          name="password"
          required
          autoComplete="current-password"
        />
        <button type="submit" className={styles.primary} aria-busy={busy}>
          {busy ? t("正在登录…", "Signing in…") : t("登录", "Sign in")}
        </button>
      </fieldset>
      {returnTo !== "/account" && (
        <p className={styles.hint}>{t("登录成功后将返回刚才访问的页面。", "After signing in you will return to the page you were on.")}</p>
      )}
      <noscript>{t("请启用 JavaScript 后登录。", "Enable JavaScript to sign in.")}</noscript>
    </form>
  );
}

export function PasswordResetForm({
  message = "",
  sent = false,
  returnTo = "/account",
}: {
  message?: string;
  sent?: boolean;
  returnTo?: string;
}) {
  const destination = safeReturnPath(returnTo);
  const onward =
    destination === "/account"
      ? ""
      : `&returnTo=${encodeURIComponent(destination)}`;
  const t = useT(),
    uncertain = uncertainText(t);
  const ready = useReady();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"code" | "password" | null>(null);
  const [feedback, setFeedback] = useState(
    message || (sent ? t("如果账户存在，验证码已发送，请查收注册邮箱。", "If the account exists, a code has been sent. Check your registered email.") : ""),
  );
  const [failed, setFailed] = useState(Boolean(message));
  return (
    <div className={styles.form}>
      <FormFeedback
        message={feedback}
        error={failed}
        focus={Boolean(feedback)}
      />
      <form
        className={styles.form}
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          const data = new FormData(event.currentTarget);
          setBusy("code");
          setFeedback("");
          try {
            const result = await requestPasswordCodeAction(data);
            setFailed("error" in result);
            setFeedback(
              "error" in result
                ? result.error
                : t("如果账户存在，验证码已发送，10 分钟内有效。请查收注册邮箱。60 秒后可再次获取。", "If the account exists, a code valid for 10 minutes has been sent to your registered email. You can request another after 60 seconds."),
            );
          } catch {
            setFailed(true);
            setFeedback(uncertain);
          } finally {
            setBusy(null);
          }
        }}
      >
        <h2 className={styles.formHeading}>
          <span>1</span>{t("获取邮箱验证码", "Get an email code")}
        </h2>
        <fieldset disabled={!ready || Boolean(busy)}>
          <label htmlFor="recovery-email">
            {t("注册邮箱", "Registered email")}
            <input
              id="recovery-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <button
            className={styles.secondary}
            type="submit"
            aria-busy={busy === "code"}
          >
            {busy === "code" ? t("正在发送…", "Sending…") : t("获取验证码", "Get code")}
          </button>
        </fieldset>
      </form>
      <form
        className={`${styles.form} ${styles.formSection}`}
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          const form = event.currentTarget;
          const data = new FormData(form);
          setBusy("password");
          setFeedback("");
          try {
            const result = await updatePasswordAction(data);
            if ("error" in result) {
              setFailed(true);
              setFeedback(result.error);
            } else {
              form.reset();
              setEmail("");
              window.location.assign(`/login?reset=1${onward}`);
            }
          } catch {
            setFailed(true);
            setFeedback(uncertain);
          } finally {
            setBusy(null);
          }
        }}
      >
        <h2 className={styles.formHeading}>
          <span>2</span>{t("验证并设置新密码", "Verify and set a new password")}
        </h2>
        <input type="hidden" name="email" value={email} />
        <fieldset disabled={!ready || Boolean(busy)}>
          <label>
            {t("六位验证码", "6-digit code")}
            <input
              name="code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoComplete="one-time-code"
            />
          </label>
          <PasswordField
            label={t("新密码", "New password")}
            name="password"
            minLength={8}
            required
            autoComplete="new-password"
            hint={t("至少 8 位，不限制字符组成。", "At least 8 characters, any mix.")}
          />
          <PasswordField
            label={t("确认新密码", "Confirm new password")}
            name="confirm"
            minLength={8}
            required
            autoComplete="new-password"
          />
          <button
            className={styles.primary}
            type="submit"
            aria-busy={busy === "password"}
          >
            {busy === "password" ? t("正在更新…", "Updating…") : t("更新密码", "Update password")}
          </button>
        </fieldset>
        <p className={styles.hint}>
          {t("使用上方注册邮箱完成验证；更新成功后将返回登录页。", "Verify with the registered email above; you will return to sign-in after the update.")}
        </p>
      </form>
      <Link
        className={styles.textLink}
        href={
          destination === "/account"
            ? "/login"
            : `/login?returnTo=${encodeURIComponent(destination)}`
        }
      >
        {t("返回登录", "Back to sign in")}
      </Link>
      <noscript>{t("请启用 JavaScript 后重设密码。", "Enable JavaScript to reset your password.")}</noscript>
    </div>
  );
}

export function LogoutButton() {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className={styles.form}>
      <button
        className={styles.secondary}
        disabled={busy}
        type="button"
        onClick={async () => {
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            const result = await signOutAction();
            if ("error" in result) setError(result.error);
            else window.location.assign("/");
          } catch {
            setError(t("退出登录未确认完成，请重试。", "Sign-out was not confirmed. Please try again."));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? t("正在退出…", "Signing out…") : t("退出登录", "Sign out")}
      </button>
      <FormFeedback message={error} error focus />
    </div>
  );
}
