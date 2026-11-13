"use client";
import { useState, useSyncExternalStore } from "react";
import { updateCommunityArticleAction } from "@/app/(frontend)/community/actions";
import { publicationAsset, publicationImageInput, type PublicationImage } from "@/lib/publication-images";
import type { PublicationBlock } from "@/lib/publication-content";
import { PublicationArticleEditor } from "./PublicationArticleEditor";
import { ActionForm } from "./activity-pages/ActionForm";
import styles from "./community-pages/CommunityPages.module.css";
import { useT } from "@/components/i18n/LocaleProvider";

export function CommunityArticleEditor({ id, game, images, blocks, revision }: {
  id: number; game: number; images: PublicationImage[]; blocks: PublicationBlock[]; revision: string;
}) {
  const t = useT();
  const [draft, setDraft] = useState<{ blocks: PublicationBlock[]; images: PublicationImage[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const ready = useSyncExternalStore(() => () => {}, () => true, () => false);
  const visibleImages = images.map((image, index) => {
    const asset = publicationAsset(image.source);
    return asset ? { ...image, preview: `/api/v2/images/community-post/${id}/${index}?v=${asset.version}` } : image;
  });
  return <div className={styles.disclosure}>
    <button type="button" className="button light" disabled={!ready} onClick={() => setEditing(value => !value)} aria-expanded={editing}>{t("编辑文章", "Edit article")}</button>
    {editing && <>
    <p>{t("修改正文与图片后保存；已升推内容会同步更新。", "Edit the text and images, then save. Promoted content updates as well.")}</p>
    <ActionForm action={updateCommunityArticleAction} onSuccess={() => setDraft(null)}>
      <input type="hidden" name="id" value={id} /><input type="hidden" name="game" value={game} />
      <input type="hidden" name="revision" value={revision} />
      <input type="hidden" name="postImages" value={JSON.stringify(publicationImageInput(draft?.images ?? visibleImages))} />
      <input type="hidden" name="contentBlocks" value={JSON.stringify(draft?.blocks ?? blocks)} />
      <PublicationArticleEditor key={revision} initialBlocks={blocks} initialImages={visibleImages} onBusyChange={setBusy} onChange={(nextBlocks, nextImages) => setDraft({ blocks: nextBlocks, images: nextImages })} />
      <button type="submit" className="button" disabled={!draft || busy}>{t("保存文章", "Save article")}</button>
    </ActionForm>
    </>}
  </div>;
}
