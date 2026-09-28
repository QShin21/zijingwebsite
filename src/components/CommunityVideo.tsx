"use client";
import { useState, useSyncExternalStore } from "react";
import { communityVideo } from "@/lib/community-video";
export function CommunityVideo({ url }: { url: string }) {
  const ready = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [preview, setPreview] = useState(false);
  const video = communityVideo(url);
  if (!video) return null;
  return <div className="community-video">
    <div className="reaction-bar"><a className="button light" href={video.url} target="_blank" rel="noopener noreferrer">{video.embed ? "前往 B 站观看 ↗" : "打开视频链接 ↗"}</a>
      {video.embed && <button className="button" disabled={!ready} onClick={() => setPreview(!preview)}>{preview ? "收起预览" : "站内预览 B 站视频"}</button>}</div>
    {preview && video.embed && <><iframe src={video.embed} title="B站视频预览" allow="fullscreen" allowFullScreen sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" referrerPolicy="strict-origin-when-cross-origin" /><p>如预览受视频权限或网络限制，请前往 B 站观看。</p></>}
  </div>;
}
