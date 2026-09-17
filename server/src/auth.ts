import { Hono } from "hono";
import {
  oidcAuthMiddleware,
  revokeSession,
  processOAuthCallback,
} from "@hono/oidc-auth";
import { cors } from "hono/cors";

export const isAllowedOrigin = (origin: string): boolean => {
  if (!origin) return false;
  const normalized = origin.replace(/\/$/, "");
  const allowed = [
    "https://codeee-5173.ant.ms",
    "http://localhost:5173",
    "http://localhost:3000",
    ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : []),
    ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : []),
  ];
  if (allowed.some((item) => item.trim().replace(/\/$/, "") === normalized)) {
    return true;
  }
  if (/^https?:\/\/([a-zA-Z0-9-]+\.)*ant\.ms(:\d+)?$/.test(normalized)) {
    return true;
  }
  return false;
};

export const setupAuthHandlers = (app: Hono) => {
  app.use(
    "*",
    cors({
      origin: (origin) => (isAllowedOrigin(origin) ? origin : undefined),
      credentials: true,
    }),
  );
  app.use("*", async (c, next) => {
    c.set("oidcClaimsHook", async (orig, claims) => ({
      ...orig,
      name: claims?.name,
      picture: claims?.picture,
    }));
    await next();
  });
  app.get("/logout", async (c) => {
    await revokeSession(c);
    return c.text("You have been successfully logged out!");
  });
  app.get("/callback", async (c) => {
    console.log("oidc callback");
    return processOAuthCallback(c);
  });
  app.use("/api/*", oidcAuthMiddleware());
};
