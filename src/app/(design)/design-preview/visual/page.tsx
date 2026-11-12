import type { ArticleCard, CommunityCard, EventCard, RecruitmentCard } from "@/lib/v2";
import { Stage, StageActions, StageKicker, StageLead, StageTitle, Ticker } from "@/components/v2/Stage";
import { ButtonLink, LinkTabs, PageHero, Section, StatusPill, Wrap } from "@/components/v2/ui";
import { CommunityTile, MatchCard, NoticeRow, RecruitmentTile } from "@/components/v2/cards";
import layout from "@/components/v2/layout.module.css";

export const metadata = { title: "V3 视觉样张（合成）", robots: { index: false, follow: false } };

/*
 * V3 黑曜竞技场 visual QA specimen. Every value below is synthetic and labeled as such;
 * nothing is read from the CMS or production. Gated by the (design) layout
 * (non-production + signed-in). Use for screenshots at 390/768/1440 in both themes.
 */
const synthetic = "合成样张";
const community = (id: number, slug: string, title: string) => ({ id, slug, title, hue: (id * 137) % 360 });
const signup = (state: EventCard["signup"]["state"], label: string): EventCard["signup"] => ({ mode: "form", state, label, opensAt: null, deadline: "2026-12-01T15:59:00.000Z", viewerSubmitted: null });
const event = (id: number, title: string, startAt: string | null, extra: Partial<EventCard> = {}): EventCard => ({
  key: `club:${id}`, ref: { type: "event", source: "club", id, slug: `synthetic-${id}` }, href: "#", title, summary: `${synthetic} · 用于检查对阵卡的层级、日期牌与报名状态。`,
  cover: null, community: null, team: null, category: "比赛", startAt, endAt: startAt ? new Date(Date.parse(startAt) + 3 * 3600000).toISOString() : null,
  location: "合成场馆 A", state: "upcoming", stateLabel: "即将开始", signup: signup("open", "报名开放"), promoted: false, demo: true, archived: false, publishedAt: null, ...extra,
});
const events: EventCard[] = [
  event(9001, "合成 · 秋季联赛半决赛", "2026-11-28T11:00:00.000Z", { promoted: true }),
  event(9002, "合成 · 新手训练营第三周", "2026-11-30T12:30:00.000Z", { category: "训练", signup: signup("notStarted", "报名未开始") }),
  event(9003, "合成 · 观赛之夜（时间待定）", null, { category: "观赛", state: "upcoming", signup: signup("closed", "报名已结束") }),
  { ...event(9004, "合成 · 社群交流赛", "2026-12-02T10:00:00.000Z"), key: "community:9004", ref: { type: "event", source: "community", id: 9004, community: "synthetic-moba" }, community: community(41, "synthetic-moba", "合成 MOBA 社群") },
];
const communities: CommunityCard[] = [
  { community: community(41, "synthetic-moba", "合成 MOBA 社群"), summary: `${synthetic} · 无封面时显示竞技场纹理与六边形徽面。`, cover: null, demo: true, counts: { upcomingEvents: 2, teams: 1, showcase: 6 }, viewer: { isOfficer: false } },
  { community: community(57, "synthetic-fps", "合成 FPS 社群"), summary: `${synthetic} · 色相随社群变化。`, cover: null, demo: true, counts: { upcomingEvents: 0, teams: 2, showcase: 3 }, viewer: { isOfficer: true } },
  { community: community(73, "synthetic-card", "合成卡牌社群"), summary: null, cover: null, demo: true, counts: { upcomingEvents: 1, teams: 0, showcase: 0 }, viewer: null },
];
const calls: RecruitmentCard[] = [
  { key: "staff:801", ref: { type: "staffBatch", id: 801 }, href: "#", kind: "staff", title: "合成 · 执行部骨干招新", summary: synthetic, team: null, community: null, opensAt: null, deadline: "2026-12-10T15:59:00.000Z", state: "open", stateLabel: "申请开放", viewerApplication: null },
  { key: "teamRecruitment:802", ref: { type: "teamRecruitment", id: 802 }, href: "#", kind: "team", title: "合成 · 代表队冬季选拔", summary: synthetic, team: null, community: community(57, "synthetic-fps", "合成 FPS 社群"), opensAt: "2026-12-05T02:00:00.000Z", deadline: null, state: "upcoming", stateLabel: "即将开放", viewerApplication: null },
];
const notices: ArticleCard[] = [
  { key: "announcement:701", kind: "announcement", ref: { type: "announcement", id: 701, slug: "synthetic-701" }, href: "#", label: "公告", title: "合成 · 场馆开放时间调整", summary: null, cover: null, community: null, publishedAt: "2026-11-10T02:00:00.000Z", promoted: false, demo: true },
  { key: "communityNotice:702", kind: "communityNotice", ref: { type: "communityNotice", id: 702, community: "synthetic-moba" }, href: "#", label: "社群通知", title: "合成 · 社群周赛分组公布", summary: null, cover: null, community: community(41, "synthetic-moba", "合成 MOBA 社群"), publishedAt: "2026-11-09T02:00:00.000Z", promoted: true, demo: true },
];

