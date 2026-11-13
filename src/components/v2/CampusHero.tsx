import type { CSSProperties, ReactNode } from "react";
import type { ImageRef } from "@/lib/v2";
import { Img } from "./ui";
import { MotionScene } from "./CampusMotion";
import styles from "./campus.module.css";

/*
 * 像素校园 home stage. Back → front: the CMS hero image when configured, otherwise the original
 * pixel campus for the active palette (pixel-art/*.png, drawn by scripts/pixel-campus-art.mjs),
 * client-gated ambient sprites, a legibility shade, then the copy. Sprite coordinates are given
 * in source-art pixels (480×200) so they stay aligned with the drawing at every crop.
 */
const at = (x: number, y: number, extra?: Record<string, string | number>) =>
  ({ "--x": `${(x / 480) * 100}%`, "--y": `${(y / 200) * 100}%`, ...extra }) as CSSProperties;

const stars: [number, number, number][] = [
  [36, 24, 0], [88, 12, 1.2], [130, 40, 2.1], [168, 18, 0.6], [214, 46, 1.7], [300, 14, 2.6],
  [330, 34, 0.9], [382, 10, 1.4], [420, 40, 2.3], [452, 20, 0.3], [60, 58, 1.9], [150, 70, 2.8], [238, 64, 1.1],
];
const lamps = [150, 252, 356, 452];
const leaves: [number, number, number][] = [
  [186, 128, 0], [196, 132, 2.2], [466, 128, 1.1], [474, 134, 3.4], [320, 144, 1.7], [118, 136, 2.8],
];
const fireflies: [number, number, number][] = [
  [110, 150, 0], [140, 162, 1.3], [175, 140, 2.4], [205, 158, 0.7], [240, 168, 1.9], [318, 150, 2.9],
  [340, 162, 0.4], [400, 150, 1.6], [440, 166, 2.2], [465, 140, 3.1],
];

// Foreground glints: nearest depth layer, moves most with the pointer.
const sparks: [number, number, number][] = [
  [40, 176, 0], [96, 188, 1.4], [158, 180, 2.6], [226, 190, 0.8], [292, 184, 2.1], [372, 190, 1.2], [436, 182, 3],
];

function Ambience() {
  return (
    <MotionScene className={styles.ambience}>
      {stars.map(([x, y, delay]) => (
        <span key={`star-${x}`} className={styles.star} style={at(x, y, { "--delay": `${delay}s` })} />
      ))}
      {lamps.map((x, index) => (
        <span key={`lamp-${x}`} className={styles.lamp} style={at(x + 1, 148, { "--delay": `${index * 0.7}s` })} />
      ))}
      <span className={styles.screen} style={at(346, 101)} />
      {leaves.map(([x, y, delay]) => (
        <span key={`leaf-${x}-${y}`} className={styles.leaf} style={at(x, y, { "--delay": `${delay}s` })} />
      ))}
      {fireflies.map(([x, y, delay]) => (
        <span key={`fly-${x}-${y}`} className={styles.firefly} style={at(x, y, { "--delay": `${delay}s` })} />
      ))}
      <span className={styles.snow} />
      <span className={`${styles.snow} ${styles.snowNear}`} />
      <span className={styles.shootingStar} style={at(120, 18)} />
      <span className={styles.cloud} style={at(60, 30, { "--delay": "0s" })} />
      <span className={styles.cloud} style={at(300, 54, { "--delay": "-14s" })} />
      {sparks.map(([x, y, delay]) => (
        <span key={`spark-${x}`} className={styles.spark} style={at(x, y, { "--delay": `${delay}s` })} />
      ))}
    </MotionScene>
  );
}

export function CampusHero({
  label,
  heroImage,
  children,
  feature,
  side,
}: {
  label: string;
  heroImage: ImageRef | null;
  children: ReactNode;
  feature: ReactNode;
  side?: ReactNode;
}) {
  return (
    <section className={styles.hero} aria-label={label}>
      <div className={styles.window}>
        <div className={styles.scene} data-scene="" data-custom={heroImage ? "" : undefined}>
          {heroImage ? (
            <Img image={heroImage} className={styles.customImage} eager sizes="100vw" />
          ) : (
            <span className={styles.art}>
              <Ambience />
            </span>
          )}
        </div>
        <div className={styles.copyWrap}>
          <div className={styles.copy}>{children}</div>
        </div>
      </div>
      <div className={styles.dock}>
        <div className={styles.dockInner} data-side={side ? "" : undefined}>
          <div className={styles.feature}>{feature}</div>
          {side && <div className={styles.side}>{side}</div>}
        </div>
      </div>
    </section>
  );
}

export function HeroKicker({ children }: { children: ReactNode }) {
  return <p className={styles.kicker}>{children}</p>;
}
export function HeroTitle({ children }: { children: ReactNode }) {
  return <h1 className={styles.title}>{children}</h1>;
}
export function HeroLead({ children }: { children: ReactNode }) {
  return <p className={styles.lead}>{children}</p>;
}
export function HeroActions({ children }: { children: ReactNode }) {
  return <div className={styles.actions}>{children}</div>;
}
