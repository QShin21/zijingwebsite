import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { bySlug, cms } from "@/lib/content";
import { managesGame, formatDate } from "@/lib/rules";
import { CommunityPager, pageNumber } from "@/components/CommunityPager";
import { CommunityActivityComposer } from "@/components/CommunityActivityComposer";
import { StaffRecruitmentNotice } from "@/components/StaffRecruitmentNotice";
import { EmptyState } from "@/components/activity-pages/PublicPages";
import { ClubFrame } from "../../../_club/ClubPage";
import styles from "../../../_club/ClubPages.module.css";

export default async function Updates({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; message?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const game = await bySlug("games", slug);
  if (!game) notFound();
  const p = await cms();
  const { user } = await p.auth({ headers: await headers() });
  const page = pageNumber(query.page);
  const entries = await p.find({
    collection: "community-posts",
    overrideAccess: false,
    user: null,
    depth: 0,
    where: { game: { equals: game.id } },
    sort: "-createdAt",
    limit: 10,
    page,
    select: {
      title: true,
      body: true,
      category: true,
      createdAt: true,
      authorName: true,
    },
  });
  return (
    <ClubFrame className={styles.communityBody}><section className="community-page">
      <header className={styles.subHeader}>
        <div>
          <p className={styles.kicker}>社群日程</p>
          <h2>活动与通知</h2>
          <p>查看本社群的活动安排与参与说明，找到下一次相聚的机会。</p>
        </div>
      </header>
      <p role="status">{query.message}</p>
      <StaffRecruitmentNotice />
      <ul className={styles.readingList}>
        {entries.docs.map((post) => (
          <li key={post.id}>
            <div className={styles.recordDate}>
              {formatDate(post.createdAt)}
            </div>
            <div>
              <span className={styles.status}>
                {post.category === "event" ? "社群活动" : "社群通知"}
              </span>
              <h3>
                <Link href={`/community/${slug}/updates/${post.id}`}>
                  {post.title}
                </Link>
              </h3>
              <p className="community-excerpt">{post.body}</p>
              <Link href={`/community/${slug}/updates/${post.id}`}>
                阅读全文 ↗
              </Link>
            </div>
          </li>
        ))}
      </ul>
      {!entries.docs.length && (
        <EmptyState title="暂无活动与通知">
          <p>
            社群的活动安排发布后会在这里展示。你也可以查看已公开的社群风采。
          </p>
          <Link className="button light" href={`/community/${slug}/showcase`}>
            查看社群风采
          </Link>
        </EmptyState>
      )}
      <CommunityPager
        page={page}
        pages={entries.totalPages}
        base={`/community/${slug}/updates`}
      />
      {managesGame(user, game.id) && (
        <CommunityActivityComposer game={game.id} />
      )}
    </section></ClubFrame>
  );
}
