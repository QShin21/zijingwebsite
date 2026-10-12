import { APIError, type PayloadRequest } from "payload";
import type { HonorAction } from "./team-honor-model";

type HonorWriteGrant = {
  action: HonorAction;
  id?: number;
  data: Record<string, unknown>;
};
const writeGrants = new WeakMap<object, HonorWriteGrant>();
const projectionGrants = new WeakSet<object>();
function token(value: unknown): object | null {
  return value !== null && typeof value === "object" ? value : null;
}
export const honorWriteGrant = (req: PayloadRequest) => {
  const key = token(req.context.teamHonorWriteToken);
  return key ? writeGrants.get(key) : undefined;
};
export const honorProjectionGranted = (req: PayloadRequest) => {
  const key = token(req.context.teamHonorProjectionToken);
  return Boolean(key && projectionGrants.has(key));
};

// These grants are request-local server capabilities. HTTP JSON/context cannot forge them.
export async function withHonorWrite<T>(
  req: PayloadRequest,
  grant: HonorWriteGrant,
  work: () => Promise<T>,
) {
  if (!req.transactionID || !req.user?.id)
    throw new APIError("请通过荣誉工作台保存", 403);
  const key = {};
  req.context.teamHonorWriteToken = key;
  writeGrants.set(key, grant);
  try {
    return await work();
  } finally {
    writeGrants.delete(key);
    delete req.context.teamHonorWriteToken;
  }
}
export async function withHonorProjection<T>(
  req: PayloadRequest,
  work: () => Promise<T>,
) {
  if (req.user) throw new APIError("公开档案必须使用匿名投影", 403);
  const key = {};
  req.context.teamHonorProjectionToken = key;
  projectionGrants.add(key);
  try {
    return await work();
  } finally {
    projectionGrants.delete(key);
    delete req.context.teamHonorProjectionToken;
  }
}
