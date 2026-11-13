import config from "@payload-config";
import { legacyPublicContent } from "@/lib/legacy-public-content";
import {
  REST_GET,
  REST_POST,
  REST_DELETE,
  REST_PATCH,
  REST_PUT,
  REST_OPTIONS,
} from "@payloadcms/next/routes";
const payloadGet = REST_GET(config);
export const GET: typeof payloadGet = async (request, context) => {
  const { slug = [] } = await context.params;
  const [collection] = slug;
  if (slug.length === 1 && !request.headers.has("cookie") && !request.headers.has("authorization") &&
      (collection === "events" || collection === "announcements" || collection === "pages")) {
    const response = await legacyPublicContent(request, collection);
    if (response) return response;
  }
  return payloadGet(request, context);
};
export const POST = REST_POST(config);
export const DELETE = REST_DELETE(config);
export const PATCH = REST_PATCH(config);
export const PUT = REST_PUT(config);
export const OPTIONS = REST_OPTIONS(config);
