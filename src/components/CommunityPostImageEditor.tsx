"use client";

import { useState } from "react";
import { updateCommunityPostImagesAction } from "@/app/(frontend)/community/actions";
import { publicationAsset, publicationImageInput, type PublicationImage } from "@/lib/publication-images";
import { PublicationImagesEditor } from "./PublicationImagesEditor";
import { ActionForm } from "./activity-pages/ActionForm";
import styles from "./community-pages/CommunityPages.module.css";

export function CommunityPostImageEditor({
  id,
  game,
  images,
  revision,
}: {
  id: number;
  game: number;
  images: PublicationImage[];
  revision: string;
}) {
  const [draft, setDraft] = useState<{ images: PublicationImage[]; revision: string } | null>(null);
  const current = draft?.images ?? images.map((image, index) => {
    const asset = publicationAsset(image.source);
    return asset ? { ...image, preview: `/api/v2/images/community-post/${id}/${index}?v=${asset.version}` } : image;
  });

  return (
    <details className={styles.disclosure}>
      <summary>编辑配图</summary>
      <p>补充、替换或移除正文图片，保存后同步更新展示。</p>
      <ActionForm action={updateCommunityPostImagesAction} onSuccess={() => setDraft(null)}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="game" value={game} />
        <input type="hidden" name="revision" value={draft?.revision ?? revision} />
        <input type="hidden" name="postImages" value={JSON.stringify(publicationImageInput(current))} />
        <PublicationImagesEditor
          label="正文配图"
          images={current}
          allowReplace
          onChange={(next) => setDraft((previous) => ({
            images: next, revision: previous?.revision ?? revision,
          }))}
        />
        <div className={styles.submitRow}>
          <button className="button" type="submit" disabled={!draft}>保存配图</button>
          {draft && (
            <button className="button light" type="button" onClick={() => setDraft(null)}>
              载入已保存配图
            </button>
          )}
        </div>
      </ActionForm>
    </details>
  );
}
