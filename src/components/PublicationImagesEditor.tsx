"use client";

import { useId, useState } from "react";
import {
  publicationImageBytes,
  publicationImageMegabytes,
  publicationImageTypes,
  publicationPreview,
  type PublicationImage,
} from "@/lib/publication-images";
import type { Question } from "@/lib/signup-schema";
import styles from "./PublicationImages.module.css";
import { useLocale, useT } from "@/components/i18n/LocaleProvider";
import { localizeAccountMessage } from "@/lib/i18n/messages-account";

export async function uploadPublicationImage(file: File) {
  const data = new FormData();
  data.set("purpose", "publication");
  data.set("file", file);
  const response = await fetch("/api/v2/uploads", { method: "POST", body: data, credentials: "same-origin" });
  const result = await response.json().catch(() => null);
  const upload = result?.upload;
  const match = typeof upload?.preview?.src === "string" && /\?v=([a-f0-9]{16})$/.exec(upload.preview.src);
  if (!response.ok || !Number.isSafeInteger(upload?.id) || !match)
    throw new Error(typeof result?.error === "string" ? result.error : "图片上传失败，请重新选择。"); // i18n-exempt: server message, localized at display
  return { source: `asset:${upload.id}:${match[1]}`, preview: upload.preview.src, alt: "" };
}

export function PublicationImagesEditor({
  label,
  images,
  onChange,
  questions,
  readOnly = false,
  allowReplace = false,
}: {
  label: string;
  images: PublicationImage[];
  onChange: (images: PublicationImage[]) => void;
  questions?: Question[];
  readOnly?: boolean;
  allowReplace?: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const id = useId();
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);

  async function chooseImages(input: HTMLInputElement, replaceIndex?: number) {
    const files = Array.from(input.files ?? []);
    input.value = "";
    if (reading || !files.length) return;
    setError("");
    if (files.some((file) =>
      !file.size || file.size > publicationImageBytes || !publicationImageTypes.includes(file.type)
    )) {
      setError(t(`请选择 ${publicationImageMegabytes} MB 以内的 PNG、JPEG 或 WebP 图片。`, `Choose PNG, JPEG or WebP images up to ${publicationImageMegabytes} MB.`));
      return;
    }
    input.setCustomValidity(t("图片正在读取，请稍候。", "Reading images, please wait."));
    setReading(true);
    try {
      const sources: PublicationImage[] = [];
      for (const file of files) sources.push(await uploadPublicationImage(file));
      onChange(replaceIndex === undefined
        ? [...images, ...sources]
        : images.map((image, index) => index === replaceIndex ? { ...image, ...sources[0], alt: image.alt } : image));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("图片上传失败，请重新选择。", "Image upload failed. Choose again."));
    } finally {
      input.setCustomValidity("");
      setReading(false);
    }
  }

  return (
    <div className={styles.editor} aria-busy={reading}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="file"
        multiple
        accept={publicationImageTypes.join(",")}
        aria-describedby={`${id}-hint`}
        disabled={readOnly}
        onChange={(event) => void chooseImages(event.currentTarget)}
      />
      <small id={`${id}-hint`}>
        {t(
          `PNG、JPEG、WebP，每张不超过 ${publicationImageMegabytes} MB。已添加 ${images.length} 张。`,
          `PNG, JPEG or WebP, up to ${publicationImageMegabytes} MB each. ${images.length} added.`,
        )}
      </small>
      {error && <p role="alert">{localizeAccountMessage(error, locale)}</p>}
      {images.length > 0 && (
        <ol>
          {images.map((image, index) => {
            const update = (patch: Partial<PublicationImage>) =>
              onChange(images.map((current, position) =>
                position === index ? { ...current, ...patch } : current,
              ));
            return (
              <li key={index}>
                <img src={publicationPreview(image)} alt={image.alt || t(`第 ${index + 1} 张图片预览`, `Preview of image ${index + 1}`)} />
                <label>
                  {t(`第 ${index + 1} 张图片说明（选填）`, `Image ${index + 1} caption (optional)`)}
                  <input
                    value={image.alt}
                    maxLength={120}
                    disabled={readOnly || reading}
                    onChange={(event) => update({ alt: event.target.value })}
                  />
                </label>
                {allowReplace && !readOnly && (
                  <label>
                    {t(`更换第 ${index + 1} 张图片`, `Replace image ${index + 1}`)}
                    <input
                      type="file"
                      accept={publicationImageTypes.join(",")}
                      onChange={(event) => void chooseImages(event.currentTarget, index)}
                    />
                  </label>
                )}
                {questions && (
                  <label>
                    {t("展示位置", "Placement")}
                    <select
                      value={image.questionId ?? ""}
                      disabled={readOnly || reading}
                      onChange={(event) => update({ questionId: event.target.value || undefined })}
                    >
                      <option value="">{t("问卷说明", "Questionnaire intro")}</option>
                      {image.questionId && !questions.some(({ id }) => id === image.questionId) && (
                        <option value={image.questionId}>{t("原题目已移除", "Original question removed")}</option>
                      )}
                      {questions.map(({ id, label }, position) => (
                        <option key={id} value={id}>{t(`第 ${position + 1} 题`, `Q${position + 1}`)} · {label}</option>
                      ))}
                    </select>
                  </label>
                )}
                {!readOnly && (
                  <button
                    type="button"
                    disabled={reading}
                    onClick={() => {
                      onChange(images.filter((_, position) => position !== index));
                      setError("");
                    }}
                  >
                    {t(`移除第 ${index + 1} 张图片`, `Remove image ${index + 1}`)}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
