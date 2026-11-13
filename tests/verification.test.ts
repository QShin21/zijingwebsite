import { describe, expect, it } from "vitest";
import { validPassword } from "../src/lib/verification";
import { accountEmail, classifyEmail } from "../src/lib/affiliation";
describe("邮箱身份与密码门槛", () => {
  it("规范化邮箱并按完整域名区分清华、友校与校外身份", () => {
    expect(accountEmail(" Alice@MAILS.TSINGHUA.EDU.CN ")).toBe("alice@mails.tsinghua.edu.cn");
    for (const address of ["member@tsinghua.org.cn", "teacher@tsinghua.edu.cn", "name@mail.tsinghua.org.cn"])
      expect(classifyEmail(address, "")).toBe("tsinghua");
    for (const address of ["x@fake-tsinghua.edu.cn", "x@stu.other.edu.cn", "x@university.edu", "x@school.ac.uk"])
      expect(classifyEmail(address, "")).toBe("peer");
    for (const address of ["x@tsinghua.org.cn.evil.com", "x@tsinghua.edu.cn.evil", "x@edu.cn", "x@example.com"])
      expect(classifyEmail(address, "")).toBe("external");
    for (const address of ["x@@example.com", "x..y@example.com", "x@-example.com", "x@example..com", "x@example.com."])
      expect(accountEmail(address)).toBeNull();
    expect(classifyEmail("x@uni.example", "other.example,uni.example")).toBe("peer");
    expect(classifyEmail("x@sub.uni.example", "other.example,uni.example")).toBe("external");
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
