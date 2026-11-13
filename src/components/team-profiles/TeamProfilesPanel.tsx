"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  emptyTeamProfile,
  safeTeamProfileAvatar,
  type OwnTeamProfile,
  type TeamProfileDraft,
  type TeamProfilesView,
} from "@/lib/team-profiles-model";
import { TeamProfileCard } from "./TeamProfileCard";
import { localizeMessage } from "@/lib/i18n/messages";
import { useLocale, useT } from "@/components/i18n/LocaleProvider";
import styles from "./TeamProfiles.module.css";

// Status/error text is kept in state as Chinese (the server contract) and translated on render.
const profileMessagesEn: Record<string, string> = {
  "简介加载失败，请重试": "Failed to load profiles. Please try again.",
  "请上传 2 MB 以内的 PNG、JPEG 或 WebP 静态图片": "Upload a static PNG, JPEG or WebP image under 2 MB.",
  "头像读取失败，请重新选择": "Could not read the avatar. Please choose it again.",
  "简介保存失败，请重试": "Failed to save the profile. Please try again.",
  "简介已保存并选择展示": "Profile saved and shown",
  "简介已保存并隐藏": "Profile saved and hidden",
  "入队周期已更新，请重新加载后确认当前周期的展示选择":
    "Your membership period has changed. Reload and confirm your display choice for the current period.",
  "已保存，名单刷新失败，请重新加载": "Saved, but the roster failed to refresh. Please reload.",
  "简介保存失败，请重试；输入已保留": "Failed to save the profile. Please try again; your input is kept.",
};

