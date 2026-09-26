const fields: Record<string, string> = {
  realName: "姓名", phone: "手机号", wechatQr: "微信名片二维码",
  game: "已有游戏", proposedGame: "新游戏名称", reason: "申请说明",
};

export function applicationError(error: unknown): string {
  // Payload collection hooks and actions can load different class instances in
  // the production bundle. Use the public error contract, not instanceof.
  if (error && typeof error === "object" && "status" in error &&
      typeof error.status === "number" && error.status >= 400 && error.status < 500 &&
      "isPublic" in error && error.isPublic === true) {
    if ("data" in error && error.data && typeof error.data === "object" &&
        "errors" in error.data && Array.isArray(error.data.errors)) {
      const messages = error.data.errors.flatMap((item: unknown) => {
        if (!item || typeof item !== "object" || !("path" in item) || !("message" in item) ||
            typeof item.path !== "string" || typeof item.message !== "string" || !fields[item.path]) return [];
        return [`${fields[item.path]}：${item.message}`];
      });
      if (messages.length) return messages.join("；");
    }
    if ("message" in error && typeof error.message === "string") return error.message;
  }
  // Unexpected server/database errors must not expose contact data or SQL.
  return "服务器暂时无法保存申请，请稍后重试；已填写的资料会保留。";
}
