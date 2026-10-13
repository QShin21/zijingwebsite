import { applicationError } from "@/lib/application-error";
export function workflowFeedback(error: unknown) {
  const expected = error && typeof error === "object" && "status" in error && typeof error.status === "number" && error.status >= 400 && error.status < 500 && "isPublic" in error && error.isPublic === true;
  return expected ? applicationError(error) : "服务器暂时无法确认操作结果。填写内容已保留，请先刷新已保存记录核对后再重试。";
}
