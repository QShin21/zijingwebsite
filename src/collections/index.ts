import { EventSignups, signupFields, validateSignupForm } from './signups';
import type {
  CollectionConfig,
  Where,
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
  readEventContent,
  readAnnouncementContent,
  staff,
} from "../access";
import {
  canPublish,
  canSubmitClubContent,
  relationID,
  hasRole,
  routeFor,
  safeURL,
  type Identity,
} from "../lib/rules";
import sharp from "sharp";
import { APIError } from "payload";
import { SocialCollections } from "./social";
import { ContentPromotions } from "./promotions";
import { StaffBatches, StaffApplications } from "./staff-recruitment";
import { TeamCoreCollections, teamLifecycleFields, guardTeamLifecycle, closeInactiveTeamRecruitments } from "./team-core";
import { TeamMemberProfiles } from "./team-profiles";
import { TeamHonorRecords } from "./team-honor-records";
import { protectLegacyTeamHonors } from "./team-honor-legacy";
import { publicMediaRead } from "../lib/public-media-access";
import { nicknameKey, validNickname } from "../lib/nickname";
import { postImagesField, validatePostImages } from "./publication-images";
import { guardTeamSlug, validateTeamSlug } from "../lib/team-slugs";
import { userPermissionFields, userPermissionUnchanged } from "../lib/user-permissions";
import { accountEmail, affiliations, affiliationLabels, classifyEmail } from "../lib/affiliation";
import { audienceField } from "../lib/content-audience";

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
      canPublish(req.user as Identity) ||
      (canSubmitClubContent(req.user as Identity) &&
        String(doc?.submittedBy) === String(req.user?.id)),
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
  {
    name: "submittedBy",
    label: "投稿人",
    type: "relationship",
    relationTo: "users",
    access: { create: () => true, update: () => false, read: ({ req }) => canPublish(req.user as Identity) },
  },
  {
    name: "reviewState",
    label: "审核状态",
    type: "select",
    defaultValue: "editing",
    options: [
      { label: "编辑中", value: "editing" },
      { label: "待审核", value: "submitted" },
      { label: "退回修改", value: "rejected" },
      { label: "已审核", value: "approved" },
    ],
  },
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
  (_scoped: boolean, _self: boolean): CollectionBeforeChangeHook =>
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
      ) {
        req.context.previousPublishedSlug = published.slug;
        req.context.hasPublishedVersion = true;
      }
    }
    const user = req.user as Identity;
    if (!req.context.system && !canPublish(user)) {
      data._status = "draft";
      if (operation === "create") data.submittedBy = user.id;
      else if (originalDoc?.submittedBy && data.submittedBy &&
        String(data.submittedBy) !== String(originalDoc.submittedBy))
        throw new APIError("投稿人不可修改", 403);
      // A contributor may revise previously approved content as a new draft.
      if (operation === "update" && originalDoc?.reviewState === "approved")
        data.reviewState = data.reviewState === "submitted" ? "submitted" : "editing";
      if (data.reviewState && !["editing", "submitted"].includes(data.reviewState))
        throw new APIError("只有审核负责人可以批准或退回", 403);
    }
    if (!req.context.system && canPublish(user) && data._status === "published" &&
        originalDoc?.submittedBy && originalDoc?._status !== "published" &&
        !req.context.hasPublishedVersion && !req.context.isRestoringVersion &&
        (data.reviewState ?? originalDoc?.reviewState) !== "submitted")
      throw new APIError("投稿需要先提交审核", 409);
    if (data._status === "published") data.reviewState = "approved";
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
  const permissionChange = collection.slug === "users" &&
    (JSON.stringify(previousDoc?.roles) !== JSON.stringify(doc.roles) ||
      JSON.stringify(previousDoc?.teams) !== JSON.stringify(doc.teams) ||
      JSON.stringify(previousDoc?.communityOffices) !== JSON.stringify(doc.communityOffices));
  const action = [
    permissionChange ? "permissions-change" : null,
    collection.slug === "users" && req.context.adminPasswordReset ? "admin-password-reset" : null,
  ].filter(Boolean).join("+") || operation;
  // Internal privilege is narrowly limited to append-only audit/redirect records in this transaction.
  await req.payload.create({
    collection: "audit",
    overrideAccess: true,
    req,
    context: { ...req.context, skipAudit: true },
    data: {
      actor: String(req.user?.id ?? "system"),
      action,
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
  const hasPostImages = slug === "events" || slug === "announcements";
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
      read: slug === "events" ? readEventContent : slug === "announcements" ? readAnnouncementContent : readContent(scoped, slug === "honors", self),
      create: ({ req }) =>
        canSubmitClubContent(req.user as Identity),
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
      beforeChange: [guard(scoped, self), ...(slug === 'teams' ? [guardTeamSlug, guardTeamLifecycle] : []), ...(slug === 'events' ? [validateSignupForm] : []), ...(hasPostImages ? [validatePostImages] : [])],
      afterChange: [...(slug === "teams" ? [closeInactiveTeamRecruitments] : []), audit],
    },
    fields: [
      ...common.map(field => slug === "teams" && "name" in field && field.name === "slug" && field.type === "text"
        ? { ...field, validate: validateTeamSlug } : field),
      ...(hasPostImages ? [audienceField, postImagesField] : []),
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
  labels: { singular: "用户", plural: "用户" },
  admin: {
    useAsTitle: "name",
    description: "社长、副社长可重置密码；办理退休时将平台角色设为荣誉骨干并保存，原有社群任职将自动撤任。",
  },
  auth: {
    maxLoginAttempts: 5,
    lockTime: 600000,
    cookies: { sameSite: "Lax", secure: process.env.APP_ENV === "production" },
  },
  access: {
    create: () => false,
    read: ({ req }) =>
      req.context.publicCommunityContacts ? ({ and: [{ communities: { contains: req.context.publicCommunityContacts } }, { accountStatus: { not_equals: "suspended" } }] } as Where) :
      canPublish(req.user as Identity) || {
        id: { equals: req.user?.id },
      },
    update: ({ req }) =>
      canPublish(req.user as Identity) || {
        id: { equals: req.user?.id },
      },
    delete: admin,
    admin: ({ req }) => canSubmitClubContent(req.user as Identity),
  },
  hooks: {
    beforeOperation: [({ args, operation, req }) => {
      if (["create", "update"].includes(operation)) {
        const input = args as unknown as { data?: Record<string, unknown> };
        req.context.adminPasswordReset = false;
        req.context.legacyCommunitiesInput = input.data?.communities !== undefined && input.data?.communityOffices === undefined;
        // Capture before field access removes read-only values from data.
        req.context.userSubmittedPermissions = structuredClone(Object.fromEntries(
          Object.entries(input.data ?? {}).filter(([key]) => userPermissionFields.some(field => field === key)),
        ));
      }
      return args;
    }],
    beforeValidate: [({ data }) => {
      if (data) {
        // Never trust a key supplied by a REST, GraphQL or Local API caller.
        delete data.nameKey;
        if (typeof data.name === "string") {
          data.name = data.name.trim();
          data.nameKey = nicknameKey(data.name);
        }
      }
      return data;
    }],
    beforeChange: [
      ({ data, operation, req, originalDoc }) => {
        if (
          operation === "create" &&
          !req.context.system &&
          !req.context.signupVerified
        )
          throw new APIError("账号必须经过邮箱验证", 403);
        if (operation === "create" && req.context.signupVerified) {
          const email = accountEmail(data.email);
          if (!email) throw new APIError("邮箱格式无效", 400);
          data.email = email;
          data.affiliation = classifyEmail(email);
          const bootstrap = data.affiliation === "tsinghua" && req.context.presidentClaim &&
            email === process.env.PRESIDENT_CLAIM_EMAIL?.trim().toLowerCase();
          data.roles = [bootstrap ? "president" : "member"];
          data.accountStatus = "active";
          data.communityOffices = [];
          data.communities = [];
          data.teams = [];
          data.department = undefined;
        }
        if (operation === "update" && !req.context.system) {
          const submitted = req.context.userSubmittedPermissions as Record<string, unknown> ?? {};
          if ("affiliation" in submitted && !userPermissionUnchanged("affiliation", submitted.affiliation, originalDoc?.affiliation))
            throw new APIError("邮箱身份由验证邮箱确定", 403);
          const retirement = hasRole(req.user as Identity, "vicePresident") &&
            Array.isArray(submitted.roles) && submitted.roles.length === 1 && submitted.roles[0] === "honoraryBackbone" &&
            !hasRole(originalDoc as Identity, "president") &&
            Object.entries(submitted).every(([key, value]) => key === "roles" || userPermissionUnchanged(key, value, originalDoc?.[key]));
          if (!hasRole(req.user as Identity, "president") && !retirement &&
            Object.entries(submitted).some(([key, value]) => !userPermissionUnchanged(key, value, originalDoc?.[key])))
            throw new APIError("只有社长可以调整权限", 403);
          if (data.email !== undefined && data.email !== originalDoc?.email)
            throw new APIError("修改账号邮箱必须经过受控邮箱验证", 403);
          if (data.password) {
            if (!req.context.verifiedPasswordChange && !canPublish(req.user as Identity))
              throw new APIError("修改密码需完成邮箱验证，或由社长、副社长在后台重置", 403);
            if (typeof data.password !== "string" || data.password.length < 8)
              throw new APIError("新密码至少需要 8 位", 400);
            req.context.adminPasswordReset = canPublish(req.user as Identity) && !req.context.verifiedPasswordChange;
          }
        }
        if (operation === "update" && originalDoc &&
          hasRole(originalDoc as Identity, "president") &&
          data.roles && !data.roles.includes("president") && !req.context.system)
          throw new APIError("社长账号不可通过普通编辑降级", 403);
        if (data.roles && (data.roles.length !== 1 ||
          !["president", "vicePresident", "backbone", "communityAdmin", "honoraryBackbone", "member"].includes(data.roles[0])))
          throw new APIError("账号必须且只能拥有一个等级", 400);
        const affiliation = data.affiliation ?? originalDoc?.affiliation;
        if (affiliation && affiliation !== "tsinghua" && (data.roles?.some((role: string) => role !== "member") ||
            data.teams?.length || data.communities?.length || data.department ||
            data.communityOffices?.some((office: { status?: string }) => office.status === "active"))) {
          throw new APIError("社团任职和代表队权限仅适用于清华账号", 403);
        }
        if (operation === "update" && data.roles?.[0] === "honoraryBackbone" && originalDoc?.roles?.[0] !== "honoraryBackbone") {
          data.department = null;
          data.teams = [];
          data.communityOffices = (originalDoc?.communityOffices ?? []).map((office: Record<string, unknown>) => ({ ...office, status: "revoked" }));
        }
        // Preserve legacy controlled assignments, while making the independent office canonical.
        if (data.communities !== undefined && req.context.legacyCommunitiesInput === true) {
          const old = originalDoc?.communityOffices ?? [];
          data.communityOffices = data.communities.map((game: unknown) => old.find((office: { game: unknown }) => String(relationID(office.game)) === String(relationID(game))) ?? {
            game: relationID(game), status: "active", publishContent: true, reviewShowcase: true,
            handleJoins: true, viewSignups: false, exportSignups: false, contactConsent: false,
            grantedAt: new Date().toISOString(), grantedBy: req.user?.id,
          });
        }
        if (data.communityOffices !== undefined) {
          if (!Array.isArray(data.communityOffices)) throw new APIError("社群任职格式无效", 400);
          for (const office of data.communityOffices) {
            const previous = originalDoc?.communityOffices?.find((item: { id?: string }) => item.id && item.id === office.id);
            if (previous?.game != null && String(relationID(previous.game)) !== String(relationID(office.game)))
              throw new APIError("任职所属社群不可更换；请撤任后新增授权", 400);
          }
          // Removing an assignment must retain its revocation evidence for rollback checks.
          for (const previous of originalDoc?.communityOffices ?? []) {
            const retained = data.communityOffices.some((office: { id?: string; game?: unknown }) =>
              previous.game != null
                ? String(relationID(office.game)) === String(relationID(previous.game))
                : previous.id && office.id === previous.id);
            if (!retained) data.communityOffices.push({ ...previous, status: "revoked" });
          }
          const seen = new Set<string>();
          for (const office of data.communityOffices) {
            const game = String(relationID(office.game));
            if (office.status === "active" && !(Number(game) > 0)) {
              const oldOffice = originalDoc?.communityOffices?.find((item: { id?: string; game?: unknown }) => item.id === office.id);
              if (!oldOffice || oldOffice.game != null) throw new APIError("在任授权需选择游戏社群", 400);
              office.status = "revoked";
            }
            if (Number(game) > 0) {
              if (seen.has(game)) throw new APIError("同一社群只能有一项任职", 400);
              seen.add(game);
            }
            if (office.exportSignups && !office.viewSignups) throw new APIError("导出报名需要同时授予读取报名权限", 400);
          }
          data.communities = data.communityOffices.filter((office: { status?: string }) => office.status === "active").map((office: { game: unknown }) => relationID(office.game));
        }
        return data;
      },
    ],
    afterChange: [audit],
  },
  fields: [
    { ...text("name", "昵称", true), minLength: 2, maxLength: 40,
      validate: (value: unknown) => validNickname(value) || "昵称需为 2–40 个字符，不含 @ 或控制字符",
      admin: { description: "昵称唯一，登录和重名检查不区分大小写，展示保留输入的大小写。" } },
    { ...text("nameKey", "昵称匹配键", true), unique: true, index: true,
      // Derived by the hook; Local API callers should only provide the display name.
      typescriptSchema: [({ jsonSchema }) => ({ ...jsonSchema, required: false })],
      admin: { hidden: true }, access: { read: () => false } },
    {
      name: "affiliation",
      label: "邮箱身份",
      type: "select",
      required: true,
      defaultValue: "tsinghua",
      typescriptSchema: [({ jsonSchema }) => ({ ...jsonSchema, required: false })],
      options: affiliations.map(value => ({ value, label: affiliationLabels[value] })),
      access: { create: () => false, update: () => false },
      admin: { readOnly: true, description: "由已验证邮箱确定，与平台角色和社群任职分开。" },
    },
    {
      name: "roles",
      label: "平台角色（与社群任职分开）",
      type: "select",
      hasMany: true,
      required: true,
      defaultValue: ["member"],
      options: [
        { label: "社长", value: "president" },
        { label: "副社长", value: "vicePresident" },
        { label: "骨干", value: "backbone" },
        { label: "社群管理", value: "communityAdmin" },
        { label: "荣誉骨干（退休）", value: "honoraryBackbone" },
        { label: "普通用户", value: "member" },
      ],
      access: { create: () => true, update: publisherField },
    },
    { name: "accountStatus", label: "账号状态", type: "select", defaultValue: "active",
      options: ["active", "suspended"], access: { create: adminField, update: adminField } },
    { name: "department", label: "骨干方向（同权限）", type: "select", options: [
      { label: "执行部", value: "execution" }, { label: "宣传部", value: "publicity" },
    ], access: { create: adminField, update: adminField } },
    { name: "communityOffices", label: "社群任职与能力", type: "array",
      admin: { description: "移除任职会保留已撤任记录；仅在任授权生效。更换社群请新增任职。" },
      access: { create: adminField, update: adminField }, fields: [
        { name: "game", label: "游戏社群（在任必选）", type: "relationship", relationTo: "games", maxDepth: 0 },
        { name: "status", label: "任职状态", type: "select", required: true, defaultValue: "active", options: [
          { label: "在任", value: "active" }, { label: "已撤任", value: "revoked" },
        ] },
        { name: "publishContent", label: "发布本社群活动与通知", type: "checkbox", defaultValue: true },
        { name: "reviewShowcase", label: "审核本社群风采", type: "checkbox", defaultValue: true },
        { name: "handleJoins", label: "管理本社群代表队", type: "checkbox", defaultValue: true },
        { name: "viewSignups", label: "读取本社群报名（含个人资料）", type: "checkbox", defaultValue: false },
        { name: "exportSignups", label: "导出本社群报名", type: "checkbox", defaultValue: false },
        { name: "contactConsent", label: "同意展示已批准申请的微信名片", type: "checkbox", defaultValue: false },
        { name: "grantedBy", label: "授予人", type: "relationship", relationTo: "users", maxDepth: 0 },
        { name: "grantedAt", label: "授予时间", type: "date" },
        { name: "sourceApplication", label: "来源申请", type: "relationship", relationTo: "community-applications", maxDepth: 0 },
      ] },
    { name: "communities", label: "旧客户端社群投影（由任职生成）", type: "relationship", relationTo: "games",
      hasMany: true, admin: { hidden: true }, access: { create: adminField, update: adminField } },
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
  access: { read: publicMediaRead, create: staff, update: publisher, delete: admin },
  upload: {
    staticDir: process.env.MEDIA_DIR || "media",
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
    imageSizes: [{ name: "card", width: 800, height: 600, position: "centre" }],
    adminThumbnail: "card",
    modifyResponseHeaders: ({ headers }) => {
      headers.set("Cache-Control", "private, no-store");
      headers.set("Vary", "Cookie, Authorization");
      return headers;
    },
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
  ...SocialCollections,
  ContentPromotions,
  StaffBatches, StaffApplications,
  ...TeamCoreCollections,
  TeamMemberProfiles,
  TeamHonorRecords,
  EventSignups,
  content("games", "游戏项目", [
    { name: "sort", label: "排序", type: "number" },
  ]),
  content("teams", "代表队", [rel("game", "游戏项目", "games"), ...teamLifecycleFields], true, true),
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
  protectLegacyTeamHonors(content(
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
  )),
  content("events", "活动", [
    ...signupFields,
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
  content("announcements", "通知", [
    date("publishedAt", "发布日期"),
    rel("game", "相关游戏项目", "games"),
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
