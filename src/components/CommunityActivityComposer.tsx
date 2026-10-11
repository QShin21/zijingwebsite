"use client";
import { useEffect, useState } from "react";
import { SignupBuilder } from "./SignupBuilder";
import { emptySignup } from "@/lib/signup-schema";
import { SubmitButton } from "./SubmitButton";
import { publishCommunityAction } from "@/app/(frontend)/community/actions";
export function CommunityActivityComposer({ game }: { game: number }) {
  const [kind, setKind] = useState("event"),
    [signup, setSignup] = useState(emptySignup);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <details className="panel">
      <summary>发布活动与通知</summary>
      <form className="member-form" action={publishCommunityAction}>
        <fieldset className="composer-fields" disabled={!ready}>
          <input type="hidden" name="game" value={game} />
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
            标题
            <input name="title" maxLength={120} required />
          </label>
          <label>
            内容
            <textarea name="body" rows={8} maxLength={5000} required />
          </label>
          {kind === "event" && (
            <>
              <SignupBuilder value={signup} onChange={setSignup} />
              <input
                type="hidden"
                name="signupForm"
                value={JSON.stringify(signup)}
              />
            </>
          )}
          <SubmitButton className="button">发布</SubmitButton>
        </fieldset>
      </form>
    </details>
  );
}
