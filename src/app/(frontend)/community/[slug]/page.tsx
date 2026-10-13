import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Identity";
import { CommunityContactCards } from "@/components/CommunityJoin";
import { bySlug, cms } from "@/lib/content";
import { canParticipate, formatDate } from "@/lib/rules";
import { communityContacts } from "@/lib/community-contacts";
import { ClubFrame } from "../../_club/ClubPage";
import styles from "../../_club/ClubPages.module.css";

export default async function CommunityHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = await bySlug("games", slug);
  if (!game) notFound();
  const p = await cms();
  const { user } = await p.auth({ headers: await headers() });
  const [contacts, recent] = await Promise.all([
    canParticipate(user) ? communityContacts(slug) : Promise.resolve([]),
    p.find({ collection: "community-posts", overrideAccess: false, user: null, depth: 0,
      where: { game: { equals: game.id } }, sort: "-createdAt", limit: 3,
      select: { title: true, category: true, createdAt: true } }),
  ]);
  return (
    <ClubFrame className={styles.communityBody}>
      <div className={styles.split}>
        <div>
          <section aria-labelledby="community-recent-title">
            <div className={styles.sectionHead}>
              <h2 id="community-recent-title">社群近况</h2>
              <Link className={styles.cardLink} href={`/community/${slug}/updates`}>全部活动与通知 <Icon name="arrow" /></Link>
            </div>
            {recent.docs.length ? <ul className={styles.readingList}>
              {recent.docs.map(post => <li key={post.id}>
                <small>{post.category === "event" ? "社群活动" : "社群通知"} · <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time></small>
                <h3><Link href={`/community/${slug}/updates/${post.id}`}>{post.title}</Link></h3>
              </li>)}
            </ul> : <div className="empty"><h3>还没有新的活动与通知</h3><p>管理员发布安排后，会在这里展示。</p></div>}
          </section>
          <div className={styles.destinations}>
            <Link className={styles.destination} href={`/community/${slug}/showcase`}>
              <h3>社群风采</h3>
              <p>活动照片、精彩集锦，以及代表队获批荣誉的长期档案。</p>
              <span className={styles.cardLink}>看看共同留下的记录 <Icon name="arrow" /></span>
            </Link>
            <Link className={styles.destination} href={`/teams?game=${game.id}`}>
              <h3>代表队与荣誉</h3>
              <p>了解本游戏的队伍与赛季记录，查看公开招新和已核验成绩。</p>
              <span className={styles.cardLink}>查看代表队 <Icon name="arrow" /></span>
            </Link>
          </div>
          <section className={styles.nextStep} aria-labelledby="community-join-note">
            <h3 id="community-join-note">已联系管理员？记录下一步</h3>
            <p>网站记录加入意向与管理员的人工确认。查看、保存或扫描名片均不会自动加入微信群。</p>
            <Link className={styles.cardLink} href={`/community/${slug}/join`}>查看我的进群进度 <Icon name="arrow" /></Link>
          </section>
        </div>
        <aside className={styles.aside} aria-labelledby="community-contacts-title">
          <h2 id="community-contacts-title">联系管理员</h2>
          <p>在微信中识别个人名片，添加好友时备注昵称和“{game.title}”，等待管理员回复与拉群。</p>
          {contacts?.length ? <CommunityContactCards contacts={contacts} /> : <>
            <p>暂无在任管理员的有效名片，请稍后再来。</p>
            <Link href="/community/apply">申请参与社群组织</Link>
          </>}
        </aside>
      </div>
    </ClubFrame>
  );
}
