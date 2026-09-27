import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { bySlug } from "@/lib/content";
import { PageHeading } from "@/components/PageHeading";
import { CommunityJoin } from "@/components/CommunityJoin";
import { CommunityNav } from "@/components/CommunityNav";
export default async function CommunityLayout({ params, children }: { params: Promise<{ slug: string }>; children: ReactNode }) {
  const { slug } = await params;
  const game = await bySlug("games", slug);
  if (!game) notFound();
  return <><PageHeading title={game.title} eyebrow="GAME COMMUNITY / ZIJING" description={game.summary || "社群交流、论坛讨论与游戏活动。"} parent={{ href: "/community", label: "游戏社群" }} action={<CommunityJoin slug={slug} />} /><CommunityNav slug={slug} />{children}</>;
}
