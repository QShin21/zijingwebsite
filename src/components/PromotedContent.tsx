import Link from "next/link";
import { cms } from "@/lib/content";
import { promotedContent } from "@/lib/content-promotions";
import styles from "./visual-direction/PromotedContent.module.css";
import type { PromotionKind } from "@/lib/promotion-model";
import { Icon } from "./Identity";
import { getT } from "@/lib/i18n/server";

type PromotionItems = Awaited<ReturnType<typeof promotedContent>>;

export async function PromotedContent({ kind, items: supplied }: { kind: PromotionKind; items?: PromotionItems }) {
  const items = supplied ?? await promotedContent(await cms(), kind);
  if (!items.length) return null;
  const { t } = await getT();
  const titles = {
    event: t("社团精选活动", "Featured club events"),
    notice: t("社团精选公告", "Featured club notices"),
    showcase: t("社团精选风采", "Featured showcase"),
  };
  return (
    <section className={styles.section} data-section={"promoted-" + kind}>
      <header className={styles.heading}>
        <p>{t("来自游戏社群", "From game communities")}</p>
        <h2>{titles[kind]}</h2>
      </header>
      <div className={styles.records}>
        {items.map((item) => (
          <article
            className={styles.record}
            key={item.id}
            data-promotion-source={item.sourceKey}
          >
            <p className={styles.source}>
              {t("来源：", "From: ")}
              {item.gameTitle}
            </p>
            <div>
              <h3>
                <Link href={item.href}>{item.snapshot.title}</Link>
              </h3>
              <p className={styles.excerpt}>{item.snapshot.body}</p>
            </div>
            <Link className={styles.action} href={item.href}>
              {t("查看原内容", "View original")} <Icon name="arrow" />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
