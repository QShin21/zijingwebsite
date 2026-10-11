import { communityVideo } from "@/lib/community-video";
export function CommunityVideo({ url }: { url: string }) {
  const video = communityVideo(url);
  if (!video) return null;
  if (video.direct) return <div className="community-video"><video src={video.url} controls playsInline preload="metadata" aria-label="风采视频预览" /><p>若视频无法播放，请确认文件为 H.264/AAC 编码的 MP4。</p></div>;
  return <div className="community-video">
    {video.embed && <><iframe src={video.embed} title="B站视频预览" loading="lazy" allow="fullscreen" allowFullScreen sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" referrerPolicy="strict-origin-when-cross-origin" /><p>如预览受视频权限或网络限制，请前往 B 站观看。</p></>}
    <div className="video-actions"><a className="button light" href={video.url} target="_blank" rel="noopener noreferrer">{video.embed ? "前往 B 站观看 ↗" : "打开视频链接 ↗"}</a></div>
  </div>;
}
