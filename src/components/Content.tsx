import Link from "next/link";
import { RichText } from "@payloadcms/richtext-lexical/react";
import { list, media, type Content } from "@/lib/content";
import {
  eventState,
  formatDate,
  registrationState,
  routeFor,
  safeURL,
} from "@/lib/rules";
export function Empty({
  text = "这里暂时还没有公开内容。",
}: {
  text?: string;
}) {
  return (
    <div className="empty">
      <span aria-hidden="true">◇</span>
      <p>{text}</p>
    </div>
  );
}
export async function Picture({
  id,
  priority = false,
}: {
  id?: number | null;
  priority?: boolean;
}) {
  const image = await media(id);
  if (!image?.url) return null;
  return (
    <img
      className="picture"
      src={image.sizes?.card?.url || image.url}
      alt={image.alt}
      width={image.sizes?.card?.width || image.width || 800}
      height={image.sizes?.card?.height || image.height || 600}
      loading={priority ? "eager" : "lazy"}
    />
  );
}
export function Prose({ doc }: { doc: Content }) {
  return (
    <div className="prose">
      {doc.body && (
        <RichText
          data={doc.body}
          converters={({ defaultConverters }) => ({
            ...defaultConverters,
            link: ({ node, nodesToJSX }) => {
              const href = node.fields?.url;
              return safeURL(href) ? (
                <a href={href} rel="noopener noreferrer">
                  {nodesToJSX({ nodes: node.children })}
                </a>
              ) : (
                <span>{nodesToJSX({ nodes: node.children })}</span>
              );
            },
          })}
        />
      )}
      {doc.sections?.map((s, i) => (
        <section key={i}>
          <h2>{s.heading}</h2>
          <p className="preserve">{s.text}</p>
        </section>
      ))}
    </div>
  );
}
export function JoinCards() {
  return (
    <div className="grid join-grid">
      {[
        ["members", "普通社员", "参与社团生活"],
        ["teams", "代表队选拔", "了解项目与选拔安排"],
        ["staff", "骨干招新", "一起组织社团活动"],
      ].map(([key, title, desc], i) => (
        <Link className="join-card" href={`/join/${key}`} key={key}>
          <span className="number">0{i + 1}</span>
          <h3>{title}</h3>
          <p>{desc}</p>
          <span aria-hidden="true">↗</span>
        </Link>
      ))}
    </div>
  );
}
export function Cards({
  docs,
  collection,
}: {
  docs: Content[];
  collection: string;
}) {
  if (!docs.length) return <Empty />;
  return (
    <div className="grid">
      {docs.map((doc) => (
        <article className="card" key={doc.id}>
          <Picture id={doc.cover} />
          <div className="card-body">
            <div className="eyebrow">
              {doc.demo ? "演示资料 · " : ""}
              {collection === "events"
                ? eventState(doc)
                : doc.type || doc.kind || "紫荆电竞"}
            </div>
            <h3>
              <Link href={`/${routeFor[collection]}/${doc.slug}`}>
                {doc.title}
              </Link>
            </h3>
            {doc.summary && <p>{doc.summary}</p>}
            {doc.startAt && <p className="meta">{formatDate(doc.startAt)}</p>}
            {collection === "recruitment" && (
              <span className="tag">{registrationState(doc)}</span>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
export async function Detail({
  doc,
  collection,
  photoPage = 1,
}: {
  doc: Content;
  collection: string;
  photoPage?: number;
}) {
  const state = registrationState(doc);
  const linkedTeam = doc.team
    ? (await list("teams", { id: { equals: doc.team } }, 1, 1)).docs[0]
    : null;
  const linkedEvent = doc.event
    ? (await list("events", { id: { equals: doc.event } }, 1, 1)).docs[0]
    : null;
  const linkedSeason = doc.season
    ? (await list("seasons", { id: { equals: doc.season } }, 1, 1)).docs[0]
    : null;
  const related =
    collection === "events"
      ? await Promise.all([
          list("news", { event: { equals: doc.id } }),
          list("albums", { event: { equals: doc.id } }),
        ])
      : null;
  const history =
    collection === "teams"
      ? await Promise.all([
          list("seasons", { team: { equals: doc.id } }, 1, 100),
          list("honors", { team: { equals: doc.id } }),
          list("events", { team: { equals: doc.id } }),
        ])
      : null;
  return (
    <>
      <header className="page-head">
        <p className="eyebrow">
          {doc.demo ? "演示资料 · 非真实社团记录" : "紫荆档案"}
          {doc.archived ? " / 历史归档" : ""}
        </p>
        <h1>{doc.title}</h1>
        {doc.summary && <p className="lead">{doc.summary}</p>}
      </header>
      <Picture id={doc.cover} priority />
      <div className="detail-layout">
        <div>
          <Prose doc={doc} />
          {Boolean(doc.members?.length) && (
            <section>
              <h2>公开阵容</h2>
              <ul>
                {doc.members?.map((m, i) => (
                  <li key={i}>
                    {m.displayName} · {m.position}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {doc.positions?.map((p, i) => (
            <section className="panel" key={i}>
              <h2>{p.name}</h2>
              <p>{p.duties}</p>
              <p>{p.requirements}</p>
              <p>{p.commitment}</p>
              <p>{p.arrangement}</p>
            </section>
          ))}
          {collection === "albums" && (
            <>
              {!doc.photos?.length && <Empty text="暂无获准公开的照片。" />}
              <div className="grid photos">
                {doc.photos
                  ?.slice((photoPage - 1) * 12, photoPage * 12)
                  .map((p, i) => (
                    <figure key={i}>
                      <Picture id={p.image} />
                      <figcaption>{p.caption}</figcaption>
                    </figure>
                  ))}
              </div>
              <Pagination
                page={photoPage}
                total={Math.ceil((doc.photos?.length || 0) / 12)}
                path={`/gallery/${doc.slug}`}
              />
            </>
          )}
          {history && (
            <>
              {history[0].docs.length > 0 && (
                <section>
                  <h2>赛季档案</h2>
                  <nav className="season-nav">
                    {history[0].docs.map((s) => (
                      <a href={`#season-${s.id}`} key={s.id}>
                        {s.title}
                      </a>
                    ))}
                  </nav>
                  {history[0].docs.map((s) => (
                    <article className="panel" id={`season-${s.id}`} key={s.id}>
                      <h3>{s.title}</h3>
                      <Prose doc={s} />
                      <ul>
                        {s.members?.map((m, i) => (
                          <li key={i}>
                            {m.displayName} · {m.position}
                          </li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </section>
              )}
              <section>
                <h2>相关荣誉</h2>
                <Cards docs={history[1].docs} collection="honors" />
              </section>
              <section>
                <h2>相关活动</h2>
                <Cards docs={history[2].docs} collection="events" />
              </section>
            </>
          )}
          {related && (
            <>
              <section>
                <h2>活动回顾</h2>
                <Cards docs={related[0].docs} collection="news" />
              </section>
              <section>
                <h2>活动相册</h2>
                <Cards docs={related[1].docs} collection="albums" />
              </section>
            </>
          )}
        </div>
        <aside>
          {(linkedTeam || linkedEvent) && (
            <div className="panel">
              <h2>相关档案</h2>
              {linkedTeam && (
                <p>
                  <Link href={`/teams/${linkedTeam.slug}`}>
                    {linkedTeam.title}
                  </Link>
                </p>
              )}
              {linkedSeason && linkedTeam && (
                <p>
                  <Link
                    href={`/teams/${linkedTeam.slug}#season-${linkedSeason.id}`}
                  >
                    {linkedSeason.title}
                  </Link>
                </p>
              )}
              {linkedEvent && (
                <p>
                  <Link href={`/events/${linkedEvent.slug}`}>
                    {linkedEvent.title}
                  </Link>
                </p>
              )}
            </div>
          )}
          {collection === "events" && (
            <div className="panel">
              <h2>活动信息</h2>
              <p>{eventState(doc)}</p>
              <dl>
                <dt>开始</dt>
                <dd>{formatDate(doc.startAt)}</dd>
                <dt>结束</dt>
                <dd>{formatDate(doc.endAt)}</dd>
                <dt>地点</dt>
                <dd>{doc.location || "待公布"}</dd>
              </dl>
            </div>
          )}
          {["events", "recruitment"].includes(collection) && (
            <div className="panel">
              <h2>{state}</h2>
              <p className="preserve">{doc.requirements}</p>
              <p>开始：{formatDate(doc.registrationStart)}</p>
              <p>
                截止：
                {doc.registrationEnd
                  ? formatDate(doc.registrationEnd)
                  : "未设定"}
              </p>
              {state === "报名开放" && (
                <>
                  {safeURL(doc.registrationURL) && (
                    <a
                      className="button"
                      href={doc.registrationURL!}
                      rel="noopener noreferrer"
                    >
                      前往外部报名 ↗
                    </a>
                  )}
                  {doc.channelText && (
                    <p className="preserve">{doc.channelText}</p>
                  )}
                  <Picture id={doc.qrCode} />
                  <p className="meta">
                    报名由外部平台受理，请以外部平台提示为准。
                  </p>
                </>
              )}
              {doc.contact && <p>联系：{doc.contact}</p>}
              {doc.channelCheckedAt && (
                <p className="meta">
                  渠道核验：{formatDate(doc.channelCheckedAt)}
                </p>
              )}
            </div>
          )}
          {collection === "honors" && (
            <div className="panel">
              <h2>荣誉信息</h2>
              <p>{doc.competition}</p>
              <p>
                {doc.division} · {doc.placing}
              </p>
              <p>{formatDate(doc.date)}</p>
              {safeURL(doc.sourceURL) && (
                <a href={doc.sourceURL} rel="noopener noreferrer">
                  查看公开来源 ↗
                </a>
              )}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
export function Pagination({
  page,
  total,
  path,
  query = {},
}: {
  page: number;
  total: number;
  path: string;
  query?: Record<string, string>;
}) {
  if (total <= 1) return null;
  const href = (p: number) =>
    `${path}?${new URLSearchParams({ ...query, page: String(p) })}`;
  return (
    <nav className="pagination" aria-label="分页">
      {page > 1 && <Link href={href(page - 1)}>上一页</Link>}
      <span>
        第 {page} / {total} 页
      </span>
      {page < total && <Link href={href(page + 1)}>下一页</Link>}
    </nav>
  );
}
