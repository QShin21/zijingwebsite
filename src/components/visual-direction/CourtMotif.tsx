/**
 * Original "tactics board" line drawing for the 紫荆主场 identity: court lines,
 * player marks and a Z-shaped run that echoes the interface mark. Purely
 * decorative; it carries no content and is hidden from assistive technology.
 */
export function CourtMotif({
  className = "",
  crop = false,
}: {
  className?: string;
  crop?: boolean;
}) {
  return (
    <svg
      className={`hc-court ${className}`.trim()}
      viewBox="0 0 640 400"
      preserveAspectRatio={crop ? "xMidYMid slice" : "xMidYMid meet"}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g stroke="currentColor" strokeWidth="1.5">
        <rect x="16" y="16" width="608" height="368" rx="26" />
        <path d="M320 16v368" />
        <circle cx="320" cy="200" r="58" />
        <path d="M16 116h74a84 84 0 0 1 0 168H16" />
        <path d="M624 116h-74a84 84 0 0 0 0 168h74" />
        <path d="M16 170h30v60H16M624 170h-30v60h30" />
      </g>
      <circle cx="320" cy="200" r="4" fill="currentColor" />
      <g
        className="hc-court-mark"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <circle cx="118" cy="96" r="11" />
        <circle cx="168" cy="304" r="11" />
        <circle cx="244" cy="206" r="11" />
        <path d="M424 112l18 18m0-18-18 18M498 236l18 18m0-18-18 18M404 300l18 18m0-18-18 18" />
      </g>
      <g
        className="hc-court-run"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M134 96h112L156 296h112" />
        <path d="M258 196c56-44 120-52 176-26" />
      </g>
      <path
        d="M262 288l12 8-12 8M420 160l15 10-18 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
