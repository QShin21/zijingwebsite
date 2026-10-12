"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  emptyTeamProfile,
  type OwnTeamProfile,
  type TeamProfileDraft,
  type TeamProfilesView,
} from "@/lib/team-profiles-model";
import { TeamProfileCard } from "./TeamProfileCard";
import styles from "./TeamProfiles.module.css";

export function TeamProfilesPanel({
  teamID,
  startEditing = false,
}: {
  teamID: number;
  startEditing?: boolean;
}) {
  const endpoint = `/api/team-profiles/${teamID}`;
  const generation = useRef(0),
    saving = useRef(false);
  const [view, setView] = useState<TeamProfilesView | null>(null);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(startEditing),
    [preview, setPreview] = useState(false);
  const [draft, setDraft] = useState<TeamProfileDraft>(emptyTeamProfile);
  const [original, setOriginal] = useState<OwnTeamProfile | null>(null);
  const [membershipVersion, setMembershipVersion] = useState<string | null>(
    null,
  );
  const [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [locked, setLocked] = useState(false),
    [reloadKey, setReloadKey] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const editButton = useRef<HTMLButtonElement>(null),
    nicknameInput = useRef<HTMLInputElement>(null),
    focusTarget = useRef<"entry" | "name" | null>(null);

  useEffect(() => {
    if (!focusTarget.current) return;
    const control = focusTarget.current === "entry" ? editButton.current : nicknameInput.current;
    control?.focus();
    focusTarget.current = null;
  }, [editing, preview]);

  useEffect(() => {
    const turn = ++generation.current,
      controller = new AbortController();
    saving.current = false;
    setLoading(true);
    setView(null);
    setBusy(false);
    setError("");
    setMessage("");
    setDraft(emptyTeamProfile());
    setOriginal(null);
    setMembershipVersion(null);
    setPreview(false);
    setLocked(false);
    setEditing(startEditing);
    if (fileInput.current) fileInput.current.value = "";
    fetch(endpoint, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "简介加载失败，请重试");
        if (turn !== generation.current) return;
        setView(data);
        setOriginal(data.own.profile);
        setMembershipVersion(data.own.membershipVersion);
        setDraft(data.own.profile ?? emptyTeamProfile());
      })
      .catch((cause) => {
        if (turn === generation.current && !controller.signal.aborted)
          setError(
            cause instanceof Error ? cause.message : "简介加载失败，请重试",
          );
      })
      .finally(() => {
        if (turn === generation.current) setLoading(false);
      });
    return () => {
      controller.abort();
      generation.current++;
    };
  }, [endpoint, startEditing, reloadKey]);

  const change = <K extends keyof TeamProfileDraft>(
    key: K,
    value: TeamProfileDraft[K],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setMessage("");
    setError("");
  };
  async function avatar(file?: File) {
    if (!file) return;
    if (
      file.size > 2 * 1024 * 1024 ||
      !["image/png", "image/jpeg", "image/webp"].includes(file.type)
    ) {
      setError("请上传 2 MB 以内的 PNG、JPEG 或 WebP 静态图片");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    const turn = generation.current;
    try {
      const value = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("头像读取失败，请重新选择"));
        reader.readAsDataURL(file);
      });
      if (turn === generation.current) change("avatar", value);
    } catch {
      if (turn === generation.current) setError("头像读取失败，请重新选择");
    }
  }
  async function save() {
    if (saving.current || locked || !view?.own.eligible) return;
    const turn = generation.current;
    const submittedMembershipVersion = membershipVersion;
    saving.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revision: original?.revision ?? null,
          membershipVersion: submittedMembershipVersion,
          profile: {
            displayName: draft.displayName,
            position: draft.position,
            biography: draft.biography,
            avatar: draft.avatar,
            visible: draft.visible,
          },
        }),
      });
      const result = await response.json();
      if (turn !== generation.current) return;
      if (!response.ok) {
        if (
          [401, 403, 404].includes(response.status) ||
          result.code === "PROFILE_PERIOD_CHANGED"
        ) {
          setLocked(true);
          setView(null);
        }
        throw new Error(result.error || "简介保存失败，请重试");
      }
      setOriginal(result.profile);
      setDraft(result.profile);
      setPreview(false);
      setMessage(
        result.profile.visible ? "简介已保存并选择展示" : "简介已保存并隐藏",
      );
      const responseView = await fetch(endpoint, { cache: "no-store" });
      const updated = await responseView.json();
      if (turn !== generation.current) return;
      if (responseView.ok) {
        setView(updated);
        // A background roster refresh must never rebind an old checked draft to
        // a new period. Only explicit reload initializes the editor credential.
        if (
          !updated.own.eligible ||
          updated.own.membershipVersion !== submittedMembershipVersion
        ) {
          setLocked(true);
          setMessage("");
          setError("入队周期已更新，请重新加载后确认当前周期的展示选择");
        }
      } else {
        setView(null);
        setError(updated.error || "已保存，名单刷新失败，请重新加载");
      }
    } catch (cause) {
      if (turn === generation.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "简介保存失败，请重试；输入已保留",
        );
    } finally {
      if (turn === generation.current) {
        saving.current = false;
        setBusy(false);
      }
    }
  }
  function cancel() {
    focusTarget.current = "entry";
    setDraft(original ?? emptyTeamProfile());
    setPreview(false);
    setEditing(false);
    setError("");
    setMessage("");
    if (fileInput.current) fileInput.current.value = "";
  }
  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPreview(true);
  }
  const editable = Boolean(view?.own.eligible) && !locked;
  return (
    <section
      id="team-members"
      className={`panel ${styles.panel}`}
      aria-labelledby={`team-profiles-title-${teamID}`}
    >
      <div className={styles.heading}>
        <div>
          <p className="eyebrow">TEAM / MEMBERS</p>
          <h2 id={`team-profiles-title-${teamID}`}>队员简介</h2>
        </div>
        {editable && !editing && (
          <button
            ref={editButton}
            type="button"
            className="button light"
            onClick={() => { focusTarget.current = "name"; setEditing(true); }}
          >
            编辑我的队内简介
          </button>
        )}
      </div>
      <p className={styles.note}>
        展示仍在队且选择公开的成员资料。昵称与介绍由本人填写。
      </p>
      {loading && <p role="status">正在加载队员简介…</p>}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {!loading && view && (
        <>
          {view.profiles.length ? (
            <div className={styles.grid}>
              {view.profiles.map((profile) => (
                <TeamProfileCard key={profile.id} profile={profile} />
              ))}
            </div>
          ) : (
            <p className={styles.empty}>暂无选择展示的队员简介。</p>
          )}
          {!view.own.eligible && (
            <p className={styles.note}>
              通过入队审核且仍在队后，可以填写自己的队内简介。
            </p>
          )}
        </>
      )}
      {!loading && error && (
        <button
          type="button"
          className="button light"
          disabled={busy}
          onClick={() => setReloadKey((key) => key + 1)}
        >
          重新加载已保存资料
        </button>
      )}
      {editing && (editable || locked) && (
        <div className={styles.editor}>
          <h3>我的队内简介</h3>
          <p className={styles.note}>
            请使用公开昵称。无需填写真实姓名、学号、联系方式或报名作答。
          </p>
          <form className="member-form" onSubmit={review}>
            <fieldset disabled={busy || locked} className={styles.fields}>
              <label>
                公开昵称
                <input
                  ref={nicknameInput}
                  value={draft.displayName}
                  onChange={(event) =>
                    change("displayName", event.target.value)
                  }
                  maxLength={40}
                  required
                  autoComplete="off"
                />
              </label>
              <label>
                位置 / 游戏角色（可选）
                <input
                  value={draft.position}
                  onChange={(event) => change("position", event.target.value)}
                  maxLength={60}
                  autoComplete="off"
                />
              </label>
              <label>
                简短介绍（可选）
                <textarea
                  value={draft.biography}
                  onChange={(event) => change("biography", event.target.value)}
                  maxLength={400}
                  rows={4}
                />
              </label>
              <label>
                头像（可选）
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => void avatar(event.target.files?.[0])}
                />
              </label>
              <p className={styles.note}>
                静态 PNG、JPEG、WebP，2 MB 以内。公开前会清除图片元数据。
              </p>
              {draft.avatar && (
                <button
                  type="button"
                  className="button light"
                  onClick={() => {
                    change("avatar", null);
                    if (fileInput.current) fileInput.current.value = "";
                  }}
                >
                  移除头像
                </button>
              )}
              <label className={styles.consent}>
                <input
                  type="checkbox"
                  checked={draft.visible}
                  onChange={(event) => change("visible", event.target.checked)}
                />
                在本代表队页面展示我的简介
              </label>
              <p className={styles.note}>
                取消展示后保存即可隐藏；离队或资格撤销后，简介会退出名单。
              </p>
              <div className={styles.actions}>
                <button className="button" type="submit">
                  预览简介
                </button>
                <button className="button light" type="button" onClick={cancel}>
                  取消修改
                </button>
              </div>
            </fieldset>
          </form>
          {preview && (
            <div className={styles.preview}>
              <h3>展示预览</h3>
              <TeamProfileCard profile={draft} />
              <p>
                {draft.visible
                  ? "保存后会在本代表队名单展示。"
                  : "保存后仅自己可编辑，名单中隐藏。"}
              </p>
              <div className={styles.actions}>
                <button
                  type="button"
                  className="button"
                  onClick={() => void save()}
                  disabled={busy || locked}
                >
                  {busy ? "正在保存…" : "确认保存简介"}
                </button>
                <button
                  type="button"
                  className="button light"
                  disabled={busy}
                  onClick={() => { focusTarget.current = "name"; setPreview(false); }}
                >
                  返回修改
                </button>
              </div>
            </div>
          )}
          {locked && (
            <p role="status">当前已无法编辑。请重新加载核对入队资格。</p>
          )}
        </div>
      )}
    </section>
  );
}
