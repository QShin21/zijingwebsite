"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./community-pages/CommunityPages.module.css";
import { applyAction } from "@/app/(frontend)/community/actions";
import {
  applicationContactConsentLabel,
  applicationContactConsentRequiredMessage,
} from "@/lib/community-status";
import { useLocale, useT } from "@/components/i18n/LocaleProvider";
import { localizeAccountMessage } from "@/lib/i18n/messages-account";

const subscribe = () => () => {};
export function CommunityApplicationForm({
  games,
  initial,
}: {
  games: { id: number; title: string }[];
  initial?: {
    id: number;
    updatedAt: string;
    game?: number | null;
    proposedGame: string;
    realName?: string | null;
    phone?: string | null;
    reason: string;
    contactConsent?: boolean | null;
  };
}) {
  const t = useT();
  const locale = useLocale();
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [consentError, setConsentError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [qrPreview, setQrPreview] = useState("");
  const qrFile = useRef<HTMLInputElement>(null);
  const [selectedGame, setSelectedGame] = useState(String(initial?.game ?? ""));
  const consent = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const consentId = useId();
  const router = useRouter();
  const focusConsent = () => {
    consent.current?.focus();
    consent.current?.scrollIntoView({ block: "center" });
  };
  useEffect(
    () => () => {
      if (qrPreview) URL.revokeObjectURL(qrPreview);
    },
    [qrPreview],
  );
  useEffect(() => {
    if (consentError && !busy) {
      consent.current?.focus();
      consent.current?.scrollIntoView({ block: "center" });
    }
  }, [consentError, busy]);
  return (
    <form
      className="member-form application-form"
      aria-busy={!ready || busy}
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        if (!ready || busy || pending.current) return;
        setError("");
        setUncertain(false);
        if (!consent.current?.checked) {
          setConsentError(applicationContactConsentRequiredMessage);
          focusConsent();
          return;
        }
        if (!event.currentTarget.reportValidity()) return;
        const data = new FormData(event.currentTarget);
        pending.current = true;
        setBusy(true);
        try {
          const result = await applyAction(data);
          if (result.error) {
            if (
              ("field" in result && result.field === "contactConsent") ||
              result.error === applicationContactConsentRequiredMessage
            ) {
              setConsentError(applicationContactConsentRequiredMessage);
            } else setError(result.error);
          } else {
            router.push("/community/apply?submitted=1");
            router.refresh();
          }
        } catch {
          setUncertain(true);
          setError(
            t(
              "提交结果尚未确认，填写的资料已保留，所选文件也保留。请先在我的申请中核对是否已有记录，再决定是否重试。",
              "The result is not confirmed yet. Your answers and selected file are kept. Check My applications for a record before retrying.",
            ),
          );
        } finally {
          pending.current = false;
          setBusy(false);
        }
      }}
    >
      <input type="hidden" name="id" value={initial?.id ?? ""} />
      <input type="hidden" name="revision" value={initial?.updatedAt ?? ""} />
      <p role="status" className="form-feedback">
        {localizeAccountMessage(error, locale)}
      </p>
      {uncertain && (
        <Link
          href="/community/apply#my-applications"
          target="_blank"
          rel="noreferrer"
        >
          {t("在新窗口核对我的申请", "Check My applications in a new window")}
        </Link>
      )}
      <fieldset disabled={!ready || busy}>
        <section
          className={styles.formGroup}
          aria-labelledby={`${consentId}-plan-title`}
        >
          <h3 id={`${consentId}-plan-title`}>{t("你想组织哪个社群", "Which community do you want to organize?")}</h3>
          <label>
            {t("游戏社群（必选）", "Game community (required)")}
            <select
              name="game"
              value={selectedGame}
              onChange={(event) => setSelectedGame(event.currentTarget.value)}
            >
              <option value="">{t("申请建立新游戏社群", "Propose a new game community")}</option>
              {games.map((game) => (
                <option value={game.id} key={game.id}>
                  {game.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("新游戏名称", "New game name")}
            {selectedGame
              ? t("（已有社群可留空）", " (optional for an existing community)")
              : t("（必填）", " (required)")}
            <input
              name="proposedGame"
              maxLength={80}
              required={!selectedGame}
              defaultValue={initial?.proposedGame ?? ""}
            />
          </label>
          <label>
            {t("申请说明（必填，至少 10 字）", "Reason (required, at least 10 characters)")}
            <textarea
              name="reason"
              defaultValue={initial?.reason ?? ""}
              minLength={10}
              maxLength={3000}
              required
              rows={6}
              aria-describedby={`${consentId}-reason-hint`}
            />
          </label>
          <p id={`${consentId}-reason-hint`}>
            {t(
              "说明你对这款游戏的了解，以及准备怎样组织交流、活动与日常管理。",
              "Describe what you know about this game and how you plan to run discussions, events and day-to-day management.",
            )}
          </p>
        </section>
        <section
          className={styles.formGroup}
          aria-labelledby={`${consentId}-personal-title`}
        >
          <h3 id={`${consentId}-personal-title`}>{t("审核联系资料", "Contact details for review")}</h3>
          <p>
            {t(
              "姓名和手机号用于申请审核与联系，仅本人和有权审核者可读。",
              "Your name and mobile number are used for review and contact; only you and authorized reviewers can read them.",
            )}
          </p>
          <div className={styles.fieldPair}>
            <label>
              <span>
                {t("姓名", "Name")}
                <span aria-hidden="true">{t("（必填）", " (required)")}</span>
              </span>
              <input
                name="realName"
                autoComplete="name"
                required
                maxLength={80}
                defaultValue={initial?.realName ?? ""}
              />
            </label>
            <label>
              <span>
                {t("手机号", "Mobile")}
                <span aria-hidden="true">{t("（必填）", " (required)")}</span>
              </span>
              <input
                name="phone"
                defaultValue={initial?.phone ?? ""}
                type="tel"
                autoComplete="tel"
                required
                pattern="\+?[0-9]{6,20}"
                maxLength={21}
                aria-describedby={`${consentId}-phone-hint`}
              />
            </label>
          </div>
          <p id={`${consentId}-phone-hint`} className="field-hint">
            {t(
              "填写可联系到本人的手机号，国际号码可带 + 国家代码。",
              "Enter a number that reaches you; international numbers may include + and the country code.",
            )}
          </p>
        </section>
        <section
          className={styles.formGroup}
          aria-labelledby={`${consentId}-contact-title`}
        >
          <h3 id={`${consentId}-contact-title`}>{t("用于进群的微信名片", "WeChat contact card for joining")}</h3>
          <label>
            <span>
              {t("微信名片二维码", "WeChat card QR code")}
              <span aria-hidden="true">
                {initial
                  ? t("（更换时上传）", " (upload to replace)")
                  : t("（必填）", " (required)")}
              </span>
            </span>
            <input
              ref={qrFile}
              name="wechatQr"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              required={!initial}
              aria-describedby={`${consentId}-qr-hint`}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                const invalid =
                  file &&
                  (file.size > 2 * 1024 * 1024 ||
                    !["image/png", "image/jpeg", "image/webp"].includes(
                      file.type,
                    ));
                event.currentTarget.setCustomValidity(
                  invalid
                    ? t(
                        "请上传 2 MB 以内的 PNG、JPEG 或 WebP 微信名片二维码。",
                        "Upload a WeChat contact-card QR code as PNG, JPEG or WebP, up to 2 MB.",
                      )
                    : "",
                );
                setQrPreview(file && !invalid ? URL.createObjectURL(file) : "");
              }}
            />
          </label>
          <p id={`${consentId}-qr-hint`} className="field-hint">
            {t(
              "支持 PNG、JPEG、WebP，最大 2 MB。请保留完整二维码和四周留白。修改申请时不选文件可保留原名片。",
              "PNG, JPEG or WebP, up to 2 MB. Keep the whole QR code and its margins. When editing, leave this empty to keep the current card.",
            )}
          </p>
          {qrPreview && (
            <div className={styles.uploadPreview}>
              <img
                src={qrPreview}
                width={160}
                height={160}
                alt={t("待提交的微信名片预览", "Preview of the contact card to submit")}
              />
              <button
                className="button light"
                type="button"
                onClick={() => {
                  if (qrFile.current) {
                    qrFile.current.value = "";
                    qrFile.current.setCustomValidity("");
                  }
                  setQrPreview("");
                }}
              >
                {t("移除所选名片", "Remove selected card")}
              </button>
            </div>
          )}
          <p id={`${consentId}-hint`} className="field-hint">
            {t(
              "微信名片只有在你同意、申请批准且任职有效时，才向登录成员展示。提交管理员申请须本人勾选下方选项；获批名片可在我的申请中更新或关闭。",
              "Your WeChat card is shown to signed-in members only when you agree, the application is approved and your role is active. You must tick the option below yourself; an approved card can be updated or turned off in My applications.",
            )}
          </p>
          <label className="check" htmlFor={consentId}>
            <input
              id={consentId}
              ref={consent}
              type="checkbox"
              name="contactConsent"
              defaultChecked={initial?.contactConsent === true}
              aria-required="true"
              aria-invalid={Boolean(consentError)}
              aria-describedby={`${consentId}-hint${consentError ? ` ${consentId}-error` : ""}`}
              onChange={(event) => {
                if (event.currentTarget.checked) setConsentError("");
              }}
            />
            {t(
              applicationContactConsentLabel,
              "I agree to show my WeChat card as the contact for joining the group",
            )}
          </label>
          {consentError && (
            <p id={`${consentId}-error`} role="alert" className="form-feedback">
              {localizeAccountMessage(consentError, locale)}
            </p>
          )}
        </section>
        <div className={styles.submitRow}>
          <button className="button" disabled={busy} type="submit">
            {busy
              ? t("正在提交…", "Submitting…")
              : initial
                ? t("修改并重新提交", "Update and resubmit")
                : t("提交审核", "Submit for review")}
          </button>
          <p>
            {t(
              "提交后在“我的申请”中查看处理意见。",
              "After submitting, check review feedback in “My applications”.",
            )}
          </p>
        </div>
      </fieldset>
    </form>
  );
}
