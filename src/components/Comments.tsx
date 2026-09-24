import { SubmitButton } from "@/components/SubmitButton";
import Link from "next/link";
import { headers } from "next/headers";
import { cms } from "@/lib/content";
import { canParticipate, formatDate } from "@/lib/rules";
import { commentAction } from "@/app/(frontend)/community/actions";
export async function Comments({
  targetType,
  targetId,
}: {
  targetType: "events" | "albums" | "news" | "announcements";
  targetId: number;
}) {
  const p = await cms();
  const { user } = await p.auth({ headers: await headers() });
  const comments = await p.find({
    collection: "comments",
    overrideAccess: false,
    user: null,
    depth: 0,
    where: {
      and: [
        { targetType: { equals: targetType } },
        { targetId: { equals: targetId } },
      ],
    },
    sort: "createdAt",
    limit: 100,
  });
  return (
    <section className="comments">
      <h2>留言讨论</h2>
      {comments.docs.length ? (
        comments.docs.map((entry) => (
          <article className="community-message" key={entry.id}>
            <strong>{entry.authorName}</strong>
            <small>{formatDate(entry.createdAt)}</small>
            <p className="preserve">{entry.body}</p>
            {canParticipate(user) && (
              <form action={commentAction}>
                <input type="hidden" name="targetType" value={targetType} />
                <input type="hidden" name="targetId" value={targetId} />
                <input type="hidden" name="parent" value={entry.id} />
                <label>
                  回复
                  <input name="body" maxLength={5000} required />
                </label>
                <SubmitButton className="moderate-button">回复</SubmitButton>
              </form>
            )}
          </article>
        ))
      ) : (
        <p>暂无留言。</p>
      )}
      {canParticipate(user) ? (
        <form className="member-form" action={commentAction}>
          <input type="hidden" name="targetType" value={targetType} />
          <input type="hidden" name="targetId" value={targetId} />
          <label>
            写留言
            <textarea name="body" maxLength={5000} required rows={4} />
          </label>
          <SubmitButton className="button light">发布留言</SubmitButton>
        </form>
      ) : (
        <p>
          <Link href="/login">登录后留言或回复</Link>
        </p>
      )}
    </section>
  );
}
