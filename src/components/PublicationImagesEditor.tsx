"use client";

import { useId, useState } from "react";
import {
  publicationImageBytes,
  publicationImageLimit,
  publicationImageTypes,
  type PublicationImage,
} from "@/lib/publication-images";
import type { Question } from "@/lib/signup-schema";
import styles from "./PublicationImages.module.css";

function readImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function PublicationImagesEditor({
  label,
  images,
  onChange,
  questions,
  limit = publicationImageLimit,
  readOnly = false,
}: {
  label: string;
  images: PublicationImage[];
  onChange: (images: PublicationImage[]) => void;
  questions?: Question[];
  limit?: number;
  readOnly?: boolean;
}) {
  const id = useId();
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);

  return (
    <div className={styles.editor} aria-busy={reading}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="file"
        multiple
        accept={publicationImageTypes.join(",")}
        aria-describedby={`${id}-hint`}
        disabled={readOnly || limit <= images.length}
        onChange={async (event) => {
          const input = event.currentTarget;
          const files = Array.from(input.files ?? []);
          input.value = "";
          if (reading || !files.length) return;
          setError("");
          if (files.length + images.length > limit) {
            setError(`还能添加 ${limit - images.length} 张图片。`);
            return;
          }
          if (files.some((file) =>
            !file.size || file.size > publicationImageBytes || !publicationImageTypes.includes(file.type)
          )) {
            setError("请选择 2 MB 以内的 PNG、JPEG 或 WebP 图片。");
            return;
          }
          input.setCustomValidity("图片正在读取，请稍候。");
          setReading(true);
          try {
            const added = await Promise.all(files.map(async (file) => ({
              source: await readImage(file), alt: "",
            })));
            onChange([...images, ...added]);
          } catch {
            setError("无法读取图片，请重新选择。");
          } finally {
            input.setCustomValidity("");
            setReading(false);
          }
        }}
      />
      <small id={`${id}-hint`}>
        PNG、JPEG、WebP，每张不超过 2 MB。已添加 {images.length} / {limit} 张。
      </small>
      {error && <p role="alert">{error}</p>}
      {images.length > 0 && (
        <ol>
          {images.map((image, index) => {
            const update = (patch: Partial<PublicationImage>) =>
              onChange(images.map((current, position) =>
                position === index ? { ...current, ...patch } : current,
              ));
            return (
              <li key={index}>
                <img src={image.source} alt={image.alt || `第 ${index + 1} 张图片预览`} />
                <label>
                  第 {index + 1} 张图片说明（选填）
                  <input
                    value={image.alt}
                    maxLength={120}
                    disabled={readOnly || reading}
                    onChange={(event) => update({ alt: event.target.value })}
                  />
                </label>
                {questions && (
                  <label>
                    展示位置
                    <select
                      value={image.questionId ?? ""}
                      disabled={readOnly || reading}
                      onChange={(event) => update({ questionId: event.target.value || undefined })}
                    >
                      <option value="">问卷说明</option>
                      {image.questionId && !questions.some(({ id }) => id === image.questionId) && (
                        <option value={image.questionId}>原题目已移除</option>
                      )}
                      {questions.map(({ id, label }, position) => (
                        <option key={id} value={id}>第 {position + 1} 题 · {label}</option>
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
                    移除第 {index + 1} 张图片
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
