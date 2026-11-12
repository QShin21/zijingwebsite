"use client";

import { useEffect, useRef, useState } from "react";
import { publicationImageBytes, publicationImageTypes, publicationPreview, type PublicationImage } from "@/lib/publication-images";
import type { PublicationBlock } from "@/lib/publication-content";
import { uploadPublicationImage } from "./PublicationImagesEditor";
import styles from "./PublicationArticleEditor.module.css";

export function PublicationArticleEditor({ onChange, onBusyChange, initialBlocks = [], initialImages = [] }: {
  onChange: (blocks: PublicationBlock[], images: PublicationImage[]) => void;
  onBusyChange: (busy: boolean) => void;
  initialBlocks?: PublicationBlock[];
  initialImages?: PublicationImage[];
}) {
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
        element.alt = image.alt || "文章配图"; element.contentEditable = "false";
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
      setError("请选择 10 MB 以内的 PNG、JPEG 或 WebP 图片。"); return;
    }
    setBusy(true); onBusyChange(true);
    try {
      for (const file of files) {
        const image = await uploadPublicationImage(file);
        const element = document.createElement("img");
        element.src = image.preview; element.dataset.source = image.source;
        element.alt = "文章配图"; element.contentEditable = "false";
        insert(element);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "图片上传失败，请重新选择。"); }
    finally { setBusy(false); onBusyChange(false); }
  }
  return <div className={styles.editor}>
    <div className={styles.toolbar}>
      <label>插入图片<input type="file" multiple accept={publicationImageTypes.join(",")} disabled={busy}
        onChange={event => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; void add(files); }} /></label>
      <span>在正文中输入文字，图片会插入到光标位置。</span>
    </div>
    <div ref={editor} className={styles.canvas} contentEditable suppressContentEditableWarning role="textbox" aria-label="文章正文" aria-multiline="true"
      onInput={read} onKeyUp={rememberSelection} onMouseUp={rememberSelection} onBlur={rememberSelection}
      onPaste={event => {
        event.preventDefault(); rememberSelection();
        const files = Array.from(event.clipboardData.files);
        if (files.length) void add(files);
        else insert(document.createTextNode(event.clipboardData.getData("text/plain")));
      }} />
    {busy && <p role="status">正在上传图片，请稍候…</p>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
