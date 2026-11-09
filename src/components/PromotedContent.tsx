import Link from "next/link";
import { cms } from "@/lib/content";
import { promotedContent } from "@/lib/content-promotions";
import styles from "./visual-direction/PromotedContent.module.css";
import type { PromotionKind } from "@/lib/promotion-model";
import { Icon } from "./Identity";

type PromotionItems = Awaited<ReturnType<typeof promotedContent>>;

export async function PromotedContent({ kind, items: supplied }: { kind: PromotionKind; items?: PromotionItems }) {
  const items = supplied ?? await promotedContent(await cms(), kind);
  if (!items.length) return null;
  const titles = {
    event: "社团精选活动",
    notice: "社团精选公告",
    showcase: "社团精选风采",
  };
  return (
    <section className={styles.section} data-section={"promoted-" + kind}>
      <header className={styles.heading}>
        <p>来自游戏社群</p>
        <h2>{titles[kind]}</h2>
      </header>
      <div className={styles.records}>
        {items.map((item) => (
          <article
            className={styles.record}
            key={item.id}
            data-promotion-source={item.sourceKey}
          >
            <p className={styles.source}>来源：{item.gameTitle}</p>
            <div>
              <h3>
                <Link href={item.href}>{item.snapshot.title}</Link>
              </h3>
              <p className={styles.excerpt}>{item.snapshot.body}</p>
            </div>
            <Link className={styles.action} href={item.href}>
              查看原内容 <Icon name="arrow" />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
