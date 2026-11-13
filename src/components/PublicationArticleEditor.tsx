"use client";

import { useEffect, useRef, useState } from "react";
import { publicationImageBytes, publicationImageTypes, publicationPreview, type PublicationImage } from "@/lib/publication-images";
import type { PublicationBlock } from "@/lib/publication-content";
import { uploadPublicationImage } from "./PublicationImagesEditor";
import styles from "./PublicationArticleEditor.module.css";
import { useLocale, useT } from "@/components/i18n/LocaleProvider";
import { localizeAccountMessage } from "@/lib/i18n/messages-account";

export function PublicationArticleEditor({ onChange, onBusyChange, initialBlocks = [], initialImages = [] }: {
  onChange: (blocks: PublicationBlock[], images: PublicationImage[]) => void;
  onBusyChange: (busy: boolean) => void;
  initialBlocks?: PublicationBlock[];
  initialImages?: PublicationImage[];
}) {
  const t = useT();
  const locale = useLocale();
  const editor = useRef<HTMLDivElement>(null);
  const selection = useRef<Range | null>(null);
  const initial = useRef({ blocks: initialBlocks, images: initialImages });
  const initialized = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editor.current || initialized.current) return;
    initialized.current = true;
    for (const block of initial.current.blocks) {
      if (block.type === "text") editor.current.appendChild(document.createTextNode(block.text));
      else {
        const image = initial.current.images[block.index];
        if (!image) continue;
        const element = document.createElement("img");
        element.src = publicationPreview(image); element.dataset.source = image.source;
        element.alt = image.alt || "文章配图"; element.contentEditable = "false"; // i18n-exempt: stored image alt (content data)
        editor.current.appendChild(element);
      }
    }
  }, []);

  function rememberSelection() {
    const current = window.getSelection();
    if (current?.rangeCount && editor.current?.contains(current.getRangeAt(0).commonAncestorContainer))
      selection.current = current.getRangeAt(0).cloneRange();
  }
  function read() {
    const blocks: PublicationBlock[] = [], images: PublicationImage[] = [];
    function text(value: string) {
      const last = blocks.at(-1);
      if (last?.type === "text") last.text += value;
      else blocks.push({ type: "text", text: value });
    }
    function walk(node: Node) {
      if (node.nodeType === Node.TEXT_NODE) { text(node.textContent || ""); return; }
      if (!(node instanceof HTMLElement)) return;
      if (node.tagName === "IMG") {
        const source = node.dataset.source, preview = node.getAttribute("src");
        if (source && preview) {
          let index = images.findIndex(image => image.source === source);
          if (index < 0) { index = images.length; images.push({ source, preview, alt: node.getAttribute("alt") || "" }); }
          blocks.push({ type: "image", index });
        }
        return;
      }
      if (node.tagName === "BR") { text("\n"); return; }
      const paragraph = ["DIV", "P"].includes(node.tagName);
      if (paragraph && blocks.length) text("\n");
      node.childNodes.forEach(walk);
    }
    editor.current?.childNodes.forEach(walk);
    onChange(blocks, images);
  }
  function insert(node: Node) {
    const root = editor.current;
    if (!root) return;
    const range = selection.current;
    if (range && root.contains(range.commonAncestorContainer)) {
      range.deleteContents(); range.insertNode(node); range.setStartAfter(node); range.collapse(true);
      selection.current = range;
    } else root.appendChild(node);
    root.focus();
    const current = window.getSelection();
    if (selection.current && current) { current.removeAllRanges(); current.addRange(selection.current); }
    read();
  }
  async function add(files: File[]) {
    if (!files.length || busy) return;
    setError("");
    if (files.some(file => !file.size || file.size > publicationImageBytes || !publicationImageTypes.includes(file.type))) {
      setError(t("请选择 10 MB 以内的 PNG、JPEG 或 WebP 图片。", "Choose PNG, JPEG or WebP images up to 10 MB.")); return;
    }
    setBusy(true); onBusyChange(true);
    try {
      for (const file of files) {
        const image = await uploadPublicationImage(file);
        const element = document.createElement("img");
        element.src = image.preview; element.dataset.source = image.source;
        element.alt = "文章配图"; element.contentEditable = "false"; // i18n-exempt: stored image alt (content data)
        insert(element);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("图片上传失败，请重新选择。", "Image upload failed. Choose again.")); }
    finally { setBusy(false); onBusyChange(false); }
  }
  return <div className={styles.editor}>
    <div className={styles.toolbar}>
      <label>{t("插入图片", "Insert image")}<input type="file" multiple accept={publicationImageTypes.join(",")} disabled={busy}
        onChange={event => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; void add(files); }} /></label>
      <span>{t("在正文中输入文字，图片会插入到光标位置。", "Type the body here; images are inserted at the cursor.")}</span>
    </div>
    <div ref={editor} className={styles.canvas} contentEditable suppressContentEditableWarning role="textbox" aria-label={t("文章正文", "Article body")} aria-multiline="true"
      onInput={read} onKeyUp={rememberSelection} onMouseUp={rememberSelection} onBlur={rememberSelection}
      onPaste={event => {
        event.preventDefault(); rememberSelection();
        const files = Array.from(event.clipboardData.files);
        if (files.length) void add(files);
        else insert(document.createTextNode(event.clipboardData.getData("text/plain")));
      }} />
    {busy && <p role="status">{t("正在上传图片，请稍候…", "Uploading images, please wait…")}</p>}
    {error && <p role="alert">{localizeAccountMessage(error, locale)}</p>}
  </div>;
}
