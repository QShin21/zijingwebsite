import { describe, expect, it } from "vitest";
import { schoolEmail, accountNumber, validPassword } from "../src/lib/verification";
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
  it("数字账户和新密码有边界", () => {
    expect(accountNumber("1234567890")).toBe(true);
    expect(accountNumber("012345")).toBe(true);
    expect(accountNumber("one23456")).toBe(false);
    expect(validPassword("aStrongPassword123!")).toBe(true);
    expect(validPassword("1234567890")).toBe(false);
  });
});
