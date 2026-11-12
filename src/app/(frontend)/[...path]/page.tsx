import type { Metadata } from "next";
import type { CollectionSlug } from "payload";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { bySlug, cms, list } from "@/lib/content";
import { getArticle, getFeed, getFixedPage, getRecruitmentCenter, type FixedPageKey } from "@/lib/v2";
import { Detail } from "@/components/Content";
import { teamHonorQuery, teamHonorScopeID } from "@/components/TeamHonorNavigation";
import { pageNumber, read, request, single, type Search } from "@/components/v2/data";
import { ArticleView, FeedView, feedKinds, type FeedKind } from "@/components/v2/Feed";
import { RecruitmentTile } from "@/components/v2/cards";
import { RichText, Sections } from "@/components/v2/RichText";
import { ButtonLink, EmptyState, KeyValues, LinkTabs, PageHero, Pager, Section, Wrap } from "@/components/v2/ui";
import { joinPaths } from "@/components/v2/copy";
import { formatDate } from "@/components/v2/format";
import layout from "@/components/v2/layout.module.css";
import styles from "./fixed.module.css";

type Props = { params: Promise<{ path: string[] }>; searchParams: Search };
const legacyCollections: Record<string, CollectionSlug> = { honors: "honors", recruitment: "recruitment" };
const fixedKeys: Record<string, FixedPageKey> = { about: "about", contact: "contact", privacy: "privacy" };
const joinKeys: Record<string, FixedPageKey> = { "": "join", members: "join-members", teams: "join-teams" };

function route(path: string[]) {
  if (path[0] === "news" && path.length <= 2) return path.length === 1 ? "news" : "newsDetail";
  if (legacyCollections[path[0]] && path.length <= 2) return path.length === 1 ? "legacyList" : "legacyDetail";
  if (path.length === 1 && fixedKeys[path[0]]) return "fixed";
  if (path[0] === "join" && path.length <= 2 && (path.length === 1 || path[1] === "members" || path[1] === "teams")) return "join";
  return null;
}

