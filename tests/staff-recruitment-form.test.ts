import { expect, it } from "vitest";
import { endTarget, questionRoute, type ConditionGroup } from "../src/lib/questionnaire-flow";
import { normalizeSignup, validateAnswers, type Question } from "../src/lib/signup-schema";
import { defaultStaffForm, staffAnswers, staffDepartments, staffForm } from "../src/lib/staff-recruitment-model";

const coreIDs = ["department", "name", "school", "motivation", "experience", "time", "contact"];
const answers = {
  department: staffDepartments.execution,
  name: "合成申请人",
  school: "合成院系与年级",
  motivation: "合成申请动机",
  experience: "合成相关经验",
  time: "合成每周时段",
  contact: "synthetic@example.invalid",
};
const draft = () => structuredClone(defaultStaffForm);
const question = (id: string, extra: Partial<Question> = {}): Question => ({
  id, label: "合成扩展题 " + id, type: "text", required: false, options: [], ...extra,
});
const departmentCondition = (value: string): ConditionGroup => ({
  mode: "all", rules: [{ questionId: "department", operator: "equals", value }],
});

it("默认骨干问卷保留全部核心题并可校验提交资料", () => {
  const form = staffForm(defaultStaffForm);
  expect(questionRoute(form, answers).questions.map(item => item.id)).toEqual(defaultStaffForm.questions.map(item => item.id));
  expect(staffAnswers(form, answers)).toEqual({ department: "execution", answers: { ...answers, works: "" } });
});

it("通用问卷允许无条件结束，骨干问卷在保存前拒绝方向题提前结束", () => {
  const value = draft();
  value.questions[0].jumps = [{ target: endTarget }];
  const generic = normalizeSignup(value);
  expect(questionRoute(generic, answers).questions.map(item => item.id)).toEqual(["department"]);
  expect(validateAnswers(generic, answers)).toEqual({ department: staffDepartments.execution });
  expect(() => staffForm(value)).toThrow("字段：name");
});

it("拒绝方向题跳到后续题目时越过核心姓名题", () => {
  const value = draft();
  value.questions[0].jumps = [{ target: "school" }];
  expect(() => staffForm(value)).toThrow("字段：name");
});

it.each(coreIDs)("拒绝扩展题跳转越过核心必填字段 %s", id => {
  const value = draft(), index = value.questions.findIndex(item => item.id === id);
  const target = value.questions[index + 1]?.id ?? endTarget;
  value.questions.splice(index, 0, question("branch_gate", { jumps: [{ target }] }));
  expect(() => staffForm(value)).toThrow("字段：" + id);
});

it.each(["execution", "publicity"] as const)("拒绝仅 %s 条件分支跳过核心题的问卷", department => {
  const value = draft();
  value.questions[0].jumps = [
    { when: departmentCondition(staffDepartments.execution), target: department === "execution" ? endTarget : "name" },
    { when: departmentCondition(staffDepartments.publicity), target: department === "publicity" ? "school" : "name" },
  ];
  const generic = normalizeSignup(value);
  const otherDepartment = department === "execution" ? "publicity" : "execution";
  expect(questionRoute(generic, { ...answers, department: staffDepartments[otherDepartment] }).questions.map(item => item.id)).toEqual(expect.arrayContaining(coreIDs));
  expect(() => staffForm(value)).toThrow("字段：name");
});

it.each(Object.entries(staffDepartments))("保留只跳扩展题的合法分支，%s 路径可提交全部核心资料", (department, label) => {
  const value = draft();
  value.questions.splice(1, 0,
    question("extra_rating", { type: "rating", required: true }),
    question("role_note", { type: "description" }),
  );
  value.questions[0].jumps = [
    { when: departmentCondition(staffDepartments.execution), target: "name" },
    { when: departmentCondition(staffDepartments.publicity), target: "role_note" },
  ];
  value.questions.find(item => item.id === "contact")!.jumps = [{ target: endTarget }];
  value.questions.push(question("follow_up", { type: "single", required: true, options: ["可以", "暂不"] }));

  const form = staffForm(value), raw = { ...answers, department: label, extra_rating: "3", follow_up: "可以" };
  const route = questionRoute(form, raw);
  expect(route.questions.map(item => item.id)).toEqual(expect.arrayContaining(coreIDs));
  expect(route.questions.some(item => item.id === "extra_rating")).toBe(department === "both");
  expect(route.questions.some(item => item.id === "role_note")).toBe(department !== "execution");
  expect(route.questions.some(item => item.id === "follow_up")).toBe(false);
  expect(route.jumps).toEqual(expect.arrayContaining([{ from: "contact", target: endTarget, skipped: 1 }]));

  const clean = staffAnswers(form, raw);
  expect(clean.department).toBe(department);
  expect(clean.answers).toMatchObject({ ...answers, department: label });
  expect(clean.answers).not.toHaveProperty("follow_up");
  if (department === "both") expect(clean.answers.extra_rating).toBe("3");
  else expect(clean.answers).not.toHaveProperty("extra_rating");
});
