import type { GlobalConfig } from "payload";
import { queueSiteTranslationAfterChange } from "../lib/content-translation/hooks";
import { publisher } from "../access";
import { safeURL } from "../lib/rules";
import { defaultHomeSections, validateHomeSections } from "../lib/v2/home-sections";
export const Site: GlobalConfig = {
  slug: "site",
  label: "站点与首页",
  access: { read: () => true, update: publisher },
  hooks: {
    afterChange: [
      async ({ req, doc }) => {
        await req.payload.create({
          collection: "audit",
          overrideAccess: true,
          req,
          data: {
            actor: String(req.user?.id ?? "system"),
            action: "update",
            object: "global:site",
            status: "updated",
          },
        });
        return doc;
      },
      // English cache of the public home texts (hero, footer, SEO description, section titles).
      queueSiteTranslationAfterChange,
    ],
  },
  fields: [
    {
      name: "name",
      label: "社团名称",
      type: "text",
      defaultValue: "清华大学学生紫荆电竞社",
      required: true,
    },
    { name: "heroTitle", label: "首屏标题", type: "text" },
    { name: "heroSubtitle", label: "首屏副标题", type: "textarea" },
    {
      name: "heroImage",
      label: "首屏图片",
      type: "upload",
      relationTo: "media",
    },
    { name: "heroButtonLabel", label: "首屏按钮文字", type: "text" },
    {
      name: "heroButtonURL",
      label: "首屏按钮地址",
      type: "text",
      validate: (v: unknown) =>
        !v ||
        (typeof v === "string" &&
          /^\/(join|events|about|teams|news|gallery|honors)(\/[a-z0-9-]+)?$/.test(
            v,
          )) ||
        safeURL(v) ||
        "请选择站内栏目或 HTTPS 链接",
    },
    { name: "description", label: "默认 SEO 描述", type: "textarea" },
    { name: "footer", label: "页脚文字", type: "textarea" },
    {
      name: "contacts",
      label: "公共联系方式",
      type: "array",
      fields: [
        { name: "label", label: "名称", type: "text", required: true },
        { name: "text", label: "文字信息", type: "text", required: true },
        {
          name: "url",
          label: "HTTPS 链接（可选）",
          type: "text",
          validate: (v: unknown) => !v || safeURL(v) || "需 HTTPS 链接",
        },
      ],
    },
    {
      name: "navigation",
      label: "导航（留空使用栏目导航）",
      type: "array",
      admin: { description: "V2 网站不使用此字段" },
      fields: [
        { name: "label", label: "标题", type: "text", required: true },
        {
          name: "path",
          label: "栏目",
          type: "select",
          required: true,
          options: [
            "/about",
            "/events",
            "/teams",
            "/honors",
            "/join",
            "/news",
            "/gallery",
            "/contact",
            "/community",
            "/announcements",
          ],
        },
      ],
    },
    {
      name: "modules",
      label: "首页模块（拖拽调整顺序）",
      type: "array",
      admin: { description: "旧版首页配置保留；V2 请使用下方的 V2 主场区块。" },
      fields: [
        {
          name: "kind",
          label: "模块类型",
          type: "select",
          required: true,
          options: [
            "join",
            "events",
            "teams",
            "honors",
            "news",
            "albums",
            "about",
          ],
        },
        {
          name: "enabled",
          label: "启用",
          type: "checkbox",
          defaultValue: true,
        },
        { name: "title", label: "模块标题", type: "text" },
      ],
    },
    {
      name: "homeSections",
      label: "V2 主场区块（拖拽调整顺序）",
      type: "array",
      maxRows: defaultHomeSections.length,
      validate: validateHomeSections,
      admin: { description: "可调整 V2 主场区块的顺序、标题与启停。未配置的区块按默认顺序追加；隐藏须明确取消启用。内容权限不受此配置影响。" },
      fields: [
        { name: "kind", label: "区块", type: "select", required: true,
          options: defaultHomeSections.map(section => ({ label: section.title, value: section.kind })) },
        { name: "enabled", label: "启用", type: "checkbox", defaultValue: true },
        { name: "title", label: "标题（留空使用默认标题）", type: "text", maxLength: 60 },
      ],
    },
    {
      name: "featuredEvents",
      label: "重点活动（最多三个）",
      type: "relationship",
      relationTo: "events",
      hasMany: true,
      maxRows: 3,
    },
    {
      name: "featuredHonors",
      label: "精选荣誉",
      type: "relationship",
      relationTo: "honors",
      hasMany: true,
      maxRows: 3,
    },
  ],
};
