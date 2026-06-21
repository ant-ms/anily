import { Hono } from "hono";
import {
  oidcAuthMiddleware,
  revokeSession,
  processOAuthCallback,
} from "@hono/oidc-auth";
import { cors } from "hono/cors";

export const setupAuthHandlers = (app: Hono) => {
  app.use("*", cors());
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
