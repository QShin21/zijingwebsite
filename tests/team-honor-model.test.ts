import { describe, expect, it } from "vitest";
import {
  completeHonor,
  honorArchiveHref,
  honorID,
  legacyHonorDate,
  honorText,
  honorVersion,
  nextHonorState,
  type HonorContent,
} from "../src/lib/team-honor-model";

const content: HonorContent = {
  title: "合成荣誉",
  competition: "合成比赛",
  placing: "合成奖项",
  date: "2026-10-01T00:00:00.000Z",
  description: "合成说明",
  images: [{ source: "data:image/webp;base64,YQ==", caption: "合成证明" }],
  videoURL: null,
};
describe("荣誉状态与证据边界", () => {
  it("每次创建都先待审，编辑已批准记录撤下后重提，重复批准失败", () => {
    expect(nextHonorState("new", "submit")).toBe("pending");
    expect(nextHonorState("approved", "save")).toBe("draft");
    expect(nextHonorState("draft", "submit")).toBe("pending");
    expect(nextHonorState("approved", "submit")).toBe("pending");
    expect(nextHonorState("pending", "submit")).toBe("pending");
    expect(nextHonorState("pending", "withdraw")).toBe("withdrawn");
    expect(nextHonorState("pending", "return")).toBe("returned");
    expect(nextHonorState("pending", "reject")).toBe("rejected");
    for (const state of [
      "returned",
      "rejected",
      "withdrawn",
      "hidden",
    ] as const)
      expect(nextHonorState(state, "submit")).toBe("pending");
    expect(() => nextHonorState("approved", "approve")).toThrow();
    expect(() => nextHonorState("hidden", "approve")).toThrow();
  });
  it("缺少证据不能提交，日期不能自动纠正成另一天", () => {
    expect(() => completeHonor({ ...content, images: [] })).toThrow("证据");
    expect(() =>
      completeHonor({
        ...content,
        images: [{ ...content.images[0], caption: "" }],
      }),
    ).toThrow("说明");
    expect(honorText({ ...content, date: "2024-02-29" }).date).toBe(
      "2024-02-29T00:00:00.000Z",
    );
    expect(() => honorText({ ...content, date: "2025-02-29" })).toThrow("日期");
    expect(legacyHonorDate("2026-09-30T16:00:00.000Z")).toBe(
      "2026-10-01T00:00:00.000Z",
    );
  });
  it("字节、描述、日期与历史归属都进入审核版本", () => {
    const attribution = {
      team: 1,
      game: 2,
      author: 3,
      authorName: "合成队员",
      season: null,
    };
    const version = honorVersion(content, attribution, "a");
    for (const change of [
      { description: "改稿" },
      { date: "2026-10-02" },
      {
        images: [
          { ...content.images[0], source: "data:image/webp;base64,Yg==" },
        ],
      },
    ])
      expect(
        honorVersion({ ...content, ...change }, attribution, "a"),
      ).not.toBe(version);
    expect(honorVersion(content, { ...attribution, team: 9 }, "a")).not.toBe(
      version,
    );
    expect(honorVersion(content, attribution, "b")).not.toBe(version);
  });
  it("档案链接按队伍永久稳定，非安全标识不能构成链接", () => {
    expect(honorArchiveHref("synthetic-game", 12)).toBe(
      "/community/synthetic-game/showcase/team-honors/12",
    );
    for (const id of [
      NaN,
      0,
      -1,
      "1 OR 1=1",
      "1.2",
      Number.MAX_SAFE_INTEGER + 1,
    ])
      expect(() => honorID(id)).toThrow();
  });
});
