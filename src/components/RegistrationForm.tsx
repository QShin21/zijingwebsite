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

const subscribe = () => () => {};

export function RegistrationForm({
  returnTo = "/account",
}: { returnTo?: string } = {}) {
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
      setVerificationMessage(resend ? "验证码已重新发送。" : "");
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
          "验证码发送结果暂时无法确认，请检查邮箱后重试。",
        );
      else
        setMessage(
          "验证码发送结果暂时无法确认，请检查邮箱后重试。填写的资料已保留。",
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
        <h2 className={styles.formTitle}>创建账号</h2>
        <FormFeedback message={message} error focus />
        <fieldset disabled={!ready || busy}>
          <RegistrationEmail />
          <label>
            昵称
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
              2–40 个字符，不含
              @。昵称唯一，登录不区分大小写，展示保留你输入的大小写。
            </span>
          </label>
          <PasswordField
            label="密码"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            hint="至少 8 位，不限制字符组成。"
          />
          <PasswordField
            label="确认密码"
            name="confirm"
            required
            minLength={8}
            autoComplete="new-password"
          />
          <button className={styles.primary} type="submit" aria-busy={busy}>
            {busy ? "正在发送验证码…" : "验证并注册"}
          </button>
        </fieldset>
        <p className={styles.hint}>
          点击后发送验证码，完成邮箱验证才会创建账号。
        </p>
        <noscript>请启用 JavaScript 后完成邮箱验证。</noscript>
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
        <h2 id="verification-title">验证邮箱</h2>
        <p id="verification-description">
          验证码已发送至 <strong>{email}</strong>，10
          分钟内有效。验证通过后即可完成注册。
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
                "注册结果暂时无法确认，请重试；若已完成注册，可直接前往登录。",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            六位验证码
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
            {busy ? "正在处理…" : "确认验证码并完成注册"}
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
              {seconds > 0 ? `${seconds} 秒后可重发` : "重新发送验证码"}
            </button>
            <button
              type="button"
              className={styles.secondary}
              disabled={busy}
              onClick={close}
            >
              返回修改资料
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
