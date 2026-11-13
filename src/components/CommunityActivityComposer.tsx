"use client";
import styles from "./community-pages/CommunityPages.module.css";
import { useEffect, useState } from "react";
import { SignupBuilder } from "./SignupBuilder";
import { emptySignup } from "@/lib/signup-schema";
import { PublicationImagesEditor } from "./PublicationImagesEditor";
import { PublicationArticleEditor } from "./PublicationArticleEditor";
import { publicationImageInput, type PublicationImage } from "@/lib/publication-images";
import type { PublicationBlock } from "@/lib/publication-content";
import { SubmitButton } from "./SubmitButton";
import { audiences, audienceLabels } from "@/lib/content-audience";
import { ActionForm } from "./activity-pages/ActionForm";
import { publishCommunityResultAction } from "@/app/(frontend)/community/actions";
import { useLocale, useT } from "@/components/i18n/LocaleProvider";
import { keyedLabel, audienceLabelsEn } from "@/lib/i18n/labels-account";
export function CommunityActivityComposer({ game }: { game: number }) {
  const t = useT();
  const locale = useLocale();
  const [kind, setKind] = useState("event"),
    [signup, setSignup] = useState(emptySignup);
  const [postImages, setPostImages] = useState<PublicationImage[]>([]);
  const [signupImages, setSignupImages] = useState<PublicationImage[]>([]);
  const [contentMode, setContentMode] = useState<"gallery" | "article">("gallery");
  const [articleImages, setArticleImages] = useState<PublicationImage[]>([]);
  const [articleBlocks, setArticleBlocks] = useState<PublicationBlock[]>([]);
  const [articleBusy, setArticleBusy] = useState(false);
  const [articleKey, setArticleKey] = useState(0);
  const articleText = articleBlocks.filter((block): block is Extract<PublicationBlock, { type: "text" }> => block.type === "text").map(block => block.text).join("\n");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [location, setLocation] = useState("");
  const activeSignupImages = kind === "event" && signup.enabled ? signupImages : [];
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <section aria-label={t("活动与通知发布表单", "Event and notice publishing form")}>
      <ActionForm
        action={publishCommunityResultAction}
        resetOnSuccess
        onSuccess={() => {
          setSignup(emptySignup);
          setPostImages([]);
          setSignupImages([]);
          setArticleImages([]);
          setArticleBlocks([]);
          setArticleKey(key => key + 1);
          setStartAt("");
          setEndAt("");
          setLocation("");
        }}
      >
        <fieldset className="composer-fields" disabled={!ready}>
          <input type="hidden" name="game" value={game} />
          <section className={styles.formGroup} aria-label={t("内容与发布范围", "Content and audience")}>
            <h3>{t("内容与发布范围", "Content and audience")}</h3>
            <label>
              {t("类型", "Type")}
              <select
                name="kind"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                <option value="event">{t("社群活动", "Community event")}</option>
                <option value="notice">{t("社群通知", "Community notice")}</option>
              </select>
            </label>
            <label>
              {t("可见范围", "Visibility")}
              <select name="audience" defaultValue="campus">
                {audiences.map(value => <option key={value} value={value}>{keyedLabel(locale, value, audienceLabelsEn, audienceLabels[value])}</option>)}
              </select>
            </label>
            <label>
              <span>
                {t("标题", "Title")}
                <span aria-hidden="true">{t("（必填）", " (required)")}</span>
              </span>
              <input name="title" maxLength={120} required />
            </label>
            <label>
              {t("内容形式", "Format")}
              <select name="contentMode" value={contentMode} onChange={event => setContentMode(event.target.value as "gallery" | "article")}>
                <option value="gallery">{t("图文（图片翻页）", "Text with image slides")}</option>
                <option value="article">{t("文章（图文混排）", "Article (mixed text and images)")}</option>
              </select>
            </label>
            <div hidden={contentMode !== "gallery"}>
              <label>
                <span>{t("内容", "Content")}<span aria-hidden="true">{t("（必填）", " (required)")}</span></span>
                <textarea name="body" rows={8} maxLength={5000} required={contentMode === "gallery"} disabled={contentMode !== "gallery"} />
              </label>
            </div>
            <div hidden={contentMode !== "article"}>
              <PublicationArticleEditor key={articleKey} onBusyChange={setArticleBusy} onChange={(blocks, images) => { setArticleBlocks(blocks); setArticleImages(images); }} />
            </div>
            {contentMode === "article" && <input type="hidden" name="body" value={articleText} />}
            <input type="hidden" name="contentBlocks" value={JSON.stringify(contentMode === "article" ? articleBlocks : [])} />
            {kind === "event" && (
              <>
                <div className={styles.fieldPair}>
                  <label>
                    <span>{t("活动开始时间", "Start time")}<span aria-hidden="true">{t("（选填）", " (optional)")}</span></span>
                    <input type="datetime-local" name="startAt" value={startAt} onChange={(event) => setStartAt(event.target.value)} />
                  </label>
                  <label>
                    <span>{t("活动结束时间", "End time")}<span aria-hidden="true">{t("（选填）", " (optional)")}</span></span>
                    <input type="datetime-local" name="endAt" value={endAt} onChange={(event) => setEndAt(event.target.value)} />
                  </label>
                </div>
                <p>{t("时间按北京时间填写；同时填写开始和结束时间时，结束时间需晚于开始时间。", "Use Beijing time. If both are set, the end must be after the start.")}</p>
                <label>
                  <span>{t("活动地点", "Location")}<span aria-hidden="true">{t("（选填）", " (optional)")}</span></span>
                  <input name="location" maxLength={120} value={location} onChange={(event) => setLocation(event.target.value)} />
                </label>
              </>
            )}
            {contentMode === "gallery" && <PublicationImagesEditor label={t("正文配图", "Body images")} images={postImages} onChange={setPostImages} />}
            <input type="hidden" name="postImages" value={JSON.stringify(publicationImageInput(contentMode === "article" ? articleImages : postImages))} />
          </section>
          {kind === "event" && (
            <section className={styles.formGroup} aria-label={t("活动报名配置", "Sign-up settings")}>
              <h3>{t("活动报名配置", "Sign-up settings")}</h3>
              <p>{t("按活动实际需要启用问卷，报名和统计沿用当前活动。", "Enable a questionnaire if the event needs one; sign-ups and stats stay with this event.")}</p>
              <SignupBuilder
                value={signup}
                onChange={setSignup}
                illustrations={{
                  images: signupImages,
                  onChange: setSignupImages,
                }}
              />
              <input type="hidden" name="signupImages" value={JSON.stringify(publicationImageInput(activeSignupImages))} />
              <input
                type="hidden"
                name="signupForm"
                value={JSON.stringify(signup)}
              />
            </section>
          )}
          <div className={styles.submitRow}>
            <SubmitButton className="button" disabled={articleBusy}>
              {kind === "event" ? t("发布社群活动", "Publish community event") : t("发布社群通知", "Publish community notice")}
            </SubmitButton>
            <p>{t("内容将发布到当前游戏社群。", "This will be published to the current game community.")}</p>
          </div>
        </fieldset>
      </ActionForm>
    </section>
  );
}
