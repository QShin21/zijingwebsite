import type { ReactNode } from "react";

export type IconName = "arrow" | "diagonal" | "calendar" | "trophy" | "team" | "target" | "layers" | "camera" | "mail" | "plus";
const paths: Record<IconName, ReactNode> = {
  arrow: <><path d="M4 12h15M13 5l7 7-7 7" /></>,
  diagonal: <><path d="M5 19 19 5M5 5h14v14" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 11h18M7 15h3m4 0h3m-10 3h3" /></>,
  trophy: <><path d="M8 3h8v7a4 4 0 0 1-8 0ZM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 2v6m-4 1h8" /></>,
  team: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v3" /></>,
  target: <><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" /><path d="M12 1v4m0 14v4M1 12h4m14 0h4" /></>,
  layers: <><path d="m12 3 10 6-10 6L2 9Zm-10 11 10 6 10-6M2 19l10 6 10-6" transform="translate(0 -2)" /></>,
  camera: <><path d="M8 5 6 8H3v12h18V8h-3l-2-3Z" /><circle cx="12" cy="14" r="4" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 6 9 7 9-7" /></>,
  plus: <><path d="M12 4v16M4 12h16" /></>,
};
export function Icon({ name = "diagonal", className = "" }: { name?: IconName; className?: string }) {
  return <svg className={`icon ${className}`} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
/** A geometric Z interface mark; not a university seal or an official club logo. */
export function BrandMark() {
  return <svg className="brand-symbol" viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M7 8h28L17 26h14l-5 6H4l18-18H2Z" fill="currentColor" /><path d="m32 22 6-6v8l-6 6Z" fill="currentColor" opacity=".45" /></svg>;
}
/** Original, lightweight vector artwork. Real CMS photography takes precedence. */
export function ArenaArt() {
  return <div className="arena-art" aria-hidden="true">
    <svg viewBox="0 0 620 560" fill="none">
      <defs>
        <linearGradient id="arena-face" x1="125" y1="115" x2="475" y2="430" gradientUnits="userSpaceOnUse"><stop stopColor="#d8c8ff" /><stop offset=".5" stopColor="#9a71ef" /><stop offset="1" stopColor="#7240d0" /></linearGradient>
        <linearGradient id="arena-side" x1="175" y1="200" x2="490" y2="470" gradientUnits="userSpaceOnUse"><stop stopColor="#6740a8" /><stop offset="1" stopColor="#382353" /></linearGradient>
        <radialGradient id="arena-halo"><stop stopColor="#8b5cf6" stopOpacity=".2" /><stop offset="1" stopColor="#8b5cf6" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse cx="320" cy="282" rx="275" ry="260" fill="url(#arena-halo)" />
      <g stroke="#777081" strokeOpacity=".23"><ellipse cx="309" cy="407" rx="253" ry="93" /><ellipse cx="309" cy="407" rx="205" ry="75" /><path d="M56 407h506M309 308v198M112 347l389 125M112 471l389-125" /><path d="M62 90v190m0 90v135M552 65v440M26 108h555M26 506h555" strokeDasharray="3 9" /></g>
      <ellipse cx="309" cy="412" rx="150" ry="45" fill="#090a0d" opacity=".7" />
      <g className="arena-monogram">
        <path d="m149 151 289-32 39 35-30 79-152 126 156-18-31 83-288 34-39-36 34-79 151-127-158 18Z" fill="url(#arena-side)" />
        <path d="m149 115 289-32-30 79-152 127 156-18-31 83-288 33 34-79 151-128-158 19Z" fill="url(#arena-face)" />
        <path d="m438 83 39 36-30 79-39-36ZM256 289l39 36 156-18-39-36Zm125 65 39 35-288 34-39-36Z" fill="#a078ed" opacity=".5" />
        <path d="m150 115 288-32M128 308l150-128M95 387l286-33" stroke="#eee5ff" strokeOpacity=".75" />
      </g>
      <g fill="#d9f99d"><path d="M497 107v16m-8-8h16" stroke="#d9f99d" strokeWidth="2" /><rect x="93" y="421" width="8" height="8" /><circle cx="553" cy="347" r="3" /></g>
      <g fill="#a7a4b2" fontFamily="monospace" fontSize="10" letterSpacing="2"><text x="33" y="62">ZIJING / FIELD NOTES</text><text x="403" y="528">PLAY TOGETHER.</text></g>
    </svg>
    <span className="arena-caption"><span className="status-dot" /> 热爱，正在连接</span>
  </div>;
}
export function Artwork({ collection }: { collection: string }) {
  const labels: Record<string, string> = { events: "PLAY", teams: "TEAM", news: "STORY", albums: "FRAME", recruitment: "JOIN" };
  return <div className={`cover-art cover-art-${collection}`} aria-hidden="true"><span className="cover-coordinate">ZIJING / ESPORTS</span><BrandMark /><strong>{labels[collection] || "ZIJING"}</strong><span className="cover-cross">+</span></div>;
}
