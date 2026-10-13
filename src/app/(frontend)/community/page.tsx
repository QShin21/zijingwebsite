import { Icon } from "@/components/Identity";
import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { list } from "@/lib/content";
import { ClubFrame } from "../_club/ClubPage";
import styles from "../_club/ClubPages.module.css";
export default async function Communities() {
  const games = await list("games", {}, 1, 100);
  return (
    <ClubFrame>
      <div className={styles.hero}>
        <PageHeading
          title="游戏社群"
          eyebrow="PLAY / CONNECT / SHARE"
          description="联系游戏社群管理员，由管理员在微信中人工拉群；也可申请组织已有社群或创建新群。"
        />
        <div className={styles.signal} aria-hidden="true">
          <svg viewBox="0 0 200 200" fill="none">
            <path
              d="M20 100h160M100 20v160M42 42l116 116M42 158 158 42"
              stroke="currentColor"
              strokeOpacity=".25"
            />
            <path
              d="m55 72 44-25 46 25v55l-46 26-44-26Z"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path d="m55 72 44 26 46-26M99 98v55" stroke="currentColor" />
            <circle
              className={styles.signalDot}
              cx="145"
              cy="72"
              r="5"
              fill="currentColor"
            />
          </svg>
          <span className={styles.signalLabel}>CONNECT / ZIJING</span>
        </div>
      </div>
      <section aria-labelledby="community-directory-title">
        <div className={styles.sectionHead}>
          <h2 id="community-directory-title">找到你的游戏社群</h2>
          <p>{games.totalDocs} 个公开社群 · 同好在这里相遇</p>
        </div>
        <div className={styles.directory}>
          {games.docs.length ? (
            games.docs.map((game, index) => (
              <Link
                className={styles.communityCard}
                href={`/community/${game.slug}`}
                key={game.id}
              >
                <div className={styles.cardTop}>
                  <small>
                    {String(index + 1).padStart(2, "0")} / COMMUNITY
                  </small>
                  <span className={styles.gameMark} aria-hidden="true">
                    {game.title.slice(0, 1)}
                  </span>
                </div>
                {game.demo && (
                  <small className="tag">演示资料 · 非真实社团记录</small>
                )}
                <h3>{game.title}</h3>
                <p>
                  {game.summary ||
                    "查看社群活动、通知与风采，联系管理员加入微信群。"}
                </p>
                <span className={styles.cardLink}>
                  进入社群 <Icon name="arrow" />
                </span>
              </Link>
            ))
          ) : (
            <div className="panel">
              <h2>还没有公开社群</h2>
              <p>首批游戏社群审核通过后将出现在这里。</p>
            </div>
          )}
        </div>
      </section>
      <section className={styles.callout}>
        <div>
          <p className={styles.kicker}>BUILD THE NEXT COMMUNITY</p>
          <h2>让热爱有个集合点</h2>
          <p>想组织同好，或建立新的游戏社群？从管理员申请开始。</p>
        </div>
        <Link className="button" href="/community/apply">
          申请管理已有或新游戏社群 <Icon name="diagonal" />
        </Link>
      </section>
    </ClubFrame>
  );
}
