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
