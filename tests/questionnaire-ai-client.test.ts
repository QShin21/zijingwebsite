import { expect, it, vi } from "vitest";
import { readGeneration } from "../src/lib/questionnaire-ai-client";
import { emptySignup } from "../src/lib/signup-schema";
it("assembles split UTF-8 progress and checked results without exposing intermediate drafts", async () => {
  const data =
    JSON.stringify({
      type: "progress",
      stage: "repairing",
      message: "正在修复草稿",
    }) +
    "\n" +
    JSON.stringify({
      type: "result",
      form: emptySignup,
      model: "DeepSeek-V4.1-Flash",
    }) +
    "\n";
  const bytes = new TextEncoder().encode(data),
    progress = vi.fn();
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      for (let i = 0; i < bytes.length; i += 5)
        c.enqueue(bytes.slice(i, i + 5));
      c.close();
    },
  });
  const result = await readGeneration(
    new Response(stream, {
      headers: { "Content-Type": "application/x-ndjson" },
    }),
    progress,
  );
  expect(progress).toHaveBeenCalledWith(
    expect.objectContaining({ message: "正在修复草稿" }),
  );
  expect(result.form).toEqual(emptySignup);
});
it("rejects a disconnected stream and a server error without accepting a partial draft", async () => {
  const response = (body: string) =>
    new Response(body, { headers: { "Content-Type": "application/x-ndjson" } });
  await expect(
    readGeneration(
      response(
        '{"type":"progress","stage":"generating","message":"正在制作"}\n',
      ),
      () => {},
    ),
  ).rejects.toThrow("完整草稿");
  await expect(
    readGeneration(
      response('{"type":"error","error":"当前问卷已保留"}\n'),
      () => {},
    ),
  ).rejects.toThrow("已保留");
});
