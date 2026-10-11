"use client";
import { useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { submitShowcaseAction } from "@/app/(frontend)/community/actions";
export function ShowcaseForm({ game, manager }: { game: number; manager: boolean }) {
  const ready = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const router = useRouter();
  return <details className="panel showcase-compose"><summary>分享社群风采</summary><p>记录活动、分享照片或精彩视频。仅标题必填，其余选填。{manager ? "你可以直接发布。" : "投稿通过本社群管理员审核后公开。"}</p>
    <form ref={form} className="member-form" onSubmit={async event => {
      event.preventDefault(); if (pending) return;
      const data = new FormData(event.currentTarget); const files = data.getAll("images").filter(f => f instanceof File && f.size) as File[];
      if (files.length > 6 || files.some(f => f.size > 2 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(f.type))) { setFeedback("最多上传 6 张照片，每张 2 MB 以内，支持 PNG、JPEG、WebP。"); return; }
      const video = data.get('video'); const videoFile = video instanceof File && video.size ? video : null;
      if (videoFile && String(data.get('videoURL') || '').trim()) { setFeedback('上传视频与视频链接请选择一种。'); return; }
      if ((videoFile?.size || 0) > 10 * 1024 * 1024 || files.reduce((sum, file) => sum + file.size, videoFile?.size || 0) > 12 * 1024 * 1024) { setFeedback('视频不超过 10 MB，图片与视频合计不超过 12 MB。'); return; }
      setPending(true); setFeedback("");
      try {
        const result = await submitShowcaseAction(data);
        if (result.error) setFeedback(result.error);
        else { form.current?.reset(); setFeedback(manager ? "风采已发布。" : "投稿已提交，请在“我的投稿”查看审核状态。"); router.refresh(); }
      } catch { setFeedback("提交状态未确认，请先查看我的投稿。已填写内容保留，可稍后重试。"); }
      finally { setPending(false); }
    }}>
      <input type="hidden" name="game" value={game} />
      <label>标题<input name="title" required maxLength={120} /></label>
      <label>精彩记录<textarea name="body" maxLength={5000} rows={6} placeholder="发生了什么？有哪些值得记住的瞬间？" /></label>
      <label>活动照片（最多 6 张，每张 2 MB）<input name="images" type="file" accept="image/png,image/jpeg,image/webp" multiple /></label>
      <label>照片说明<input name="caption" maxLength={200} placeholder="简要说明照片中的活动" /></label>
      <label>视频链接或 B 站嵌入代码（选填）<textarea name="videoURL" maxLength={2000} rows={3} placeholder="粘贴 B 站分享中的嵌入代码、完整视频链接，或 HTTPS MP4 直链" /></label>
      <label>上传 MP4 视频（选填，10 MB 以内）<input name="video" type="file" accept="video/mp4,.mp4" /></label>
      <small>B 站链接或嵌入代码支持网页内预览。上传的 MP4 可在网页和小程序内播放，请使用 H.264 视频／AAC 音频编码。视频文件与链接二选一，图片和视频合计不超过 12 MB。</small>
      <p role="status">{feedback}</p><button className="button" disabled={pending || !ready}>{pending ? "正在提交…" : manager ? "发布风采" : "提交审核"}</button>
    </form>
  </details>;
}
