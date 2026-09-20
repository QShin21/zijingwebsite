import type {
  CollectionConfig,
  CollectionSlug,
  TextField,
  Field,
  CollectionBeforeChangeHook,
  CollectionAfterChangeHook,
} from "payload";
import {
  admin,
  adminField,
  editContent,
  publisher,
  publisherField,
  readContent,
  staff,
} from "../access";
import {
  canPublish,
  hasRole,
  routeFor,
  safeURL,
  teamIDs,
  type Identity,
} from "../lib/rules";
import sharp from "sharp";
import { APIError } from "payload";

const text = (name: string, label: string, required = false): TextField => ({
  name,
  label,
  type: "text",
  required,
});
const date = (name: string, label: string): Field => ({
  name,
  label,
  type: "date",
  admin: {
    date: { pickerAppearance: "dayAndTime" },
    description: "按后台 Asia/Shanghai 时区输入；数据库保存 UTC。",
  },
});
const rel = (
  name: string,
  label: string,
  relationTo: CollectionSlug,
  required = false,
): Field => ({
  name,
  label,
  type: "relationship",
  relationTo,
  required,
  maxDepth: 0,
});
const url = (name: string, label: string): Field => ({
  name,
  label,
  type: "text",
  validate: (v: unknown) =>
    !v || safeURL(v) || "请填写不含账号密码的 HTTPS 链接",
});
const body: Field = { name: "body", label: "正文", type: "richText" };
const internal: Field = {
  name: "internalNotes",
  label: "内部核验备注（不公开）",
  type: "textarea",
  access: {
    read: ({ req, doc }) =>
      hasRole(req.user as Identity, "admin", "publisher", "editor") ||
      (hasRole(req.user as Identity, "leader") &&
        teamIDs(req.user as Identity).includes(String(doc?.team ?? doc?.id))),
  },
};
const common: Field[] = [
  text("title", "标题", true),
  {
    ...text("slug", "永久链接标识", true),
    unique: true,
    index: true,
    validate: (v: unknown) =>
      (typeof v === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v)) ||
      "使用小写字母、数字和短横线；已发布后慎重修改",
  },
  { name: "summary", label: "摘要", type: "textarea" },
  body,
  rel("cover", "封面", "media"),
  {
    name: "archived",
    label: "历史归档",
    type: "checkbox",
    defaultValue: false,
  },
  {
    name: "demo",
    label: "演示资料",
    type: "checkbox",
    defaultValue: false,
    access: { update: publisherField },
  },
  text("seoTitle", "SEO 标题"),
  { name: "seoDescription", label: "SEO 描述", type: "textarea" },
  internal,
];
const registration: Field[] = [
  date("registrationStart", "报名开始"),
  date("registrationEnd", "报名截止（到点关闭）"),
  { name: "registrationClosed", label: "人工关闭报名", type: "checkbox" },
  url("registrationURL", "外部报名 HTTPS 链接"),
  { name: "channelText", label: "替代参与渠道 / 公开群号", type: "textarea" },
  rel("qrCode", "二维码（必须填写文字渠道）", "media"),
  date("channelCheckedAt", "最近核验渠道时间"),
  text("contact", "公共联系人"),
  { name: "requirements", label: "参加条件", type: "textarea" },
];

