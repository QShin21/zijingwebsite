import { curateForumAction } from "@/app/(frontend)/community/actions";
import { SubmitButton } from "./SubmitButton";
export function ForumModeration({ id, pinned, featured }: { id: number; game: number; pinned: boolean; featured: boolean }) {
  return <div className="reaction-bar">{[["pinned", pinned, "置顶"], ["featured", featured, "加精"], ["status", false, "隐藏内容"]].map(([field, enabled, label]) => <form action={curateForumAction} key={String(field)}>
    <input type="hidden" name="id" value={id} /><input type="hidden" name="field" value={String(field)} /><input type="hidden" name="enabled" value={String(!enabled)} />
    <SubmitButton className="moderate-button">{enabled ? "取消" : ""}{label}</SubmitButton>
  </form>)}</div>;
}
