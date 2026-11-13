import type { Locale } from "./locale";
import { localizeMessage } from "./messages";

/*
 * English renderings of the account, auth, join and community server-action messages.
 * The actions keep returning Chinese (tests and other clients rely on it); clients
 * translate at display time. Unknown messages fall back to the shared map, then Chinese.
 */
export const accountMessages: Record<string, string> = {
  // account/actions.ts
  请输入注册时验证的完整邮箱: "Enter the full email address you verified at registration.",
  "邮件暂不可用，请稍后联系网站管理员": "Email is unavailable right now. Please contact the site admin later.",
  "请核对邮箱、昵称和密码；密码至少 8 位，两次输入需一致。":
    "Check your email, nickname and password. The password needs at least 8 characters and both entries must match.",
  "该邮箱已注册，请登录或找回密码": "This email is already registered. Sign in or reset your password.",
  "该昵称已被使用，请更换昵称": "This nickname is taken. Choose another one.",
  "验证码发送失败，请稍后重试或联系网站管理员。":
    "The code could not be sent. Try again later or contact the site admin.",
  "验证码错误、过期或尝试次数过多，请核对或重新发送。":
    "The code is wrong, expired or has had too many attempts. Check it or send a new one.",
  "注册未完成，邮箱或昵称可能已被使用。请返回检查后重新验证。":
    "Registration was not completed; the email or nickname may already be in use. Go back, check and verify again.",
  "昵称、邮箱或密码错误，请核对后重试。": "Wrong nickname, email or password. Check and try again.",
  "退出登录未确认完成，请重试。": "Sign-out was not confirmed. Please try again.",
  "请核对注册邮箱与新密码；密码至少 8 位，两次输入需一致。":
    "Check your registered email and new password. The password needs at least 8 characters and both entries must match.",
  "密码更新未确认完成，请重试；如果已完成更新，请使用新密码登录。":
    "The password update was not confirmed. Try again; if it already changed, sign in with the new password.",
  "请求过于频繁，请稍后再试": "Too many requests. Please try again later.",
  "请等待 60 秒后再次获取验证码": "Wait 60 seconds before requesting another code.",
  // community/actions.ts
  "请上传 2 MB 以内的 PNG、JPEG 或 WebP 微信名片二维码。": "Upload a WeChat contact-card QR code as PNG, JPEG or WebP, up to 2 MB.",
  "由于入社流程规定，必须展示管理联系方式": "The joining process requires showing your contact card to the admins.",
  决定无效: "Invalid decision.",
  无权在此社群发布: "You cannot publish in this community.",
  请选择有效的可见范围: "Choose a valid visibility.",
  "请检查配图格式。": "Check the image format.",
  无权管理此活动或通知: "You cannot manage this event or notice.",
  已保存可见范围: "Visibility saved.",
  发布类型无效: "Invalid post type.",
  "发布未成功，请核对内容和权限": "Publishing failed. Check the content and your permissions.",
  管理操作未成功: "The admin action failed.",
  禁言未完成: "Muting was not completed.",
  "最多 6 张 PNG、JPEG、WebP 照片，每张 2 MB 以内": "Up to 6 PNG, JPEG or WebP photos, 2 MB each.",
  请填写标题: "Please enter a title.",
  上传视频与视频链接请选择一种: "Choose either an uploaded video or a video link, not both.",
  "视频不超过 10 MB，图片与视频合计不超过 12 MB": "Videos up to 10 MB; images and video together up to 12 MB.",
  审核决定无效: "Invalid review decision.",
  "审核未成功，请刷新后重试": "Review failed. Refresh and try again.",
  审核已保存: "Review saved.",
  "活动日程已更新。": "Event schedule updated.",
  "本站视频已更新，已升推内容会同步更新。": "Site video updated. Promoted content will update as well.",
  无权修改此社群风采视频: "You cannot change this community showcase video.",
  "风采已更新，请刷新后再上传": "The showcase has changed. Refresh before uploading.",
  "请选择 10 MB 以内的 MP4 视频": "Choose an MP4 video up to 10 MB.",
  "网站申请已撤回，微信联系不受此操作影响。": "Your website application was withdrawn. WeChat contact is not affected.",
  "名片最大 2 MB": "Contact cards can be up to 2 MB.",
  "名片及展示设置已更新。": "Contact card and display settings updated.",
  "请重新登录后再发布，已填写的内容保留。": "Sign in again to publish. Your content is kept.",
  "发布类型无效，请重新选择。": "Invalid post type. Choose again.",
  "内容已发布到当前社群。": "Published to this community.",
  "当前账号无权编辑此社群的配图。": "This account cannot edit images in this community.",
  "该内容已隐藏或不属于当前社群。": "This content is hidden or does not belong to this community.",
  "内容已有更新，请刷新已保存记录，再载入最新配图。":
    "The content has changed. Refresh the saved record, then load the latest images.",
  "配图已保存。": "Images saved.",
  "当前账号无权编辑此社群内容。": "This account cannot edit content in this community.",
  "内容已隐藏或不属于当前社群。": "This content is hidden or does not belong to this community.",
  "内容已有更新，请刷新后重新编辑。": "The content has changed. Refresh and edit again.",
  "请检查文章内容。": "Check the article content.",
  "文章已保存。": "Article saved.",
  "请重新登录后再审核，已填写的说明保留。": "Sign in again to review. Your notes are kept.",
  "当前账号无法审核这条社群风采。": "This account cannot review this showcase post.",
  "审核决定无效，请重新选择。": "Invalid review decision. Choose again.",
  "审核结果已保存。": "Review result saved.",
  "请重新登录后再审核，已填写的意见保留。": "Sign in again to review. Your comments are kept.",
  "当前账号无权审核社群管理员申请。": "This account cannot review community admin applications.",
  "请重新登录后再保存，已选择的名片与展示设置保留。":
    "Sign in again to save. Your contact card and display settings are kept.",
  "名片最大 2 MB，请重新选择。": "Contact cards can be up to 2 MB. Choose another file.",
  "请重新登录后再保存，已选择的视频保留。": "Sign in again to save. Your selected video is kept.",
  "图片上传失败，请重新选择。": "Image upload failed. Choose again.",
  // application-error.ts / action-feedback.ts
  "已有同一申请，请在我的申请中继续处理。": "The same application already exists. Continue it under My applications.",
  "服务器暂时无法保存申请，请稍后重试；已填写的资料会保留。":
    "The server cannot save the application right now. Try again later; your answers are kept.",
  "服务器暂时无法确认操作结果。填写内容已保留，请先刷新已保存记录核对后再重试。":
    "The server could not confirm the result. Your input is kept; refresh the saved record to check before retrying.",
  // promotion-model.ts / promotions/actions.ts
  升推来源无效: "Invalid promotion source.",
  内容编号无效: "Invalid content ID.",
};

