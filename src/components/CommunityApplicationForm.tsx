"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { applyAction } from "@/app/(frontend)/community/actions";

const subscribe = () => () => {};
export function CommunityApplicationForm({
  games,
}: {
  games: { id: number; title: string }[];
}) {
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  return (
    <form
      className="member-form application-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        const data = new FormData(event.currentTarget);
        setBusy(true);
        setError("");
        try {
          const result = await applyAction(data);
          if (result.error) setError(result.error);
          else {
            router.push("/community/apply?submitted=1");
            router.refresh();
          }
        } catch {
          setError("提交失败，请稍后重试；填写的资料已保留。");
        } finally {
          setBusy(false);
        }
      }}
    >
      <p role="status" className="form-feedback">
        {error}
      </p>
      <fieldset disabled={!ready || busy}>
        <label>
          姓名
          <input name="realName" autoComplete="name" required maxLength={80} />
        </label>
        <label>
          手机号
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            required
            pattern="\+?[0-9]{6,20}"
            maxLength={21}
            aria-describedby="phone-hint"
          />
        </label>
        <p id="phone-hint" className="field-hint">
          填写可联系到本人的手机号，国际号码可带 + 国家代码。
        </p>
        <label>
          微信名片二维码
          <input
            name="wechatQr"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            required
            aria-describedby="qr-hint"
          />
        </label>
        <p id="qr-hint" className="field-hint">
          上传微信个人名片二维码，支持 PNG、JPEG、WebP，最大 2
          MB。请确保二维码清晰可扫描。
        </p>
        <label>
          已有游戏（申请新游戏则不选）
          <select name="game">
            <option value="">申请建立新游戏社群</option>
            {games.map((game) => (
              <option value={game.id} key={game.id}>
                {game.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          新游戏名称（选择已有游戏后可留空）
          <input name="proposedGame" maxLength={80} />
        </label>
        <label>
          申请说明（至少 10 字）
          <textarea
            name="reason"
            minLength={10}
            maxLength={3000}
            required
            rows={5}
          />
        </label>
        <p className="field-hint">
          姓名、手机号和二维码用于申请审核及联系，由你本人和有审核权限的负责人查看。
        </p>
        <button className="button" disabled={busy} type="submit">
          {busy ? "正在提交…" : "提交审核"}
        </button>
      </fieldset>
    </form>
  );
}