const guard =
  (scoped: boolean, self: boolean): CollectionBeforeChangeHook =>
  async ({ data, originalDoc, req, operation, collection }) => {
    if (originalDoc?.id && routeFor[collection.slug]) {
      const published = await req.payload
        .findByID({
          collection: collection.slug,
          id: originalDoc.id,
          req,
          draft: false,
          overrideAccess: true,
          depth: 0,
        })
        .catch(() => null);
      if (
        published &&
        "_status" in published &&
        published._status === "published" &&
        "slug" in published
      )
        req.context.previousPublishedSlug = published.slug;
    }
    const user = req.user as Identity;
    if (!req.context.system && !canPublish(user)) {
      data._status = "draft";
      if (scoped && hasRole(user, "leader") && !hasRole(user, "editor")) {
        const id = self ? originalDoc?.id : (data.team ?? originalDoc?.team);
        if (
          !teamIDs(user).includes(String(typeof id === "object" ? id?.id : id))
        )
          throw new Error("无权维护此分部");
        if (self && operation === "create")
          throw new Error("分部负责人不能建立新代表队");
      }
    }
    const merged = { ...originalDoc, ...data };
    if (merged.body) validateRichText(merged.body);
    if (
      collection.slug === "honors" &&
      merged._status === "published" &&
      merged.verified &&
      !safeURL(merged.sourceURL)
    )
      throw new Error("已核验公开荣誉需要 HTTPS 公开来源");
    if (collection.slug === "honors" && merged.season) {
      const season = await req.payload.findByID({
        collection: "seasons",
        id:
          typeof merged.season === "object" ? merged.season.id : merged.season,
        overrideAccess: false,
        user: req.user,
        req,
        depth: 0,
      });
      if (
        String(
          typeof season.team === "object" ? season.team.id : season.team,
        ) !==
        String(typeof merged.team === "object" ? merged.team.id : merged.team)
      )
        throw new Error("荣誉赛季必须属于所选代表队");
    }
    if (
      merged.registrationStart &&
      merged.registrationEnd &&
      Date.parse(merged.registrationStart) >= Date.parse(merged.registrationEnd)
    )
      throw new Error("报名截止必须晚于开始");
    if (
      merged.startAt &&
      merged.endAt &&
      Date.parse(merged.startAt) >= Date.parse(merged.endAt)
    )
      throw new Error("活动结束必须晚于开始");
    if (merged.qrCode && !merged.channelText?.trim())
      throw new Error("二维码需要可读的替代参与渠道");
    if (
      process.env.APP_ENV === "production" &&
      merged.demo &&
      merged._status === "published"
    )
      throw new Error("生产环境禁止发布演示资料");
    return data;
  };
