import Link from "next/link";
import { cms } from "@/lib/content";
import { promotedContent } from "@/lib/content-promotions";
import styles from "./activity-pages/Workspace.module.css";
import type { PromotionKind } from "@/lib/promotion-model";

export async function PromotedContent({ kind }: { kind: PromotionKind }) {
  const items = await promotedContent(await cms(), kind);
  if (!items.length) return null;
  const titles = { event: "社团精选活动", notice: "社团精选公告", showcase: "社团精选风采" };
  return <section className="home-section" data-section={"promoted-" + kind}>
    <div className="section-title"><div><p className="eyebrow">来自游戏社群</p><h2>{titles[kind]}</h2></div></div>
    <div className={styles.records}>{items.map(item => <article className={styles.record} key={item.id} data-promotion-source={item.sourceKey}>
      <small>社团精选 · 来源：{item.gameTitle}</small><h3><Link href={item.href}>{item.snapshot.title}</Link></h3>
      <p className={styles.excerpt}>{item.snapshot.body}</p><Link href={item.href}>查看原内容 ↗</Link>
    </article>)}</div>
  </section>;
}
