import { SubmitButton } from "@/components/SubmitButton";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { bySlug, cms } from "@/lib/content";
import { canParticipate, formatDate, managesGame } from "@/lib/rules";
import { banAction, moderateAction, publishCommunityAction } from "@/app/(frontend)/community/actions";
export async function CommunitySection({
  section,
  params,
  searchParams,
}: {
  section: "updates" | "forum" | "chat";
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const { slug } = await params;
  const game = await bySlug("games", slug);
  if (!game) notFound();
  const p = await cms();
  const { user } = await p.auth({ headers: await headers() });
  const manager = managesGame(user, game.id);
  const options = {
    overrideAccess: false as const,
    user: null,
    depth: 0,
    where: { game: { equals: game.id } },
    sort: "-createdAt",
    limit: 30,
  };
  const [posts, messages, local] = await Promise.all([
    p.find({ collection: "forum-posts", ...options }),
    p.find({ collection: "community-messages", ...options }),
    p.find({ collection: "community-posts", ...options }),
  ]);
  return (
    <>
      <div className="community-page">
        <p role="status">{(await searchParams).message}</p>
        {section === "updates" && <section id="community-updates">
          <h2>社群活动与通知</h2>
          {local.docs.length ? (
            <div className="community-list">
              {local.docs.map((entry) => (
                <article className="panel" key={entry.id}>
                  <small>
                    {entry.category === "event" ? "社群活动" : "社群通知"} ·{" "}
                    {formatDate(entry.createdAt)}
                  </small>
                  <h3>{entry.title}</h3>
                  <p className="preserve">{entry.body}</p>
                  {manager && (
                    <Moderate
                      collection="community-posts"
                      id={entry.id}
                      game={game.id}
                    />
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p>暂无社群活动或通知。</p>
          )}
        </section>}
        {section === "forum" && <section id="community-forum">
          <h2>论坛</h2>
          {posts.docs.length ? (
            <div className="community-list">
              {posts.docs.map((entry) => (
                <article className="panel" key={entry.id}>
                  <small>
                    {entry.authorName} · {formatDate(entry.createdAt)}
                  </small>
                  <h3>
                    <Link href={`/community/${slug}/forum/${entry.id}`}>
                      {entry.title}
                    </Link>
                  </h3>
                  <p className="community-excerpt">{entry.body}</p>
                  {manager && (
                    <Moderate
                      collection="forum-posts"
                      id={entry.id}
                      game={game.id}
                    />
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p>暂无帖子，来发第一篇讨论吧。</p>
          )}
        </section>}
        {section === "chat" && <section id="community-chat">
          <h2>社群交流</h2>
          {messages.docs.length ? (
            <div className="community-list">
              {messages.docs.map((entry) => (
                <article className="community-message" key={entry.id}>
                  <strong>{entry.authorName}</strong>
                  <small>{formatDate(entry.createdAt)}</small>
                  <p className="preserve">{entry.body}</p>
                  {manager && (
                    <Moderate
                      collection="community-messages"
                      id={entry.id}
                      game={game.id}
                    />
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p>社群里还没有发言。</p>
          )}
        </section>}
        {canParticipate(user) ? (
          <>
            {section === "forum" && <section id="community-compose">
              <h2>发表论坛帖子</h2>
              <form className="member-form" action={publishCommunityAction}>
                <input type="hidden" name="game" value={game.id} />
                <input type="hidden" name="kind" value="forum" />
                <label>
                  标题
                  <input name="title" maxLength={120} required />
                </label>
                <label>
                  内容
                  <textarea name="body" maxLength={5000} rows={6} required />
                </label>
                <SubmitButton className="button light">发布到论坛</SubmitButton>
              </form>
            </section>}
            {section === "chat" && <section>
              <h2>在社群发言</h2>
              <form className="member-form" action={publishCommunityAction}>
                <input type="hidden" name="game" value={game.id} />
                <input type="hidden" name="kind" value="message" />
                <label>
                  发言
                  <textarea name="body" maxLength={5000} rows={3} required />
                </label>
                <SubmitButton className="button">发送</SubmitButton>
              </form>
            </section>}
            {manager && section === "updates" && (
              <section>
                <h2>发布社群内容</h2>
                <form className="member-form" action={publishCommunityAction}>
                  <input type="hidden" name="game" value={game.id} />
                  <label>
                    类型
                    <select name="kind">
                      <option value="event">社群活动</option>
                      <option value="notice">社群通知</option>
                    </select>
                  </label>
                  <label>
                    标题
                    <input name="title" maxLength={120} required />
                  </label>
                  <label>
                    内容
                    <textarea name="body" maxLength={5000} rows={5} required />
                  </label>
                  <SubmitButton className="button light">
                    直接发布到本社群
                  </SubmitButton>
                </form>
                <h3>管理发言权限</h3>
                <form className="member-form" action={banAction}>
                  <input type="hidden" name="game" value={game.id} />
                  <label>
                    用户编号
                    <input name="member" inputMode="numeric" required />
                  </label>
                  <label>
                    原因
                    <input name="reason" maxLength={300} />
                  </label>
                  <SubmitButton className="button">
                    限制该用户在本社群发言
                  </SubmitButton>
                </form>
              </section>
            )}
          </>
        ) : (
          <div className="community-action">
            <div>
              <h2>让讨论多一个声音</h2>
              <p>登录后即可发表帖子，与伙伴交流。</p>
            </div>
            <Link className="button" href="/login">
              登录后参与社群讨论
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
function Moderate({
  collection,
  id,
  game,
}: {
  collection: string;
  id: number;
  game: number;
}) {
  return (
    <form action={moderateAction}>
      <input type="hidden" name="collection" value={collection} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="game" value={game} />
      <SubmitButton name="status" value="hidden" className="moderate-button">
        隐藏内容
      </SubmitButton>
    </form>
  );
}
