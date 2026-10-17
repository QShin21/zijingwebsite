"use client";
import styles from "./community-pages/CommunityPages.module.css";
import { useEffect, useState } from "react";
import { SignupBuilder } from "./SignupBuilder";
import { emptySignup } from "@/lib/signup-schema";
import { SubmitButton } from "./SubmitButton";
import { ActionForm } from "./activity-pages/ActionForm";
import { publishCommunityResultAction } from "@/app/(frontend)/community/actions";
export function CommunityActivityComposer({ game }: { game: number }) {
  const [kind, setKind] = useState("event"),
    [signup, setSignup] = useState(emptySignup);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <section aria-label="活动与通知发布表单">
      <ActionForm
        action={publishCommunityResultAction}
        resetOnSuccess
        onSuccess={() => setSignup(emptySignup)}
      >
        <fieldset className="composer-fields" disabled={!ready}>
          <input type="hidden" name="game" value={game} />
          <section className={styles.formGroup} aria-label="内容与发布范围">
            <h3>内容与发布范围</h3>
            <label>
              类型
              <select
                name="kind"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                <option value="event">社群活动</option>
                <option value="notice">社群通知</option>
              </select>
            </label>
            <label>
              <span>
                标题<span aria-hidden="true">（必填）</span>
              </span>
              <input name="title" maxLength={120} required />
            </label>
            <label>
              <span>
                内容<span aria-hidden="true">（必填）</span>
              </span>
              <textarea name="body" rows={8} maxLength={5000} required />
            </label>
          </section>
          {kind === "event" && (
            <section className={styles.formGroup} aria-label="活动报名配置">
              <h3>活动报名配置</h3>
              <p>按活动实际需要启用问卷，报名和统计沿用当前活动。</p>
              <SignupBuilder value={signup} onChange={setSignup} />
              <input
                type="hidden"
                name="signupForm"
                value={JSON.stringify(signup)}
              />
            </section>
          )}
          <div className={styles.submitRow}>
            <SubmitButton className="button">
              {kind === "event" ? "发布社群活动" : "发布社群通知"}
            </SubmitButton>
            <p>内容将发布到当前游戏社群。</p>
          </div>
        </fieldset>
      </ActionForm>
    </section>
  );
}
