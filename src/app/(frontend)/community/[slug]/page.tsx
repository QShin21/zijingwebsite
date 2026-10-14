import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Identity";
import { CommunityContactCards } from "@/components/CommunityJoin";
import {
  CommunityEmpty,
  CommunitySectionHeading,
} from "@/components/community-pages/CommunityPages";
import { Prose } from "@/components/Content";
import { bySlug, cms } from "@/lib/content";
import { canParticipate, formatDate } from "@/lib/rules";
import { communityContacts } from "@/lib/community-contacts";
import { ClubFrame } from "../../_club/ClubPage";
import styles from "@/components/community-pages/CommunityPages.module.css";

export default async function CommunityHome({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const game = await bySlug("games", slug);
  if (!game) notFound();
  const p = await cms();
  const { user } = await p.auth({ headers: await headers() });
  const [contacts, recent] = await Promise.all([
    canParticipate(user) ? communityContacts(slug) : Promise.resolve([]),
    p.find({
      collection: "community-posts",
      overrideAccess: false,
      user: null,
      depth: 0,
      where: { game: { equals: game.id } },
      sort: "-createdAt",
      limit: 3,
      select: { title: true, category: true, createdAt: true },
    }),
  ]);
  return (
    <ClubFrame className={`${styles.page} ${styles.body}`}>
      <div className={styles.homeGrid}>
        <header className={styles.homeIntro}>
          <h1>{game.title}</h1>
          <p>
            {game.summary ||
              "从日常交流到一起参赛，在这里了解社群的活动与共同经历。"}
          </p>
          {game.demo && <p className="demo-label">演示资料，非真实社团记录</p>}
        </header>
        <aside
          id="community-contacts"
          className={styles.contactAside}
          aria-labelledby="community-contacts-title"
        >
          <h2 id="community-contacts-title">
            联系管理员，
            <br />
            申请加入微信群
          </h2>
          <p>
            保存微信名片，在微信中识别并加好友，备注昵称和“{game.title}
            ”。由管理员回复并人工拉群。
          </p>
          {contacts?.length ? (
            <CommunityContactCards contacts={contacts} />
          ) : (
            <CommunityEmpty title="管理员名片暂不可用">
              <p>当前没有可展示的在任管理员名片，请稍后再来。</p>
              <Link href="/community/apply">申请参与社群组织</Link>
            </CommunityEmpty>
          )}
          <div className={styles.note}>
            <h3>已经联系管理员？</h3>
            <p>网站记录加入意向与人工处理进度，保存名片不会自动进群。</p>
            <Link href={`/community/${slug}/join`}>查看我的进群进度</Link>
          </div>
        </aside>
        <div className={styles.homeContent}>
          <section aria-labelledby="community-recent-title">
            <CommunitySectionHeading
              title="社群近况"
              id="community-recent-title"
            >
              <Link href={`/community/${slug}/updates`}>全部活动与通知</Link>
            </CommunitySectionHeading>
            {recent.docs.length ? (
              <ul className={styles.readingList}>
                {recent.docs.map((post) => (
                  <li className={styles.readingRow} key={post.id}>
                    <div className={styles.date}>
                      <time dateTime={post.createdAt}>
                        {formatDate(post.createdAt)}
                      </time>
                      <span>
                        {post.category === "event" ? "社群活动" : "社群通知"}
                      </span>
                    </div>
                    <h3>
                      <Link href={`/community/${slug}/updates/${post.id}`}>
                        {post.title}
                      </Link>
                    </h3>
                  </li>
                ))}
              </ul>
            ) : (
              <CommunityEmpty title="还没有新的活动与通知">
                <p>
                  管理员发布安排后，会在这里展示。你可以先联系管理员了解社群。
                </p>
              </CommunityEmpty>
            )}
          </section>
          {game.body && (
            <section
              className={styles.section}
              aria-labelledby="community-about-title"
            >
              <CommunitySectionHeading
                title="认识这个社群"
                id="community-about-title"
              />
              <Prose doc={game} />
            </section>
          )}
          <div className={styles.destinations}>
            <Link
              className={styles.destination}
              href={`/community/${slug}/showcase`}
            >
              <div>
                <h2>一起留下的记录</h2>
                <p>活动照片、精彩集锦和社群风采。</p>
              </div>
              <Icon name="arrow" />
            </Link>
            <Link
              className={styles.destination}
              href={`/teams?game=${game.id}`}
            >
              <div>
                <h2>代表队与荣誉</h2>
                <p>了解本游戏的队伍、公开招新和已核验成绩。</p>
              </div>
              <Icon name="arrow" />
            </Link>
          </div>
        </div>
      </div>
    </ClubFrame>
  );
}
