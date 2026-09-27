import type { Where } from "payload";
import { headers } from "next/headers";
import { cms } from "@/lib/content";
import { canParticipate } from "@/lib/rules";
import { reactionAction } from "@/app/(frontend)/community/actions";
import { SubmitButton } from "./SubmitButton";
export async function CommunityReactions({ targetType, targetId, event = false }: {
  targetType: "community-posts" | "forum-posts"; targetId: number; event?: boolean;
}) {
  const p = await cms();
  const { user } = await p.auth({ headers: await headers() });
  const kinds = event ? ["like", "attend"] as const : ["like"] as const;
  const items = await Promise.all(kinds.map(async kind => {
    const where: Where = { and: [{ targetType: { equals: targetType } }, { targetId: { equals: targetId } }, { kind: { equals: kind } }] };
    const count = await p.count({ collection: "community-reactions", overrideAccess: false, user: null, where });
    const own = user ? await p.find({ collection: "community-reactions", overrideAccess: false, user, limit: 1,
      select: { kind: true }, context: { ownReactions: true }, where: { targetType: { equals: targetType }, targetId: { equals: targetId }, kind: { equals: kind } } }) : null;
    return { kind, count: count.totalDocs, selected: Boolean(own?.docs.length) };
  }));
  return <div className="reaction-bar">{items.map(item => <form action={reactionAction} key={item.kind}>
    <input type="hidden" name="targetType" value={targetType} /><input type="hidden" name="targetId" value={targetId} /><input type="hidden" name="kind" value={item.kind} />
    <SubmitButton className="button light" aria-pressed={item.selected} disabled={!canParticipate(user)}>
      {item.kind === "attend" ? item.selected ? "已表达参加意愿 · 取消" : "我要参加" : item.selected ? "已点赞 · 取消" : "点赞"} · {item.count}
    </SubmitButton>
  </form>)}{event && <small>参加意愿仅用于初步统计，点击即可，再次点击取消。</small>}{!user && <a href="/login">登录后参与互动</a>}</div>;
}
