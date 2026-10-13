import Link from "next/link";
import type { CollectionSlug, Where } from "payload";
import { site, list, names, fixed } from "@/lib/content";
import { publicHref, sectionMeta } from "@/lib/presentation";
import { Icon } from "@/components/Identity";
import { Picture, Prose } from "@/components/Content";
import {
  designBase,
  StageArt,
  SectionHeading,
  EventCard,
  EmptyState,
  DemoTag,
} from "@/components/visual-direction/DesignUI";
import { PromotedContent } from "@/components/PromotedContent";
import { StaffRecruitmentNotice } from "@/components/StaffRecruitmentNotice";
import { routeFor } from "@/lib/rules";
const defaults = [
  "events",
  "teams",
  "honors",
  "join",
  "news",
  "albums",
  "about",
];
export async function FieldHome({
  preview = false,
}: { preview?: boolean } = {}) {
  const s = await site(),
    games = await list("games", {}, 1, 4),
    seen = new Set<string>();
  const modules = (
    s.modules?.length
      ? s.modules
      : defaults.map((kind) => ({ kind, enabled: true, title: undefined }))
  ).filter((m) => {
    if (
      !m.enabled ||
      seen.has(m.kind) ||
      ![...Object.keys(sectionMeta), "join", "about"].includes(m.kind)
    )
      return false;
    seen.add(m.kind);
    return true;
  });
  const heroTitle = s.heroTitle || "为热爱，一起上场。",
    hero = heroTitle.split(/[，,]/),
    heroSeparator = heroTitle.match(/[，,]/)?.[0];
  return (
    <div className="z-home">
      <section className="z-hero">
        <StageArt priority />
        {s.heroImage && (
          <div className="z-cms-hero">
            <Picture
              id={
                typeof s.heroImage === "number" ? s.heroImage : s.heroImage.id
              }
              priority
            />
          </div>
        )}
        <div className="z-hero-copy">
          <p className="z-kicker">
            <span className="z-live-dot" /> CAMPUS / PLAY / TOGETHER
          </p>
          <p className="z-hero-name">{s.name}</p>
          <h1>
            {hero[0]}
            {hero.length > 1 && (
              <>
                {heroSeparator}
                <br />
                <em>{hero.slice(1).join("，")}</em>
              </>
            )}
          </h1>
          <p className="z-hero-description">
            {s.heroSubtitle ||
              "从一场游戏，到一群伙伴。让每一次并肩，都成为值得记住的校园时光。"}
          </p>
          <div className="z-hero-actions">
            <Link
              className="z-button"
              href={publicHref(s.heroButtonURL, "/join")}
            >
              {s.heroButtonLabel || "加入紫荆"}
              <Icon name="diagonal" />
            </Link>
            <Link className="z-text-link" href="#communities">
              探索游戏社群 <Icon name="arrow" />
            </Link>
          </div>
        </div>
        <div className="z-hero-bottom">
          <span>PLAY TOGETHER. GO FURTHER.</span>
          <a href="#communities">
            向下探索 <span aria-hidden="true">↓</span>
          </a>
        </div>
        <span className="z-hero-coordinate" aria-hidden="true">
          ZIJING / FIELD 01
        </span>
      </section>
      <nav className="z-entry-strip" aria-label="参与方式">
        {[
          ["/community", "找到同好", "PLAY TOGETHER"],
          ["/events", "参与活动", "WHAT'S ON"],
          ["/teams", "代表队与荣誉", "OUR LEGACY"],
          [
            preview ? designBase + "/apply" : "/community/apply",
            "参与社群组织",
            "BUILD WITH US",
          ],
        ].map(([href, title, en], i) => (
          <Link href={href} key={href}>
            <span className="z-entry-number">0{i + 1}</span>
            <span>
              <strong>{title}</strong>
              <small>{en}</small>
            </span>
            <Icon name="diagonal" />
          </Link>
        ))}
      </nav>
      <section className="z-section" id="communities">
        <SectionHeading
          index="01"
          en="FIND YOUR PEOPLE"
          title="热爱，各有主场。"
          href="/community"
          action="所有游戏社群"
        />
        <p className="z-section-description">
          不必先成为高手。找到同频的人，下一局就有了期待。
        </p>
        <div className="z-community-rows">
          {games.docs.map((g, i) => (
            <Link
              className="z-community-row"
              href={(preview ? designBase : "") + "/community/" + g.slug}
              key={g.id}
            >
              <span className="z-row-index">0{i + 1}</span>
              <div>
                <DemoTag demo={g.demo} />
                <h3>{g.title}</h3>
                <p>{g.summary || "查看社群活动，联系管理员，认识新的伙伴。"}</p>
              </div>
              <span className="z-row-label">GAME COMMUNITY</span>
              <Icon name="diagonal" />
            </Link>
          ))}
          {!games.docs.length && (
            <EmptyState
              title="社群正在集合。"
              description="审核通过并公开的社群，会出现在这里。"
              href={preview ? designBase + "/apply" : "/community/apply"}
              action="申请参与社群组织"
            />
          )}
        </div>
      </section>
      <div className="z-promotion-scope">
        <PromotedContent kind="event" />
        <PromotedContent kind="notice" />
        <PromotedContent kind="showcase" />
        <StaffRecruitmentNotice home />
      </div>
      {await Promise.all(
        modules.map(async (m, i) => {
          const index = String(i + 2).padStart(2, "0");
          if (m.kind === "join")
            return (
              <section className="z-participation" key={m.kind}>
                <div>
                  <p className="z-kicker">{index} / MORE THAN A PLAYER</p>
                  <h2>
                    {m.title || (
                      <>
                        场上并肩，
                        <br />
                        场下共创。
                      </>
                    )}
                  </h2>
                  <p>
                    普通入社、代表队选拔、社团骨干。
                    <br />
                    每一种参与，都有自己的入口与流程。
                  </p>
                </div>
                <div className="z-participation-links">
                  {[
                    [
                      "/join/members",
                      "普通入社",
                      "联系管理员，人工加入微信社群",
                    ],
                    [
                      "/teams/recruitment",
                      "代表队选拔",
                      "查看要求，提交资料，等待人工选拔",
                    ],
                    [
                      "/join/staff",
                      "骨干招新",
                      "参与执行或宣传，创造下一次精彩",
                    ],
                  ].map(([href, title, note], j) => (
                    <Link href={href} key={href}>
                      <span>0{j + 1}</span>
                      <div>
                        <h3>{title}</h3>
                        <p>{note}</p>
                      </div>
                      <Icon name="diagonal" />
                    </Link>
                  ))}
                </div>
              </section>
            );
          if (m.kind === "about") {
            const doc = await fixed("about");
            return (
              <section className="z-section z-about" key={m.kind}>
                <SectionHeading
                  index={index}
                  en="BEYOND THE GAME"
                  title={m.title || "共同的热爱，让我们相遇。"}
                  href="/about"
                />
                {doc ? (
                  <Prose doc={doc} />
                ) : (
                  <p>
                    有人在赛场并肩，有人在幕后相助。下一段故事，从相遇开始。
                  </p>
                )}
              </section>
            );
          }
          const conditions: Where[] = [{ archived: { not_equals: true } }],
            featured =
              m.kind === "events"
                ? s.featuredEvents
                : m.kind === "honors"
                  ? s.featuredHonors
                  : null;
          if (featured?.length)
            conditions.push({
              id: {
                in: featured.map((x) => (typeof x === "number" ? x : x.id)),
              },
            });
          let result = await list(
            m.kind as CollectionSlug,
            { and: conditions },
            1,
            3,
          );
          if (!result.docs.length && featured?.length)
            result = await list(
              m.kind as CollectionSlug,
              { archived: { not_equals: true } },
              1,
              3,
            );
          return (
            <section className="z-section z-module" key={m.kind}>
              <SectionHeading
                index={index}
                en={sectionMeta[m.kind].label}
                title={
                  m.title ||
                  (m.kind === "events"
                    ? "把下一次相遇，留给现场。"
                    : names[m.kind])
                }
                href={"/" + routeFor[m.kind]}
              />
              <div className="z-event-grid">
                {result.docs.map((doc, j) => (
                  <EventCard
                    key={doc.id}
                    doc={doc}
                    index={j}
                    collection={m.kind}
                    preview={preview}
                  />
                ))}
              </div>
              {!result.docs.length && <EmptyState />}
            </section>
          );
        }),
      )}
    </div>
  );
}
