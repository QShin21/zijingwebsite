import { describe, expect, it } from "vitest";
import { schoolEmail, validPassword } from "../src/lib/verification";
describe("邮箱身份与密码门槛", () => {
  it("只接受核实的清华学校与校友邮箱域名", () => {
    expect(schoolEmail(" Alice@MAILS.TSINGHUA.EDU.CN ")).toBe("alice@mails.tsinghua.edu.cn");
    expect(schoolEmail("member@tsinghua.org.cn")).toBe("member@tsinghua.org.cn");
    expect(schoolEmail("teacher@tsinghua.edu.cn")).toBe("teacher@tsinghua.edu.cn");
    expect(schoolEmail("name@mail.tsinghua.org.cn")).toBe("name@mail.tsinghua.org.cn");
    for (const address of ["x@tsinghua.evil.com", "x@fake-tsinghua.edu.cn",
      "x@tsinghua.org.cn.evil.com", "x@other.edu.cn", "x@tsinghua.edu.cn.evil"]) {
      expect(schoolEmail(address)).toBeNull();
    }
  });
  it("密码至少八位且不限制字符组成", () => {
    for (const value of ["12345678", "abcdefgh", "!!!!!!!!", "八个汉字作为密码", "        ", "x".repeat(129)]) {
      expect(validPassword(value)).toBe(true);
    }
    for (const value of ["", "1234567", null, undefined, 12345678]) {
      expect(validPassword(value)).toBe(false);
    }
  });
});
