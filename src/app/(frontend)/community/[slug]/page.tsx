import Link from "next/link";
import { Icon } from "@/components/Identity";
import { ClubFrame } from "../../_club/ClubPage";
import styles from "../../_club/ClubPages.module.css";
export default async function CommunityHome({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <ClubFrame className={styles.communityBody}>
      <div className={styles.subHeader}>
        <h2>从这里，参与社群</h2>
        <p>了解最新安排，留下共同经历。加入微信群请联系在任管理员。</p>
      </div>
      <div className={styles.destinations}>
        {[
          ["updates", "活动与通知", "了解社群活动安排与最新通知。"],
          ["showcase", "社群风采", "分享活动照片、精彩集锦与值得记录的瞬间。"],
        ].map(([path, title, description], index) => (
          <Link
            className={styles.destination}
            href={`/community/${slug}/${path}`}
            key={path}
          >
            <span className={styles.kicker}>
              {String(index + 1).padStart(2, "0")} /{" "}
              {path === "updates" ? "COMMUNITY UPDATES" : "SHARED MOMENTS"}
            </span>
            <h3>{title}</h3>
            <p>{description}</p>
            <span className={styles.cardLink}>
              进入栏目 <Icon name="diagonal" />
            </span>
          </Link>
        ))}
      </div>
      <section className={styles.callout}>
        <div>
          <h2>与同好并肩</h2>
          <p>
            查看管理员名片，记录加入意向。好友申请、拉群与确认由管理员在微信中人工完成。
          </p>
        </div>
        <Link className="button" href={`/community/${slug}/join`}>
          查看进群方式 <Icon name="arrow" />
        </Link>
      </section>
    </ClubFrame>
  );
}
