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
import { ActionForm } from "./activity-pages/ActionForm";
import { publishCommunityResultAction } from "@/app/(frontend)/community/actions";
export function CommunityActivityComposer({ game }: { game: number }) {
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
    <section aria-label="活动与通知发布表单">
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
              内容形式
              <select name="contentMode" value={contentMode} onChange={event => setContentMode(event.target.value as "gallery" | "article")}>
                <option value="gallery">图文（图片翻页）</option>
                <option value="article">文章（图文混排）</option>
              </select>
            </label>
            <div hidden={contentMode !== "gallery"}>
              <label>
                <span>内容<span aria-hidden="true">（必填）</span></span>
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
                    <span>活动开始时间<span aria-hidden="true">（选填）</span></span>
                    <input type="datetime-local" name="startAt" value={startAt} onChange={(event) => setStartAt(event.target.value)} />
                  </label>
                  <label>
                    <span>活动结束时间<span aria-hidden="true">（选填）</span></span>
                    <input type="datetime-local" name="endAt" value={endAt} onChange={(event) => setEndAt(event.target.value)} />
                  </label>
                </div>
                <p>时间按北京时间填写；同时填写开始和结束时间时，结束时间需晚于开始时间。</p>
                <label>
                  <span>活动地点<span aria-hidden="true">（选填）</span></span>
                  <input name="location" maxLength={120} value={location} onChange={(event) => setLocation(event.target.value)} />
                </label>
              </>
            )}
            {contentMode === "gallery" && <PublicationImagesEditor label="正文配图" images={postImages} onChange={setPostImages} />}
            <input type="hidden" name="postImages" value={JSON.stringify(publicationImageInput(contentMode === "article" ? articleImages : postImages))} />
          </section>
          {kind === "event" && (
            <section className={styles.formGroup} aria-label="活动报名配置">
              <h3>活动报名配置</h3>
              <p>按活动实际需要启用问卷，报名和统计沿用当前活动。</p>
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
              {kind === "event" ? "发布社群活动" : "发布社群通知"}
            </SubmitButton>
            <p>内容将发布到当前游戏社群。</p>
          </div>
        </fieldset>
      </ActionForm>
    </section>
  );
}
