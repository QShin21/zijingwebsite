import { afterEach, expect, it, vi } from "vitest";
import {
  boundedText,
  generateQuestionnaire,
  generationRequest,
  generationPrompt,
  parseGeneratedForm,
} from "../src/lib/questionnaire-ai";
const request = {
  description: "制作一份通用活动满意度反馈问卷",
  audience: "参与者",
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
  expect(
    parseGeneratedForm(
      JSON.stringify({ ...draft, questions: draft.questions.slice(1) }),
      request,
    ).questions,
  ).toHaveLength(2);
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
  expect(JSON.parse(init.body).thinking).toEqual({ type: "disabled" });
  expect(JSON.parse(init.body).response_format).toEqual({
    type: "json_object",
  });
  expect(init.redirect).toBe("error");
  expect(JSON.stringify(result)).not.toContain("unit-test-private-key");
});
const upstream = (content: string, finish = "stop") =>
  new Response(
    JSON.stringify({
      choices: [{ message: { content }, finish_reason: finish }],
    }),
  );
it("lets the prompt determine question quantity, including more than 30 or 100 questions", () => {
  const many = {
    ...draft,
    questions: Array.from({ length: 101 }, (_, i) => ({
      ...draft.questions[0],
      id: "q" + i,
    })),
  };
  expect(
    parseGeneratedForm(JSON.stringify(many), request).questions,
  ).toHaveLength(101);
  expect(
    parseGeneratedForm(
      JSON.stringify({ ...draft, questions: draft.questions.slice(0, 1) }),
      request,
    ).questions,
  ).toHaveLength(1);
  expect(generationRequest({ ...request, count: 8 })).not.toHaveProperty(
    "count",
  );
  expect(generationPrompt(request)[0].content).not.toContain("3–30");
});
it("recovers reasoning-only truncation in the same generation and increases output room", async () => {
  vi.stubEnv("QUESTIONNAIRE_AI_API_KEY", "unit-test-private-key");
  const mock = vi
    .fn()
    .mockResolvedValueOnce(upstream("", "length"))
    .mockResolvedValueOnce(upstream(JSON.stringify(draft)));
  vi.stubGlobal("fetch", mock);
  const progress = vi.fn();
  expect(
    (await generateQuestionnaire(request, undefined, progress)).questions,
  ).toHaveLength(3);
  expect(mock).toHaveBeenCalledTimes(2);
  expect(JSON.parse(mock.mock.calls[1][1].body).max_tokens).toBeGreaterThan(
    JSON.parse(mock.mock.calls[0][1].body).max_tokens,
  );
  expect(
    progress.mock.calls.some(([event]) => event.stage === "repairing"),
  ).toBe(true);
});
it("passes concrete schema errors back for one repair and never silently discards invalid branches", async () => {
  vi.stubEnv("QUESTIONNAIRE_AI_API_KEY", "unit-test-private-key");
  const invalid = {
    ...draft,
    questions: [
      { ...draft.questions[0], jumps: [{ target: "q1" }] },
      ...draft.questions.slice(1),
    ],
  };
  const mock = vi
    .fn()
    .mockResolvedValueOnce(upstream(JSON.stringify(invalid)))
    .mockResolvedValueOnce(upstream(JSON.stringify(draft)));
  vi.stubGlobal("fetch", mock);
  expect(
    (await generateQuestionnaire({ ...request, logic: "auto" })).questions,
  ).toHaveLength(3);
  const repair = JSON.parse(mock.mock.calls[1][1].body).messages.at(-1).content;
  expect(repair).toContain("后续题目");
});
it("bounds unsuccessful retries and does not retry client cancellation or authorization errors", async () => {
  vi.stubEnv("QUESTIONNAIRE_AI_API_KEY", "unit-test-private-key");
  const mock = vi.fn().mockImplementation(async () => upstream("not JSON"));
  vi.stubGlobal("fetch", mock);
  await expect(generateQuestionnaire(request)).rejects.toThrow("自动修复");
  expect(mock).toHaveBeenCalledTimes(2);
  mock.mockClear();
  const abort = new AbortController();
  abort.abort();
  await expect(generateQuestionnaire(request, abort.signal)).rejects.toThrow(
    "取消",
  );
  expect(mock).not.toHaveBeenCalled();
});
it("validates refinement input and sends the selected draft without unrelated account data", () => {
  const input = generationRequest({
    ...request,
    draft: { ...draft, enabled: true },
    refinement: "将评分改为可选填写",
  });
  expect(input.draft?.questions).toHaveLength(3);
  expect(generationPrompt(input)[1].content).toContain("修改要求");
  expect(() =>
    generationRequest({ ...request, refinement: "补充信息" }),
  ).toThrow("草稿");
  expect(() =>
    generationRequest({
      ...request,
      draft: { questions: [] },
      refinement: "x".repeat(2001),
    }),
  ).toThrow();
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
