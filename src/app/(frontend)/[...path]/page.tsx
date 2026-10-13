import type { Metadata } from "next";
import type { CollectionSlug, Where } from "payload";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { bySlug, cms, fixed, list, names, site } from "@/lib/content";
import {
  Cards,
  Detail,
  Empty,
  JoinCards,
  Pagination,
  Prose,
} from "@/components/Content";
import { PageHeading } from "@/components/PageHeading";
import { Icon } from "@/components/Identity";
import { kindLabels, sectionMeta } from "@/lib/presentation";
import { safeURL } from "@/lib/rules";
import { ClubFrame } from "../_club/ClubPage";
import clubStyles from "../_club/ClubPages.module.css";
import styles from "@/components/account-pages/ReadingPages.module.css";
import {
  teamHonorQuery,
  teamHonorScopeID,
} from "@/components/TeamHonorNavigation";

type Props = {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
const collections: Record<string, CollectionSlug> = {
  events: "events",
  teams: "teams",
  honors: "honors",
  news: "news",
  gallery: "albums",
  recruitment: "recruitment",
  announcements: "announcements",
};
const titles: Record<string, string> = {
  about: "关于我们",
  contact: "联系与合作",
  privacy: "隐私说明",
  join: "加入紫荆",
  ...kindLabels,
};
const descriptions: Record<string, string> = {
  about: "了解紫荆，找到与你并肩的伙伴。",
  contact: "活动咨询、社团交流与合作，欢迎与我们联系。",
  join: "一起玩，认真赢。找到适合你的参与方式。",
  members: "寻找同好，参与社团生活。查看本轮招新与加入渠道。",
  teams: "了解各游戏项目的选拔要求、时间安排和报名方式。",
  staff: "让想法变成现场。了解岗位职责，一起创造社团的下一次精彩。",
};
async function resolveDetail(collection: CollectionSlug, path: string[]) {
  const doc = await bySlug(collection, path[1]);
  if (doc) return doc;
  const redirects = await (
    await cms()
  ).find({
    collection: "redirects",
    overrideAccess: false,
    user: null,
    depth: 0,
    where: { from: { equals: `/${path.join("/")}` } },
    limit: 1,
  });
  if (redirects.docs[0]) permanentRedirect(redirects.docs[0].to);
  notFound();
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { path } = await params;
  const c = collections[path[0]];
  const valid =
    (c && path.length <= 2) ||
    (path.length === 1 &&
      ["about", "contact", "privacy", "join"].includes(path[0])) ||
    (path[0] === "join" &&
      path.length === 2 &&
      ["members", "teams", "staff"].includes(path[1]));
  if (!valid) notFound();
  const doc = c && path.length === 2 ? await resolveDetail(c, path) : undefined;
  const title =
    doc?.seoTitle ||
    doc?.title ||
    (path[0] === "join"
      ? titles[path[1] || "join"]
      : c === "teams" && path.length === 1
        ? "代表队与荣誉"
        : names[c] || titles[path[0]]) ||
    "页面未找到";
  return {
    title,
    description: doc?.seoDescription || doc?.summary,
    alternates: { canonical: `/${path.join("/")}` },
    openGraph: { title, description: doc?.summary, url: `/${path.join("/")}` },
  };
}
export default async function Page({ params, searchParams }: Props) {
  const { path } = await params;
  const search = await searchParams;
  const page = Math.floor(
    Math.max(1, Math.min(10000, Number(search.page) || 1)),
  );
  const c = collections[path[0]];
  if (c === "honors" && path.length === 1) {
    const team = search.team ? teamHonorScopeID(search.team) : undefined;
    const game = search.game ? teamHonorScopeID(search.game) : undefined;
    if (team === null || game === null) notFound();
    const query = teamHonorQuery({
      view:
        search.view === "mine" || search.view === "review"
          ? search.view
          : "public",
      page,
      team,
      game,
    });
    permanentRedirect("/teams/honors" + (query ? "?" + query : ""));
  }
  if (c && path.length === 2) {
    const doc = await resolveDetail(c, path);
    return (
      <ClubFrame
        active={
          c === "teams" ||
          c === "honors" ||
          (c === "recruitment" && doc.kind === "teams")
        }
        className={clubStyles.profileScope}
      >
        <Detail collection={c} doc={doc} photoPage={page} />
      </ClubFrame>
    );
  }
  if (c && path.length === 1) {
    const and: Where[] = [];
    const query: Record<string, string> = {};
    for (const field of c === "events"
      ? ["type", "game"]
      : c === "honors"
        ? ["game", "team"]
        : c === "teams"
          ? ["game"]
          : []) {
      const value = search[field];
      if (typeof value !== "string" || !value) continue;
      if (field !== "type" && !/^\d+$/.test(value)) continue;
      if (
        field === "type" &&
        !["比赛", "观赛", "交流", "训练", "其他"].includes(value)
      )
        continue;
      and.push({ [field]: { equals: value } });
      query[field] = value;
    }
    if (
      c === "honors" &&
      typeof search.year === "string" &&
      /^\d{4}$/.test(search.year) &&
      Number(search.year) >= 1900 &&
      Number(search.year) <= 2200
    ) {
      and.push(
        { date: { greater_than_equal: `${search.year}-01-01T00:00:00+08:00` } },
        {
          date: {
            less_than: `${Number(search.year) + 1}-01-01T00:00:00+08:00`,
          },
        },
      );
      query.year = search.year;
    }
    if (c === "events" && search.time === "upcoming") {
      and.push({ startAt: { greater_than_equal: new Date().toISOString() } });
      query.time = "upcoming";
    }
    if (c === "events" && search.time === "past") {
      and.push({ endAt: { less_than_equal: new Date().toISOString() } });
      query.time = "past";
    }
    const [result, games, teams] = await Promise.all([
      list(c, and.length ? { and } : {}, page),
      ["events", "teams", "honors"].includes(c)
        ? list("games", {}, 1, 100)
        : null,
      c === "honors" ? list("teams", {}, 1, 100) : null,
    ]);
    return (
      <ClubFrame active={c === "teams"} className={styles.pageBody}>
        <PageHeading
          title={c === "teams" ? "代表队与荣誉" : names[c]}
          eyebrow={`紫荆主场 · ${names[c] || "社团内容"}`}
          description={
            c === "teams"
              ? "了解代表队、查看队员简介与已批准荣誉，找到适合自己的选拔入口。"
              : sectionMeta[c]?.description
          }
        />
        {c === "teams" && (
          <nav className={styles.tabs} aria-label="代表队与荣誉">
            <Link href="/teams" aria-current="page">
              代表队档案
            </Link>
            <Link
              href={"/teams/honors" + (query.game ? "?game=" + query.game : "")}
            >
              队伍荣誉档案与投稿
            </Link>
          </nav>
        )}
        {c === "teams" && (
          <nav className={styles.toolbar} aria-label="代表队入口">
            <Link className="button" href="/teams/recruitment">
              代表队招新与我的记录
            </Link>
            <Link href="/teams/manage">代表队工作台</Link>
            <Link href="/teams/apply">申请建立代表队</Link>
          </nav>
        )}
        {games && (
          <form className={styles.filters} method="get" aria-label="筛选内容">
            <label>
              游戏项目
              <select name="game" defaultValue={query.game || ""}>
                <option value="">全部项目</option>
                {games.docs.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            </label>
            {c === "events" && (
              <>
                <label>
                  活动类型
                  <select name="type" defaultValue={query.type || ""}>
                    <option value="">全部类型</option>
                    {["比赛", "观赛", "交流", "训练", "其他"].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label>
                  时间
                  <select name="time" defaultValue={query.time || ""}>
                    <option value="">全部时间</option>
                    <option value="upcoming">即将开始</option>
                    <option value="past">历史活动</option>
                  </select>
                </label>
              </>
            )}
            {teams && (
              <>
                <label>
                  代表队
                  <select name="team" defaultValue={query.team || ""}>
                    <option value="">全部代表队</option>
                    {teams.docs.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  年份
                  <input
                    name="year"
                    type="number"
                    min="1900"
                    max="2200"
                    placeholder="全部年份"
                    defaultValue={query.year}
                  />
                </label>
              </>
            )}
            <button className="button" type="submit">
              筛选 <Icon name="arrow" />
            </button>
            <Link href={`/${path[0]}`}>重置</Link>
          </form>
        )}
        <div className={styles.resultMeta}>
          <span>
            {Object.keys(query).length ? "筛选结果" : "公开档案"} ·{" "}
            {result.totalDocs} 条
          </span>
          {Object.keys(query).length > 0 && (
            <Link href={`/${path[0]}`}>清除筛选</Link>
          )}
        </div>
        {result.docs.length ? (
          <Cards docs={result.docs} collection={c} />
        ) : Object.keys(query).length ? (
          <Empty text="没有符合当前筛选条件的内容，请调整条件或清除筛选。" />
        ) : (
          <Empty collection={c} />
        )}
        <Pagination
          page={page}
          total={result.totalPages}
          path={`/${path[0]}`}
          query={query}
        />
      </ClubFrame>
    );
  }
  if (
    path[0] === "join" &&
    path.length <= 2 &&
    (!path[1] || ["members", "teams", "staff"].includes(path[1]))
  ) {
    const [doc, batches] = await Promise.all([
      fixed(path[1] ? `join-${path[1]}` : "join"),
      path[1] ? list("recruitment", { kind: { equals: path[1] } }, page) : null,
    ]);
    return (
      <ClubFrame active={path[1] === "teams"}>
        <PageHeading
          title={titles[path[1] || "join"]}
          eyebrow="加入紫荆 · 找到你的参与方式"
          description={descriptions[path[1] || "join"]}
          parent={path[1] ? { href: "/join", label: "加入紫荆" } : undefined}
        />
        {doc && (
          <div className={styles.readingLayout}>
            <Prose doc={doc} />
          </div>
        )}
        <JoinCards selected={path[1]} />
        {(!path[1] || path[1] === "members") && (
          <section className={styles.panel}>
            <h2>联系管理员，人工加入微信群</h2>
            <p>
              网站账号用于报名与记录。选择游戏社群后，查看在任管理员名片，在微信中添加好友，再由管理员人工邀请进群。
            </p>
            <Link className="button" href="/community">
              选择游戏社群
            </Link>
          </section>
        )}
        {path[1] === "teams" && (
          <section className={styles.panel}>
            <h2>站内代表队申请</h2>
            <p>
              普通入社、骨干招新和入队申请分别处理。由本社群管理员人工审核，录取不授予管理角色。
            </p>
            <Link className="button" href="/teams/recruitment">
              查看代表队招新与我的记录
            </Link>
          </section>
        )}
        {batches && (
          <section className={styles.contentSection}>
            <p className={styles.eyebrow}>已发布招新与历史归档</p>
            <h2>招新批次与历史记录</h2>
            <Cards collection="recruitment" docs={batches.docs} />
            <Pagination
              page={page}
              total={batches.totalPages}
              path={`/join/${path[1]}`}
            />
          </section>
        )}
      </ClubFrame>
    );
  }
  if (path.length === 1 && ["about", "contact", "privacy"].includes(path[0])) {
    const [doc, settings] = await Promise.all([fixed(path[0]), site()]);
    const privacy = path[0] === "privacy";
    const contact = path[0] === "contact";
    return (
      <>
        <PageHeading
          title={doc?.title || titles[path[0]]}
          eyebrow={
            privacy
              ? "资料用途 · 展示选择 · 联系方式"
              : contact
                ? "紫荆主场 · 联系社团"
                : "紫荆主场 · 关于社团"
          }
          description={descriptions[path[0]]}
        />
        <div className={styles.readingLayout}>
          <div>
            {doc ? (
              <Prose doc={doc} />
            ) : privacy ? (
              <div className={styles.prose}>
                <h2>已确认的运营与资料安排</h2>
                <p>
                  完整隐私正文尚待通过网站发布流程公开。以下为已确认的运营信息与资料安排；提交资料前，请同时阅读具体表单中的用途与展示说明。
                </p>
                <h3>运营者与联系渠道</h3>
                <p>
                  运营者为叶佳鑫（清华大学学生紫荆电竞社社长），个人信息与隐私联系微信为
                  yejx2003。查看、更正、停止展示或删除资料，可通过此微信联系叶佳鑫；删除申请由叶佳鑫审核处理。
                </p>
                <h3>报名与本人回执</h3>
                <p>
                  活动报名保存本人账号、提交时间、填写的答案及表单快照，供本人和具备当前相应权限的管理人员查看，用于活动组织与报名处理。外部平台受理的报名，请同时阅读对应平台的隐私说明。
                </p>
                <h3>资料保留与人工处理</h3>
                <p>
                  活动、社群活动、骨干招新及代表队等报名资料的运营保留政策为 1
                  年。成员关系记录长期保留，原始报名答案、联系方式与完整申请不会因此一并适用长期保留。
                </p>
                <p>
                  当前系统尚未启用自动到期删除。超过保留期的资料需要由叶佳鑫人工复核处理，1
                  年保留政策需人工落实。撤回、关闭展示或退出登录不表示服务器资料已经删除。
                </p>
              </div>
            ) : !contact ? (
              <Empty text="社团介绍正在整理，确认后的内容会在这里发布。" />
            ) : null}
            {contact && (
              <div className={styles.contactList}>
                {settings.contacts?.length ? (
                  settings.contacts.map((entry, index) => (
                    <article key={index}>
                      <h2>{entry.label}</h2>
                      <p className="preserve">{entry.text}</p>
                      {safeURL(entry.url) && (
                        <a href={entry.url!} rel="noopener noreferrer">
                          查看联系渠道 ↗
                        </a>
                      )}
                    </article>
                  ))
                ) : (
                  <article>
                    <h2>从游戏社群联系管理员</h2>
                    <p>
                      当前尚未配置额外公共联系渠道。已有游戏社群可查看在任管理员名片，想组织新的游戏项目，可提交站内申请并查看负责人意见。
                    </p>
                    <div className={styles.toolbar}>
                      <Link href="/community">查看社群与管理员名片</Link>
                      <Link href="/community/apply">申请组织社群</Link>
                    </div>
                  </article>
                )}
                <article>
                  <h2>隐私与资料处理</h2>
                  <p>
                    运营者：叶佳鑫（清华大学学生紫荆电竞社社长）
                    <br />
                    隐私联系微信：yejx2003
                  </p>
                  <Link href="/privacy">查看隐私说明 →</Link>
                </article>
              </div>
            )}
          </div>
          <aside>
            {privacy ? (
              <>
                <h2>资料处理与联系</h2>
                <p>
                  报名资料保留政策为 1
                  年，成员关系记录长期保留。到期与删除申请均需人工处理。
                </p>
                <p>
                  隐私负责人：叶佳鑫
                  <br />
                  微信：yejx2003
                </p>
                <Link href="/account">查看本人记录 →</Link>
              </>
            ) : contact ? (
              <>
                <h2>加入游戏社群</h2>
                <p>
                  好友申请、建群和拉群由成员与管理员在微信中人工完成。网站记录帮助你查看当前进度。
                </p>
                <Link href="/community">查看游戏社群 →</Link>
              </>
            ) : (
              <>
                <h2>一起参与紫荆</h2>
                <p>关注社团活动、寻找游戏同好，或了解代表队选拔与骨干招新。</p>
                <div className={styles.toolbar}>
                  <Link href="/events">社团活动</Link>
                  <Link href="/join">加入紫荆</Link>
                </div>
              </>
            )}
          </aside>
        </div>
      </>
    );
  }
  notFound();
}