function validateRichText(value: unknown): void {
  if (!value || typeof value !== "object") return;
  const node = value as Record<string, unknown>;
  if (
    typeof node.type === "string" &&
    ![
      "root",
      "paragraph",
      "text",
      "heading",
      "list",
      "listitem",
      "link",
      "autolink",
      "linebreak",
      "quote",
      "horizontalrule",
      "tab",
    ].includes(node.type)
  )
    throw new Error("不支持的富文本节点");
  if (["link", "autolink"].includes(String(node.type))) {
    const fields = node.fields as { url?: unknown } | undefined;
    if (!safeURL(fields?.url)) throw new Error("正文外链必须为 HTTPS");
  }
  if (node.root) validateRichText(node.root);
  if (Array.isArray(node.children)) node.children.forEach(validateRichText);
}
export const audit: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
  collection,
  operation,
}) => {
  if (req.context.skipAudit) return doc;
  // Internal privilege is narrowly limited to append-only audit/redirect records in this transaction.
  await req.payload.create({
    collection: "audit",
    overrideAccess: true,
    req,
    context: { ...req.context, skipAudit: true },
    data: {
      actor: String(req.user?.id ?? "system"),
      action:
        collection.slug === "users" &&
        (JSON.stringify(previousDoc?.roles) !== JSON.stringify(doc.roles) ||
          JSON.stringify(previousDoc?.teams) !== JSON.stringify(doc.teams))
          ? "permissions-change"
          : operation,
      object: `${collection.slug}:${doc.id}`,
      status: doc._status ?? "updated",
    },
  });
  const oldSlug =
    req.context.previousPublishedSlug ||
    (previousDoc?._status === "published" ? previousDoc.slug : null);
  if (
    routeFor[collection.slug] &&
    oldSlug &&
    oldSlug !== doc.slug &&
    doc._status === "published"
  ) {
    const from = `/${routeFor[collection.slug]}/${oldSlug}`;
    const existing = await req.payload.find({
      collection: "redirects",
      where: { from: { equals: from } },
      limit: 1,
      req,
      overrideAccess: true,
    });
    const data = { from, to: `/${routeFor[collection.slug]}/${doc.slug}` };
    if (existing.docs[0])
      await req.payload.update({
        collection: "redirects",
        id: existing.docs[0].id,
        data,
        req,
        overrideAccess: true,
      });
    else
      await req.payload.create({
        collection: "redirects",
        data,
        req,
        overrideAccess: true,
      });
  }
  return doc;
};
function content(
  slug: string,
  label: string,
  fields: Field[],
  scoped = false,
  self = false,
): CollectionConfig {
  return {
    slug,
    labels: { singular: label, plural: label },
    admin: {
      useAsTitle: "title",
      defaultColumns: ["title", "_status", "updatedAt"],
      preview: (doc) => `/preview/${slug}/${doc.id}`,
    },
    versions: { drafts: true, maxPerDoc: 30 },
    access: {
      read: readContent(scoped, slug === "honors", self),
      create: ({ req }) =>
        hasRole(req.user as Identity, "admin", "publisher", "editor") ||
        (scoped && !self && hasRole(req.user as Identity, "leader")),
      update: editContent(scoped, self),
      delete: publisher,
      readVersions: editContent(scoped, self),
    },
    hooks: {
      beforeOperation: [
        async ({ args, operation, req }) => {
          if (
            operation === "restoreVersion" &&
            !req.context.system &&
            !canPublish(req.user as Identity)
          )
            throw new Error("版本恢复仅限发布负责人");
          if (
            ["create", "update"].includes(operation) &&
            !req.context.system &&
            !canPublish(req.user as Identity)
          ) {
            const input = args as unknown as {
              data?: { _status?: string };
              draft?: boolean;
            };
            if (input.data?._status === "published")
              throw new Error("仅发布负责人可以发布");
            input.draft = true;
          }
          return args;
        },
      ],
      beforeChange: [guard(scoped, self)],
      afterChange: [audit],
    },
    fields: [
      ...common,
      ...fields,
      {
        name: "_status",
        type: "select",
        options: [],
        defaultValue: "draft",
        access: { create: publisherField, update: publisherField },
      },
    ],
  };
}
export const Users: CollectionConfig = {
  slug: "users",
  labels: { singular: "后台用户", plural: "后台用户" },
  admin: { useAsTitle: "email" },
  auth: {
    maxLoginAttempts: 5,
    lockTime: 600000,
    cookies: { sameSite: "Lax", secure: process.env.APP_ENV === "production" },
  },
  access: {
    create: admin,
    read: ({ req }) =>
      hasRole(req.user as Identity, "admin") || {
        id: { equals: req.user?.id },
      },
    update: ({ req }) =>
      hasRole(req.user as Identity, "admin") || {
        id: { equals: req.user?.id },
      },
    delete: admin,
    admin: ({ req }) => Boolean(req.user),
  },
  hooks: {
    beforeChange: [
      ({ data, operation, req }) => {
        if (
          operation === "create" &&
          !req.context.system &&
          !hasRole(req.user as Identity, "admin")
        )
          throw new APIError("通过受控初始化或管理员建立账号", 403);
        return data;
      },
    ],
    afterChange: [audit],
  },
  fields: [
    text("name", "显示名称"),
    {
      name: "roles",
      label: "角色",
      type: "select",
      hasMany: true,
      required: true,
      defaultValue: ["editor"],
      options: [
        { label: "系统管理员", value: "admin" },
        { label: "内容编辑", value: "editor" },
        { label: "发布负责人", value: "publisher" },
        { label: "分部负责人", value: "leader" },
      ],
      access: { create: adminField, update: adminField },
    },
    {
      name: "teams",
      label: "负责分部",
      type: "relationship",
      relationTo: "teams",
      hasMany: true,
      access: { create: adminField, update: adminField },
    },
  ],
};
export const Media: CollectionConfig = {
  slug: "media",
  labels: { singular: "公开媒体", plural: "公开媒体" },
  access: { read: () => true, create: staff, update: publisher, delete: admin },
  upload: {
    staticDir: process.env.MEDIA_DIR || "media",
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
    imageSizes: [{ name: "card", width: 800, height: 600, position: "centre" }],
    adminThumbnail: "card",
  },
  hooks: {
    beforeOperation: [
      async ({ args, operation, req }) => {
        if (["create", "update"].includes(operation) && req.file) {
          if (req.file.size > 8 * 1024 * 1024) throw new Error("图片上限 8 MB");
          if (!/\.(png|jpe?g|webp)$/i.test(req.file.name))
            throw new Error("仅支持 PNG、JPEG、WebP 扩展名");
          const meta = await sharp(req.file.data).metadata();
          if (
            !["jpeg", "png", "webp"].includes(meta.format ?? "") ||
            !meta.width ||
            !meta.height ||
            meta.width * meta.height > 40000000
          )
            throw new Error("不支持的实际图片类型或像素过大");
        }
        return args;
      },
    ],
  },
  fields: [
    text("alt", "替代文字", true),
    text("credit", "来源 / 授权说明", true),
    { name: "demo", label: "演示媒体", type: "checkbox" },
  ],
};
export const Collections: CollectionConfig[] = [
  Users,
  Media,
  content("games", "游戏项目", [
    { name: "sort", label: "排序", type: "number" },
  ]),
  content("teams", "代表队", [rel("game", "游戏项目", "games")], true, true),
  content(
    "seasons",
    "赛季阵容",
    [
      rel("team", "代表队", "teams", true),
      text("season", "赛季名称", true),
      date("startAt", "赛季开始"),
      {
        name: "members",
        label: "获准公开的阵容",
        type: "array",
        fields: [
          text("displayName", "公开昵称", true),
          text("position", "位置"),
          {
            name: "consent",
            label: "已取得公开授权",
            type: "checkbox",
            required: true,
            validate: (v: unknown) => v === true || "请确认公开授权",
          },
        ],
      },
    ],
    true,
  ),
  content(
    "honors",
    "荣誉",
    [
      rel("team", "取得成绩时的代表队", "teams", true),
      rel("season", "取得成绩时的赛季", "seasons"),
      rel("game", "游戏项目", "games"),
      text("competition", "赛事", true),
      text("division", "组别"),
      text("placing", "名次", true),
      date("date", "获奖日期"),
      url("sourceURL", "公开证明来源"),
      {
        name: "verified",
        label: "已经核验",
        type: "checkbox",
        defaultValue: false,
        access: { create: publisherField, update: publisherField },
      },
    ],
    true,
  ),
  content("events", "活动", [
    {
      name: "type",
      label: "类型",
      type: "select",
      options: ["比赛", "观赛", "交流", "训练", "其他"],
    },
    rel("game", "游戏项目", "games"),
    rel("team", "相关代表队", "teams"),
    date("startAt", "开始时间"),
    date("endAt", "结束时间"),
    text("location", "地点"),
    {
      name: "lifecycle",
      label: "人工生命周期",
      type: "select",
      defaultValue: "scheduled",
      options: [
        { label: "按时间推进", value: "scheduled" },
        { label: "取消", value: "cancelled" },
        { label: "延期", value: "postponed" },
        { label: "结束", value: "ended" },
      ],
    },
    ...registration,
  ]),
  content("recruitment", "招新批次", [
    {
      name: "kind",
      label: "招新类型",
      type: "select",
      required: true,
      options: [
        { label: "普通社员", value: "members" },
        { label: "代表队选拔", value: "teams" },
        { label: "骨干招新", value: "staff" },
      ],
    },
    rel("game", "游戏项目", "games"),
    ...registration,
    {
      name: "positions",
      label: "岗位 / 位置",
      type: "array",
      fields: [
        text("name", "名称", true),
        { name: "duties", label: "职责", type: "textarea" },
        { name: "requirements", label: "要求", type: "textarea" },
        text("commitment", "投入要求"),
        text("arrangement", "选拔安排"),
      ],
    },
  ]),
  content("news", "动态", [
    {
      name: "type",
      label: "类型",
      type: "select",
      options: ["公告", "新闻", "回顾", "人物故事"],
    },
    date("publishedAt", "发布日期"),
    rel("event", "关联活动", "events"),
    rel("team", "关联队伍", "teams"),
  ]),
  content("albums", "相册", [
    date("date", "拍摄日期"),
    rel("event", "关联活动", "events"),
    {
      name: "photos",
      label: "图片",
      type: "array",
      maxRows: 200,
      fields: [rel("image", "图片", "media", true), text("caption", "说明")],
    },
  ]),
  content("pages", "固定页面", [
    {
      name: "key",
      label: "页面",
      type: "select",
      unique: true,
      required: true,
      options: [
        "about",
        "contact",
        "privacy",
        "join",
        "join-members",
        "join-teams",
        "join-staff",
      ],
    },
    {
      name: "sections",
      label: "内容分区 / 常见问题",
      type: "array",
      fields: [
        text("heading", "标题", true),
        { name: "text", label: "内容", type: "textarea" },
      ],
    },
  ]),
  {
    slug: "redirects",
    labels: { singular: "路径重定向", plural: "路径重定向" },
    access: { read: () => true, create: admin, update: admin, delete: admin },
    fields: [
      { ...text("from", "旧路径", true), unique: true },
      {
        ...text("to", "新路径", true),
        validate: (v: unknown) =>
          (typeof v === "string" &&
            /^\/(events|teams|honors|news|gallery|recruitment)\/[a-z0-9-]+$/.test(
              v,
            )) ||
          "只能跳转到站内内容详情",
      },
    ],
  },
  {
    slug: "audit",
    labels: { singular: "审计日志", plural: "审计日志" },
    access: {
      read: admin,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    fields: [
      text("actor", "操作者"),
      text("action", "操作"),
      text("object", "对象"),
      text("status", "状态"),
    ],
  },
];