export default function VisualSpecimen() {
  return (
    <>
      <Stage
        label="V3 主场样张"
        aside={<MatchCard event={events[0]} variant="spotlight" headingLevel={2} eager />}
        ticker={<Ticker label="NEXT UP" items={events.filter((item) => item.startAt).map((item) => ({ key: item.key, text: item.title }))} />}
      >
        <StageKicker>
          <strong>MATCHDAY</strong>
          {synthetic} · 黑曜竞技场
        </StageKicker>
        <StageTitle>
          竞在<em>紫荆</em>
        </StageTitle>
        <StageLead>主视觉为原创矢量竞技场：透视赛台、金属立碑、光束与悬浮品牌徽面；生成资产就位后自动叠加，缺失时不影响构建。</StageLead>
        <StageActions>
          <ButtonLink href="#cards" tone="accent" icon="arrow">
            查看组件
          </ButtonLink>
          <ButtonLink href="#inner" tone="stage">
            内页样式
          </ButtonLink>
        </StageActions>
      </Stage>
      <Wrap className={layout.pageBody}>
        <Section id="cards" title="对阵卡与日期牌" description={synthetic}>
          <div className={layout.grid2}>
            {events.map((item) => (
              <MatchCard key={item.key} event={item} />
            ))}
          </div>
          <div className={layout.rail}>
            {events.map((item) => (
              <MatchCard key={`tile-${item.key}`} event={item} variant="tile" />
            ))}
          </div>
        </Section>
        <Section id="communities" title="社群（无封面兜底）" description={synthetic}>
          <div className={layout.communities}>
            {communities.map((card) => (
              <CommunityTile key={card.community.id} card={card} />
            ))}
          </div>
        </Section>
        <Section id="calls" title="招募与公告" description={synthetic}>
          <div className={layout.grid3}>
            {calls.map((call) => (
              <RecruitmentTile key={call.key} call={call} />
            ))}
          </div>
          <ul className={`${layout.list} ${layout.panel}`}>
            {notices.map((notice) => (
              <NoticeRow key={notice.key} article={notice} />
            ))}
          </ul>
        </Section>
      </Wrap>
      <div id="inner">
        <PageHero
          tone="stage"
          eyebrow="INNER PAGE · 内页舞台"
          title="合成 · 内页标题样张"
          description="内页使用同一竞技场环纹饰与黑曜层级，不再使用斜纹背景。"
          back={{ href: "/design-preview", label: "样张首页" }}
          meta={
            <>
              <StatusPill tone="live">进行中</StatusPill>
              <StatusPill tone="success">已录取</StatusPill>
              <StatusPill tone="warning">待补充</StatusPill>
              <StatusPill>{synthetic}</StatusPill>
            </>
          }
        />
        <Wrap className={layout.pageBody}>
          <LinkTabs
            label="样张标签"
            items={[
              { href: "#inner", label: "全部", current: true },
              { href: "#inner", label: "可报名", current: false, count: 3 },
              { href: "#inner", label: "已报名", current: false },
            ]}
          />
          <p className={layout.resultMeta}>按钮：</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <ButtonLink href="#inner">主按钮</ButtonLink>
            <ButtonLink href="#inner" tone="accent">
              强调按钮
            </ButtonLink>
            <ButtonLink href="#inner" tone="ghost">
              次按钮
            </ButtonLink>
          </div>
        </Wrap>
        <PageHero tone="stage" hue={137} eyebrow="COMMUNITY HUE · 社群色相" title="合成 MOBA 社群" description="社群内页按色相着色，保持同一层级。" />
      </div>
    </>
  );
}
