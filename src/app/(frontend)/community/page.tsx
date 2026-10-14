import Link from "next/link";
import { list } from "@/lib/content";
import { CommunityPager, pageNumber } from "@/components/CommunityPager";
import { CommunityEmpty } from "@/components/community-pages/CommunityPages";
import { ClubFrame } from "../_club/ClubPage";
import styles from "@/components/community-pages/CommunityPages.module.css";

export default async function Communities({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const query = await searchParams;
  const search = typeof query.q === "string" ? query.q.trim().slice(0, 80) : "";
  const page = pageNumber(query.page);
  const games = await list(
    "games",
    search
      ? {
          or: [
            { title: { contains: search } },
            { summary: { contains: search } },
          ],
        }
      : {},
    page,
    24,
  );
  return (
    <ClubFrame className={styles.page}>
      <header className={styles.hero}>
        <div>
          <h1>
            找到同好，
            <br />
            从这里开场。
          </h1>
          <p>
            游戏社群是紫荆的日常据点。找到你玩的游戏，看看活动与共同经历，再联系管理员申请加入微信群。
          </p>
        </div>
        <aside className={styles.heroAside} aria-label="加入社群的方法">
          <h2>怎样加入社群</h2>
          <p>
            进入社群查看在任管理员的微信名片，加好友时备注昵称与游戏。管理员回复后，在微信中人工拉群。
          </p>
          <Link href="/account">查看我的进群进度</Link>
        </aside>
      </header>
      <section aria-label="游戏社群目录">
        <div className={styles.directoryTools}>
          <form
            action="/community"
            method="get"
            className={styles.search}
            role="search"
          >
            <label htmlFor="community-search">按游戏或社群名称查找</label>
            <div className={styles.searchFields}>
              <input
                id="community-search"
                name="q"
                type="search"
                defaultValue={search}
                maxLength={80}
                placeholder="输入游戏名称或介绍关键词"
              />
              <button className="button" type="submit">
                查找社群
              </button>
              {search && (
                <Link className="button light" href="/community">
                  全部社群
                </Link>
              )}
            </div>
          </form>
          <p>
            {search ? `“${search}”的匹配结果` : "已开放社群"}：{games.totalDocs}{" "}
            个
          </p>
        </div>
        {games.docs.length ? (
          <ul className={styles.directory}>
            {games.docs.map((game) => (
              <li className={styles.directoryRow} key={game.id}>
                <div>
                  <h2>
                    <Link href={`/community/${game.slug}`}>{game.title}</Link>
                  </h2>
                  {game.demo && <small>演示资料，非真实社团记录</small>}
                </div>
                <p>
                  {game.summary || "查看本社群的活动安排、风采记录与进群方法。"}
                </p>
                <div className={styles.rowLinks}>
                  <Link href={`/community/${game.slug}`}>了解社群</Link>
                  <Link href={`/community/${game.slug}#community-contacts`}>
                    联系管理员
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <CommunityEmpty
            title={search ? "没有找到匹配的社群" : "社群正在筹备"}
          >
            <p>
              {search
                ? "换一个游戏名称或关键词试试，也可以查看全部社群。"
                : "审核开放后，游戏社群会出现在这里。你也可以申请组织新的社群。"}
            </p>
            {search && <Link href="/community">查看全部社群</Link>}
          </CommunityEmpty>
        )}
        {games.totalPages > 1 && (
          <CommunityPager
            page={page}
            pages={games.totalPages}
            base="/community"
            query={search ? `&q=${encodeURIComponent(search)}` : ""}
          />
        )}
      </section>
      <section className={styles.organize}>
        <div>
          <h2>把热爱的游戏，组织成社群</h2>
          <p>
            参与已有社群的组织工作，或为还没出现的游戏发起申请。审核状态和处理意见会保存在你的申请记录中。
          </p>
        </div>
        <Link className="button light" href="/community/apply">
          申请成为社群管理员
        </Link>
      </section>
    </ClubFrame>
  );
}
