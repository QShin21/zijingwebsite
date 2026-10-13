import Link from "next/link";
import { notFound } from "next/navigation";
import { bySlug, list, cms } from "@/lib/content";
import { CommunityJoin } from "@/components/CommunityJoin";
import { Icon } from "@/components/Identity";
import {
  designBase,
  StageArt,
  SectionHeading,
  EventCard,
  EmptyState,
  DemoTag,
} from "@/components/visual-direction/DesignUI";
export default async function CommunityDirection({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params,
    game = await bySlug("games", slug);
  if (!game) notFound();
  const events = await list(
    "events",
    {
      and: [{ game: { equals: game.id } }, { archived: { not_equals: true } }],
    },
    1,
    3,
  );
  const posts = await (
    await cms()
  ).find({
    collection: "community-posts",
    overrideAccess: false,
    user: null,
    draft: false,
    depth: 0,
    where: { game: { equals: game.id } },
    select: { title: true, category: true, body: true, createdAt: true },
    sort: "-createdAt",
    limit: 3,
  });
  return (
    <div className="z-community">
      <section className="z-community-hero">
        <StageArt priority />
        <div className="z-community-title">
          <Link className="z-back" href={designBase}>
            紫荆 / 游戏社群 <Icon name="arrow" />
          </Link>
          <p className="z-kicker">YOUR PEOPLE. YOUR PLAY.</p>
          <DemoTag demo={game.demo} />
          <h1>{game.title}</h1>
          <p>
            {game.summary || "认识同好，记录精彩。这里是属于你的游戏主场。"}
          </p>
          <CommunityJoin slug={slug} />
        </div>
        <span className="z-community-word" aria-hidden="true">
          PLAY
          <br />
          AS ONE.
        </span>
      </section>
      <nav className="z-community-tabs" aria-label="社群内容">
        <a href="#community-updates" aria-current="page">
          活动与通知
        </a>
        <Link href={"/community/" + slug + "/showcase"}>社群风采</Link>
        <Link href={"/community/" + slug + "/join"}>我的进群进度</Link>
        <Link href="/teams/recruitment">
          代表队招新 <Icon name="diagonal" />
        </Link>
      </nav>
      <div className="z-community-body">
        <section id="community-updates">
          <SectionHeading
            index="01"
            en="GATHER. PLAY. CONNECT."
            title="下一次并肩，见。"
            href={"/community/" + slug + "/updates"}
            action="社群活动与通知"
          />
          <div className="z-event-grid">
            {events.docs.map((doc, i) => (
              <EventCard key={doc.id} doc={doc} index={i} />
            ))}
          </div>
          {!events.docs.length && (
            <EmptyState
              title="新的活动，正在准备。"
              description="公开活动发布后会出现在这里，你也可以先联系管理员认识同好。"
            />
          )}
          <div className="z-notice-list">
            {posts.docs.map((post) => (
              <Link
                href={"/community/" + slug + "/updates/" + post.id}
                key={post.id}
              >
                <span>{post.category === "event" ? "社群活动" : "通知"}</span>
                <strong>{post.title}</strong>
                <Icon name="arrow" />
              </Link>
            ))}
          </div>
        </section>
        <aside className="z-community-aside">
          <p className="z-kicker">FIRST THINGS FIRST</p>
          <h2>
            一起玩，
            <br />
            从认识开始。
          </h2>
          <ol className="z-step-list">
            <li>
              <span>01</span>
              <div>
                <strong>联系管理员</strong>
                <p>登录后查看在任管理员已授权的微信名片。</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>在微信添加好友</strong>
                <p>主动发送好友申请，说明昵称和游戏项目。</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>等待人工拉群与确认</strong>
                <p>扫码、记录意向或网站申请批准，都不代表已进入微信群。</p>
              </div>
            </li>
          </ol>
          <Link className="z-text-link" href={"/community/" + slug + "/join"}>
            查看我的进群进度 <Icon name="diagonal" />
          </Link>
          <div className="z-aside-divider" />
          <p className="z-kicker">BUILD WITH US</p>
          <h3>把热爱组织起来。</h3>
          <p>想参与组织已有社群或发起新游戏项目？从一份管理员申请开始。</p>
          <Link className="z-button z-outline" href={designBase + "/apply"}>
            申请成为社群管理员 <Icon name="diagonal" />
          </Link>
        </aside>
      </div>
    </div>
  );
}
