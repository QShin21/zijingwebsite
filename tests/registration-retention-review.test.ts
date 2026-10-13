import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterAll, describe, expect, it } from "vitest";
import {
  buildRetentionReview,
  retentionCollections,
} from "../src/lib/registration-retention-review";
const now = "2026-10-13T00:00:00.000Z";
const old = "2025-10-12T00:00:00.000Z";
const record = (
  collection = "event-signups",
  extra: Record<string, unknown> = {},
) => ({ collection, id: 101, createdAt: old, updatedAt: old, ...extra });
const review = (records: unknown[], extra: Record<string, unknown> = {}) =>
  buildRetentionReview({ schemaVersion: 1, records, ...extra }, now);
const folder = mkdtempSync(join(tmpdir(), "zijing-retention-synthetic-"));
afterAll(() => rmSync(folder, { recursive: true, force: true }));

describe("报名一年政策：只读元数据审查，不替代人工提交时间/引用核查", () => {
  it.each([
    "event-signups",
    "staff-applications",
    "team-join-applications",
    "team-establishment-applications",
  ])("%s过一年只给人工候选，不提供删除资格或原答卷", (collection) => {
    const result = review([record(collection)]);
    expect(result.items[0].review).toBe("one-year-inactive-review");
    expect(result).toMatchObject({
      readOnly: true,
      automaticDeletion: false,
      expiryConfirmed: false,
    });
    expect(result.summary.reviewItems).toBe(1);
    expect(result.items[0]).not.toHaveProperty("answers");
    expect(result.items[0]).not.toHaveProperty("deleteEligible");
    expect(result.items[0]).not.toHaveProperty("canDelete");
    expect(result.items[0].reasons.join("")).toContain("引用元数据未声明完整");
  });
  it("同一活动集合保留社团/社区报名合同；名单无按题内容或账号身份", () => {
    expect(retentionCollections).toContain("event-signups");
    const result = review([record(), record("event-signups", { id: 102 })]);
    expect(result.items.map((item) => item.id)).toEqual([101, 102]);
    expect(
      result.items.every(
        (item) => !("memberName" in item) && !("member" in item),
      ),
    ).toBe(true);
  });
  it("近一年记录保留；边界恰好一年仅进入审查", () => {
    const result = review([
      record("event-signups", {
        createdAt: "2025-10-13T00:00:00.001Z",
        updatedAt: null,
      }),
      record("event-signups", {
        id: 102,
        createdAt: "2025-10-13T00:00:00Z",
        updatedAt: null,
      }),
    ]);
    expect(result.items.map((item) => item.review)).toEqual([
      "not-yet-one-year",
      "one-year-inactive-review",
    ]);
  });
  it("近期审核/改稿不能隐去旧记录；两个时间点不冒充submittedAt", () => {
    const result = review([
      record("staff-applications", { status: "accepted", updatedAt: now }),
    ]);
    expect(result.items[0]).toMatchObject({
      review: "created-one-year-review",
      createdReviewAt: "2026-10-12T00:00:00.000Z",
      latestChangeReviewAt: "2027-10-13T00:00:00.000Z",
    });
    expect(result.items[0].reasons.join("")).toContain(
      "不能用updatedAt自动续期",
    );
    expect(result.timingNote).toContain("不能冒充统一submittedAt");
  });
  it.each(["withdrawn", "approved", "pending", "returned", "rejected"])(
    "代表队%s原编号仍审查，不因状态成为可删除",
    (status) => {
      const result = review([record("team-join-applications", { status })]);
      expect(result.items[0].review).toBe("one-year-inactive-review");
      expect(result.expiryConfirmed).toBe(false);
    },
  );
  it("入队草稿不能被createdAt冒充报名", () => {
    const result = review([
      record("team-join-applications", { status: "draft" }),
    ]);
    expect(result.items[0].review).toBe("draft-scope-review");
    expect(result.items[0].reasons.join("")).toContain("草稿创建不是报名提交");
  });
  it("建队现有契约不支持draft，不能把虚构状态作为报名输入", () => {
    expect(() =>
      review([record("team-establishment-applications", { status: "draft" })]),
    ).toThrow("记录状态须使用现有集合状态");
  });
  it.each(["active", "revoked"])(
    "长期成员%s关系保留，但原申请另列一年审查",
    (status) => {
      const result = review(
        [
          record("team-memberships", { status }),
          record("team-join-applications", { status: "approved" }),
        ],
        {
          references: [
            {
              sourceCollection: "team-memberships",
              sourceID: 101,
              sourceField: "sourceApplication",
              targetCollection: "team-join-applications",
              targetID: 101,
            },
          ],
          referencesComplete: true,
        },
      );
      expect(result.items[0].review).toBe("long-term-member");
      expect(result.items[1].review).toBe("one-year-inactive-review");
      expect(result.items[1].references).toHaveLength(1);
      expect(result.items[1].reasons.join("")).toContain("禁止据清单整行删除");
      expect(result.summary).toMatchObject({
        longTermMembers: 1,
        reviewItems: 1,
      });
    },
  );
  it("人工已入群关系长期；未完成进群意向与建群管理员申请需单列范围确认", () => {
    const result = review([
      record("community-joins", { status: "joined" }),
      record("community-joins", { id: 102, status: "withdrawn" }),
      record("community-applications", { status: "approved" }),
    ]);
    expect(result.items.map((item) => item.review)).toEqual([
      "long-term-member",
      "related-application-review",
      "related-application-review",
    ]);
    expect(result.items[2].reasons.join("")).toContain("人工确认政策范围");
  });
  it("成立来源、历史队伍版本、社群任职引用保持，且同编号跨集合不串联", () => {
    const references = [
      {
        sourceCollection: "teams",
        sourceID: 51,
        sourceField: "establishmentApplication",
        targetCollection: "team-establishment-applications",
        targetID: 101,
      },
      {
        sourceCollection: "_teams_v",
        sourceID: 61,
        sourceField: "version.establishmentApplication",
        targetCollection: "team-establishment-applications",
        targetID: 101,
      },
      {
        sourceCollection: "users",
        sourceID: 71,
        sourceField: "communityOffices.sourceApplication",
        targetCollection: "community-applications",
        targetID: 101,
      },
    ];
    const result = review(
      [
        record("team-establishment-applications"),
        record("community-applications"),
        record("staff-applications"),
      ],
      { references, referencesComplete: true },
    );
    expect(result.items.map((item) => item.references.length)).toEqual([
      2, 1, 0,
    ]);
    expect(result.expiryConfirmed).toBe(false);
  });
  it("自然年计算闰日与时区，避免把365天当成所有一年", () => {
    const result = buildRetentionReview(
      {
        schemaVersion: 1,
        records: [
          record("event-signups", {
            createdAt: "2024-02-29T08:00:00+08:00",
            updatedAt: null,
          }),
          record("event-signups", {
            id: 102,
            createdAt: "2023-10-13T00:00:00Z",
            updatedAt: null,
          }),
        ],
      },
      now,
    );
    expect(result.items[0].createdReviewAt).toBe("2025-02-28T00:00:00.000Z");
    expect(result.items[1].createdReviewAt).toBe("2024-10-13T00:00:00.000Z");
  });
  it.each([
    undefined,
    null,
    "2025-02-30T00:00:00Z",
    "2025-10-12",
    "2027-01-01T00:00:00Z",
    "2025-10-12T25:00:00Z",
    "2025-10-12T00:00:00+15:00",
  ])("无效/缺失/未来日期%s进入人工核查，不判未到期", (createdAt) => {
    expect(
      review([record("event-signups", { createdAt })]).items[0].review,
    ).toBe("date-needs-review");
  });
  it.each([
    "2025-01-01T00:00:00Z",
    "synthetic-invalid",
    "2027-01-01T00:00:00Z",
  ])("updatedAt异常%s不跳过人工核查", (updatedAt) => {
    expect(
      review([record("event-signups", { updatedAt })]).items[0].review,
    ).toBe("date-needs-review");
  });
  it("缺少状态或部分关联的元数据不声称已完成期限/依赖核查", () => {
    const result = review([record("staff-applications")]);
    expect(result.referencesComplete).toBe(false);
    expect(result.items[0].reasons.join("")).toContain("未提供当前状态");
  });
  it("输入对象及成员/来源引用完全不变，报告可重复生成", () => {
    const input = { schemaVersion: 1, records: [record()], references: [] };
    Object.freeze(input.records[0]);
    Object.freeze(input.records);
    Object.freeze(input.references);
    Object.freeze(input);
    const before = JSON.stringify(input);
    expect(buildRetentionReview(input, now)).toEqual(
      buildRetentionReview(input, now),
    );
    expect(JSON.stringify(input)).toBe(before);
  });
  it.each([
    "answers",
    "questions",
    "formSnapshot",
    "history",
    "reviewNotes",
    "memberName",
    "email",
    "phone",
    "wechatQr",
    "token",
  ])("拒绝包含%s的真实答卷/私人字段快照", (key) => {
    expect(() =>
      review([record("event-signups", { [key]: "synthetic-private-marker" })]),
    ).toThrow("只接受规定的元数据字段");
  });
  it("未知/重复集合、未知状态/伪造引用和执行标志在输入阶段被拒绝", () => {
    expect(() => review([record("made-up-team-list")])).toThrow();
    expect(() => review([record(), record()])).toThrow();
    expect(() =>
      review([record("event-signups", { status: "private-answer-as-status" })]),
    ).toThrow();
    expect(() =>
      review([record()], {
        references: [
          {
            sourceCollection: "users",
            sourceID: 7,
            sourceField: "answers",
            targetCollection: "event-signups",
            targetID: 101,
          },
        ],
      }),
    ).toThrow();
    expect(() => review([], { purge: true })).toThrow();
    expect(() =>
      buildRetentionReview({ schemaVersion: 1, records: [] }, "not-a-date"),
    ).toThrow();
  });
});

