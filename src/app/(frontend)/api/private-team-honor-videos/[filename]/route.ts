// Internal storage identifiers are never authorization. Browser access uses the scoped evidence endpoint.
const deny = () =>
  new Response(null, {
    status: 404,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export const GET = deny;
export const HEAD = deny;
