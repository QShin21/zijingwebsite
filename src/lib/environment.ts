// SERVER_URL is intentionally server-only so a single image can run in staging or production.
export const serverURL=process.env.SERVER_URL||process.env.NEXT_PUBLIC_SERVER_URL||'http://localhost:3000';
