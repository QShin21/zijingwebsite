// Generated from src/lib/questionnaire-model.ts; run pnpm miniapp:generate.
// Source SHA-256: 479ecabd7609a1030529ce157d1420ce753767f8e3d8ddf960a81d930c298987
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasRows = exports.hasOptions = exports.questionTypes = void 0;
exports.normalizeQuestionExtras = normalizeQuestionExtras;
exports.normalizeFormExtras = normalizeFormExtras;
exports.matchesDisplay = matchesDisplay;
exports.validateAdvancedAnswer = validateAdvancedAnswer;
exports.formatAnswer = formatAnswer;
exports.questionPages = questionPages;
exports.sanitizeDraft = sanitizeDraft;
exports.randomizedOptions = randomizedOptions;
const { fromEntries } = require("../questionnaire-runtime");
const questionnaire_flow_1 = require("./questionnaire-flow");
const signup_schema_1 = require("./signup-schema");
exports.questionTypes = {
    text: "单行文本",
    textarea: "多行文本",
    single: "单选",
    multiple: "多选",
    select: "下拉选择",
    number: "数字",
    date: "日期",
    time: "时间",
    rating: "评分量表",
    nps: "NPS 推荐度",
    ranking: "排序",
    matrix: "矩阵单选",
    matrixMultiple: "矩阵多选",
    blanks: "多项填空",
    group: "可增减信息组",
    description: "段落说明",
};
const hasOptions = (type) => [
    "single",
    "multiple",
    "select",
    "ranking",
    "matrix",
    "matrixMultiple",
].includes(type);
exports.hasOptions = hasOptions;
const hasRows = (type) => ["matrix", "matrixMultiple", "blanks"].includes(type);
exports.hasRows = hasRows;
function fail(message) {
    throw new Error(message);
}
function normalizeQuestionExtras(raw, q) {
    var _a, _b, _c;
    if (raw.pageBreak === true)
        q.pageBreak = true;
    if (raw.randomize === true && (0, exports.hasOptions)(q.type) && q.type !== "ranking")
        q.randomize = true;
    if (q.type === "description")
        q.required = false;
    if (q.type === "group") {
        if (!Array.isArray(raw.fields) ||
            !raw.fields.length ||
            raw.fields.length > 10)
            fail(q.label + "：信息组需要 1–10 个字段");
        const fields = raw.fields.map((field) => {
            if (!field || !["text", "select", "number"].includes(String(field.type)))
                fail(q.label + "：字段仅支持文本、下拉选择和数字");
            if (field.display || field.showWhen || field.jumps)
                fail(q.label + "：组内字段不支持分支，请在信息组题目上设置");
            return fromEntries([
                "id",
                "label",
                "type",
                "required",
                "options",
                "format",
                "minLength",
                "maxLength",
                "min",
                "max",
                "step",
                "placeholder",
            ]
                .filter((key) => field[key] != null)
                .map((key) => [key, field[key]]));
        });
        q.fields = (0, signup_schema_1.normalizeSignup)({ enabled: true, questions: fields })
            .questions;
        for (const key of ["minEntries", "maxEntries"]) {
            const value = (_a = raw[key]) !== null && _a !== void 0 ? _a : (key === "minEntries" ? 1 : 10);
            if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 20)
                fail(q.label + "：记录条数应为 1–20 的整数");
            q[key] = Number(value);
        }
        if (q.minEntries > q.maxEntries)
            fail(q.label + "：最少条数不能超过最多条数");
    }
    if ((0, exports.hasRows)(q.type)) {
        if (!Array.isArray(raw.rows) ||
            !raw.rows.length ||
            raw.rows.length > 20 ||
            raw.rows.some((v) => typeof v !== "string" || !v.trim() || v.trim().length > 120))
            fail(q.label + "：请配置 1–20 个子题，每项最多 120 字");
        q.rows = raw.rows.map((v) => v.trim());
        if (new Set(q.rows).size !== q.rows.length ||
            q.rows.some((v) => Object.prototype.hasOwnProperty.call(Object.prototype, v) || v === "prototype"))
            fail(q.label + "：子题名称重复或无效");
    }
    if (["number", "rating", "nps"].includes(q.type)) {
        for (const key of ["min", "max", "step"]) {
            if (raw[key] != null) {
                if (typeof raw[key] !== "number" ||
                    !Number.isFinite(raw[key]) ||
                    Math.abs(raw[key]) > 1e9)
                    fail(q.label + "：数值限制无效");
                q[key] = raw[key];
            }
        }
        if (q.type === "nps") {
            q.min = 0;
            q.max = 10;
            q.step = 1;
        }
        if (q.type === "rating") {
            (_b = q.min) !== null && _b !== void 0 ? _b : (q.min = 1);
            (_c = q.max) !== null && _c !== void 0 ? _c : (q.max = 5);
            q.step = 1;
            if (!Number.isInteger(q.min) ||
                !Number.isInteger(q.max) ||
                q.min < 0 ||
                q.max > 10)
                fail(q.label + "：评分范围应为 0–10 内的整数");
        }
        if (q.min != null && q.max != null && q.min >= q.max)
            fail(q.label + "：最大值应大于最小值");
        if (q.step != null && q.step <= 0)
            fail(q.label + "：步长应大于零");
    }
    if (raw.display != null)
        q.display = (0, questionnaire_flow_1.normalizeCondition)(raw.display);
    if (raw.jumps != null) {
        if (!Array.isArray(raw.jumps) || !raw.jumps.length || raw.jumps.length > 10)
            fail(q.label + "：跳转应包含 1–10 条分支");
        q.jumps = raw.jumps.map((raw) => {
            if (!raw || typeof raw !== "object" || typeof raw.target !== "string")
                fail(q.label + "：跳转规则无效");
            return {
                ...(raw.when != null ? { when: (0, questionnaire_flow_1.normalizeCondition)(raw.when) } : {}),
                target: raw.target,
            };
        });
    }
}
function normalizeFormExtras(raw, questions) {
    const result = {};
    for (const key of ["title", "completionMessage"]) {
        if (raw[key] != null && typeof raw[key] !== "string")
            fail("问卷文案格式无效");
        const text = String(raw[key] || "").trim();
        if (text.length > (key === "title" ? 120 : 1000))
            fail("问卷文案过长");
        if (text)
            result[key] = text;
    }
    if (raw.theme != null) {
        if (!["purple", "blue", "green"].includes(String(raw.theme)))
            fail("主题无效");
        result.theme = raw.theme;
    }
    (0, questionnaire_flow_1.validateFlow)(questions);
    if (raw.enabled === true && !questions.some((q) => q.type !== "description"))
        fail("问卷至少需要一道作答题");
    return result;
}
function matchesDisplay(q, answers, visible) {
    return (0, questionnaire_flow_1.matchesCondition)(q.display, answers, visible);
}
function validateAdvancedAnswer(q, raw) {
    var _a, _b;
    const failAnswer = (hint) => fail(q.label + "：" + hint);
    if (q.type === "group") {
        if (raw != null &&
            (!Array.isArray(raw) ||
                raw.some((row) => !row || typeof row !== "object" || Array.isArray(row))))
            failAnswer("信息组填写格式无效");
        const entries = (raw || []);
        if (entries.some((row) => Object.keys(row).some((id) => !q.fields.some((field) => field.id === id))))
            failAnswer("字段已变化，请刷新后填写");
        if (entries.length > q.maxEntries)
            failAnswer(`最多填写 ${q.maxEntries} 条记录`);
        const nonempty = entries.some((row) => Object.values(row).some((value) => value !== "" && value != null));
        if (!q.required && !nonempty)
            return [];
        if (entries.length < q.minEntries)
            failAnswer(`至少填写 ${q.minEntries} 条记录`);
        return entries.map((row, index) => {
            try {
                const result = (0, signup_schema_1.validateAnswers)({
                    enabled: true,
                    closed: false,
                    start: "",
                    end: "",
                    intro: "",
                    questions: q.fields,
                }, row);
                if (!Object.values(result).some((value) => typeof value === "string" && value.trim()))
                    throw new Error("请填写此条记录，或移除多余的空记录");
                return result;
            }
            catch (error) {
                return failAnswer(`第 ${index + 1} 条：${error.message}`);
            }
        });
    }
    if ((0, exports.hasRows)(q.type)) {
        if (raw != null && (typeof raw !== "object" || Array.isArray(raw)))
            failAnswer("子题填写格式无效");
        const input = (raw || {}), result = {};
        if (Object.keys(input).some((key) => !q.rows.includes(key)))
            failAnswer("子题已变化，请刷新");
        for (const row of q.rows) {
            const value = input[row];
            if (q.type === "matrixMultiple") {
                if (value != null &&
                    (!Array.isArray(value) ||
                        value.some((v) => typeof v !== "string" || !q.options.includes(v))))
                    failAnswer(row + "选项无效");
                const answer = [...new Set((value || []))];
                if (q.required && !answer.length)
                    failAnswer("请完成“" + row + "”");
                result[row] = answer;
            }
            else {
                if (value != null && typeof value !== "string")
                    failAnswer(row + "格式无效");
                const answer = String(value || "").trim();
                if ((q.required && !answer) ||
                    answer.length > 200 ||
                    (q.type === "matrix" && answer && !q.options.includes(answer)))
                    failAnswer("请检查“" + row + "”");
                result[row] = answer;
            }
        }
        return result;
    }
    if (q.type === "ranking") {
        if (raw != null &&
            (!Array.isArray(raw) || raw.some((v) => typeof v !== "string")))
            failAnswer("请完成排序");
        const answer = (raw || []);
        if (!q.required && !answer.length)
            return [];
        if (answer.length !== q.options.length ||
            new Set(answer).size !== answer.length ||
            answer.some((v) => !q.options.includes(v)))
            failAnswer("请为所有选项选择不同名次");
        return answer;
    }
    if (raw != null && typeof raw !== "string")
        failAnswer("填写格式无效");
    const answer = String(raw || "").trim();
    if (!answer) {
        if (q.required)
            failAnswer("请填写此题");
        return "";
    }
    if (answer.length > 200)
        failAnswer("答案过长");
    if (q.type === "select" && !q.options.includes(answer))
        failAnswer("请选择有效选项");
    if (["number", "rating", "nps"].includes(q.type)) {
        const n = Number(answer);
        if (!/^-?\d+(\.\d+)?$/.test(answer) ||
            !Number.isFinite(n) ||
            (q.min != null && n < q.min) ||
            (q.max != null && n > q.max))
            failAnswer(`请填写范围内的数字（${(_a = q.min) !== null && _a !== void 0 ? _a : "不限"} 至 ${(_b = q.max) !== null && _b !== void 0 ? _b : "不限"}）`);
        if (q.step != null &&
            Math.abs((n - (q.min || 0)) / q.step - Math.round((n - (q.min || 0)) / q.step)) > 1e-7)
            failAnswer("数值不符合步长");
    }
    if (q.type === "date" &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(answer) ||
            !Number.isFinite(Date.parse(answer)) ||
            new Date(answer).toISOString().slice(0, 10) !== answer))
        failAnswer("请输入有效日期");
    if (q.type === "time" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(answer))
        failAnswer("请输入有效时间");
    return answer;
}
function formatAnswer(answer, question) {
    if (answer == null || answer === "")
        return "未填写";
    if (Array.isArray(answer))
        return (answer
            .map((row, index) => typeof row === "string"
            ? row
            : `第 ${index + 1} 条：` +
                Object.entries(row)
                    .map(([key, value]) => { var _a, _b; return `${((_b = (_a = question === null || question === void 0 ? void 0 : question.fields) === null || _a === void 0 ? void 0 : _a.find((field) => field.id === key)) === null || _b === void 0 ? void 0 : _b.label) || key}：${value || "未填写"}`; })
                    .join("；"))
            .join(answer.some((v) => typeof v === "object") ? "\n" : "、") ||
            "未填写");
    if (typeof answer === "object")
        return Object.entries(answer)
            .map(([row, value]) => `${row}：${Array.isArray(value) ? value.join("、") || "未填写" : value || "未填写"}`)
            .join("\n");
    return answer;
}
function questionPages(questions, size) {
    var _a;
    const pages = [];
    let afterJump = false;
    for (const q of questions) {
        if (afterJump ||
            !pages.length ||
            (q.pageBreak && pages[pages.length - 1].length) ||
            pages[pages.length - 1].filter((v) => v.type !== "description").length >= size)
            pages.push([]);
        pages[pages.length - 1].push(q);
        afterJump = Boolean((_a = q.jumps) === null || _a === void 0 ? void 0 : _a.length);
    }
    return pages.length ? pages : [[]];
}
// Restore only bounded, well-shaped values belonging to the current form.
function sanitizeDraft(form, raw) {
    const result = {};
    for (const q of form.questions) {
        const value = raw[q.id];
        if (q.type === "group") {
            if (Array.isArray(value))
                result[q.id] = value
                    .slice(0, q.maxEntries || 20)
                    .filter((row) => row && typeof row === "object" && !Array.isArray(row))
                    .map((row) => fromEntries((q.fields || []).map((field) => [
                    field.id,
                    typeof row[field.id] === "string"
                        ? row[field.id].slice(0, field.maxLength || 200)
                        : "",
                ])));
        }
        else if ((0, exports.hasRows)(q.type)) {
            if (value && typeof value === "object" && !Array.isArray(value)) {
                const rows = {};
                for (const row of q.rows || []) {
                    const v = value[row];
                    if (typeof v === "string")
                        rows[row] = v.slice(0, 200);
                    else if (Array.isArray(v) && v.every((x) => typeof x === "string"))
                        rows[row] = v.slice(0, 50).map((x) => x.slice(0, 120));
                }
                result[q.id] = rows;
            }
        }
        else if (typeof value === "string")
            result[q.id] = value.slice(0, q.type === "textarea" ? 2000 : 200);
        else if (["multiple", "ranking"].includes(q.type) &&
            Array.isArray(value) &&
            value.every((x) => typeof x === "string"))
            result[q.id] = value.slice(0, 50).map((x) => x.slice(0, 120));
    }
    return result;
}
function randomizedOptions(options, seed) {
    const hash = (value) => {
        let n = 2166136261;
        for (const c of value)
            n = Math.imul(n ^ c.charCodeAt(0), 16777619);
        return n >>> 0;
    };
    return [...options].sort((a, b) => hash(seed + a) - hash(seed + b));
}
