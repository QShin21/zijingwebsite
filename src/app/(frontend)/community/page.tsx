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
      <PageHeading
        title="游戏社群"
        eyebrow="找到同好，一起开场"
        description="从熟悉的游戏出发，看看社群近况。联系在任管理员，在微信中加好友、等待人工拉群。"
        action={<Link className="button light" href="/community/apply">申请成为管理员</Link>}
      />
      <section aria-labelledby="community-directory-title">
        <div className={styles.sectionHead}>
          <h2 id="community-directory-title">社群目录</h2>
          <p>{games.totalDocs} 个已开放社群</p>
        </div>
        <div className={styles.directory}>
          {games.docs.length ? games.docs.map((game) => (
            <Link className={styles.communityCard} href={`/community/${game.slug}`} key={game.id}>
              <h3>{game.title}</h3>
              {game.demo && <small className="tag">演示资料 · 非真实社团记录</small>}
              <p>{game.summary || "查看活动与通知、社群风采和进群方式。"}</p>
              <span className={styles.cardLink}>进入社群 <Icon name="arrow" /></span>
            </Link>
          )) : (
            <div className="empty">
              <h3>社群正在筹备</h3>
              <p>审核开放后，游戏社群会出现在这里。你也可以申请组织新的社群。</p>
            </div>
          )}
        </div>
      </section>
      <section className={styles.callout}>
        <div>
          <h2>为热爱的游戏，组织一场相聚</h2>
          <p>想参与组织现有社群，或还没有找到自己的游戏？提交管理员申请，并在本人记录中跟进审核。</p>
        </div>
        <Link className="button" href="/community/apply">申请管理已有或新游戏社群 <Icon name="arrow" /></Link>
      </section>
    </ClubFrame>
  );
}
