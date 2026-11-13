"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  beginRegistrationAction,
  registerAction,
} from "@/app/(frontend)/account/actions";
import { RegistrationEmail } from "./RegistrationEmail";
import { FormFeedback, PasswordField } from "./account-pages/AuthFields";
import { safeReturnPath } from "./account-pages/auth-return";
import styles from "./account-pages/AccountPages.module.css";
import { useT } from "./i18n/LocaleProvider";

const subscribe = () => () => {};

export function RegistrationForm({
  returnTo = "/account",
}: { returnTo?: string } = {}) {
  const t = useT();
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const draft = useRef<FormData | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [verificationMessage, setVerificationMessage] = useState("");
  const [verificationError, setVerificationError] = useState(false);
  const [email, setEmail] = useState("");
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  function close() {
    dialog.current?.close();
    draft.current = null;
    dialog.current?.querySelector("form")?.reset();
    setVerificationMessage("");
  }

  async function send(data: FormData, resend = false) {
    setBusy(true);
    if (resend) setVerificationMessage("");
    else setMessage("");
    try {
      const result = await beginRegistrationAction(data);
      if ("error" in result) {
        setVerificationError(true);
        if (resend) setVerificationMessage(result.error);
        else setMessage(result.error);
        return;
      }
      draft.current = data;
      setEmail(result.email);
      setSeconds(60);
      setVerificationError(false);
      setVerificationMessage(resend ? t("验证码已重新发送。", "Code sent again.") : "");
      dialog.current?.showModal();
      requestAnimationFrame(() =>
        dialog.current
          ?.querySelector<HTMLInputElement>('input[name="code"]')
          ?.focus(),
      );
    } catch {
      setVerificationError(true);
      if (resend)
        setVerificationMessage(
          t("验证码发送结果暂时无法确认，请检查邮箱后重试。", "Could not confirm the code was sent. Check your email and try again."),
        );
      else
        setMessage(
          t("验证码发送结果暂时无法确认，请检查邮箱后重试。填写的资料已保留。", "Could not confirm the code was sent. Check your email and try again; your details are kept."),
        );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form
        className={styles.form}
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy) void send(new FormData(event.currentTarget));
        }}
      >
        <h2 className={styles.formTitle}>{t("创建账号", "Create account")}</h2>
        <FormFeedback message={message} error focus />
        <fieldset disabled={!ready || busy}>
          <RegistrationEmail />
          <label>
            {t("昵称", "Nickname")}
            <input
              name="name"
              required
              minLength={2}
              maxLength={40}
              pattern="[^@]+"
              autoComplete="username"
              aria-describedby="nickname-hint"
            />
            <span id="nickname-hint" className={styles.hint}>
              {t("2–40 个字符，不含 @。昵称唯一，登录不区分大小写，展示保留你输入的大小写。", "2–40 characters, no @. Nicknames are unique; sign-in ignores case, and display keeps your casing.")}
            </span>
          </label>
          <PasswordField
            label={t("密码", "Password")}
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            hint={t("至少 8 位，不限制字符组成。", "At least 8 characters, any mix.")}
          />
          <PasswordField
            label={t("确认密码", "Confirm password")}
            name="confirm"
            required
            minLength={8}
            autoComplete="new-password"
          />
          <button className={styles.primary} type="submit" aria-busy={busy}>
            {busy ? t("正在发送验证码…", "Sending code…") : t("验证并注册", "Verify and register")}
          </button>
        </fieldset>
        <p className={styles.hint}>
          {t("点击后发送验证码，完成邮箱验证才会创建账号。", "We send a code; your account is created only after email verification.")}
        </p>
        <noscript>{t("请启用 JavaScript 后完成邮箱验证。", "Enable JavaScript to verify your email.")}</noscript>
      </form>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby="verification-title"
        aria-describedby="verification-description"
        onCancel={(event) => {
          if (busy) event.preventDefault();
          else close();
        }}
      >
        <h2 id="verification-title">{t("验证邮箱", "Verify email")}</h2>
        <p id="verification-description">
          {t("验证码已发送至 ", "A code was sent to ")}<strong>{email}</strong>{t("，10 分钟内有效。验证通过后即可完成注册。", ". It is valid for 10 minutes; verify to finish registering.")}
        </p>
        <form
          className={styles.form}
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy || !draft.current) return;
            const code = new FormData(event.currentTarget).get("code");
            const data = new FormData();
            draft.current.forEach((value, key) => data.append(key, value));
            data.set("code", String(code ?? ""));
            setBusy(true);
            setVerificationMessage("");
            try {
              const result = await registerAction(data);
              if ("error" in result) {
                setVerificationError(true);
                setVerificationMessage(result.error);
              } else {
                close();
                formRef.current?.reset();
                const target = safeReturnPath(returnTo);
                window.location.assign(
                  `/login?registered=1${target === "/account" ? "" : `&returnTo=${encodeURIComponent(target)}`}`,
                );
              }
            } catch {
              setVerificationError(true);
              setVerificationMessage(
                t("注册结果暂时无法确认，请重试；若已完成注册，可直接前往登录。", "Could not confirm registration. Try again; if you are already registered, go to sign in."),
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            {t("六位验证码", "6-digit code")}
            <input
              name="code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoComplete="one-time-code"
              autoFocus
              disabled={busy}
            />
          </label>
          <FormFeedback
            message={verificationMessage}
            error={verificationError}
            focus={verificationError}
          />
          <button type="submit" className={styles.primary} disabled={busy}>
            {busy ? t("正在处理…", "Working…") : t("确认验证码并完成注册", "Confirm code and register")}
          </button>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondary}
              disabled={busy || seconds > 0}
              onClick={() => {
                if (draft.current) void send(draft.current, true);
              }}
            >
              {seconds > 0 ? t(`${seconds} 秒后可重发`, `Resend in ${seconds}s`) : t("重新发送验证码", "Resend code")}
            </button>
            <button
              type="button"
              className={styles.secondary}
              disabled={busy}
              onClick={close}
            >
              {t("返回修改资料", "Back to edit details")}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