export function TeamProfilesPanel({
  teamID,
  startEditing = false,
}: {
  teamID: number;
  startEditing?: boolean;
}) {
  const t = useT(),
    locale = useLocale();
  const shown = (text: string) =>
    locale === "en" && profileMessagesEn[text] ? profileMessagesEn[text] : localizeMessage(text, locale);
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
    previewTitle = useRef<HTMLHeadingElement>(null),
    focusTarget = useRef<"entry" | "name" | "preview" | null>(null);

  useEffect(() => {
    if (!focusTarget.current) return;
    const control =
      focusTarget.current === "entry"
        ? editButton.current
        : focusTarget.current === "preview"
          ? previewTitle.current
          : nicknameInput.current;
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
        // i18n-exempt: stored as Chinese, rendered via profileMessagesEn
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
            // i18n-exempt: stored as Chinese, rendered via profileMessagesEn
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
      // i18n-exempt: stored as Chinese, rendered via profileMessagesEn
      setError("请上传 2 MB 以内的 PNG、JPEG 或 WebP 静态图片");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    const turn = generation.current;
    try {
      const value = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        // i18n-exempt: stored as Chinese, rendered via profileMessagesEn
        reader.onerror = () => reject(new Error("头像读取失败，请重新选择"));
        reader.readAsDataURL(file);
      });
      if (turn === generation.current) change("avatar", value);
    } catch {
      // i18n-exempt: stored as Chinese, rendered via profileMessagesEn
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
        // i18n-exempt: stored as Chinese, rendered via profileMessagesEn
        throw new Error(result.error || "简介保存失败，请重试");
      }
      setOriginal(result.profile);
      setDraft(result.profile);
      setPreview(false);
      setMessage(
        // i18n-exempt: stored as Chinese, rendered via profileMessagesEn
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
          // i18n-exempt: stored as Chinese, rendered via profileMessagesEn
          setError("入队周期已更新，请重新加载后确认当前周期的展示选择");
        }
      } else {
        setView(null);
        // i18n-exempt: stored as Chinese, rendered via profileMessagesEn
        setError(updated.error || "已保存，名单刷新失败，请重新加载");
      }
    } catch (cause) {
      if (turn === generation.current)
        setError(
          cause instanceof Error
            ? cause.message
            : // i18n-exempt: stored as Chinese, rendered via profileMessagesEn
              "简介保存失败，请重试；输入已保留",
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
    focusTarget.current = "preview";
    setPreview(true);
  }
  const editable = Boolean(view?.own.eligible) && !locked;
  const roster = !loading && view && (
    <section className={styles.roster} aria-label={t("已选择展示的队员简介", "Player profiles chosen for display")}>
      {startEditing && (
        <div className={styles.heading}>
          <h2>{t("队伍公开成员", "Public team members")}</h2>
          <p className={styles.note}>{t("本人明确选择展示的昵称与介绍", "Nicknames and bios each player chose to show")}</p>
        </div>
      )}
      {view.profiles.length ? (
        <div className={styles.grid}>
          {view.profiles.map((profile) => (
            <TeamProfileCard key={profile.id} profile={profile} />
          ))}
        </div>
      ) : (
        <p className={styles.empty}>{t("暂无选择展示的队员简介。", "No player profiles are shown yet.")}</p>
      )}
      {!view.own.eligible && (
        <p className={styles.note}>
          {t("通过入队审核且仍在队后，可以填写自己的队内简介。", "Once accepted and while still on the team, you can fill in your team profile.")}
        </p>
      )}
    </section>
  );
  return (
    <section
      id="team-members"
      className={styles.panel}
      aria-labelledby={`team-profiles-title-${teamID}`}
      aria-busy={loading || busy}
    >
      <div className={styles.heading}>
        <div>
          <h2 id={`team-profiles-title-${teamID}`}>
            {startEditing ? t("我的队内简介", "My team profile") : t("队员简介", "Player profiles")}
          </h2>
          <p className={styles.note}>
            {startEditing
              ? t("填写资料、预览内容，再确认本次展示选择。", "Fill in your details, preview them, then confirm your display choice.")
              : t("展示仍在队且选择公开的成员资料。昵称与介绍由本人填写。", "Shows current members who chose to be public. Nicknames and bios are written by each member.")}
          </p>
        </div>
        {editable && !editing && (
          <button
            ref={editButton}
            type="button"
            className="button light"
            onClick={() => {
              focusTarget.current = "name";
              setEditing(true);
            }}
          >
            {t("编辑我的队内简介", "Edit my team profile")}
          </button>
        )}
      </div>
      {loading && <p role="status">{t("正在加载队员简介…", "Loading player profiles…")}</p>}
      {error && (
        <p className={styles.error} role="alert">
          {shown(error)}
        </p>
      )}
      {message && (
        <div className={styles.saved} role="status">
          <strong>{shown(message)}</strong>
          <p>{t("当前展示选择已保存，可在下方名单核对。", "Your display choice is saved; check the roster below.")}</p>
        </div>
      )}
      {!startEditing && roster}
      {!loading && error && (
        <div className={styles.actions}>
          <button
            type="button"
            className="button light"
            disabled={busy}
            onClick={() => setReloadKey((key) => key + 1)}
          >
            {t("重新加载已保存资料", "Reload saved details")}
          </button>
        </div>
      )}
      {editing && (editable || locked) && (
        <div className={styles.editor}>
          <div className={styles.editorAside}>
            <h3>{preview ? t("确认展示选择", "Confirm display choice") : t("只介绍公开身份", "Public identity only")}</h3>
            <p>
              {t("使用公开昵称，介绍游戏角色与共同兴趣。无需填写真实姓名、学号、联系方式或报名作答。", "Use a public nickname and describe your in-game role and interests. No real name, student ID, contact details or sign-up answers needed.")}
            </p>
            <dl className={styles.visibility}>
              <dt>{t("当前保存的展示状态", "Currently saved display")}</dt>
              <dd>{original?.visible ? t("在队伍页面展示", "Shown on team page") : t("隐藏", "Hidden")}</dd>
              <dt>{t("这次准备保存为", "Will be saved as")}</dt>
              <dd>{draft.visible ? t("展示", "Shown") : t("隐藏", "Hidden")}</dd>
            </dl>
            <p>{t("取消展示后保存即可隐藏；离队或资格撤销后，简介会退出名单。", "Untick display and save to hide. If you leave the team or lose eligibility, your profile leaves the roster.")}</p>
          </div>
          <div className={styles.editorMain}>
            <form className="member-form" onSubmit={review} hidden={preview}>
              <fieldset disabled={busy || locked} className={styles.fields}>
                <h3>{t("填写本人资料", "Your details")}</h3>
                <div className={styles.fieldPair}>
                  <label>
                    {t("公开昵称", "Public nickname")}
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
                    {t("位置 / 游戏角色（可选）", "Position / in-game role (optional)")}
                    <input
                      value={draft.position}
                      onChange={(event) =>
                        change("position", event.target.value)
                      }
                      maxLength={60}
                      autoComplete="off"
                    />
                  </label>
                </div>
                <label>
                  {t("简短介绍（可选）", "Short bio (optional)")}
                  <textarea
                    value={draft.biography}
                    onChange={(event) =>
                      change("biography", event.target.value)
                    }
                    aria-describedby={`team-profile-bio-count-${teamID}`}
                    maxLength={400}
                    rows={5}
                  />
                </label>
                <p
                  id={`team-profile-bio-count-${teamID}`}
                  className={styles.note}
                >
                  {t(`已填写 ${draft.biography.length} / 400 字`, `${draft.biography.length} / 400 characters`)}
                </p>
                <div className={styles.avatarEditor}>
                  {safeTeamProfileAvatar(draft.avatar) && (
                    <img
                      src={draft.avatar}
                      alt={t("待保存头像预览", "Avatar preview")}
                      width={80}
                      height={80}
                    />
                  )}
                  <div>
                    <label>
                      {t("头像（可选）", "Avatar (optional)")}
                      <input
                        ref={fileInput}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(event) =>
                          void avatar(event.target.files?.[0])
                        }
                      />
                    </label>
                    <p className={styles.note}>
                      {t("使用 2 MB 以内的静态 PNG、JPEG 或 WebP。请选择获准展示的头像。", "Use a static PNG, JPEG or WebP under 2 MB that you are allowed to show.")}
                    </p>
                  </div>
                  {draft.avatar && (
                    <button
                      type="button"
                      className="button light"
                      onClick={() => {
                        change("avatar", null);
                        if (fileInput.current) fileInput.current.value = "";
                      }}
                    >
                      {t("移除头像", "Remove avatar")}
                    </button>
                  )}
                </div>
                <div className={styles.consentSection}>
                  <h3>{t("选择是否公开", "Choose visibility")}</h3>
                  <label className={styles.consent}>
                    <input
                      type="checkbox"
                      checked={draft.visible}
                      onChange={(event) =>
                        change("visible", event.target.checked)
                      }
                    />
                    {t("在本代表队页面展示我的简介", "Show my profile on this team's page")}
                  </label>
                  <p className={styles.note}>
                    {t("位置、简介与头像均可留空。勾选并保存后，公开昵称与已填写的资料会一起出现在队伍页面。", "Position, bio and avatar may be empty. Once ticked and saved, your nickname and filled-in details appear on the team page.")}
                  </p>
                </div>
                <div className={styles.actions}>
                  <button className="button" type="submit">
                    {t("预览简介", "Preview profile")}
                  </button>
                  <button
                    className="button light"
                    type="button"
                    onClick={cancel}
                  >
                    {t("取消修改", "Cancel changes")}
                  </button>
                </div>
              </fieldset>
            </form>
            {preview && (
              <div className={styles.preview}>
                <h3 ref={previewTitle} tabIndex={-1}>
                  {t("展示预览", "Display preview")}
                </h3>
                <TeamProfileCard profile={draft} />
                <div className={styles.previewDecision}>
                  <strong>
                    {draft.visible
                      ? t("本次选择：在代表队名单展示", "This time: show on the team roster")
                      : t("本次选择：在代表队名单隐藏", "This time: hide from the team roster")}
                  </strong>
                  <p>
                    {draft.visible
                      ? t("确认后，页面会展示上方本人资料。", "Once confirmed, the page shows your details above.")
                      : t("保存后仅自己可编辑，名单中隐藏。", "Once saved, only you can edit it and it stays hidden from the roster.")}
                  </p>
                </div>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className="button"
                    onClick={() => void save()}
                    disabled={busy || locked}
                  >
                    {busy ? t("正在保存…", "Saving…") : t("确认保存简介", "Confirm and save profile")}
                  </button>
                  <button
                    type="button"
                    className="button light"
                    disabled={busy}
                    onClick={() => {
                      focusTarget.current = "name";
                      setPreview(false);
                    }}
                  >
                    {t("返回修改", "Back to editing")}
                  </button>
                </div>
              </div>
            )}
            {locked && (
              <p role="status">{t("当前已无法编辑。请重新加载核对入队资格。", "Editing is no longer available. Reload to check your membership.")}</p>
            )}
          </div>
        </div>
      )}
      {startEditing && roster}
    </section>
  );
}
