// Generated from src/lib/questionnaire-flow.ts; run pnpm miniapp:generate.
// Source SHA-256: 6c745e7a204f0f2a9e742e57a5a78609ab4a3ce839d77bd020e231d5197272c0
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.conditionLabels = exports.endTarget = void 0;
exports.normalizeCondition = normalizeCondition;
exports.validateFlow = validateFlow;
exports.matchesCondition = matchesCondition;
exports.questionRoute = questionRoute;
exports.endTarget = "$end";
exports.conditionLabels = {
    equals: "等于／包含",
    notEquals: "不等于／不包含",
    answered: "已作答",
    notAnswered: "未作答",
    gt: "大于",
    gte: "大于等于",
    lt: "小于",
    lte: "小于等于",
};
function normalizeCondition(raw) {
    const d = raw;
    if (!d ||
        !["all", "any"].includes(d.mode) ||
        !Array.isArray(d.rules) ||
        !d.rules.length ||
        d.rules.length > 10)
        throw new Error("条件应包含 1–10 条规则，并选择全部或任一满足");
    return {
        mode: d.mode,
        rules: d.rules.map((r) => {
            if (!r ||
                typeof r.questionId !== "string" ||
                !Object.prototype.hasOwnProperty.call(exports.conditionLabels, r.operator) ||
                typeof r.value !== "string" ||
                r.value.length > 200)
                throw new Error("条件规则无效");
            return { questionId: r.questionId, operator: r.operator, value: r.value };
        }),
    };
}
function validateGroup(group, sources, title) {
    for (const r of group.rules) {
        const source = sources.find((q) => q.id === r.questionId);
        if (!source ||
            ["description", "matrix", "matrixMultiple", "blanks", "group"].includes(source.type))
            throw new Error(title + "：条件只能引用当前范围内的非矩阵作答题");
        if (["gt", "gte", "lt", "lte"].includes(r.operator)) {
            if (!["number", "rating", "nps"].includes(source.type) ||
                !/^-?\d+(\.\d+)?$/.test(r.value) ||
                !Number.isFinite(Number(r.value)))
                throw new Error(title + "：数值比较应引用数字或评分题并填写有效数字");
        }
        else if (["equals", "notEquals"].includes(r.operator) &&
            (!r.value ||
                (["single", "multiple", "select", "ranking"].includes(source.type) &&
                    !source.options.includes(r.value))))
            throw new Error(title + "：条件选项或值无效");
    }
}
function validateFlow(questions) {
    questions.forEach((q, i) => {
        var _a;
        if (q.display)
            validateGroup(q.display, questions.slice(0, i), q.label);
        (_a = q.jumps) === null || _a === void 0 ? void 0 : _a.forEach((jump, j) => {
            if (jump.when)
                validateGroup(jump.when, questions.slice(0, i + 1), q.label);
            else if (j !== q.jumps.length - 1)
                throw new Error(q.label + "：无条件跳转应放在最后");
            if (jump.target !== exports.endTarget &&
                !questions.slice(i + 1).some((next) => next.id === jump.target))
                throw new Error(q.label + "：跳转目标应为后续题目或结束问卷");
        });
    });
}
function matchesCondition(group, answers, visible) {
    if (!group)
        return true;
    const results = group.rules.map((r) => {
        if (!visible.has(r.questionId))
            return false;
        const answer = answers[r.questionId];
        const filled = Array.isArray(answer)
            ? answer.length > 0
            : typeof answer === "string" && answer.trim().length > 0;
        if (r.operator === "answered")
            return filled;
        if (r.operator === "notAnswered")
            return !filled;
        if (["gt", "gte", "lt", "lte"].includes(r.operator)) {
            if (!filled ||
                typeof answer !== "string" ||
                !/^-?\d+(\.\d+)?$/.test(answer.trim()))
                return false;
            const a = Number(answer), b = Number(r.value);
            if (!Number.isFinite(a) || !Number.isFinite(b))
                return false;
            return r.operator === "gt"
                ? a > b
                : r.operator === "gte"
                    ? a >= b
                    : r.operator === "lt"
                        ? a < b
                        : a <= b;
        }
        const equal = Array.isArray(answer)
            ? answer.includes(r.value)
            : typeof answer === "string" && answer.trim() === r.value;
        return r.operator === "equals" ? equal : filled && !equal;
    });
    return group.mode === "all" ? results.every(Boolean) : results.some(Boolean);
}
function questionRoute(form, answers) {
    var _a;
    const questions = [], visible = new Set();
    const jumps = [];
    for (let i = 0; i < form.questions.length; i++) {
        const q = form.questions[i], condition = q.showWhen;
        if (condition &&
            !matchesCondition({
                mode: "all",
                rules: [
                    {
                        questionId: condition.questionId,
                        operator: "equals",
                        value: condition.option,
                    },
                ],
            }, answers, visible))
            continue;
        if (!matchesCondition(q.display, answers, visible))
            continue;
        questions.push(q);
        visible.add(q.id);
        const jump = (_a = q.jumps) === null || _a === void 0 ? void 0 : _a.find((rule) => matchesCondition(rule.when, answers, visible));
        if (!jump)
            continue;
        if (jump.target === exports.endTarget) {
            jumps.push({
                from: q.id,
                target: exports.endTarget,
                skipped: form.questions.length - i - 1,
            });
            break;
        }
        const next = form.questions.findIndex((p) => p.id === jump.target);
        // Invalid drafts must never loop or accidentally skip validation.
        if (next <= i)
            continue;
        jumps.push({ from: q.id, target: jump.target, skipped: next - i - 1 });
        i = next - 1;
    }
    return { questions, jumps };
}
