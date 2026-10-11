import {
  APIError,
  type CollectionConfig,
  type CollectionBeforeChangeHook,
  type Field,
  type Where,
} from "payload";
import {
  canParticipate,
  canPublish,
  hasRole,
  type Identity,
} from "../lib/rules";
import { normalizeSignup } from "../lib/signup-schema";
export const signupFields: Field[] = [
  {
    name: "signupForm",
    label: "活动报名问卷",
    type: "json",
    access: {
      create: ({ req }) =>
        req.context.manageSignupForm === true || req.context.system === true,
      update: ({ req }) =>
        req.context.manageSignupForm === true || req.context.system === true,
    },
    admin: { hidden: true },
  },
  {
    name: "signupEditor",
    type: "ui",
    admin: {
      components: { Field: "@/components/SignupEditorLink#SignupEditorLink" },
    },
  },
];
export const validateSignupForm: CollectionBeforeChangeHook = ({
  data,
  originalDoc,
  collection,
}) => {
  if (data.signupForm !== undefined) {
    try {
      data.signupForm = normalizeSignup(data.signupForm);
    } catch (error) {
      throw new APIError((error as Error).message, 400);
    }
  }
  if (
    collection.slug === "community-posts" &&
    (data.category || originalDoc?.category) !== "event" &&
    (data.signupForm || originalDoc?.signupForm)?.enabled
  )
    throw new APIError("通知不能启用活动报名", 400);
  return data;
};
export const EventSignups: CollectionConfig = {
  slug: "event-signups",
  labels: { singular: "活动报名记录", plural: "活动报名记录" },
  admin: {
    useAsTitle: "eventTitle",
    defaultColumns: ["eventTitle", "member", "createdAt"],
  },
  access: {
    create: ({ req }) =>
      canParticipate(req.user as Identity) &&
      req.context.submitEventSignup === true,
    read: ({ req }) => {
      const user = req.user as Identity;
      if (!canParticipate(user)) return false;
      if (canPublish(user)) return true;
      const scope: Where[] = [{ member: { equals: user.id } }];
      if (hasRole(user, "communityAdmin")) {
        scope.push({ organizer: { equals: user.id } });
        const games = (user.communities || []).map((v) =>
          typeof v === "object" ? v.id : v,
        );
        if (games.length)
          scope.push({
            and: [
              { activityType: { equals: "community-posts" } },
              { game: { in: games } },
            ],
          });
      }
      return { or: scope };
    },
    update: ({ req }) =>
      canParticipate(req.user as Identity) && req.context.updateEventSignup === true
        ? { member: { equals: req.user!.id } }
        : false,
    delete: () => false,
  },
  hooks: {
    beforeChange: [
      ({ req, data, operation, originalDoc }) => {
        if (operation === "update") {
          if (
            req.context.updateEventSignup !== true ||
            String(originalDoc?.member?.id ?? originalDoc?.member) !== String(req.user?.id) ||
            Object.keys(data).some((key) =>
              data[key] !== undefined &&
              !["answers", "questions", "formVersion", "updatedAt"].includes(key) &&
              JSON.stringify(data[key]) !== JSON.stringify(originalDoc?.[key]),
            )
          )
            throw new APIError("请从本人报名入口修改作答", 403);
        } else if (req.context.submitEventSignup !== true)
          throw new APIError("请从活动报名入口提交", 403);
        return data;
      },
    ],
  },
  fields: [
    { name: "activityType", type: "text", required: true },
    { name: "activityID", type: "number", required: true, index: true },
    {
      name: "dedupeKey",
      type: "text",
      required: true,
      unique: true,
      admin: { hidden: true },
    },
    {
      name: "member",
      type: "relationship",
      relationTo: "users",
      required: true,
      maxDepth: 0,
    },
    {
      name: "organizer",
      type: "relationship",
      relationTo: "users",
      maxDepth: 0,
    },
    { name: "game", type: "relationship", relationTo: "games", maxDepth: 0 },
    { name: "memberName", type: "text", required: true },
    { name: "eventTitle", type: "text", required: true },
    { name: "formVersion", type: "text", required: true },
    { name: "questions", type: "json", required: true },
    { name: "answers", type: "json", required: true },
  ],
};
