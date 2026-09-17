import { Hono } from "hono";
import {
  oidcAuthMiddleware,
  revokeSession,
  processOAuthCallback,
  getAuth,
} from "@hono/oidc-auth";
import { cors } from "hono/cors";
import { getCookie } from "hono/cookie";

export const isAllowedOrigin = (origin: string): boolean => {
  if (!origin) return false;
  const normalized = origin.replace(/\/$/, "");
  const allowed = [
    "https://codeee-5173.ant.ms",
    "http://localhost:5173",
    "http://localhost:3000",
    "https://localhost",
    "http://localhost",
    "capacitor://localhost",
    ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : []),
    ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : []),
  ];
  if (allowed.some((item) => item.trim().replace(/\/$/, "") === normalized)) {
    return true;
  }
  if (
    /^https?:\/\/localhost(:\d+)?$/.test(normalized) ||
    normalized === "capacitor://localhost"
  ) {
    return true;
  }
  if (/^https?:\/\/([a-zA-Z0-9-]+\.)*ant\.ms(:\d+)?$/.test(normalized)) {
    return true;
  }
  return false;
};

export const setupAuthHandlers = (app: Hono) => {
  const corsMiddleware = cors({
    origin: (origin) => (isAllowedOrigin(origin) ? origin : undefined),
    credentials: true,
  });

  app.use("*", async (c, next) => {
    if (c.req.path.startsWith("/api/stream/proxy")) {
      return next();
    }
    return corsMiddleware(c, next);
  });
  app.use("*", async (c, next) => {
    const authHeader = c.req.header("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const cookieName = process.env.OIDC_COOKIE_NAME || "oidc-auth";
      const existingCookie = c.req.header("cookie");
      const cookieVal = `${cookieName}=${token}`;
      c.req.raw.headers.set(
        "Cookie",
        existingCookie ? `${existingCookie}; ${cookieVal}` : cookieVal
      );
    }
    await next();
  });
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
  app.use("/api/*", async (c, next) => {
    if (c.req.path.startsWith("/api/stream/proxy")) {
      return next();
    }
    if (!process.env.OIDC_ISSUER && !process.env.OIDC_CLIENT_ID) {
      return next();
    }
    return oidcAuthMiddleware()(c, next);
  });
  app.get("/api/login", (c) => {
    const isMobile = c.req.query("mobile") === "1";
    if (isMobile) {
      const cookieName = process.env.OIDC_COOKIE_NAME || "oidc-auth";
      const session = getCookie(c, cookieName);
      if (session) {
        return c.redirect(`ms.ant.anily://auth?session=${encodeURIComponent(session)}`);
      }
    }
    const redirect = c.req.query("redirect");
    if (redirect) {
      try {
        const url = new URL(redirect);
        if (isAllowedOrigin(url.origin)) {
          return c.redirect(redirect);
        }
      } catch {}
    }
    return c.redirect("/");
  });
  app.get("/api/me", async (c) => {
    const auth = await getAuth(c);
    if (!auth) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    return c.json(auth);
  });
};
