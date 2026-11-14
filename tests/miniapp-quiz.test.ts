/* eslint-disable @typescript-eslint/no-explicit-any -- WeChat Page definitions are dynamic objects. */
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";

const event = { id: 7, title: "合成活动", description: "", status: "published" };
const detail = () => ({ admin: true, event, prizes: [{ id: 3, name: "合成奖品", quantity: 2, remaining: 2 }], winners: [], rounds: [{ id: 5, title: "第一轮", status: "open", threshold: 1, closesAt: null, correctAnswers: null, entry: null, questions: [{ prompt: "胜者？", options: ["甲", "乙"] }] }] });
function harness(handler: (path: string, options: any, token: string) => Promise<unknown>) {
  let token = "synthetic-a", definition: any;
  const request = vi.fn((path: string, options: any) => handler(path, options, token));
  const modules: Record<string, unknown> = {
    "../../lib/theme": { page: (value: any) => value },
    "../../lib/i18n": { bind() {}, unbind() {}, navTitle() {}, t: (zh: string) => zh },
    "../../lib/http": { request }, "../../lib/session": { token: () => token },
  };
  runInNewContext(readFileSync("miniprogram/src/pages/quiz/index.js", "utf8"), {
    Page: (value: any) => { definition = value; }, require: (name: string) => modules[name],
    wx: { showModal: ({ success }: any) => success({ confirm: true }), navigateTo: vi.fn(), stopPullDownRefresh: vi.fn() },
  });
  const page = { ...definition, data: JSON.parse(JSON.stringify(definition.data)) };
  page.setData = (values: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(values)) {
      const parts = key.split("."); let target = page.data;
      for (const part of parts.slice(0, -1)) target = target[part] ??= {};
      target[parts.at(-1)!] = value;
    }
  };
  return { page, request, setToken: (value: string) => { token = value; } };
}
const tap = (values: Record<string, unknown>) => ({ currentTarget: { dataset: values } });

it("原生竞猜：选择并提交本人答案，重复点击保持单次请求", async () => {
  let finish!: () => void;
  const gate = new Promise<void>(resolve => { finish = resolve; });
  const { page, request } = harness(async (path, options) => {
    if (options.method === "POST") { await gate; return { submitted: true }; }
    return path.includes("event=") ? detail() : { admin: true, events: [event] };
  });
  page.onLoad({ event: "7" }); await page.onShow();
  page.choose(tap({ id: 5, q: 0, option: 1, type: "choice" }));
  expect(page.data.detail.rounds[0].questions[0].options[1].selected).toBe(true);
  const first = page.roundAction(tap({ action: "submit", id: 5 }));
  await Promise.resolve(); await page.roundAction(tap({ action: "submit", id: 5 }));
  const writes = request.mock.calls.filter(([, options]) => options.method === "POST");
  expect(writes).toHaveLength(1);
  expect(writes[0][1].data).toMatchObject({ eventId: 7, roundId: 5, action: "submit", answers: [1] });
  finish(); await first;
});

it("原生管理：截止日期需要同时填写时间，选项和轮次可保存", async () => {
  const { page, request } = harness(async (path, options) => options.method === "POST" ? { saved: true } : path.includes("event=") ? detail() : { admin: true, events: [event] });
  page.onLoad({ event: "7" }); await page.onShow();
  page.roundInput({ currentTarget: { dataset: { field: "title" } }, detail: { value: "新轮次" } });
  page.roundInput({ currentTarget: { dataset: { field: "date" } }, detail: { value: "2026-12-01" } });
  await page.saveRound(); expect(page.data.error).toContain("截止日期和时间");
  expect(request.mock.calls.filter(([, options]) => options.method === "POST")).toHaveLength(0);
  page.clearDate();
  page.questionInput({ currentTarget: { dataset: { q: 0 } }, detail: { value: "题目" } });
  page.questionInput({ currentTarget: { dataset: { q: 0, option: 0 } }, detail: { value: "甲" } });
  page.questionInput({ currentTarget: { dataset: { q: 0, option: 1 } }, detail: { value: "乙" } });
  await page.saveRound();
  expect(request.mock.calls.find(([, options]) => options.method === "POST")?.[1].data).toMatchObject({ action: "save-round", eventId: 7, title: "新轮次", questions: [{ prompt: "题目", options: ["甲", "乙"] }] });
});

it("切换账号后丢弃前一账号迟到的读取并清除选择", async () => {
  let release!: (value: unknown) => void;
  const delayed = new Promise(resolve => { release = resolve; });
  const { page, setToken } = harness(async (path, _options, token) => {
    if (token === "synthetic-a") return delayed;
    return path.includes("event=") ? detail() : { admin: true, events: [event] };
  });
  page.onLoad({ event: "7" }); const old = page.onShow();
  setToken("synthetic-b"); await page.load();
  page.choose(tap({ id: 5, q: 0, option: 1, type: "choice" }));
  setToken("synthetic-c"); await page.load();
  release({ admin: false, events: [{ id: 99, title: "旧账号数据" }] }); await old;
  expect(page.data.detail.event.title).toBe("合成活动");
  expect(page.data.detail.rounds[0].questions[0].options[1].selected).toBe(false);
});
