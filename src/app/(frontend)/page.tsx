import Link from "next/link";
import { site, list, fixed, names } from "@/lib/content";
import { Cards, JoinCards, Picture, Prose } from "@/components/Content";
import type { CollectionSlug, Where } from "payload";
import { routeFor } from "@/lib/rules";
export default async function Home() {
  const s = await site();
  const modules: {
    kind: string;
    enabled?: boolean | null;
    title?: string | null;
  }[] = s.modules?.length
    ? s.modules
    : [
        { kind: "join", enabled: true },
        { kind: "events", enabled: true },
        { kind: "teams", enabled: true },
        { kind: "honors", enabled: true },
        { kind: "news", enabled: true },
        { kind: "albums", enabled: true },
        { kind: "about", enabled: true },
      ];
  const seen = new Set<string>();
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">ZIJING / ESPORTS CLUB</p>
          <h1>{s.heroTitle || s.name}</h1>
          {s.heroSubtitle && <p className="lead">{s.heroSubtitle}</p>}
          <Link className="button light" href={s.heroButtonURL || "/join"}>
            {s.heroButtonLabel || "了解加入方式"}{" "}
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
        {s.heroImage ? (
          <Picture
            id={typeof s.heroImage === "number" ? s.heroImage : s.heroImage.id}
            priority
          />
        ) : (
          <div className="hero-art" aria-hidden="true">
            <div className="orbit" />
            <span>紫荆</span>
            <small>PLAY. CONNECT. GROW.</small>
          </div>
        )}
        <div className="hero-foot">
          <span>{s.name}</span>
          <span>{s.heroSubtitle || "ZIJING ESPORTS"}</span>
        </div>
      </section>
      {await Promise.all(
        modules
          .filter((m) => {
            if (!m.enabled || seen.has(m.kind)) return false;
            seen.add(m.kind);
            return true;
          })
          .map(async (m) => {
            if (m.kind === "join")
              return (
                <section key={m.kind}>
                  <div className="section-title">
                    <h2>{m.title || "找到你的加入方式"}</h2>
                    <span>JOIN ZIJING</span>
                  </div>
                  <JoinCards />
                </section>
              );
            if (m.kind === "about") {
              const p = await fixed("about");
              return p ? (
                <section key={m.kind} className="about-block">
                  <h2>{m.title || "关于紫荆"}</h2>
                  <Prose doc={p} />
                  <Link href="/about">更多关于我们 ↗</Link>
                </section>
              ) : null;
            }
            const featured =
              m.kind === "events"
                ? s.featuredEvents
                : m.kind === "honors"
                  ? s.featuredHonors
                  : null;
            const conditions: Where[] = [{ archived: { not_equals: true } }];
            if (featured?.length)
              conditions.push({
                id: {
                  in: featured.map((v) => (typeof v === "number" ? v : v.id)),
                },
              });
            if (m.kind === "events")
              conditions.push(
                { lifecycle: { not_in: ["cancelled", "postponed", "ended"] } },
                {
                  or: [
                    { endAt: { exists: false } },
                    { endAt: { greater_than: new Date().toISOString() } },
                  ],
                },
              );
            const result = await list(
              m.kind as CollectionSlug,
              { and: conditions },
              1,
              3,
            );
            if (!result.docs.length) return null;
            return (
              <section key={m.kind}>
                <div className="section-title">
                  <h2>{m.title || names[m.kind]}</h2>
                  <Link href={`/${routeFor[m.kind]}`}>查看全部 ↗</Link>
                </div>
                <Cards docs={result.docs} collection={m.kind} />
              </section>
            );
          }),
      )}
      <section className="contact-strip">
        <h2>保持联系</h2>
        <Link href="/contact">联系与合作 ↗</Link>
      </section>
    </>
  );
}
