import styles from "./arena.module.css";

/**
 * 黑曜竞技场 · original brand illustration (vector, no photos, no people, no real event marks).
 * Two compositions share one visual language:
 * - Landscape (≥641px): perspective floor right of centre, two brushed-metal monoliths framing a
 *   floating brand plate (our own 紫荆 Z mark, not a school emblem), light shafts, left text veil.
 * - Portrait (≤640px): its own viewBox so nothing is cropped on phones — floor and one monolith in
 *   the lower right, a small complete plate resting above the floor, shafts from the upper right
 *   and a top-down veil for the stacked copy. The desktop translate/positions are not reused.
 * Each SVG owns its gradient ids (a display:none SVG cannot serve paint to the other).
 * Motion is CSS-only (shaft sway, scan arc, plate float) and stops under reduced motion.
 */
export function ArenaArt({ className }: { className?: string }) {
  return (
    <span className={[styles.frame, className].filter(Boolean).join(" ")} aria-hidden="true">
      <Landscape />
      <Portrait />
    </span>
  );
}

function Landscape() {
  return (
    <svg className={`${styles.art} ${styles.landscape}`} viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="za-core" cx="63%" cy="60%" r="62%">
          <stop offset="0" stopColor="#3b1848" />
          <stop offset="0.42" stopColor="#1a1029" />
          <stop offset="1" stopColor="#07060b" />
        </radialGradient>
        <linearGradient id="za-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#efd6f5" stopOpacity="0.62" />
          <stop offset="0.45" stopColor="#a356b8" stopOpacity="0.22" />
          <stop offset="1" stopColor="#660874" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="za-slab" x1="0" y1="0" x2="1" y2="0.2">
          <stop offset="0" stopColor="#2d2839" />
          <stop offset="0.5" stopColor="#14121c" />
          <stop offset="1" stopColor="#09080e" />
        </linearGradient>
        <linearGradient id="za-edge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6f1fb" />
          <stop offset="0.55" stopColor="#a49bb6" stopOpacity="0.7" />
          <stop offset="1" stopColor="#a49bb6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="za-ring" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5d4d72" stopOpacity="0.2" />
          <stop offset="0.5" stopColor="#f1eaf8" />
          <stop offset="1" stopColor="#5d4d72" stopOpacity="0.2" />
        </linearGradient>
        <radialGradient id="za-floor" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#3a1c4a" />
          <stop offset="0.7" stopColor="#120e1b" />
          <stop offset="1" stopColor="#07060b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="za-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f8e0a0" />
          <stop offset="0.5" stopColor="#d4a03c" />
          <stop offset="1" stopColor="#7d5714" />
        </linearGradient>
        <linearGradient id="za-plate" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#241b31" />
          <stop offset="1" stopColor="#0c0a12" />
        </linearGradient>
        <linearGradient id="za-veil" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#07060b" stopOpacity="0.94" />
          <stop offset="0.38" stopColor="#07060b" stopOpacity="0.62" />
          <stop offset="0.62" stopColor="#07060b" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="za-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.7" stopColor="#07060b" stopOpacity="0" />
          <stop offset="1" stopColor="#07060b" stopOpacity="0.9" />
        </linearGradient>
        <filter id="za-blur" x="-30%" y="-10%" width="160%" height="120%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
        <filter id="za-soft" x="-50%" y="-200%" width="200%" height="500%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
      </defs>

      <rect width="1600" height="900" fill="url(#za-core)" />

      {/* Tiered stands: faint arcs read as a distant stadium bowl. */}
      <g fill="none" stroke="#6a5880" strokeWidth="1.2">
        <path d="M150 455 Q1000 300 1600 430" opacity="0.32" />
        <path d="M90 505 Q1000 335 1600 480" opacity="0.26" />
        <path d="M30 560 Q1000 375 1600 535" opacity="0.2" />
        <path d="M0 615 Q1000 418 1600 590" opacity="0.14" />
      </g>
      <g fill="none" stroke="#f1eaf8" strokeWidth="2" strokeDasharray="1 22" opacity="0.18">
        <path d="M150 455 Q1000 300 1600 430" />
        <path d="M30 560 Q1000 375 1600 535" />
      </g>

      {/* Volumetric light shafts. */}
      <g className={styles.beams} filter="url(#za-blur)">
        <polygon points="985,-60 1035,-60 1215,650 815,650" fill="url(#za-beam)" opacity="0.85" />
        <polygon points="742,-60 770,-60 900,600 600,600" fill="url(#za-beam)" opacity="0.38" />
        <polygon points="1238,-60 1268,-60 1460,590 1160,590" fill="url(#za-beam)" opacity="0.34" />
      </g>

      {/* Competition floor: rings, dial ticks and a gold scan arc. */}
      <g>
        <ellipse cx="1000" cy="770" rx="660" ry="158" fill="url(#za-floor)" />
        <ellipse cx="1000" cy="770" rx="600" ry="140" fill="none" stroke="#efe7f6" strokeWidth="10" strokeDasharray="2 34" opacity="0.28" />
        <ellipse cx="1000" cy="770" rx="560" ry="128" fill="none" stroke="url(#za-ring)" strokeWidth="2" opacity="0.75" />
        <ellipse cx="1000" cy="770" rx="438" ry="98" fill="none" stroke="#a356b8" strokeWidth="1.5" opacity="0.6" />
        <ellipse cx="1000" cy="770" rx="310" ry="66" fill="none" stroke="url(#za-ring)" strokeWidth="3" opacity="0.9" />
        <ellipse cx="1000" cy="770" rx="190" ry="38" fill="#660874" opacity="0.22" />
        <ellipse className={styles.scan} cx="1000" cy="770" rx="500" ry="114" fill="none" stroke="#f0c060" strokeWidth="2.5" strokeDasharray="140 2900" strokeLinecap="round" />
        <path d="M440 770 H1560" stroke="#efe7f6" strokeWidth="1" opacity="0.12" />
      </g>

      {/* Brushed-metal monoliths with silver rim light and floor reflections. */}
      <g>
        <polygon points="628,268 712,232 728,712 644,748" fill="url(#za-slab)" />
        <polygon points="712,232 728,712 736,709 720,229" fill="url(#za-edge)" />
        <polygon points="644,748 728,712 722,830 650,860" fill="url(#za-slab)" opacity="0.2" />
        <polygon points="1292,196 1396,232 1378,744 1276,708" fill="url(#za-slab)" />
        <polygon points="1292,196 1276,708 1268,705 1284,193" fill="url(#za-edge)" opacity="0.85" />
        <polygon points="1276,708 1378,744 1372,850 1282,826" fill="url(#za-slab)" opacity="0.2" />
        <rect x="652" y="420" width="64" height="3" fill="#f0c060" opacity="0.75" transform="rotate(-24 684 421)" />
        <rect x="1300" y="380" width="72" height="3" fill="#d69be3" opacity="0.7" transform="rotate(19 1336 381)" />
      </g>

      {/* Floating brand plate: original 紫荆 Z mark in a gold-rimmed hexagon. */}
      <g transform="translate(1000 515)">
        <ellipse cx="0" cy="252" rx="150" ry="24" fill="#d69be3" opacity="0.28" filter="url(#za-soft)" />
        <g className={styles.plate}>
          <polygon points="0,-122 106,-61 106,61 0,122 -106,61 -106,-61" fill="url(#za-plate)" stroke="url(#za-gold)" strokeWidth="5" />
          <polygon points="0,-98 85,-49 85,49 0,98 -85,49 -85,-49" fill="none" stroke="#a356b8" strokeWidth="1.5" opacity="0.85" />
          <path d="M-40 -32 H36 L-38 34 H42" fill="none" stroke="#f6f1fb" strokeWidth="13" strokeLinecap="square" strokeLinejoin="miter" />
          <path d="M-40 -32 H36" stroke="#f0c060" strokeWidth="4" opacity="0.9" />
        </g>
      </g>

      {/* Legibility: left veil for copy, bottom fade into the page. */}
      <rect width="1600" height="900" fill="url(#za-veil)" />
      <rect width="1600" height="900" fill="url(#za-fade)" />
    </svg>
  );
}

