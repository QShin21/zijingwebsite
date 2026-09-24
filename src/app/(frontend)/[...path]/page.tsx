import type { Metadata } from "next";
import type { CollectionSlug, Where } from "payload";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { bySlug, cms, fixed, list, names, site } from "@/lib/content";
import { Cards, Detail, Empty, JoinCards, Pagination, Prose } from "@/components/Content";
import { PageHeading } from "@/components/PageHeading";
import { Icon } from "@/components/Identity";
import { kindLabels, sectionMeta } from "@/lib/presentation";
import { safeURL } from "@/lib/rules";

type Props = { params: Promise<{ path: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
const collections: Record<string, CollectionSlug> = { events: "events", teams: "teams", honors: "honors", news: "news", gallery: "albums", recruitment: "recruitment", announcements: "announcements" };
const titles: Record<string, string> = { about: "关于我们", contact: "联系与合作", privacy: "隐私说明", join: "加入紫荆", ...kindLabels };
const descriptions: Record<string, string> = { about: "了解紫荆，找到与你并肩的伙伴。", contact: "活动咨询、社团交流与合作，欢迎与我们联系。", join: "一起玩，认真赢。找到适合你的参与方式。", members: "寻找同好，参与社团生活。查看本轮招新与加入渠道。", teams: "了解各游戏项目的选拔要求、时间安排和报名方式。", staff: "让想法变成现场。了解岗位职责，一起创造社团的下一次精彩。" };
async function resolveDetail(collection: CollectionSlug, path: string[]) {
  const doc = await bySlug(collection, path[1]);
  if (doc) return doc;
  const redirects = await (await cms()).find({ collection: "redirects", overrideAccess: false, user: null, depth: 0, where: { from: { equals: `/${path.join("/")}` } }, limit: 1 });
  if (redirects.docs[0]) permanentRedirect(redirects.docs[0].to);
  notFound();
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { path } = await params;
  const c = collections[path[0]];
  const valid = (c && path.length <= 2) || (path.length === 1 && ["about", "contact", "privacy", "join"].includes(path[0])) || (path[0] === "join" && path.length === 2 && ["members", "teams", "staff"].includes(path[1]));
  if (!valid) notFound();
  const doc = c && path.length === 2 ? await resolveDetail(c, path) : undefined;
  const title = doc?.seoTitle || doc?.title || (path[0] === "join" ? titles[path[1] || "join"] : names[c] || titles[path[0]]) || "页面未找到";
  return { title, description: doc?.seoDescription || doc?.summary, alternates: { canonical: `/${path.join("/")}` }, openGraph: { title, description: doc?.summary, url: `/${path.join("/")}` } };
}
export default async function Page({ params, searchParams }: Props) {
  const { path } = await params;
  const search = await searchParams;
  const page = Math.floor(Math.max(1, Math.min(10000, Number(search.page) || 1)));
  const c = collections[path[0]];
  if (c && path.length === 2) return <Detail collection={c} doc={await resolveDetail(c, path)} photoPage={page} />;
  if (c && path.length === 1) {
    const and: Where[] = [];
    const query: Record<string, string> = {};
    for (const field of c === "events" ? ["type", "game"] : c === "honors" ? ["game", "team"] : c === "teams" ? ["game"] : []) {
      const value = search[field];
      if (typeof value !== "string" || !value) continue;
      if (field !== "type" && !/^\d+$/.test(value)) continue;
      if (field === "type" && !["比赛", "观赛", "交流", "训练", "其他"].includes(value)) continue;
      and.push({ [field]: { equals: value } }); query[field] = value;
    }
    if (c === "honors" && typeof search.year === "string" && /^\d{4}$/.test(search.year) && Number(search.year) >= 1900 && Number(search.year) <= 2200) {
      and.push({ date: { greater_than_equal: `${search.year}-01-01T00:00:00+08:00` } }, { date: { less_than: `${Number(search.year) + 1}-01-01T00:00:00+08:00` } }); query.year = search.year;
    }
    if (c === "events" && search.time === "upcoming") { and.push({ startAt: { greater_than_equal: new Date().toISOString() } }); query.time = "upcoming"; }
    if (c === "events" && search.time === "past") { and.push({ endAt: { less_than_equal: new Date().toISOString() } }); query.time = "past"; }
    const [result, games, teams] = await Promise.all([list(c, and.length ? { and } : {}, page), ["events", "teams", "honors"].includes(c) ? list("games", {}, 1, 100) : null, c === "honors" ? list("teams", {}, 1, 100) : null]);
    return <>
      <PageHeading title={names[c]} eyebrow={`ZIJING / ${sectionMeta[c]?.label || path[0].toUpperCase()}`} description={sectionMeta[c]?.description} />
      {games && <form className="filters" method="get" aria-label="筛选内容">
        <label>游戏项目<select name="game" defaultValue={query.game || ""}><option value="">全部项目</option>{games.docs.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</select></label>
        {c === "events" && <><label>活动类型<select name="type" defaultValue={query.type || ""}><option value="">全部类型</option>{["比赛", "观赛", "交流", "训练", "其他"].map((t) => <option key={t}>{t}</option>)}</select></label><label>时间<select name="time" defaultValue={query.time || ""}><option value="">全部时间</option><option value="upcoming">即将开始</option><option value="past">历史活动</option></select></label></>}
        {teams && <><label>代表队<select name="team" defaultValue={query.team || ""}><option value="">全部代表队</option>{teams.docs.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label><label>年份<input name="year" type="number" min="1900" max="2200" placeholder="全部年份" defaultValue={query.year} /></label></>}
        <button className="button" type="submit">筛选 <Icon name="arrow" /></button><Link href={`/${path[0]}`}>重置</Link>
      </form>}
      <div className="result-meta"><span>{Object.keys(query).length ? "筛选结果" : "公开档案"} · {result.totalDocs} 条</span>{Object.keys(query).length > 0 && <Link href={`/${path[0]}`}>清除筛选</Link>}</div>
      {result.docs.length ? <Cards docs={result.docs} collection={c} /> : Object.keys(query).length ? <Empty text="没有符合当前筛选条件的内容，请调整条件或清除筛选。" /> : <Empty collection={c} />}
      <Pagination page={page} total={result.totalPages} path={`/${path[0]}`} query={query} />
    </>;
  }
  if (path[0] === "join" && path.length <= 2 && (!path[1] || ["members", "teams", "staff"].includes(path[1]))) {
    const [doc, batches] = await Promise.all([fixed(path[1] ? `join-${path[1]}` : "join"), path[1] ? list("recruitment", { kind: { equals: path[1] } }, page) : null]);
    return <><PageHeading title={titles[path[1] || "join"]} eyebrow="FIND YOUR PLACE / JOIN ZIJING" description={descriptions[path[1] || "join"]} parent={path[1] ? { href: "/join", label: "加入紫荆" } : undefined} />{doc && <div className="join-intro"><Prose doc={doc} /></div>}<JoinCards selected={path[1]} />{batches && <section className="join-history"><p className="eyebrow">RECRUITMENT ARCHIVE</p><h2>招新批次与历史记录</h2><Cards collection="recruitment" docs={batches.docs} /><Pagination page={page} total={batches.totalPages} path={`/join/${path[1]}`} /></section>}</>;
  }
  if (path.length === 1 && ["about", "contact", "privacy"].includes(path[0])) {
    const [doc, s] = await Promise.all([fixed(path[0]), site()]);
    return <><PageHeading title={doc?.title || titles[path[0]]} eyebrow={`ZIJING / ${path[0].toUpperCase()}`} description={descriptions[path[0]]} />{doc ? <Prose doc={doc} /> : <Empty text={path[0] === "privacy" ? "隐私说明尚待内容负责人确认发布。本站报名通过外部渠道进行，不接收站内报名资料。" : "内容正在整理，确认后将在这里发布。"} />}{path[0] === "contact" && Boolean(s.contacts?.length) && <div className="grid contact-grid">{s.contacts?.map((v, i) => <article className="panel" key={i}><Icon name="mail" /><h2>{v.label}</h2><p className="preserve">{v.text}</p>{safeURL(v.url) && <a className="text-link" href={v.url!} rel="noopener noreferrer">查看渠道 <Icon name="diagonal" /></a>}</article>)}</div>}</>;
  }
  notFound();
}
