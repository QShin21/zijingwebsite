import { ActivitySignup } from "@/components/ActivitySignup";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { bySlug, cms } from "@/lib/content";
import { canReviewPromotion, managesGame, formatDate } from "@/lib/rules";
import { ClubFrame } from "../../../../_club/ClubPage";
import styles from "../../../../_club/ClubPages.module.css";
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
    <ClubFrame className={styles.communityBody}><article className={styles.article}>
      <nav className="signup-tools" aria-label="社群活动导航">
        <Link href={`/community/${slug}/updates`}>← 活动与通知</Link>
      </nav>
      <p className={styles.kicker}>
        {post.category === "event" ? "社群活动" : "社群通知"}
      </p>
      <h2>{post.title}</h2>
      <p className={styles.recordMeta}>
        {post.authorName} · {formatDate(post.createdAt)}
      </p>
      <p className="preserve thread-body">{post.body}</p>
      <p role="status">{(await searchParams).message}</p>
      {post.category === "event" && (
        <ActivitySignup kind="community-posts" id={post.id} />
      )}
      {(managesGame(user, game.id) || canReviewPromotion(user)) && (
        <Link
          className="button light"
          href={"/community/promotions?source=community-posts&id=" + post.id}
        >
          申请社团级展示
        </Link>
      )}
    </article></ClubFrame>
  );
}
