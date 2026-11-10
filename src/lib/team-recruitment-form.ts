import { normalizeSignup, type SignupForm } from "./signup-schema";

export const defaultTeamForm: SignupForm = normalizeSignup({
  enabled: true,
  closed: false,
  start: "",
  end: "",
  title: "代表队入队申请",
  pageSize: 5,
  intro:
    "填写游戏与训练资料，供本社群管理员人工选拔。录取不会授予社群或平台管理权限；公开简介需另行授权。请仅提供一种可联系到你的方式。",
  questions: [
    {
      id: "gameID",
      label: "游戏 ID / 游戏昵称",
      type: "text",
      required: true,
      maxLength: 100,
    },
    {
      id: "position",
      label: "擅长位置 / 项目方向",
      type: "text",
      required: true,
      maxLength: 100,
    },
    {
      id: "experience",
      label: "游戏、比赛经历与当前水平",
      type: "textarea",
      required: true,
      maxLength: 1000,
    },
    {
      id: "availability",
      label: "可参加训练的时间与投入安排",
      type: "textarea",
      required: true,
      maxLength: 500,
    },
    {
      id: "contact",
      label: "一种联系方式（微信、邮箱或电话任选其一）",
      type: "text",
      required: true,
      maxLength: 120,
    },
  ],
});
