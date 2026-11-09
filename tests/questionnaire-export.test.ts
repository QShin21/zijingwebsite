import { expect, it } from "vitest";
import {
  csvCell,
  responseCSV,
  responseExportFilename,
  responseExportLayout,
} from "../src/lib/questionnaire-export";
import type { ResponseRecord } from "../src/lib/questionnaire-results";
import type { Answers, Question } from "../src/lib/signup-schema";
import { readCSV } from "./csv";
const q = (
  id: string,
  type: Question["type"],
  extra: Partial<Question> = {},
): Question => ({
  id,
  label: id,
  type,
  required: false,
  options: [],
  ...extra,
});
const record = (
  questions: Question[],
  answers: Answers,
  extra: Partial<ResponseRecord> = {},
): ResponseRecord => ({
  id: 1,
  createdAt: "2026-10-11T16:00:00Z",
  updatedAt: "2026-10-11T17:01:02Z",
  memberName: "本地演示",
  memberEmail: "demo@example.invalid",
  formVersion: "v1",
  questions,
  answers,
  ...extra,
});
const group = q("成员名单", "group", {
  maxEntries: 6,
  fields: [
    { id: "name", label: "姓名", type: "text", required: true, options: [] },
    { id: "student", label: "学号", type: "text", required: true, options: [] },
  ],
});

