import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { bySlug } from "@/lib/content";
import Link from "next/link";
import { CommunityJoin } from "@/components/CommunityJoin";
import { CommunityNav } from "@/components/CommunityNav";
import { ClubFrame } from "../../_club/ClubPage";
import styles from "@/components/community-pages/CommunityPages.module.css";
export default async function CommunityLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: ReactNode;
}) {
  const { slug } = await params;
  const game = await bySlug("games", slug);
  if (!game) notFound();
  return (
    <>
      <ClubFrame className={`${styles.page} ${styles.shellHeader}`}>
        <div className={styles.identityBar}>
          <nav className={styles.breadcrumb} aria-label="所属社群">
            <Link href="/community">游戏社群</Link>
            <span aria-hidden="true">/</span>
            <Link href={`/community/${slug}`}>
              <strong>{game.title}</strong>
            </Link>
          </nav>
          <CommunityJoin slug={slug} />
        </div>
        <CommunityNav slug={slug} />
      </ClubFrame>
      {children}
    </>
  );
}
