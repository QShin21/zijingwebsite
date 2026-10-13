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
import styles from "./AccountPages.module.css";

const subscribe = () => () => {};
const useReady = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
const uncertain =
  "请求结果暂时无法确认，请重试。已填写的内容仍保留在当前页面。";

export function LoginForm({
  message = "",
  success = false,
  returnTo = "/account",
}: {
  message?: string;
  success?: boolean;
  returnTo?: string;
}) {
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
      <h2 className={styles.formTitle}>欢迎回来</h2>
      <FormFeedback message={feedback} error={failed} focus={failed} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <fieldset disabled={!ready || busy}>
        <label>
          昵称或邮箱
          <input
            name="identifier"
            required
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
          />
        </label>
        <PasswordField
          label="密码"
          name="password"
          required
          autoComplete="current-password"
        />
        <button type="submit" className={styles.primary} aria-busy={busy}>
          {busy ? "正在登录…" : "登录"}
        </button>
      </fieldset>
      {returnTo !== "/account" && (
        <p className={styles.hint}>登录成功后将返回刚才访问的页面。</p>
      )}
      <noscript>请启用 JavaScript 后登录。</noscript>
    </form>
  );
}

export function PasswordResetForm({
  message = "",
  sent = false,
}: {
  message?: string;
  sent?: boolean;
}) {
  const ready = useReady();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"code" | "password" | null>(null);
  const [feedback, setFeedback] = useState(
    message || (sent ? "如果账户存在，验证码已发送，请查收注册邮箱。" : ""),
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
                : "如果账户存在，验证码已发送，10 分钟内有效。请查收注册邮箱。60 秒后可再次获取。",
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
          <span>1</span>获取邮箱验证码
        </h2>
        <fieldset disabled={!ready || Boolean(busy)}>
          <label htmlFor="recovery-email">
            注册邮箱
            <input
              id="recovery-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <button
            className={styles.secondary}
            type="submit"
            aria-busy={busy === "code"}
          >
            {busy === "code" ? "正在发送…" : "获取验证码"}
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
              window.location.assign("/login?reset=1");
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
          <span>2</span>验证并设置新密码
        </h2>
        <input type="hidden" name="email" value={email} />
        <fieldset disabled={!ready || Boolean(busy)}>
          <label>
            六位验证码
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
            label="新密码"
            name="password"
            minLength={8}
            required
            autoComplete="new-password"
            hint="至少 8 位，不限制字符组成。"
          />
          <PasswordField
            label="确认新密码"
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
            {busy === "password" ? "正在更新…" : "更新密码"}
          </button>
        </fieldset>
        <p className={styles.hint}>
          使用上方注册邮箱完成验证；更新成功后将返回登录页。
        </p>
      </form>
      <Link className={styles.textLink} href="/login">
        返回登录
      </Link>
      <noscript>请启用 JavaScript 后重设密码。</noscript>
    </div>
  );
}

export function LogoutButton() {
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
            setError("退出登录未确认完成，请重试。");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "正在退出…" : "退出登录"}
      </button>
      <FormFeedback message={error} error focus />
    </div>
  );
}