async function resolveLegacy(collection: CollectionSlug, path: string[]) {
  const doc = await bySlug(collection, path[1]);
  if (doc) return doc;
  const redirects = await (await cms()).find({
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
  const kind = route(path);
  if (!kind) notFound();
  const url = `/${path.join("/")}`;
  if (kind === "newsDetail") {
    const { article } = await read(getArticle, { kind: "news", idOrSlug: path[1] }, url, { redirects: true });
    return { title: article.title, description: article.summary ?? undefined, alternates: { canonical: url } };
  }
  if (kind === "legacyDetail") {
    const doc = await resolveLegacy(legacyCollections[path[0]], path);
    return { title: doc.seoTitle || doc.title, description: doc.seoDescription || doc.summary, alternates: { canonical: url } };
  }
  const titles: Record<string, string> = { news: "动态", about: "关于紫荆", contact: "联系与合作", privacy: "隐私说明", join: "加入紫荆", members: "加入游戏社群", teams: "代表队选拔" };
  return { title: titles[path[1] ?? path[0]] ?? "紫荆", alternates: { canonical: url } };
}

function FixedNav({ current }: { current: string }) {
  return (
    <LinkTabs
      label="关于紫荆"
      items={[
        { href: "/about", label: "关于我们", current: current === "about" },
        { href: "/contact", label: "联系与合作", current: current === "contact" },
        { href: "/privacy", label: "隐私说明", current: current === "privacy" },
        { href: "/join", label: "加入紫荆", current: current === "join" },
      ]}
    />
  );
}

function PrivacyFallback() {
  return (
    <div className={styles.fallback}>
      <h2>已确认的运营与资料安排</h2>
      <p>完整隐私正文尚待通过网站发布流程公开。以下为已确认的运营信息与资料安排；提交资料前，请同时阅读具体表单中的用途与展示说明。</p>
      <h3>运营者与联系渠道</h3>
      <p>
        运营者为叶佳鑫（清华大学学生紫荆电竞社社长），个人信息与隐私联系微信为 yejx2003。查看、更正、停止展示或删除资料，可通过此微信联系叶佳鑫；删除申请由叶佳鑫审核处理。
      </p>
      <h3>报名与本人回执</h3>
      <p>
        活动报名保存本人账号、提交时间、填写的答案及表单快照，供本人和具备当前相应权限的管理人员查看，用于活动组织与报名处理。外部平台受理的报名，请同时阅读对应平台的隐私说明。
      </p>
      <h3>资料保留与人工处理</h3>
      <p>
        活动、社群活动、骨干招新及代表队等报名资料的运营保留政策为 1 年。成员关系记录长期保留，原始报名答案、联系方式与完整申请不会因此一并适用长期保留。
      </p>
      <p>
        当前系统尚未启用自动到期删除。超过保留期的资料需要由叶佳鑫人工复核处理，1 年保留政策需人工落实。撤回、关闭展示或退出登录不表示服务器资料已经删除。
      </p>
    </div>
  );
}

async function FixedPageView({ name }: { name: string }) {
  const page = await read(getFixedPage, { key: fixedKeys[name] }, `/${name}`);
  const privacy = name === "privacy",
    contact = name === "contact";
  return (
    <>
      <PageHero
        tone="stage"
        title={page.title}
        description={
          privacy ? "资料的用途、展示范围与保留期限" : undefined
        }
        meta={page.updatedAt ? <span>更新于 {formatDate(page.updatedAt)}</span> : undefined}
      />
      <Wrap className={layout.pageBody}>
        <FixedNav current={name} />
        <div className={layout.sidebarLayout}>
          <article className={styles.article}>
            {privacy && (
              <section className={styles.retention} aria-label="已确认的资料保留安排">
                <KeyValues
                  items={[
                    { label: "报名资料保留", value: "1 年" },
                    { label: "成员关系记录", value: "长期保留" },
                    { label: "资料删除申请", value: "联系负责人，人工处理" },
                  ]}
                />
              </section>
            )}
            {page.body ? (
              <RichText body={page.body} />
            ) : privacy ? (
              <PrivacyFallback />
            ) : !contact ? (
              <EmptyState title="内容整理中">社团介绍正在整理，确认后的内容会在这里发布。</EmptyState>
            ) : null}
            <Sections sections={page.sections} />
            {contact && (
              <div className={styles.contacts}>
                {page.contacts?.length ? (
                  page.contacts.map((entry, index) => (
                    <article key={index} className={layout.panel}>
                      <h2>{entry.label}</h2>
                      <p className="preserve">{entry.text}</p>
                      {entry.url && (
                        <a href={entry.url} rel="noopener noreferrer" className="text-link">
                          查看联系渠道 ↗
                        </a>
                      )}
                    </article>
                  ))
                ) : (
                  <article className={layout.panel}>
                    <h2>从游戏社群联系管理员</h2>
                    <p>当前尚未配置额外公共联系渠道。已有游戏社群可查看在任管理员名片，想组织新的游戏项目，可提交站内申请并查看负责人意见。</p>
                    <p className={styles.links}>
                      <Link href="/community">查看社群与管理员名片</Link>
                      <Link href="/community/apply">申请组织社群</Link>
                    </p>
                  </article>
                )}
                <article className={layout.panel}>
                  <h2>隐私与资料处理</h2>
                  <p>
                    运营者：叶佳鑫（清华大学学生紫荆电竞社社长）
                    <br />
                    隐私联系微信：yejx2003
                  </p>
                  <Link href="/privacy" className="text-link">
                    查看隐私说明 →
                  </Link>
                </article>
              </div>
            )}
          </article>
          <aside className={`${layout.panel} ${layout.sticky} ${styles.aside}`}>
            {page.sections.length > 0 && (
              <nav aria-label="本页目录" className={styles.toc}>
                <h2>本页内容</h2>
                {page.sections.map((section) => (
                  <a key={section.id} href={`#section-${section.id}`}>
                    {section.heading}
                  </a>
                ))}
              </nav>
            )}
            {privacy ? (
              <>
                <h2>资料处理与联系</h2>
                <p>报名资料保留政策为 1 年，成员关系记录长期保留。到期与删除申请均需人工处理。</p>
                <p>
                  隐私负责人：叶佳鑫
                  <br />
                  微信：yejx2003
                </p>
                <Link href="/account" className="text-link">
                  查看本人记录 →
                </Link>
              </>
            ) : contact ? (
              <>
                <h2>加入游戏社群</h2>
                <p>好友申请、建群和拉群由成员与管理员在微信中人工完成。网站记录帮助你查看当前进度。</p>
                <Link href="/community" className="text-link">
                  查看游戏社群 →
                </Link>
              </>
            ) : (
              <>
                <h2>一起参与紫荆</h2>
                <p>关注社团活动、寻找游戏同好，或了解代表队选拔与骨干招新。</p>
                <p className={styles.links}>
                  <Link href="/events">日程</Link>
                  <Link href="/join">加入紫荆</Link>
                </p>
              </>
            )}
          </aside>
        </div>
      </Wrap>
    </>
  );
}

async function JoinView({ sub, page }: { sub: string; page: number }) {
  const key = joinKeys[sub];
  const path = sub ? `/join/${sub}` : "/join";
  const [doc, center, legacy] = await Promise.all([
    read(getFixedPage, { key }, path),
    sub ? null : read(getRecruitmentCenter, {}, path),
    sub ? list("recruitment", { kind: { equals: sub } }, page) : null,
  ]);
  const { user } = await request();
  const selected = joinPaths.find((entry) => entry.key === sub);
  return (
    <>
      <PageHero
        tone="stage"
        title={selected ? selected.title : "加入紫荆"}
        back={sub ? { href: "/join", label: "加入紫荆" } : undefined}
        actions={
          user ? undefined : (
            <ButtonLink href={`/register?returnTo=${encodeURIComponent(path)}`} tone="accent" icon="arrow">
              注册账号
            </ButtonLink>
          )
        }
      />
      <Wrap className={layout.pageBody}>
        <ol className={styles.paths}>
          {joinPaths.map((entry, index) => {
            const open = center ? (entry.key === "staff" ? center.staff.filter((call) => call.state === "open") : entry.key === "teams" ? (center.teams?.docs ?? []).filter((call) => call.state === "open") : []) : [];
            return (
              <li key={entry.key} className={styles.path} aria-current={entry.key === sub ? "true" : undefined}>
                <span className={styles.pathIndex}>{String(index + 1).padStart(2, "0")}</span>
                <h2>{entry.title}</h2>
                <p>{entry.body}</p>
                <p className={styles.pathSteps}>{entry.steps.join(" → ")}</p>
                {center && entry.key !== "members" && (
                  <div className={styles.pathOpen}>
                    {open.length ? (
                      open.slice(0, 2).map((call) => <RecruitmentTile key={call.key} call={call} />)
                    ) : (
                      <p className={styles.muted}>当前没有开放批次，可先浏览社群与活动。</p>
                    )}
                  </div>
                )}
                <ButtonLink href={entry.href} tone={entry.key === sub ? "accent" : "ghost"} size="small" icon="arrow">
                  {entry.action}
                </ButtonLink>
              </li>
            );
          })}
        </ol>
        {(doc.body || doc.sections.length > 0) && (
          <Section id="join-faq" title="常见问题">
            <RichText body={doc.body} />
            <Sections sections={doc.sections} />
          </Section>
        )}
        {legacy && legacy.docs.length > 0 && (
          <Section id="join-archive" title="往期招新记录">
            <ul className={styles.archive}>
              {legacy.docs.map((item) => (
                <li key={item.id}>
                  <Link href={`/recruitment/${item.slug}`}>{item.title}</Link>
                  {item.summary && <p>{item.summary}</p>}
                </li>
              ))}
            </ul>
            <Pager page={page} totalPages={legacy.totalPages} path={path} />
          </Section>
        )}
      </Wrap>
    </>
  );
}

async function NewsView({ search }: { search: Awaited<Search> }) {
  const raw = single(search.kind);
  const kind: FeedKind = feedKinds.some((entry) => entry.kind === raw) ? (raw as FeedKind) : "all";
  const page = pageNumber(search.page);
  const result = await read(getFeed, { kind, page, limit: 18 }, "/news");
  return (
    <FeedView
      title="动态"
      kind={kind}
      result={result}
      signedIn
      basePath="/news"
      query={{ kind: kind === "all" ? undefined : kind }}
    />
  );
}

export default async function CatchAll({ params, searchParams }: Props) {
  const { path } = await params;
  const search = await searchParams;
  const kind = route(path);
  const page = pageNumber(search.page);
  if (kind === "news") return <NewsView search={search} />;
  if (kind === "newsDetail")
    return <ArticleView detail={await read(getArticle, { kind: "news", idOrSlug: path[1] }, `/${path.join("/")}`, { redirects: true })} />;
  if (kind === "legacyList") {
    if (path[0] === "honors") {
      const team = search.team ? teamHonorScopeID(search.team) : undefined;
      const game = search.game ? teamHonorScopeID(search.game) : undefined;
      if (team === null || game === null) notFound();
      const view = search.view === "mine" || search.view === "review" ? search.view : "public";
      const query = teamHonorQuery({ view, page, team, game });
      permanentRedirect("/teams/honors" + (query ? "?" + query : ""));
    }
    permanentRedirect("/teams/recruitment");
  }
  if (kind === "legacyDetail") {
    const collection = legacyCollections[path[0]];
    const doc = await resolveLegacy(collection, path);
    // Detail renders the V2 stage hero and body container itself.
    return <Detail collection={collection} doc={doc} photoPage={page} />;
  }
  if (kind === "fixed") return <FixedPageView name={path[0]} />;
  if (kind === "join") return <JoinView sub={path[1] ?? ""} page={page} />;
  notFound();
}
