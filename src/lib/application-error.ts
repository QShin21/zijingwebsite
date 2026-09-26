import { APIError, ValidationError } from "payload";

const fields: Record<string, string> = {
  realName: "姓名", phone: "手机号", wechatQr: "微信名片二维码",
  game: "已有游戏", proposedGame: "新游戏名称", reason: "申请说明",
};

export function applicationError(error: unknown): string {
  if (error instanceof ValidationError) {
    const messages = error.data.errors.filter(item => fields[item.path])
      .map(item => `${fields[item.path]}：${item.message}`);
    if (messages.length) return messages.join("；");
  }
  if (error instanceof APIError && error.isPublic && error.status >= 400 && error.status < 500)
    return error.message;
  // Unexpected server/database errors must not expose contact data or SQL.
  return "服务器暂时无法保存申请，请稍后重试；已填写的资料会保留。";
}
