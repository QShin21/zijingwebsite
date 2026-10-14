import { ActivitySignup } from "@/components/ActivitySignup";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { bySlug, cms } from "@/lib/content";
import { canReviewPromotion, managesGame, formatDate } from "@/lib/rules";
import { ClubFrame } from "../../../../_club/ClubPage";
import styles from "@/components/community-pages/CommunityPages.module.css";
export default async function Update({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const { slug, id } = await params;
  const game = await bySlug("games", slug);
  if (!game || !/^\d+$/.test(id)) notFound();
  const p = await cms(),
    { user } = await p.auth({ headers: await headers() });
  const post = await p
    .findByID({
      collection: "community-posts",
      id: Number(id),
      overrideAccess: false,
      user: null,
      depth: 0,
      select: {
        game: true,
        title: true,
        body: true,
        authorName: true,
        createdAt: true,
        category: true,
      },
    })
    .catch(() => null);
  if (!post || Number(post.game) !== game.id) notFound();
  return (
    <ClubFrame className={`${styles.page} ${styles.body}`}>
      <nav className={styles.breadcrumb} aria-label="社群活动导航">
        <Link href={`/community/${slug}/updates`}>活动与通知</Link>
        <span aria-hidden="true">/</span>
        <span>{post.category === "event" ? "社群活动" : "社群通知"}</span>
      </nav>
      <header className={styles.articleHeader}>
        <h1>{post.title}</h1>
        <div className={styles.articleMeta}>
          <span>{game.title}</span>
          <span>{post.authorName}</span>
          <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time>
          <span>社群发布</span>
        </div>
      </header>
      <p role="status">{(await searchParams).message}</p>
      <div className={styles.articleGrid}>
        <article className={styles.article} aria-label="正文">
          <p className={styles.articleBody}>{post.body}</p>
        </article>
        <aside className={styles.articleAside}>
          {post.category === "event" ? (
            <>
              <h2>参与这场活动</h2>
              <p>先查看报名条件与截止信息，再填写本活动的报名问卷。</p>
              <a className="button" href="#activity-registration">
                查看活动报名
              </a>
            </>
          ) : (
            <>
              <h2>社群日常</h2>
              <p>对通知有疑问时，可联系本社群管理员。</p>
              <Link href={`/community/${slug}#community-contacts`}>
                查看联系名片
              </Link>
            </>
          )}
          {(managesGame(user, game.id) || canReviewPromotion(user)) && (
            <section className={styles.section}>
              <h2>管理展示范围</h2>
              <p>将当前内容申请展示到社团首页，报名继续使用同一活动记录。</p>
              <Link
                className="button light"
                href={
                  "/community/promotions?source=community-posts&id=" + post.id
                }
              >
                申请社团级展示
              </Link>
            </section>
          )}
        </aside>
      </div>
      {post.category === "event" && (
        <section id="activity-registration" className={styles.section}>
          <ActivitySignup kind="community-posts" id={post.id} />
        </section>
      )}
    </ClubFrame>
  );
}
