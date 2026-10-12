import { APIError, type PayloadRequest } from "payload";
import type { HonorAction } from "./team-honor-model";

type HonorWriteGrant = {
  action: HonorAction;
  id?: number;
  data: Record<string, unknown>;
};
type HonorGrantRegistry = {
  write: WeakMap<object, HonorWriteGrant>;
  projection: WeakSet<object>;
};
const registryKey = Symbol.for("zijing.team-honor-server-grants.v1");
const registryHost = globalThis as typeof globalThis & {
  [registryKey]?: HonorGrantRegistry;
};
const registry = (registryHost[registryKey] ??= {
  write: new WeakMap<object, HonorWriteGrant>(),
  projection: new WeakSet<object>(),
});
// Next's route/action/CMS bundles share a process cache, but may evaluate this module more than once.
const writeGrants = registry.write;
const projectionGrants = registry.projection;
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
