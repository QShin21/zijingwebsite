/** Presentation-layer request feedback. A lost response cannot prove a write failed. */
const legacyUnknownWriteMessage = "服务器暂时无法保存申请，请稍后重试；已填写的资料会保留。";
export async function activityRequest(url: string, method = "GET", data?: unknown) {
  const reading = method === "GET";
  let response: Response;
  try {
    response = await fetch(url, { method, cache: "no-store", headers: { "Content-Type": "application/json" }, ...(data !== undefined ? { body: JSON.stringify(data) } : {}) });
  } catch {
    throw new Error(reading ? "网络连接中断，请检查连接后重新加载。" : "提交结果尚未确认。填写内容已保留，请先刷新本人回执或已保存记录，确认后再重试。");
  }
  let value;
  try { value = await response.json(); }
  catch { throw new Error(reading ? "暂时无法读取服务器响应，请稍后重新加载。" : "服务器响应不完整，提交结果尚未确认。请先查看本人回执或已保存记录，填写内容已保留。"); }
  if (!response.ok) {
    if (!reading && (response.status >= 500 || value.error === legacyUnknownWriteMessage)) throw new Error("服务器暂时无法确认提交结果。填写内容已保留，请先刷新本人回执或已保存记录，再决定是否重试。");
    throw new Error(value.error || (response.status === 403 ? "当前账号没有此操作权限。" : "请求未被接受，请核对内容后重试。"));
  }
  return value;
}
