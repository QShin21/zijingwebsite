import { describe, expect, it } from "vitest";
import { nicknameKey, validNickname } from "../src/lib/nickname";

describe("登录昵称", () => {
  it("大小写变化匹配同一昵称", () => {
    expect(["SHIN", "shin", "Shin", " Shin "].map(nicknameKey)).toEqual([
      "shin",
      "shin",
      "shin",
      "shin",
    ]);
  });
  it("允许中文、英文和纯数字昵称", () => {
    for (const name of [
      "紫荆同学",
      "Player One",
      "123456",
      "ab",
      "a".repeat(40),
    ]) {
      expect(validNickname(name)).toBe(true);
    }
  });
  it("拒绝空值、邮箱歧义、控制字符和超长昵称", () => {
    for (const name of [
      null,
      "",
      "a",
      "a".repeat(41),
      " name",
      "name ",
      "a@b",
      "a\nb",
      "a\tb",
    ]) {
      expect(validNickname(name)).toBe(false);
    }
  });
});
