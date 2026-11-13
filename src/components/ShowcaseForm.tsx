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
import { submitShowcaseAction } from "@/app/(frontend)/community/actions";
import workStyles from "./activity-pages/Workspace.module.css";
import styles from "./community-pages/CommunityPages.module.css";
import { useLocale, useT } from "@/components/i18n/LocaleProvider";
import { localizeAccountMessage } from "@/lib/i18n/messages-account";
export function ShowcaseForm({
  game,
  slug,
  manager,
}: {
  game: number;
  slug: string;
  manager: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const ready = useSyncExternalStore(
      () => () => {},
      () => true,
      () => false,
    ),
    prefix = useId();
  const [pending, setPending] = useState(false),
    [feedback, setFeedback] = useState("");
  const [failed, setFailed] = useState(false),
    [selection, setSelection] = useState("");
  const form = useRef<HTMLFormElement>(null),
    lock = useRef(false),
    message = useRef<HTMLParagraphElement>(null);
  const router = useRouter();
  const photosInput = useRef<HTMLInputElement>(null),
    videoInput = useRef<HTMLInputElement>(null);
  const [photoPreviews, setPhotoPreviews] = useState<
      { name: string; url: string }[]
    >([]),
    [videoPreview, setVideoPreview] = useState("");
  useEffect(
    () => () => {
      photoPreviews.forEach((photo) => URL.revokeObjectURL(photo.url));
    },
    [photoPreviews],
  );
  useEffect(
    () => () => {
      if (videoPreview) URL.revokeObjectURL(videoPreview);
    },
    [videoPreview],
  );
  function reject(text: string) {
    setFailed(true);
    setFeedback(text);
    requestAnimationFrame(() => message.current?.focus());
  }
  return (
    <section className="showcase-compose" aria-label={t("分享社群风采表单", "Share community showcase form")}>
      <p>
        {t(
          "记录活动，分享照片或精彩视频。标题必填，其余选填。",
          "Record an event and share photos or highlight videos. Only the title is required. ",
        )}
        {manager
          ? t("你可以直接发布。", "You can publish directly.")
          : t("投稿通过本社群管理员审核后公开。", "Posts go public after a community admin approves them.")}
      </p>
      <form
        ref={form}
        className="member-form"
        aria-busy={pending}
        onSubmit={async (event) => {
          event.preventDefault();
          if (lock.current) return;
          const data = new FormData(event.currentTarget);
          const files = data
            .getAll("images")
            .filter((file) => file instanceof File && file.size) as File[];
          if (
            files.length > 6 ||
            files.some(
              (file) =>
                file.size > 2 * 1024 * 1024 ||
                !["image/png", "image/jpeg", "image/webp"].includes(file.type),
            )
          ) {
            reject(
              t(
                "照片不符合要求：最多 6 张，每张 2 MB 以内，支持 PNG、JPEG、WebP。请重新选择照片；文字内容已保留。",
                "Photos do not meet the limits: up to 6, 2 MB each, PNG, JPEG or WebP. Choose again; your text is kept.",
              ),
            );
            return;
          }
          const video = data.get("video"),
            videoFile = video instanceof File && video.size ? video : null;
          if (videoFile && String(data.get("videoURL") || "").trim()) {
            reject(
              t(
                "上传视频与视频链接请选择一种。已选择的文件与文字均保留，可调整后重试。",
                "Choose either an uploaded video or a video link. Your files and text are kept; adjust and try again.",
              ),
            );
            return;
          }
          if (
            (videoFile?.size || 0) > 10 * 1024 * 1024 ||
            files.reduce((sum, file) => sum + file.size, videoFile?.size || 0) >
              12 * 1024 * 1024
          ) {
            reject(
              t(
                "视频不超过 10 MB，图片与视频合计不超过 12 MB。请调整文件后重试。",
                "Videos up to 10 MB; images and video together up to 12 MB. Adjust the files and try again.",
              ),
            );
            return;
          }
          lock.current = true;
          setPending(true);
          setFeedback("");
          setFailed(false);
          try {
            const result = await submitShowcaseAction(data);
            if (result.error) reject(localizeAccountMessage(result.error, locale));
            else {
              form.current?.reset();
              setSelection("");
              setPhotoPreviews([]);
              setVideoPreview("");
              setFeedback(
                manager
                  ? t("风采已发布。", "Showcase published.")
                  : t(
                      "投稿已提交，请在“我的投稿”查看审核状态。",
                      "Submitted. Check the review status in “My posts”.",
                    ),
              );
              router.refresh();
            }
          } catch {
            reject(
              t(
                "提交结果尚未确认，请先查看我的投稿。已填写内容和选择的文件保留，确认后可重试。",
                "The result is not confirmed yet. Check My posts first; your input and files are kept for a retry.",
              ),
            );
          } finally {
            lock.current = false;
            setPending(false);
          }
        }}
      >
        <fieldset
          className={workStyles.actionFields}
          disabled={pending || !ready}
        >
          <input type="hidden" name="game" value={game} />
          <section
            className={styles.formGroup}
            aria-labelledby={`${prefix}-story-title`}
          >
            <h3 id={`${prefix}-story-title`}>{t("活动与故事", "Event and story")}</h3>
            <label>
              <span>
                {t("标题", "Title")}
                <span aria-hidden="true">{t("（必填）", " (required)")}</span>
              </span>
              <input name="title" required maxLength={120} />
            </label>
            <label>
              <span>
                {t("精彩记录", "Story")}
                <span aria-hidden="true">{t("（选填）", " (optional)")}</span>
              </span>
              <textarea
                name="body"
                maxLength={5000}
                rows={6}
                placeholder={t("记录活动经过或想分享的瞬间", "What happened, or a moment you want to share")}
              />
            </label>
          </section>
          <section
            className={styles.formGroup}
            aria-labelledby={`${prefix}-photos-title`}
          >
            <h3 id={`${prefix}-photos-title`}>{t("活动照片", "Event photos")}</h3>
            <label>
              <span>
                {t("活动照片", "Event photos")}
                <span aria-hidden="true">{t("（选填）", " (optional)")}</span>
              </span>
              <input
                ref={photosInput}
                name="images"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                aria-describedby={`${prefix}-photos`}
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  setSelection(files.map((file) => file.name).join(t("、", ", ")));
                  setPhotoPreviews(
                    files
                      .filter(
                        (file) =>
                          ["image/png", "image/jpeg", "image/webp"].includes(
                            file.type,
                          ) && file.size <= 2 * 1024 * 1024,
                      )
                      .slice(0, 6)
                      .map((file) => ({
                        name: file.name,
                        url: URL.createObjectURL(file),
                      })),
                  );
                }}
              />
            </label>
            <p id={`${prefix}-photos`}>
              {t(
                "最多 6 张，每张不超过 2 MB；支持 PNG、JPEG、WebP。",
                "Up to 6 photos, 2 MB each; PNG, JPEG or WebP. ",
              )}
              {selection && t(`已选择：${selection}`, `Selected: ${selection}`)}
            </p>
            {photoPreviews.length > 0 && (
              <div className={styles.uploadPreview}>
                {photoPreviews.map((photo) => (
                  <img
                    key={photo.url}
                    src={photo.url}
                    width={160}
                    height={120}
                    alt={t(`待上传照片：${photo.name}`, `Photo to upload: ${photo.name}`)}
                  />
                ))}
              </div>
            )}
            {selection && (
              <div>
                <button
                  type="button"
                  className="button light"
                  onClick={() => {
                    if (photosInput.current) photosInput.current.value = "";
                    setSelection("");
                    setPhotoPreviews([]);
                  }}
                >
                  {t("移除所选照片", "Remove selected photos")}
                </button>
              </div>
            )}
            <label>
              {t("照片说明（选填）", "Photo caption (optional)")}
              <input
                name="caption"
                maxLength={200}
                placeholder={t("简要说明照片中的活动", "Briefly describe the event in the photos")}
              />
            </label>
          </section>
          <section
            className={styles.formGroup}
            aria-labelledby={`${prefix}-video-title`}
          >
            <h3 id={`${prefix}-video-title`}>{t("精彩视频", "Highlight video")}</h3>
            <p id={`${prefix}-video`}>
              {t(
                "上传文件与链接二选一，均为选填。视频不超过 10 MB，图片与视频合计不超过 12 MB。",
                "Upload a file or give a link (both optional). Videos up to 10 MB; images and video together up to 12 MB.",
              )}
            </p>
            <div className={styles.fieldPair}>
              <label>
                {t("上传 MP4 视频（选填）", "Upload MP4 video (optional)")}
                <input
                  ref={videoInput}
                  name="video"
                  type="file"
                  accept="video/mp4,.mp4"
                  aria-describedby={`${prefix}-video`}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    setVideoPreview(
                      file && file.size <= 10 * 1024 * 1024
                        ? URL.createObjectURL(file)
                        : "",
                    );
                  }}
                />
              </label>
              <label>
                {t("视频链接或 B 站嵌入代码（选填）", "Video link or Bilibili embed code (optional)")}
                <textarea
                  name="videoURL"
                  maxLength={2000}
                  rows={3}
                  aria-describedby={`${prefix}-video`}
                  placeholder={t("B 站分享链接、嵌入代码或 HTTPS MP4 直链", "Bilibili share link, embed code or direct HTTPS MP4 link")}
                />
              </label>
            </div>
            {videoPreview && (
              <div className={styles.video}>
                <video
                  src={videoPreview}
                  controls
                  playsInline
                  preload="metadata"
                  aria-label={t("待上传视频预览", "Preview of the video to upload")}
                />
                <button
                  type="button"
                  className="button light"
                  onClick={() => {
                    if (videoInput.current) videoInput.current.value = "";
                    setVideoPreview("");
                  }}
                >
                  {t("移除所选视频", "Remove selected video")}
                </button>
              </div>
            )}
            <p>
              {t(
                "H.264 视频／AAC 音频可兼容网页和小程序播放。外链视频可在社群展示，申请社团首页升推时需使用本站上传的受控版本。",
                "H.264 video with AAC audio plays on the web and in the mini program. External videos can appear in the community; promotion to the club front page needs a video uploaded to this site.",
              )}
            </p>
          </section>
          <div className={styles.submitRow}>
            <button className="button" type="submit">
              {pending
                ? t("正在上传与提交…", "Uploading and submitting…")
                : manager
                  ? t("发布风采", "Publish showcase")
                  : t("提交审核", "Submit for review")}
            </button>
            <p>
              {manager
                ? t("发布到当前社群。", "Publishes to this community.")
                : t("提交后由本社群管理员审核。", "A community admin reviews it after submission.")}
            </p>
          </div>
        </fieldset>
        {feedback && (
          <p
            ref={message}
            tabIndex={-1}
            className={failed ? workStyles.error : workStyles.feedback}
            role={failed ? "alert" : "status"}
          >
            {feedback}
          </p>
        )}
        {failed && (
          <Link
            href={`/community/${slug}/showcase?view=mine`}
            target="_blank"
            rel="noreferrer"
          >
            {t("在新窗口查看我的投稿，核对提交结果", "Open My posts in a new window to check the result")}
          </Link>
        )}
      </form>
    </section>
  );
}