it("writes one aligned row per response and expands every advanced answer shape", () => {
  const questions = [
    q("姓名", "text"),
    q("偏好", "multiple", { options: ["A", "B"] }),
    q("志愿", "ranking", { options: ["A", "B"] }),
    q("评分", "matrix", { rows: ["环境", "安排"], options: ["好", "差"] }),
    q("矩阵多选", "matrixMultiple", {
      rows: ["周一", "周二"],
      options: ["上午", "下午"],
    }),
    q("联系", "blanks", { rows: ["邮箱", "电话"] }),
    group,
    q("数字", "number"),
    q("说明", "description"),
  ];
  const a = record(questions, {
    姓名: 'a,"b"\nc',
    偏好: ["A"],
    志愿: ["B", "A"],
    评分: { 环境: "好", 安排: "差" },
    矩阵多选: { 周一: ["下午"], 周二: [] },
    联系: { 邮箱: "demo@example.invalid", 电话: "01012345678" },
    成员名单: [
      { name: "演示成员1", student: "00001" },
      { name: "演示成员2", student: "123456789012345678" },
    ],
    数字: "-1.5",
  });
  const text = responseCSV([
    a,
    record(questions, { 姓名: "第二份" }, { id: 2 }),
  ]);
  const { headers, records } = readCSV(text);
  expect(text.startsWith("\uFEFF")).toBe(true);
  expect(records).toHaveLength(2);
  expect(new Set(headers).size).toBe(headers.length);
  expect(records[0]).toMatchObject({
    报名编号: "1",
    账号邮箱: "demo@example.invalid",
    "首次提交时间（北京时间）": "2026-10-12 00:00:00",
    "最后修改时间（北京时间）": "2026-10-12 01:01:02",
    "Q1. 姓名": 'a,"b"\nc',
    "Q2. 偏好 / A": "1",
    "Q2. 偏好 / B": "0",
    "Q3. 志愿 / A（名次）": "2",
    "Q3. 志愿 / B（名次）": "1",
    "Q4. 评分 / 环境": "好",
    "Q5. 矩阵多选 / 周一 / 上午": "0",
    "Q5. 矩阵多选 / 周一 / 下午": "1",
    "Q5. 矩阵多选 / 周二 / 上午": "0",
    "Q6. 联系 / 电话": "01012345678",
    "Q7. 成员名单 / 记录数": "2",
    "Q7. 成员名单 / 第1条 / 学号": "00001",
    "Q7. 成员名单 / 第2条 / 学号": "123456789012345678",
    "Q7. 成员名单 / 第6条 / 姓名": "",
    "Q8. 数字": "-1.5",
  });
  expect(records[1]["Q2. 偏好 / A"]).toBe("");
  expect(headers.some((h) => h.includes("说明"))).toBe(false);
  expect(text).not.toContain("[object Object]");
});
it("retains current empty columns and old questions, options, fields and changed meanings", () => {
  const old = [
    q("同名", "text"),
    q("m", "multiple", { label: "选择", options: ["旧项", "共用"] }),
    group,
  ];
  const current = [
    q("同名", "number"),
    q("m", "multiple", { label: "选择", options: ["新项", "共用"] }),
    {
      ...group,
      fields: group.fields!.map((f) => ({ ...f, label: f.label + "新版" })),
    },
    q("other", "text", { label: "同名" }),
  ];
  const result = readCSV(
    responseCSV(
      [
        record(old, {
          同名: "旧文本",
          m: ["旧项"],
          成员名单: [{ name: "旧姓名", student: "0001" }],
        }),
      ],
      current,
    ),
  );
  expect(result.records[0]).toMatchObject({
    "Q1. 同名": "",
    "Q2. 选择 / 新项": "",
    "Q2. 选择 / 共用": "0",
    "Q2. 选择 / 旧项": "1",
    "Q3. 成员名单 / 第1条 / 姓名新版": "",
    "Q3. 成员名单 / 第1条 / 姓名": "旧姓名",
    "Q4. 同名": "",
    "Q5. 同名": "旧文本",
  });
  const empty = readCSV(responseCSV([], current));
  expect(empty.rows).toHaveLength(0);
  expect(empty.headers).toContain("Q3. 成员名单 / 第6条 / 学号新版");
});
it("expands member details with response context and preserves multiple independent groups", () => {
  const second = { ...group, id: "替补名单", label: "替补名单", maxEntries: 1 };
  const questions = [q("队名", "text"), group, second];
  const r = record(questions, {
    队名: "本地演示队",
    成员名单: [
      { name: "一", student: "0001" },
      { name: "二", student: "0002" },
    ],
    替补名单: [{ name: "三", student: "0003" }],
  });
  const { records } = readCSV(responseCSV([r], questions, "members"));
  expect(records).toHaveLength(3);
  expect(
    Object.keys(records[0]).filter((name) => name === "学号"),
  ).toHaveLength(1);
  expect(records[0]).toMatchObject({
    报名编号: "1",
    账号邮箱: "demo@example.invalid",
    "Q1. 队名": "本地演示队",
    信息组题目: "成员名单",
    组内序号: "1",
    学号: "0001",
    姓名: "一",
  });
  expect(records[2]).toMatchObject({
    信息组题目: "替补名单",
    学号: "0003",
    姓名: "三",
  });
  expect(
    readCSV(responseCSV([record(questions, {})], questions, "members")).rows,
  ).toHaveLength(0);
});
it("keeps UTF-8, line breaks, quotes and formula safety across every export layout", () => {
  const r = record(
    [q("a", "text"), group],
    { a: '  =HYPERLINK("x")', 成员名单: [{ name: "@危险", student: "+001" }] },
    { memberName: "\t=1+1" },
  );
  for (const layout of ["responses", "members", "long"] as const) {
    const text = responseCSV([r], [], layout);
    expect(readCSV(text).records[0]["账号邮箱"]).toBe("demo@example.invalid");
    expect(text).toContain("'\t=1+1");
    expect(text).toContain("'  =HYPERLINK");
    readCSV(text);
  }
  expect(csvCell(-1)).toBe('"-1"');
  expect(csvCell("-1")).toBe('"\'-1"');
  expect(csvCell('a"b')).toBe('"a""b"');
  const long = readCSV(responseCSV([r], [], "long"));
  expect(long.records[1]["答案"]).toContain("姓名：@危险");
});
it("disambiguates separator collisions and repeated field labels without overwriting data", () => {
  const questions = [
    q("m", "matrixMultiple", { rows: ["r", "r / A"], options: ["A / B", "B"] }),
    { ...group, fields: group.fields!.map((f) => ({ ...f, label: "同名" })) },
  ];
  const { headers, records } = readCSV(
    responseCSV([
      record(questions, {
        m: { r: ["A / B"], "r / A": [] },
        成员名单: [{ name: "姓名", student: "学号" }],
      }),
    ]),
  );
  expect(new Set(headers).size).toBe(headers.length);
  expect(records[0]["Q1. m / r / A / B"]).toBe("1");
  expect(records[0]["Q1. m / r / A / B [2]"]).toBe("0");
  expect(records[0]["Q2. 成员名单 / 第1条 / 同名 [1]"]).toBe("姓名");
  expect(records[0]["Q2. 成员名单 / 第1条 / 同名 [2]"]).toBe("学号");
  const member = readCSV(
    responseCSV(
      [record(questions, { 成员名单: [{ name: "姓名", student: "学号" }] })],
      [],
      "members",
    ),
  ).records[0];
  expect(member["Q2. 成员名单 / 同名 [1]"]).toBe("姓名");
  expect(member["Q2. 成员名单 / 同名 [2]"]).toBe("学号");
});
it("uses explicit layout validation and activity/time filenames", () => {
  const unicodeName = responseExportFilename(
    "a".repeat(59) + "😀更多",
    "responses",
  );
  expect(unicodeName).toContain("😀");
  expect(() => encodeURIComponent(unicodeName)).not.toThrow();
  expect(responseExportLayout(null)).toBe("responses");
  expect(responseExportLayout("members")).toBe("members");
  expect(() => responseExportLayout("unknown")).toThrow("导出格式无效");
  expect(
    responseExportFilename(
      "测试/报名",
      "members",
      new Date("2026-10-11T16:01:02Z"),
    ),
  ).toBe("测试_报名-成员明细-20261012000102.csv");
});
