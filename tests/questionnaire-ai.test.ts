import { afterEach, expect, it, vi } from "vitest";
import {
  boundedText,
  generateQuestionnaire,
  generationRequest,
  parseGeneratedForm,
} from "../src/lib/questionnaire-ai";
const request = {
  description: "制作一份通用活动满意度反馈问卷",
  audience: "参与者",
  count: 3,
  logic: false,
};
const draft = {
  title: "活动反馈",
  intro: "请按实际情况填写",
  questions: [1, 2, 3].map((n) => ({
    id: "q" + n,
    type: "rating",
    label: "体验 " + n,
    required: true,
    options: [],
  })),
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("validates bounded generation inputs", () => {
  expect(generationRequest(request)).toEqual(request);
  for (const change of [
    { count: 31 },
    { description: "短" },
    { logic: "true" },
    { audience: "x".repeat(201) },
  ])
    expect(() => generationRequest({ ...request, ...change })).toThrow();
});
it("normalizes AI output and rejects unsafe or invalid logic without silently dropping it", () => {
  expect(
    parseGeneratedForm("```json\n" + JSON.stringify(draft) + "\n```", request)
      .questions.length,
  ).toBe(3);
  expect(() =>
    parseGeneratedForm(
      JSON.stringify({
        ...draft,
        questions: [
          { ...draft.questions[0], jumps: [{ target: "q1" }] },
          ...draft.questions.slice(1),
        ],
      }),
      { ...request, logic: true },
    ),
  ).toThrow();
  expect(() =>
    parseGeneratedForm(
      JSON.stringify({ ...draft, questions: draft.questions.slice(1) }),
      request,
    ),
  ).toThrow();
  expect(() => parseGeneratedForm("not JSON", request)).toThrow();
});
it("uses the requested model on the provider only and never returns the key", async () => {
  vi.stubEnv("QUESTIONNAIRE_AI_API_KEY", "unit-test-private-key");
  vi.stubEnv("QUESTIONNAIRE_AI_BASE_URL", "https://llmapi.paratera.com/v1");
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        choices: [
          {
            message: { content: JSON.stringify(draft) },
            finish_reason: "stop",
          },
        ],
      }),
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
  const result = await generateQuestionnaire(request);
  expect(fetchMock.mock.calls[0][0]).toBe(
    "https://llmapi.paratera.com/v1/chat/completions",
  );
  const init = fetchMock.mock.calls[0][1];
  expect(JSON.parse(init.body).model).toBe("DeepSeek-V4.1-Flash");
  expect(init.redirect).toBe("error");
  expect(JSON.stringify(result)).not.toContain("unit-test-private-key");
});
it.each([401, 429, 500])("redacts upstream errors (%s)", async (status) => {
  vi.stubEnv("QUESTIONNAIRE_AI_API_KEY", "unit-test-private-key");
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response("raw private provider error", { status }),
      ),
  );
  await expect(generateQuestionnaire(request)).rejects.not.toThrow(
    "raw private",
  );
});
it("rejects truncated outputs, untrusted endpoints and oversized streams", async () => {
  vi.stubEnv("QUESTIONNAIRE_AI_API_KEY", "unit-test-private-key");
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ choices: [{ finish_reason: "length" }] }),
        ),
      ),
  );
  await expect(generateQuestionnaire(request)).rejects.toThrow("完整");
  vi.stubEnv("QUESTIONNAIRE_AI_BASE_URL", "https://untrusted.example/v1");
  await expect(generateQuestionnaire(request)).rejects.toThrow("配置");
  await expect(boundedText(new Response("x".repeat(100)), 20)).rejects.toThrow(
    "过长",
  );
});

it("keeps generated copy consistent with logged-in questionnaires", () => {
  const f = parseGeneratedForm(
    JSON.stringify({
      ...draft,
      intro: "这是匿名填写",
      completionMessage: "匿名提交成功",
    }),
    request,
  );
  expect(f.intro).toContain("需要登录");
  expect(f.intro).not.toContain("匿名");
  expect(f.completionMessage).not.toContain("匿名");
});
