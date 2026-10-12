import Link from "next/link";
import { site, list, fixed, names } from "@/lib/content";
import { Cards, JoinCards, Picture, Prose, Empty } from "@/components/Content";
import { ArenaArt, Icon } from "@/components/Identity";
import type { CollectionSlug, Where } from "payload";
import { routeFor } from "@/lib/rules";
import { publicHref, sectionMeta } from "@/lib/presentation";
import { PromotedContent } from "@/components/PromotedContent";

type HomeModule = { kind: string; enabled?: boolean | null; title?: string | null };
const defaults: HomeModule[] = ["events", "teams", "honors", "join", "news", "albums", "about"].map((kind) => ({ kind, enabled: true }));
export default async function Home() {
  const s = await site();
  const seen = new Set<string>();
  const modules = (s.modules?.length ? s.modules : defaults).filter((m) => {
    if (!m.enabled || seen.has(m.kind) || ![...Object.keys(sectionMeta), "join", "about"].includes(m.kind)) return false;
    seen.add(m.kind); return true;
  });
  return <div className="home-page">
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy"><p className="eyebrow"><span className="status-dot" /> ZIJING ESPORTS CLUB</p>
        <p className="hero-club">{s.name}</p>
        <h1 id="hero-title" className={s.heroTitle ? "hero-custom-title" : undefined}>{s.heroTitle || <>为热爱，<br /><em>一起上场。</em></>}</h1>
        <p className="lead">{s.heroSubtitle || "从一场游戏，到一群伙伴。让每一次并肩，都成为值得记住的校园时光。"}</p>
        <div className="hero-actions"><Link className="button light" href={publicHref(s.heroButtonURL, "/join")}>{s.heroButtonLabel || "加入紫荆"}<Icon name="diagonal" /></Link><Link className="text-link" href="/events">探索社团活动 <Icon name="arrow" /></Link></div>
      </div>
      <div className="hero-visual">{s.heroImage ? <Picture id={typeof s.heroImage === "number" ? s.heroImage : s.heroImage.id} priority fallback={<ArenaArt />} /> : <ArenaArt />}</div>
      <div className="hero-foot"><span>PLAY TOGETHER. GO FURTHER.</span><a href="#explore">向下探索 <span aria-hidden="true">↓</span></a></div>
    </section>
    <nav className="quick-links" aria-label="快捷入口" id="explore">{[{ href: "/events", label: "社团活动", en: "WHAT'S ON" }, { href: "/community", label: "游戏社群", en: "PLAY TOGETHER" }, { href: "/honors", label: "荣誉档案", en: "OUR LEGACY" }, { href: "/join/staff", label: "骨干招新", en: "BUILD WITH US" }].map((item, index) => <Link key={item.href} href={item.href}><span className="quick-index">0{index + 1}</span><span><strong>{item.label}</strong><small>{item.en}</small></span><Icon name="diagonal" /></Link>)}</nav>
    <PromotedContent kind="event" />
    <PromotedContent kind="notice" />
    {await Promise.all(modules.map(async (m, index) => {
      const number = String(index + 1).padStart(2, "0");
      if (m.kind === "join") return <section key={m.kind} className="home-section join-section"><div className="section-title"><div><p className="eyebrow">{number} / FIND YOUR PLACE</p><h2>{m.title || "总有你的位置。"}</h2></div><p className="section-note">一起玩，认真赢，<br />也一起把社团变得更好。</p></div><JoinCards /></section>;
      if (m.kind === "about") {
        const p = await fixed("about");
        return <section key={m.kind} className="home-section about-block"><div><p className="eyebrow">{number} / BEYOND THE GAME</p><h2>{m.title || "共同的热爱，\n让我们相遇。"}</h2><Link className="text-link" href="/about">认识紫荆 <Icon name="diagonal" /></Link></div><div>{p ? <Prose doc={p} /> : <p className="about-manifesto">有人在赛场并肩，有人在幕后相助。<br />在这里，寻找属于你的参与方式。<br /><span>下一段故事，从相遇开始。</span></p>}</div></section>;
      }
      const meta = sectionMeta[m.kind];
      const featured = m.kind === "events" ? s.featuredEvents : m.kind === "honors" ? s.featuredHonors : null;
      const conditions: Where[] = [{ archived: { not_equals: true } }];
      if (featured?.length) conditions.push({ id: { in: featured.map((v) => typeof v === "number" ? v : v.id) } });
      // Keep published event recaps available rather than leaving a dead homepage between activities.
      let result = await list(m.kind as CollectionSlug, { and: conditions }, 1, 3);
      if (!result.docs.length && featured?.length) result = await list(m.kind as CollectionSlug, { archived: { not_equals: true } }, 1, 3);
      return <section key={m.kind} className={`home-section section-${m.kind}`} data-section={m.kind}><div className="section-title"><div><p className="eyebrow">{number} / {meta.label}</p><h2>{m.title || names[m.kind]}</h2></div><Link className="text-link" href={`/${routeFor[m.kind]}`}>查看全部 <Icon name="diagonal" /></Link></div><p className="section-description">{meta.description}</p>{result.docs.length ? <Cards docs={result.docs} collection={m.kind} /> : <Empty collection={m.kind} />}</section>;
    }))}
    <section className="contact-strip"><div><p className="eyebrow">LET'S MAKE IT HAPPEN</p><h2>下一次精彩，一起创造。</h2></div><Link className="button light" href="/contact">联系与合作 <Icon name="diagonal" /></Link></section>
  </div>;
}
