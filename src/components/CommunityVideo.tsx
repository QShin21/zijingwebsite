import styles from "./community-pages/CommunityPages.module.css";
import { communityVideo } from "@/lib/community-video";
import { getT } from "@/lib/i18n/server";
export async function CommunityVideo({ url }: { url: string }) {
  const { t } = await getT();
  const video = communityVideo(url);
  if (!video) return null;
  if (video.direct)
    return (
      <div className={styles.video}>
        <video
          src={video.url}
          controls
          playsInline
          preload="metadata"
          aria-label={t("风采视频预览", "Showcase video preview")}
        />
        <p>{t("若视频无法播放，请确认文件为 H.264/AAC 编码的 MP4。", "If the video does not play, make sure it is an H.264/AAC MP4.")}</p>
      </div>
    );
  return (
    <div className={styles.video}>
      {video.embed && (
        <>
          <iframe
            src={video.embed}
            title={t("B站视频预览", "Bilibili video preview")}
            loading="lazy"
            allow="fullscreen"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
            referrerPolicy="strict-origin-when-cross-origin"
          />
          <p>{t("如预览受视频权限或网络限制，请前往 B 站观看。", "If the preview is blocked by permissions or network limits, watch it on Bilibili.")}</p>
        </>
      )}
      <div className="video-actions">
        <a
          className="button light"
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {video.embed ? t("前往 B 站观看 ↗", "Watch on Bilibili ↗") : t("打开视频链接 ↗", "Open video link ↗")}
        </a>
      </div>
    </div>
  );
}
