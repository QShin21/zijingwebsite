import type {
  GenerationEvent,
  GenerationProgress,
} from "./questionnaire-ai-contract";
import type { SignupForm } from "./signup-schema";
// The editor displays only checked results and safe server status messages.
export async function readGeneration(
  response: Response,
  progress: (event: GenerationProgress) => void,
) {
  if (
    !response.ok ||
    !response.headers.get("content-type")?.includes("application/x-ndjson")
  ) {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "AI 制作未完成，请重试。");
    return data as { form: SignupForm; model: string };
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("未收到生成结果，请重试。制作需求已保留。");
  const decoder = new TextDecoder();
  let buffer = "",
    bytes = 0,
    result: { form: SignupForm; model: string } | undefined;
  const consume = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as GenerationEvent;
    if (event.type === "progress") progress(event);
    if (event.type === "error") throw new Error(event.error);
    if (event.type === "result") result = event;
  };
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 600000) throw new Error("生成结果过长，请简化需求后重试。");
      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop()!;
      lines.forEach(consume);
    }
    consume(buffer + decoder.decode());
    if (!result)
      throw new Error(
        "连接已中断，未收到完整草稿。制作需求与现有问卷已保留，请重试。",
      );
    return result;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
