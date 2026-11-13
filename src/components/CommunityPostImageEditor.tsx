"use client";

import { useState } from "react";
import { updateCommunityPostImagesAction } from "@/app/(frontend)/community/actions";
import { publicationAsset, publicationImageInput, type PublicationImage } from "@/lib/publication-images";
import { PublicationImagesEditor } from "./PublicationImagesEditor";
import { ActionForm } from "./activity-pages/ActionForm";
import styles from "./community-pages/CommunityPages.module.css";
import { useT } from "@/components/i18n/LocaleProvider";

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
  const t = useT();
  const [draft, setDraft] = useState<{ images: PublicationImage[]; revision: string } | null>(null);
  const current = draft?.images ?? images.map((image, index) => {
    const asset = publicationAsset(image.source);
    return asset ? { ...image, preview: `/api/v2/images/community-post/${id}/${index}?v=${asset.version}` } : image;
  });

  return (
    <details className={styles.disclosure}>
      <summary>{t("编辑配图", "Edit images")}</summary>
      <p>{t("补充、替换或移除正文图片，保存后同步更新展示。", "Add, replace or remove body images. Saving updates the display.")}</p>
      <ActionForm action={updateCommunityPostImagesAction} onSuccess={() => setDraft(null)}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="game" value={game} />
        <input type="hidden" name="revision" value={draft?.revision ?? revision} />
        <input type="hidden" name="postImages" value={JSON.stringify(publicationImageInput(current))} />
        <PublicationImagesEditor
          label={t("正文配图", "Body images")}
          images={current}
          allowReplace
          onChange={(next) => setDraft((previous) => ({
            images: next, revision: previous?.revision ?? revision,
          }))}
        />
        <div className={styles.submitRow}>
          <button className="button" type="submit" disabled={!draft}>{t("保存配图", "Save images")}</button>
          {draft && (
            <button className="button light" type="button" onClick={() => setDraft(null)}>
              {t("载入已保存配图", "Reload saved images")}
            </button>
          )}
        </div>
      </ActionForm>
    </details>
  );
}