/** Promotion action results ("升推结果已保存：" + result). */
const promotionResults: Record<string, string> = {
  "申请已提交，等待审核。": "Request submitted, awaiting review.",
  "申请已撤回。": "Request withdrawn.",
  "审核通过，已升推。": "Approved and promoted.",
  "已退回修改。": "Returned for changes.",
  "已拒绝升推。": "Promotion rejected.",
  "已主动升推。": "Promoted directly.",
  "已降为社群展示。": "Demoted to community display.",
};

const applicationFields: Record<string, string> = {
  姓名: "Name",
  手机号: "Mobile",
  微信名片二维码: "WeChat card QR code",
  已有游戏: "Existing game",
  新游戏名称: "New game name",
  申请说明: "Reason",
  处理意见: "Review note",
};

function single(message: string, locale: Locale): string {
  const trimmed = message.trim();
  if (accountMessages[trimmed]) return accountMessages[trimmed];
  if (promotionResults[trimmed]) return promotionResults[trimmed];
  const promotion = /^升推结果已保存：(.+)$/.exec(trimmed);
  if (promotion) return `Promotion saved: ${promotionResults[promotion[1]] ?? promotion[1]}`;
  const field = /^(.+?)：(.+)$/.exec(trimmed);
  if (field && applicationFields[field[1]]) {
    const rest = localizeMessage(field[2], locale);
    return `${applicationFields[field[1]]}: ${rest}`;
  }
  return localizeMessage(trimmed, locale);
}

/** Display-time translation for account/community messages; Chinese stays the fallback. */
export function localizeAccountMessage(message: string | null | undefined, locale: Locale): string {
  if (typeof message !== "string" || !message) return message ?? "";
  if (locale !== "en") return message;
  // applicationError joins several field problems with "；".
  if (message.includes("；") && /^[^；]+：/.test(message)) {
    const parts = message.split("；");
    if (parts.every((part) => /^(.+?)：/.test(part) && applicationFields[part.split("：")[0]]))
      return parts.map((part) => single(part, locale)).join("; ");
  }
  return single(message, locale);
}
