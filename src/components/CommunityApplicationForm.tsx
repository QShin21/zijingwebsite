"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { applyAction } from "@/app/(frontend)/community/actions";

const subscribe = () => () => {};
export function CommunityApplicationForm({
  games,
  initial,
}: {
  games: { id: number; title: string }[];
  initial?: { id: number; updatedAt: string; game?: number | null; proposedGame: string; realName?: string | null; phone?: string | null; reason: string; contactConsent?: boolean | null };
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
      <input type="hidden" name="id" value={initial?.id ?? ""} />
      <input type="hidden" name="revision" value={initial?.updatedAt ?? ""} />
      <p role="status" className="form-feedback">
        {error}
      </p>
      <fieldset disabled={!ready || busy}>
        <label>
          姓名
          <input name="realName" autoComplete="name" required maxLength={80} defaultValue={initial?.realName ?? ""} />
        </label>
        <label>
          手机号
          <input
            name="phone"
            defaultValue={initial?.phone ?? ""}
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
            required={!initial}
            aria-describedby="qr-hint"
          />
        </label>
        <p id="qr-hint" className="field-hint">
          上传微信个人名片二维码，支持 PNG、JPEG、WebP，最大 2
          MB。请确保二维码清晰可扫描。修改申请时不选文件可保留原名片。
        </p>
        <label>
          已有游戏（申请新游戏则不选）
          <select name="game" defaultValue={initial?.game ?? ""}>
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
          <input name="proposedGame" maxLength={80} defaultValue={initial?.proposedGame ?? ""} />
        </label>
        <label>
          申请说明（至少 10 字）
          <textarea
            name="reason"
            defaultValue={initial?.reason ?? ""}
            minLength={10}
            maxLength={3000}
            required
            rows={5}
          />
        </label>
        <p className="field-hint">
          姓名、手机号用于申请审核及联系，仅本人和现有最高管理审核者可读。微信名片只有在你同意、申请批准且任职有效时，才向登录成员展示；可在我的申请中更新或关闭。
        </p>
        <label className="check"><input type="checkbox" name="contactConsent" defaultChecked={initial?.contactConsent ?? false} />我同意批准后在任期间向登录成员展示昵称和微信个人名片</label>
        <button className="button" disabled={busy} type="submit">
          {busy ? "正在提交…" : initial ? "修改并重新提交" : "提交审核"}
        </button>
      </fieldset>
    </form>
  );
}
