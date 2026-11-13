"use client";

import { useState, useSyncExternalStore } from "react";
import type { ShowcaseCard } from "@/lib/v2";
import { Icon } from "./Icon";
import styles from "./cards.module.css";

type Video = NonNullable<ShowcaseCard["video"]>;
const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function ShowcaseVideoPlayer({ video, title }: { video: Video; title: string }) {
  const [playing, setPlaying] = useState(false);
  const hydrated = useSyncExternalStore(subscribe, clientReady, serverReady);
  if (video.kind === "link") {
    return <a className={styles.showcaseVideoControl} href={video.url} target="_blank" rel="noopener noreferrer" aria-label={`打开视频：${title}`}>
      <Icon name="play" size={34} />
    </a>;
  }
  if (!playing) {
    return <button className={styles.showcaseVideoControl} type="button" disabled={!hydrated} aria-label={`播放视频：${title}`} onClick={() => setPlaying(true)}>
      <Icon name="play" size={34} />
    </button>;
  }
  if (video.kind === "file") {
    return <video className={styles.showcaseVideoPlayer} src={video.src} autoPlay controls playsInline preload="metadata" aria-label={`${title}视频播放器`} />;
  }
  const player = new URL(video.embedSrc);
  player.searchParams.set("autoplay", "1");
  player.searchParams.set("poster", "0");
  return <iframe className={styles.showcaseVideoPlayer} src={player.toString()} title={`${title}视频播放器`}
    allow="autoplay; fullscreen; picture-in-picture" allowFullScreen
    sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" referrerPolicy="strict-origin-when-cross-origin" />;
}
