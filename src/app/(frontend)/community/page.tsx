import { Icon } from "@/components/Identity";
import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { list } from "@/lib/content";
export default async function Communities() {
  const games = await list("games", {}, 1, 100);
  return (
    <>
      <PageHeading
        title="游戏社群"
        eyebrow="PLAY / CONNECT / SHARE"
        description="加入游戏讨论，在论坛分享经验和活动。登录后即可发帖与交流。"
      />
      <section className="community-grid">
        {games.docs.length ? (
          games.docs.map((game) => (
            <Link
              className="community-card"
              href={`/community/${game.slug}`}
              key={game.id}
            >
              <small>GAME COMMUNITY</small>
              <h2>{game.title}</h2>
              <p>{game.summary || "进入社群论坛，和伙伴们继续讨论。"}</p>
              <span>
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
      </section>
      <section className="community-action">
        <div>
          <h2>让热爱有个集合点</h2>
          <p>想组织同好，或建立新的游戏社群？从管理员申请开始。</p>
        </div>
        <Link className="button" href="/community/apply">
          申请管理已有或新游戏社群 <Icon name="diagonal" />
        </Link>
      </section>
    </>
  );
}
