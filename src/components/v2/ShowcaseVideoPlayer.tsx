"use client";

import { useState, useSyncExternalStore } from "react";
import type { ShowcaseCard } from "@/lib/v2";
import { Icon } from "./Icon";
import styles from "./cards.module.css";
import { useT } from "@/components/i18n/LocaleProvider";

type Video = NonNullable<ShowcaseCard["video"]>;
const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function ShowcaseVideoPlayer({ video, title }: { video: Video; title: string }) {
  const t = useT();
  const [playing, setPlaying] = useState(false);
  const hydrated = useSyncExternalStore(subscribe, clientReady, serverReady);
  if (video.kind === "link") {
    return <a className={styles.showcaseVideoControl} href={video.url} target="_blank" rel="noopener noreferrer" aria-label={t(`打开视频：${title}`, `Open video: ${title}`)}>
      <Icon name="play" size={34} />
    </a>;
  }
  if (!playing) {
    return <button className={styles.showcaseVideoControl} type="button" disabled={!hydrated} aria-label={t(`播放视频：${title}`, `Play video: ${title}`)} onClick={() => setPlaying(true)}>
      <Icon name="play" size={34} />
    </button>;
  }
  if (video.kind === "file") {
    return <video className={styles.showcaseVideoPlayer} src={video.src} autoPlay controls playsInline preload="metadata" aria-label={t(`${title}视频播放器`, `${title} video player`)} />;
  }
  const player = new URL(video.embedSrc);
  player.searchParams.set("autoplay", "1");
  player.searchParams.set("poster", "0");
  return <iframe className={styles.showcaseVideoPlayer} src={player.toString()} title={t(`${title}视频播放器`, `${title} video player`)}
    allow="autoplay; fullscreen; picture-in-picture" allowFullScreen
    sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" referrerPolicy="strict-origin-when-cross-origin" />;
}
