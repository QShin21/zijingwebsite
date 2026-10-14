// Match playwright.config.ts or the explicitly selected synthetic QA port.
// Negative cross-origin tests keep their own deliberately foreign origins.
export const browserTestOrigin = new URL(
  `http://localhost:${process.env.REBUILD_QA_SERVER_PORT || "3000"}`,
).origin;