describe("真实TSX命令：只消费合成文件，不能删除、覆盖输入或既有输出", () => {
  const cli = resolve("node_modules/tsx/dist/cli.mjs"),
    script = resolve("scripts/registration-retention-review.ts");
  const input = join(folder, "synthetic-input.json"),
    output = join(folder, "synthetic-report.json");
  writeFileSync(
    input,
    JSON.stringify({
      schemaVersion: 1,
      records: [record(), record("team-memberships", { status: "active" })],
    }),
  );
  const run = (...args: string[]) =>
    spawnSync(process.execPath, [cli, script, ...args], {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 15000,
      env: {
        ...process.env,
        APP_ENV: "development",
        DB_PUSH: "false",
        DATABASE_URL:
          "postgresql://synthetic-only:unused@127.0.0.1:65534/metadata_only_no_connection",
        DOTENV_CONFIG_PATH: join(folder, "no-env-used"),
      },
    });
  it("纯元数据输出含已确认政策、无数据库加载，文件权限0600且输入不变", () => {
    const before = readFileSync(input);
    const result = run("--input", input, "--as-of", now, "--output", output);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(readFileSync(input)).toEqual(before);
    expect(JSON.parse(readFileSync(output, "utf8"))).toMatchObject({
      readOnly: true,
      automaticDeletion: false,
      policy: {
        registrationYears: 1,
        memberRecords: "长期保留",
        deletionRequestsHandledBy: "叶佳鑫",
      },
    });
    expect(statSync(output).mode & 0o777).toBe(0o600);
  });
  it.each(["--delete", "--purge", "--apply", "--execute", "--database-url"])(
    "命令%s不能切换为业务写入或删除",
    (flag) => {
      const result = run(flag, "synthetic-only");
      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("不提供执行或删除模式");
    },
  );
  it("已有报告与输入不能被覆盖，错误不打印私人数据", () => {
    const before = readFileSync(output);
    expect(
      run("--input", input, "--as-of", now, "--output", output).status,
    ).toBe(1);
    expect(readFileSync(output)).toEqual(before);
    expect(
      run("--input", input, "--as-of", now, "--output", input).status,
    ).toBe(1);
    const privateInput = join(folder, "synthetic-private-rejected.json");
    writeFileSync(
      privateInput,
      JSON.stringify({
        schemaVersion: 1,
        records: [
          record("event-signups", { answers: "synthetic-private-marker" }),
        ],
      }),
    );
    const refused = run("--input", privateInput, "--as-of", now);
    expect(refused.status).toBe(1);
    expect(refused.stderr).not.toContain("synthetic-private-marker");
    expect(refused.stdout).toBe("");
  });
});
