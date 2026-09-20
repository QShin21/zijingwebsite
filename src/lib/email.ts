import type { EmailAdapter } from "payload";
import { nodemailerAdapter } from "@payloadcms/email-nodemailer";
// Never log password-reset tokens when SMTP is absent.
const disabled: EmailAdapter = () => ({
  name: "disabled",
  defaultFromAddress: "disabled@example.invalid",
  defaultFromName: "邮件未配置",
  sendEmail: async () => {
    throw new Error("邮件服务尚未配置，请联系系统管理员重置账号。");
  },
});
export const email = process.env.SMTP_HOST
  ? nodemailerAdapter({
      defaultFromAddress: process.env.SMTP_FROM || "",
      defaultFromName: "紫荆电竞社网站",
      transportOptions: {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_PORT === "465",
        auth: {
          user: process.env.SMTP_USER || "",
          pass: process.env.SMTP_PASSWORD || "",
        },
      },
    })
  : disabled;
