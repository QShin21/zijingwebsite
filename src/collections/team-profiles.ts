import {
  APIError,
  type CollectionConfig,
  type CollectionSlug,
  type Where,
} from "payload";
import { canParticipate, relationID } from "../lib/rules";
import { parseTeamProfile } from "../lib/team-profiles-model";
import {
  profileMembershipAuthority,
  type ProfileMembership,
} from "../lib/team-profiles-authority";

const privateField = { read: () => false };
export const TeamMemberProfiles: CollectionConfig = {
  slug: "team-member-profiles",
  labels: { singular: "队员公开简介", plural: "队员公开简介" },
  admin: { hidden: true, useAsTitle: "displayName" },
  access: {
    read: ({ req }) => {
      if (
        canParticipate(req.user) &&
        Number.isSafeInteger(req.context.teamProfileOwn)
      )
        return { membership: { equals: req.context.teamProfileOwn } } as Where;
      const memberships = req.context.teamProfilePublic as
        | ProfileMembership[]
        | undefined;
      if (req.user || !Array.isArray(memberships) || !memberships.length)
        return false;
      return {
        and: [
          { visible: { equals: true } },
          {
            or: memberships.map((m) => ({
              and: [
                { membership: { equals: m.id } },
                { membershipJoinedAt: { equals: m.joinedAt } },
              ],
            })),
          },
        ],
      } as Where;
    },
    create: ({ req }) =>
      canParticipate(req.user) && req.context.teamProfileWrite === true,
    update: ({ req }) =>
      canParticipate(req.user) && req.context.teamProfileWrite === true
        ? ({
            membership: { equals: req.context.teamProfileMembership },
          } as Where)
        : false,
    delete: () => false,
  },
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, req }) => {
        if (req.context.teamProfileWrite !== true || !canParticipate(req.user))
          throw new APIError("请通过本人队内简介页面修改", 403);
        const active = await profileMembershipAuthority.active(req.payload, {
          teamID: Number(req.context.teamProfileTeam),
          userID: Number(req.user!.id),
          req,
        });
        if (
          !active ||
          active.id !== req.context.teamProfileMembership ||
          Number(relationID(data.membership ?? originalDoc?.membership)) !==
            active.id ||
          (originalDoc &&
            Number(relationID(originalDoc.membership)) !== active.id)
        )
          throw new APIError("当前入队资格已失效，无法继续编辑简介", 403);
        const merged = { ...originalDoc, ...data };
        const profile = parseTeamProfile({
          displayName: merged.displayName,
          position: merged.position || "",
          biography: merged.biography || "",
          avatar: merged.avatar || null,
          visible: merged.visible,
        });
        if (
          data.membershipJoinedAt !== active.joinedAt ||
          data.revision !== (originalDoc?.revision ?? 0) + 1
        )
          throw new APIError("简介版本无效，请重新加载", 409);
        return { ...data, ...profile };
      },
    ],
  },
  fields: [
    {
      name: "membership",
      label: "权威入队关系",
      type: "relationship",
      relationTo: "team-memberships" as CollectionSlug,
      required: true,
      unique: true,
      maxDepth: 0,
      access: privateField,
    },
    {
      name: "membershipJoinedAt",
      label: "展示授权对应的入队时间",
      type: "date",
      required: true,
      access: { read: ({ req }) => Boolean(req.user) },
    },
    {
      name: "displayName",
      label: "公开昵称",
      type: "text",
      required: true,
      maxLength: 40,
    },
    { name: "position", label: "位置 / 游戏角色", type: "text", maxLength: 60 },
    { name: "biography", label: "简短介绍", type: "textarea", maxLength: 400 },
    {
      name: "avatar",
      label: "本人上传的公开头像",
      type: "textarea",
      maxLength: 2_800_000,
    },
    {
      name: "visible",
      label: "本人选择展示",
      type: "checkbox",
      required: true,
      defaultValue: false,
    },
    {
      name: "revision",
      label: "资料版本",
      type: "number",
      required: true,
      defaultValue: 1,
      access: { read: ({ req }) => Boolean(req.user) },
    },
  ],
};
