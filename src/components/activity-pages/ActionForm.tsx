"use client";
import { useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import styles from "./Workspace.module.css";
export type ActionResult = { ok: boolean; message: string; id?: number; revision?: string; successHref?: string };

/** Keep entered values when a controlled workflow rejects or its response is lost. */
export function ActionForm({ action, children, className = "member-form", onSuccess, resetOnSuccess = false }: {
  action: (data: FormData) => Promise<ActionResult>;
  children: ReactNode;
  className?: string;
  onSuccess?: (result: ActionResult) => void;
  resetOnSuccess?: boolean;
}) {
  const ready = useSyncExternalStore(() => () => {}, () => true, () => false);
  const lock = useRef(false), feedback = useRef<HTMLParagraphElement>(null);
  const [pending, setPending] = useState(false), [refreshing, startRefresh] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const router = useRouter();
  const busy = !ready || pending || refreshing;
  return <form method="post" className={`${className} ${styles.actionForm}`} aria-busy={busy} onSubmit={async event => {
    event.preventDefault();
    if (lock.current || busy) return;
    const form = event.currentTarget;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const data = new FormData(form);
    if (submitter instanceof HTMLButtonElement && submitter.name) data.set(submitter.name, submitter.value);
    lock.current = true; setPending(true); setResult(null);
    try {
      const next = await action(data);
      setResult(next);
      if (next.ok) {
        onSuccess?.(next);
        if (resetOnSuccess) form.reset();
        // A successful action can remove this form from its filtered list or detail route.
        // Keep its receipt on a stable, server-selected page in that case.
        const destination = next.successHref;
        startRefresh(() => destination ? router.replace(destination) : router.refresh());
      }
    } catch {
      setResult({ ok: false, message: "操作结果尚未确认，填写内容已保留。请先刷新已保存记录核对，再决定是否重试。" });
    } finally {
      lock.current = false; setPending(false);
      requestAnimationFrame(() => feedback.current?.focus());
    }
  }}>
    <fieldset className={styles.actionFields} disabled={busy}>{children}</fieldset>
    {(busy || (result && (!result.ok || !result.successHref))) && <p ref={feedback} tabIndex={-1} className={result && !result.ok ? styles.error : styles.feedback} role={result && !result.ok ? "alert" : "status"}>{busy ? "正在保存，请稍候…" : result?.message}</p>}
    {result && !result.ok && <button type="button" className="button light" disabled={busy} onClick={() => startRefresh(() => router.refresh())}>刷新已保存记录</button>}
  </form>;
}
