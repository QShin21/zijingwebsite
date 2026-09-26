"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  beginRegistrationAction,
  registerAction,
} from "@/app/(frontend)/account/actions";
import { RegistrationEmail } from "./RegistrationEmail";

const subscribe = () => () => {};

export function RegistrationForm() {
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const draft = useRef<FormData | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [verificationMessage, setVerificationMessage] = useState("");
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
        if (resend) setVerificationMessage(result.error);
        else setMessage(result.error);
        return;
      }
      draft.current = data;
      setEmail(result.email);
      setSeconds(60);
      setVerificationMessage(resend ? "验证码已重新发送。" : "");
      dialog.current?.showModal();
      requestAnimationFrame(() => dialog.current?.querySelector<HTMLInputElement>('input[name="code"]')?.focus());
    } catch {
      if (resend) setVerificationMessage("网络异常，请稍后重试。");
      else setMessage("网络异常，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form
        className="member-form registration-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy) void send(new FormData(event.currentTarget));
        }}
      >
        <p role="status" className="form-feedback">
          {message}
        </p>
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
            <span id="nickname-hint" className="field-hint">
              2–40 个字符，不含
              @。昵称唯一，登录不区分大小写，展示保留你输入的大小写。
            </span>
          </label>
          <label>
            密码
            <input
              name="password"
              aria-label="密码"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              aria-describedby="password-hint"
            />
            <span id="password-hint" className="field-hint">
              至少 12 位，包含字母和数字。
            </span>
          </label>
          <label>
            确认密码
            <input
              name="confirm"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
            />
          </label>
          <button className="button" type="submit" aria-busy={busy}>
            {busy ? "正在发送验证码…" : "验证并注册"}
          </button>
        </fieldset>
        <p className="field-hint">
          点击后发送验证码，完成邮箱验证才会创建账号。
        </p>
        <noscript>请启用 JavaScript 后完成邮箱验证。</noscript>
      </form>
      <dialog
        ref={dialog}
        className="verification-dialog"
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
          className="member-form"
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
              if ("error" in result) setVerificationMessage(result.error);
              else {
                close();
                router.replace("/login?registered=1");
              }
            } catch {
              setVerificationMessage(
                "网络异常，请重试；若已完成注册，可直接前往登录。",
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
          <p role="status" className="form-feedback">
            {verificationMessage}
          </p>
          <button type="submit" className="button" disabled={busy}>
            {busy ? "正在处理…" : "确认验证码并完成注册"}
          </button>
          <div className="verification-actions">
            <button
              type="button"
              className="button light"
              disabled={busy || seconds > 0}
              onClick={() => {
                if (draft.current) void send(draft.current, true);
              }}
            >
              {seconds > 0 ? `${seconds} 秒后可重发` : "重新发送验证码"}
            </button>
            <button
              type="button"
              className="button light"
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
