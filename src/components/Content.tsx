import Link from "next/link";
import type { ReactNode } from "react";
import { RichText } from "@payloadcms/richtext-lexical/react";
import { list, media, names, type Content } from "@/lib/content";
import { eventState, formatDate, registrationState, routeFor, safeURL } from "@/lib/rules";
import { dateParts, kindLabels } from "@/lib/presentation";
import { Artwork, Icon, type IconName } from "./Identity";
import { PageHeading } from "./PageHeading";
import { Comments } from "./Comments";

export function Empty({ text, collection }: { text?: string; collection?: string }) {
  const copy: Record<string, [string, string, IconName]> = {
    events: ["下一场精彩，敬请关注", "活动安排确认后会在这里发布。也可以通过联系页面了解参与方式。", "calendar"],
    teams: ["代表队档案正在整理", "项目介绍与赛季信息将在确认后公开。", "team"],
    honors: ["为每一份荣誉，留下记录", "经核实的赛事成绩将在这里归档。", "trophy"],
    news: ["新的故事，即将更新", "社团公告与活动回顾会在这里与你见面。", "layers"],
    albums: ["精彩瞬间，等待入镜", "获准公开的社团影像将在这里发布。", "camera"],
    recruitment: ["暂未发布匹配的招新批次", "后续招新安排与报名渠道将在确认后公布。", "team"],
    announcements: ["暂无通知", "社团通知确认后将在这里发布。", "layers"],
  };
  const entry = copy[collection || ""] || ["内容正在整理", "确认后的公开资料会在这里更新。", "layers"];
  return <div className="empty"><div className="empty-icon"><Icon name={entry[2] as IconName} /></div><div><h3>{text || entry[0]}</h3>{!text && <p>{entry[1]}</p>}</div><Link className="text-link" href="/contact">联系社团 <Icon name="diagonal" /></Link></div>;
}
export async function Picture({ id, priority = false, fallback = null }: { id?: number | null; priority?: boolean; fallback?: ReactNode }) {
  const image = await media(id);
  if (!image?.url) return fallback;
  const card = image.sizes?.card;
  const src = priority ? image.url : card?.url || image.url;
  const srcSet = card?.url && card.width && image.width && image.width > card.width ? `${card.url} ${card.width}w, ${image.url} ${image.width}w` : undefined;
  return <img className="picture" src={src} srcSet={srcSet} sizes={srcSet ? "(max-width: 700px) 100vw, (max-width: 1080px) 50vw, 800px" : undefined} alt={image.alt || ""} width={(priority ? image.width : card?.width) || image.width || 800} height={(priority ? image.height : card?.height) || image.height || 600} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} decoding="async" />;
}
export function Prose({ doc }: { doc: Content }) {
  return <div className="prose">{doc.body && <RichText data={doc.body} converters={({ defaultConverters }) => ({ ...defaultConverters, link: ({ node, nodesToJSX }) => { const href = node.fields?.url; return safeURL(href) ? <a href={href} rel="noopener noreferrer">{nodesToJSX({ nodes: node.children })}</a> : <span>{nodesToJSX({ nodes: node.children })}</span>; } })} />}{doc.sections?.map((s, i) => <section key={i}><h2>{s.heading}</h2><p className="preserve">{s.text}</p></section>)}</div>;
}
export function JoinCards({ selected }: { selected?: string } = {}) {
  const items: { key: string; title: string; en: string; desc: string; icon: IconName }[] = [
    { key: "members", title: "普通社员", en: "PLAY TOGETHER", desc: "寻找同好，参与活动。从共同的热爱开始。", icon: "team" },
    { key: "teams", title: "代表队选拔", en: "RISE AS ONE", desc: "了解各项目选拔安排，找到并肩作战的伙伴。", icon: "target" },
    { key: "staff", title: "骨干招新", en: "MAKE IT HAPPEN", desc: "从幕后到台前，一起策划和创造社团的精彩。", icon: "layers" },
  ];
  return <div className="grid join-grid">{items.map((item, i) => <Link className={`join-card${selected === item.key ? " is-selected" : ""}`} href={`/join/${item.key}`} key={item.key} aria-current={selected === item.key ? "page" : undefined}><div className="join-card-top"><span className="number">0{i + 1} / {item.en}</span><Icon name={item.icon} /></div><h3>{item.title}</h3><p>{item.desc}</p><div className="join-card-bottom"><span>了解加入方式</span><Icon name="diagonal" /></div></Link>)}</div>;
}
export function Cards({ docs, collection }: { docs: Content[]; collection: string }) {
  if (!docs.length) return <Empty collection={collection} />;
  return <div className={`grid cards-${collection}`}>{docs.map((doc) => {
    const date = dateParts(doc.startAt || doc.date);
    const label = collection === "events" ? eventState(doc) : kindLabels[doc.kind || ""] || doc.type || names[collection] || "紫荆电竞";
    return <article className="card" key={doc.id}>
      {collection === "honors" ? <div className="honor-emblem"><Icon name="trophy" /><span>{date?.year || "ZIJING"}</span></div> : <div className="card-media"><Picture id={doc.cover} fallback={<Artwork collection={collection} />} />{collection === "events" && date && <span className="date-stamp"><strong>{date.day}</strong><span>{date.month}月 / {date.year}</span></span>}</div>}
      <div className="card-body"><div className="card-meta"><span className={`tag${collection === "events" && label === "进行中" ? " tag-live" : ""}`}>{label}</span>{doc.demo && <span className="demo-label">演示资料</span>}{doc.archived && <span className="meta">历史归档</span>}</div>
        {collection === "honors" && doc.placing && <p className="honor-placing">{doc.placing}</p>}
        <h3><Link className="card-link" href={`/${routeFor[collection]}/${doc.slug}`}>{doc.title}</Link></h3>
        {doc.summary && <p className="card-summary">{doc.summary}</p>}
        <div className="card-bottom"><span className="meta">{collection === "recruitment" ? registrationState(doc) : doc.startAt ? formatDate(doc.startAt) : doc.competition || "ZIJING ESPORTS"}</span><span className="card-arrow"><Icon name="diagonal" /></span></div>
      </div>
    </article>;
  })}</div>;
}
export async function Detail({ doc, collection, photoPage = 1 }: { doc: Content; collection: string; photoPage?: number }) {
  const state = registrationState(doc);
  const [linkedTeam, linkedEvent, linkedSeason, related, history] = await Promise.all([
    doc.team ? list("teams", { id: { equals: doc.team } }, 1, 1).then((r) => r.docs[0]) : null,
    doc.event ? list("events", { id: { equals: doc.event } }, 1, 1).then((r) => r.docs[0]) : null,
    doc.season ? list("seasons", { id: { equals: doc.season } }, 1, 1).then((r) => r.docs[0]) : null,
    collection === "events" ? Promise.all([list("news", { event: { equals: doc.id } }), list("albums", { event: { equals: doc.id } })]) : null,
    collection === "teams" ? Promise.all([list("seasons", { team: { equals: doc.id } }, 1, 100), list("honors", { team: { equals: doc.id } }), list("events", { team: { equals: doc.id } })]) : null,
  ]);
  return <>
    <PageHeading title={doc.title} eyebrow={doc.demo ? "演示资料 · 非真实社团记录" : "ZIJING / ARCHIVE"} description={doc.summary} parent={{ href: `/${routeFor[collection]}`, label: names[collection] || "档案" }}>{doc.archived && <span className="tag">历史归档</span>}</PageHeading>
    {doc.cover && <div className="detail-cover"><Picture id={doc.cover} priority /></div>}
    <div className="detail-layout"><div className="detail-main"><Prose doc={doc} />
      {Boolean(doc.members?.length) && <section><h2>公开阵容</h2><ul className="roster">{doc.members?.map((m, i) => <li key={i}><span className="number">{String(i + 1).padStart(2, "0")}</span><strong>{m.displayName}</strong><span>{m.position}</span></li>)}</ul></section>}
      {doc.positions?.map((p, i) => <section className="panel" key={i}><p className="eyebrow">POSITION / {String(i + 1).padStart(2, "0")}</p><h2>{p.name}</h2><p>{p.duties}</p><p>{p.requirements}</p><p>{p.commitment}</p><p>{p.arrangement}</p></section>)}
      {collection === "albums" && <>{!doc.photos?.length && <Empty text="暂无获准公开的照片。" />}<div className="grid photos">{doc.photos?.slice((photoPage - 1) * 12, photoPage * 12).map((p, i) => <figure key={i}><Picture id={p.image} /><figcaption>{p.caption}</figcaption></figure>)}</div><Pagination page={photoPage} total={Math.ceil((doc.photos?.length || 0) / 12)} path={`/gallery/${doc.slug}`} /></>}
      {history && <>{history[0].docs.length > 0 && <section><h2>赛季档案</h2><nav className="season-nav" aria-label="赛季导航">{history[0].docs.map((s) => <a href={`#season-${s.id}`} key={s.id}>{s.title}</a>)}</nav>{history[0].docs.map((s) => <article className="panel" id={`season-${s.id}`} key={s.id}><h3>{s.title}</h3><Prose doc={s} /><ul className="roster">{s.members?.map((m, i) => <li key={i}><strong>{m.displayName}</strong><span>{m.position}</span></li>)}</ul></article>)}</section>}<section><h2>相关荣誉</h2><Cards docs={history[1].docs} collection="honors" /></section><section><h2>相关活动</h2><Cards docs={history[2].docs} collection="events" /></section></>}
      {related && <><section><h2>活动回顾</h2><Cards docs={related[0].docs} collection="news" /></section><section><h2>活动相册</h2><Cards docs={related[1].docs} collection="albums" /></section></>}
      {(["events", "albums", "news", "announcements"].includes(collection)) &&
        <Comments targetType={collection as "events" | "albums" | "news" | "announcements"} targetId={doc.id} />}
    </div><aside className="detail-sidebar">
      {(linkedTeam || linkedEvent) && <div className="panel"><p className="eyebrow">CONNECTED</p><h2>相关档案</h2>{linkedTeam && <p><Link href={`/teams/${linkedTeam.slug}`}>{linkedTeam.title} ↗</Link></p>}{linkedSeason && linkedTeam && <p><Link href={`/teams/${linkedTeam.slug}#season-${linkedSeason.id}`}>{linkedSeason.title} ↗</Link></p>}{linkedEvent && <p><Link href={`/events/${linkedEvent.slug}`}>{linkedEvent.title} ↗</Link></p>}</div>}
      {collection === "events" && <div className="panel"><p className="eyebrow">EVENT DETAILS</p><h2>活动信息</h2><p className="tag">{eventState(doc)}</p><dl><dt>开始</dt><dd>{formatDate(doc.startAt)}</dd><dt>结束</dt><dd>{formatDate(doc.endAt)}</dd><dt>地点</dt><dd>{doc.location || "待公布"}</dd></dl></div>}
      {["events", "recruitment"].includes(collection) && <div className="panel registration-panel"><p className="eyebrow">TAKE PART</p><h2>{state}</h2><p className="preserve">{doc.requirements}</p><p>开始：{formatDate(doc.registrationStart)}</p><p>截止：{doc.registrationEnd ? formatDate(doc.registrationEnd) : "未设定"}</p>{state === "报名开放" && <>{safeURL(doc.registrationURL) && <a className="button light" aria-label="前往外部报名 ↗" href={doc.registrationURL!} rel="noopener noreferrer">前往外部报名 <Icon name="diagonal" /></a>}{doc.channelText && <p className="preserve">{doc.channelText}</p>}<Picture id={doc.qrCode} /><p className="meta">报名由外部平台受理，请以外部平台提示为准。</p></>}{doc.contact && <p>联系：{doc.contact}</p>}{doc.channelCheckedAt && <p className="meta">渠道核验：{formatDate(doc.channelCheckedAt)}</p>}</div>}
      {collection === "honors" && <div className="panel honor-panel"><Icon name="trophy" /><h2>荣誉信息</h2><p>{doc.competition}</p><p className="honor-placing">{[doc.division, doc.placing].filter(Boolean).join(" · ")}</p><p>{formatDate(doc.date)}</p>{safeURL(doc.sourceURL) && <a className="text-link" href={doc.sourceURL} rel="noopener noreferrer">查看公开来源 <Icon name="diagonal" /></a>}</div>}
    </aside></div>
  </>;
}
export function Pagination({ page, total, path, query = {} }: { page: number; total: number; path: string; query?: Record<string, string> }) {
  if (total <= 1) return null;
  const href = (p: number) => `${path}?${new URLSearchParams({ ...query, page: String(p) })}`;
  return <nav className="pagination" aria-label="分页">{page > 1 ? <Link href={href(page - 1)}>← 上一页</Link> : <span aria-disabled="true">← 上一页</span>}<span>第 <strong>{page}</strong> / {total} 页</span>{page < total ? <Link href={href(page + 1)}>下一页 →</Link> : <span aria-disabled="true">下一页 →</span>}</nav>;
}
