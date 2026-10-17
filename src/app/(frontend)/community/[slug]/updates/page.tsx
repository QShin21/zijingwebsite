import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { bySlug, cms } from "@/lib/content";
import { managesGame, formatDate } from "@/lib/rules";
import { CommunityPager, pageNumber } from "@/components/CommunityPager";
import { StaffRecruitmentNotice } from "@/components/StaffRecruitmentNotice";
import {
  CommunityEmpty,
  CommunityPageHeader,
} from "@/components/community-pages/CommunityPages";
import { ClubFrame } from "../../../_club/ClubPage";
import styles from "@/components/community-pages/CommunityPages.module.css";

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
    <ClubFrame className={`${styles.page} ${styles.body}`}>
      <CommunityPageHeader
        title="活动与通知"
        description="社群的近期安排、参与方式与日常通知。"
        action={
          managesGame(user, game.id) ? (
            <Link
              className="button light"
              href={`/community/${slug}/updates/new`}
            >
              发布活动与通知
            </Link>
          ) : undefined
        }
      />
      <p role="status">{query.message}</p>
      <StaffRecruitmentNotice />
      <div className={styles.contentWorkspace}>
        <section aria-label="社群活动与通知列表">
          <ul className={styles.readingList}>
            {entries.docs.map((post) => (
              <li className={styles.readingRow} key={post.id}>
                <div className={styles.date}>
                  <time dateTime={post.createdAt}>
                    {formatDate(post.createdAt)}
                  </time>
                  <span>
                    {post.category === "event" ? "社群活动" : "社群通知"}
                  </span>
                </div>
                <div>
                  <h2>
                    <Link href={`/community/${slug}/updates/${post.id}`}>
                      {post.title}
                    </Link>
                  </h2>
                  <p className={styles.excerpt}>{post.body}</p>
                  <Link href={`/community/${slug}/updates/${post.id}`}>
                    {post.category === "event" ? "查看活动与报名" : "阅读通知"}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
          {!entries.docs.length && (
            <CommunityEmpty title="暂无活动与通知">
              <p>
                社群的活动安排发布后会在这里展示。你也可以查看已公开的社群风采。
              </p>
              <Link href={`/community/${slug}/showcase`}>查看社群风采</Link>
            </CommunityEmpty>
          )}
          <CommunityPager
            page={page}
            pages={entries.totalPages}
            base={`/community/${slug}/updates`}
          />
        </section>
        <aside className={styles.publishAside}>
          <h2>找到一起参与的同学</h2>
          <p>联系管理员申请加入微信群，在社群里了解日常安排与交流方式。</p>
          <Link href={`/community/${slug}/join`}>联系与进群进度</Link>
        </aside>
      </div>
    </ClubFrame>
  );
}
