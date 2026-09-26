import { expect, it } from "vitest";
import { APIError, ValidationError } from "payload";
import { applicationError } from "../src/lib/application-error";

it("申请校验显示具体字段及原因", () => {
  expect(applicationError(new ValidationError({ errors: [{ path: "wechatQr", message: "图片过大" }] })))
    .toBe("微信名片二维码：图片过大");
  expect(applicationError(new APIError("新游戏名称需为 2–80 字", 400)))
    .toBe("新游戏名称需为 2–80 字");
});

it("意外服务端错误不返回数据库或私人资料", () => {
  const secret = "SELECT contact_data FROM private_records";
  for (const error of [new Error(secret), new APIError(secret, 500)]) {
    expect(applicationError(error)).not.toContain(secret);
    expect(applicationError(error)).toContain("服务器暂时无法保存申请");
  }
});