/*
 * Portrait safe area: at 390×600–390×900 stages the slice keeps x≈40–860 and the bottom
 * 1100–1600 units visible, so every element below sits inside x 120–820, y 760–1560.
 */
function Portrait() {
  return (
    <svg className={`${styles.art} ${styles.portrait}`} viewBox="0 0 900 1600" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="zp-core" cx="62%" cy="80%" r="70%">
          <stop offset="0" stopColor="#3b1848" />
          <stop offset="0.45" stopColor="#1a1029" />
          <stop offset="1" stopColor="#07060b" />
        </radialGradient>
        <linearGradient id="zp-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#efd6f5" stopOpacity="0.5" />
          <stop offset="0.5" stopColor="#a356b8" stopOpacity="0.18" />
          <stop offset="1" stopColor="#660874" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="zp-slab" x1="0" y1="0" x2="1" y2="0.2">
          <stop offset="0" stopColor="#2d2839" />
          <stop offset="0.5" stopColor="#14121c" />
          <stop offset="1" stopColor="#09080e" />
        </linearGradient>
        <linearGradient id="zp-edge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6f1fb" />
          <stop offset="0.55" stopColor="#a49bb6" stopOpacity="0.7" />
          <stop offset="1" stopColor="#a49bb6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="zp-ring" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5d4d72" stopOpacity="0.2" />
          <stop offset="0.5" stopColor="#f1eaf8" />
          <stop offset="1" stopColor="#5d4d72" stopOpacity="0.2" />
        </linearGradient>
        <radialGradient id="zp-floor" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#3a1c4a" />
          <stop offset="0.7" stopColor="#120e1b" />
          <stop offset="1" stopColor="#07060b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="zp-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f8e0a0" />
          <stop offset="0.5" stopColor="#d4a03c" />
          <stop offset="1" stopColor="#7d5714" />
        </linearGradient>
        <linearGradient id="zp-plate" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#241b31" />
          <stop offset="1" stopColor="#0c0a12" />
        </linearGradient>
        <linearGradient id="zp-veil" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#07060b" stopOpacity="0.92" />
          <stop offset="0.5" stopColor="#07060b" stopOpacity="0.55" />
          <stop offset="0.72" stopColor="#07060b" stopOpacity="0" />
        </linearGradient>
        <filter id="zp-blur" x="-40%" y="-10%" width="180%" height="120%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <filter id="zp-soft" x="-50%" y="-200%" width="200%" height="500%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>

      <rect width="900" height="1600" fill="url(#zp-core)" />

      {/* Stands behind the floor. */}
      <g fill="none" stroke="#6a5880" strokeWidth="1.2">
        <path d="M-20 1010 Q560 880 920 975" opacity="0.3" />
        <path d="M-20 1080 Q560 935 920 1040" opacity="0.22" />
        <path d="M-20 1150 Q560 995 920 1110" opacity="0.15" />
      </g>

      {/* Shafts from the upper right, converging on the floor. */}
      <g className={styles.beamsPortrait} filter="url(#zp-blur)">
        <polygon points="600,-60 640,-60 760,1380 420,1380" fill="url(#zp-beam)" opacity="0.8" />
        <polygon points="380,-60 404,-60 470,1300 250,1300" fill="url(#zp-beam)" opacity="0.32" />
        <polygon points="800,-60 824,-60 900,1280 700,1280" fill="url(#zp-beam)" opacity="0.3" />
      </g>

      {/* Floor (lower right), dial ticks and gold scan arc. */}
      <g>
        <ellipse cx="560" cy="1440" rx="430" ry="104" fill="url(#zp-floor)" />
        <ellipse cx="560" cy="1440" rx="388" ry="92" fill="none" stroke="#efe7f6" strokeWidth="8" strokeDasharray="2 26" opacity="0.26" />
        <ellipse cx="560" cy="1440" rx="360" ry="84" fill="none" stroke="url(#zp-ring)" strokeWidth="2" opacity="0.75" />
        <ellipse cx="560" cy="1440" rx="270" ry="62" fill="none" stroke="#a356b8" strokeWidth="1.5" opacity="0.6" />
        <ellipse cx="560" cy="1440" rx="180" ry="40" fill="none" stroke="url(#zp-ring)" strokeWidth="2.5" opacity="0.9" />
        <ellipse className={styles.scanPortrait} cx="560" cy="1440" rx="320" ry="74" fill="none" stroke="#f0c060" strokeWidth="2.5" strokeDasharray="90 1430" strokeLinecap="round" />
      </g>

      {/* One monolith at the right edge of the floor (fully inside the safe area). */}
      <g>
        <polygon points="734,930 806,960 790,1400 718,1372" fill="url(#zp-slab)" />
        <polygon points="734,930 718,1372 711,1369 727,927" fill="url(#zp-edge)" opacity="0.85" />
        <polygon points="718,1372 790,1400 786,1490 722,1468" fill="url(#zp-slab)" opacity="0.2" />
        <rect x="740" y="1120" width="54" height="3" fill="#f0c060" opacity="0.7" transform="rotate(20 767 1121)" />
      </g>

      {/* Small complete brand plate resting above the floor (radius 64; spans x 486–634, y 1196–1324). */}
      <g transform="translate(560 1260)">
        <ellipse cx="0" cy="168" rx="96" ry="16" fill="#d69be3" opacity="0.28" filter="url(#zp-soft)" />
        <g className={styles.plate}>
          <polygon points="0,-64 56,-32 56,32 0,64 -56,32 -56,-32" fill="url(#zp-plate)" stroke="url(#zp-gold)" strokeWidth="3.5" />
          <polygon points="0,-51 45,-26 45,26 0,51 -45,26 -45,-26" fill="none" stroke="#a356b8" strokeWidth="1.2" opacity="0.85" />
          <path d="M-21 -17 H19 L-20 18 H22" fill="none" stroke="#f6f1fb" strokeWidth="7" strokeLinecap="square" strokeLinejoin="miter" />
          <path d="M-21 -17 H19" stroke="#f0c060" strokeWidth="2.2" opacity="0.9" />
        </g>
      </g>

      {/* Top-down veil keeps the stacked copy legible. */}
      <rect width="900" height="1600" fill="url(#zp-veil)" />
    </svg>
  );
}
