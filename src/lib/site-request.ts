
import { APIError } from "payload";
import { serverURL } from "./environment";

export function siteRequestHeaders(request: Request, write = false) {
  const token = /^JWT [A-Za-z0-9._-]+$/.test(request.headers.get("authorization") || "");
  if (write) {
    const origin = request.headers.get("origin");
    const expected = new URL(serverURL).origin;
    if (origin && origin !== expected)
      throw new APIError("请求来源无效，请从网站或小程序重新操作", 403);
    if (!token && origin !== expected)
      throw new APIError("浏览器写入需要同源 Origin，小程序写入需要有效 JWT 凭据", 403);
  }
  const headers = new Headers(request.headers);
  if (token) headers.delete("cookie");
  return headers;
}

export async function boundedBody(request: Request, maximum: number) {
  if (Number(request.headers.get("content-length")) > maximum)
    throw new APIError("请求内容过长", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new APIError("请求正文为空", 400);
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maximum) {
        await reader.cancel();
        throw new APIError("请求内容过长", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
