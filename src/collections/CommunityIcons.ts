import {
  APIError,
  type Access,
  type CollectionConfig,
  type Where,
} from "payload";
import { canManageCommunityIcon } from "../lib/community-icons-access";
import { canPublish, communityIDs, relationID } from "../lib/rules";

const scope: Access = ({ req }) => {
  if (canPublish(req.user)) return true;
  const games = communityIDs(req.user);
  return games.length ? ({ game: { in: games } } as Where) : false;
};
export const CommunityIcons: CollectionConfig = {
  slug: "community-icons",
  labels: { singular: "社群图标", plural: "社群图标" },
  admin: { hidden: true },
  access: {
    read: (args) =>
      args.req.context.publicCommunityIcon
        ? ({ game: { equals: args.req.context.publicCommunityIcon } } as Where)
        : scope(args),
    create: ({ req, data }) =>
      req.context.communityIconWrite === true &&
      canManageCommunityIcon(req.user, data?.game),
    update: (args) =>
      args.req.context.communityIconWrite === true ? scope(args) : false,
    delete: () => false,
  },
  hooks: {
    beforeChange: [
      ({ req, data, originalDoc }) => {
        const game = relationID(originalDoc?.game ?? data.game);
        if (
          !req.transactionID ||
          req.context.communityIconWrite !== true ||
          !canManageCommunityIcon(req.user, game)
        )
          throw new APIError("请通过社群的图标编辑入口保存", 403);
        if (
          originalDoc &&
          data.game !== undefined &&
          String(relationID(data.game)) !== String(game)
        )
          throw new APIError("图标所属社群不可修改", 403);
        return { ...data, updatedBy: req.user!.id };
      },
    ],
  },
  fields: [
    {
      name: "game",
      label: "游戏社群",
      type: "relationship",
      relationTo: "games",
      required: true,
      unique: true,
      maxDepth: 0,
    },
    {
      name: "source",
      label: "裁切原图",
      type: "textarea",
      required: true,
      maxLength: 6_000_000,
      access: {
        read: ({ req, doc }) => canManageCommunityIcon(req.user, doc?.game),
      },
    },
    {
      name: "image",
      label: "展示图标",
      type: "textarea",
      required: true,
      maxLength: 2_000_000,
    },
    {
      name: "crop",
      label: "裁切位置",
      type: "json",
      required: true,
      access: {
        read: ({ req, doc }) => canManageCommunityIcon(req.user, doc?.game),
      },
    },
    { name: "credit", label: "图片来源", type: "text", maxLength: 200 },
    {
      name: "updatedBy",
      label: "修改人",
      type: "relationship",
      relationTo: "users",
      maxDepth: 0,
      access: {
        read: ({ req, doc }) => canManageCommunityIcon(req.user, doc?.game),
      },
    },
  ],
};
