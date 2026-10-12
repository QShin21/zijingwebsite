import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  emptyTeamProfile,
  parseTeamProfile,
  profileError,
  safeTeamProfileAvatar,
  sameTeamProfile,
  teamProfileID,
} from "../src/lib/team-profiles-model";
import { normalizeTeamProfileAvatar } from "../src/lib/team-profiles-images";

describe("队员简介公开资料边界（合成资料）", () => {
  const draft = () => ({
    ...emptyTeamProfile(),
    displayName: "合成队员",
    biography: "热爱团队比赛。",
  });
  it("默认隐藏，只存本人选择的最小公开资料", () => {
    expect(
      parseTeamProfile({ ...draft(), displayName: "  合成昵称  " }),
    ).toEqual({ ...draft(), displayName: "合成昵称" });
    expect(draft().visible).toBe(false);
    expect(sameTeamProfile(draft(), { ...draft(), visible: true })).toBe(false);
  });
  it.each([
    "membership",
    "team",
    "user",
    "member",
    "status",
    "game",
    "realName",
    "studentID",
    "phone",
    "answers",
    "reviewNote",
    "roles",
    "__proto__",
  ])("拒绝附加敏感/资格字段 %s", (field) => {
    expect(() =>
      parseTeamProfile(
        JSON.parse(
          JSON.stringify(draft()).replace(/}$/, `,"${field}":"伪造"}`),
        ),
      ),
    ).toThrow();
  });
  it.each([
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(1)>",
    "昵称\u202E隐藏",
    "昵称\0隐藏",
    "x".repeat(401),
  ])("拒绝 HTML、不可见控制和过长文本 %s", (biography) => {
    expect(() => parseTeamProfile({ ...draft(), biography })).toThrow();
  });
  it.each([
    "javascript:alert(1)",
    "https://untrusted.example/private",
    "data:image/svg+xml;base64,AAAA",
    "data:text/html;base64,AAAA",
  ])("拒绝任意头像源 %s", (avatar) => {
    expect(safeTeamProfileAvatar(avatar)).toBe(false);
    expect(() => parseTeamProfile({ ...draft(), avatar })).toThrow();
  });
  it("图片复用实际解码，清除元数据并规范为 WebP", async () => {
    const picture = await sharp({
      create: { width: 24, height: 30, channels: 3, background: "purple" },
    })
      .withMetadata()
      .png()
      .toBuffer();
    const result = await normalizeTeamProfileAvatar(
      "data:image/png;base64," + picture.toString("base64"),
    );
    expect(result).toMatch(/^data:image\/webp;base64,/);
    const meta = await sharp(
      Buffer.from(result!.split(",")[1], "base64"),
    ).metadata();
    expect(meta.exif).toBeUndefined();
    expect(await normalizeTeamProfileAvatar(null)).toBeNull();
    await expect(
      normalizeTeamProfileAvatar("data:image/png;base64,aGVsbG8="),
    ).rejects.toThrow("头像无效");
  });
  it.each([0, -1, "1e2", "01", {}, "", Number.MAX_SAFE_INTEGER + 1])(
    "严格拒绝标识 %s",
    (value) => {
      expect(() => teamProfileID(value)).toThrow();
    },
  );
  it("合法标识转换为数据库数字；未知错误不泄露 SQL/私人资料", () => {
    expect(teamProfileID("12")).toBe(12);
    expect(profileError(new Error("SQL contact=private"))).toEqual({
      status: 503,
      error: "队员简介暂时无法加载或保存，请稍后重试；已填写的内容会保留。",
    });
  });
});
