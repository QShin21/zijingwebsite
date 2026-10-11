"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function CommunityNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  return <nav className="community-tabs" aria-label="社群分区">{[
    ["updates", "活动与通知"], ["showcase", "社群风采"],
  ].map(([path, title]) => <Link href={`/community/${slug}/${path}`} key={path}
    aria-current={pathname.startsWith(`/community/${slug}/${path}`) ? "page" : undefined}>{title}</Link>)}</nav>;
}
