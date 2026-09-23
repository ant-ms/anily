import { Hono } from "hono";
import {
  oidcAuthMiddleware,
  revokeSession,
  processOAuthCallback,
  getAuth,
} from "@hono/oidc-auth";
import { cors } from "hono/cors";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";

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
    const queryToken = c.req.query("token") || c.req.query("session");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : queryToken;
    if (token) {
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
    if (c.req.path === "/api/login") {
      return oidcAuthMiddleware()(c, next);
    }

    try {
      const auth = await getAuth(c);
      if (!auth) {
        const cookieName = process.env.OIDC_COOKIE_NAME || "oidc-auth";
        deleteCookie(c, cookieName, { path: "/" });
        return c.json({ error: "Unauthorized" }, 401);
      }
    } catch {
      const cookieName = process.env.OIDC_COOKIE_NAME || "oidc-auth";
      deleteCookie(c, cookieName, { path: "/" });
      return c.json({ error: "Unauthorized" }, 401);
    }

    await next();

    c.res.headers.set("Cache-Control", "private, no-cache");
    const session_jwt = c.get("oidcAuthJwt" as any);
    if (session_jwt !== undefined) {
      const cookieName = process.env.OIDC_COOKIE_NAME || "oidc-auth";
      setCookie(c, cookieName, session_jwt, {
        path: "/",
        httpOnly: true,
        secure: true,
      });
    }
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
    const user = await getAuthenticatedUser(c);
    return c.json({
      ...auth,
      userId: user.id,
    });
  });
};

export type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
  sub?: string | null;
};

export const getAuthenticatedUser = async (c: any): Promise<AuthUser> => {
  const existing = c.get("user" as any) as AuthUser | undefined;
  if (existing) return existing;

  const { prisma } = await import("./prisma");

  let email: string | undefined;
  let name: string | undefined;
  let sub: string | undefined;

  try {
    const auth = await getAuth(c);
    if (auth?.email) email = auth.email;
    if (auth?.name) name = auth.name;
    if (auth?.sub) sub = auth.sub;
  } catch {}

  let user: AuthUser | null = null;

  if (email || sub) {
    user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(email ? [{ email }] : []),
          ...(sub ? [{ sub }] : []),
        ],
      },
    });

    if (!user && email) {
      user = await prisma.user.upsert({
        where: { email },
        create: {
          email,
          sub: sub ?? null,
          name: name ?? null,
        },
        update: {
          ...(sub ? { sub } : {}),
          ...(name ? { name } : {}),
        },
      });
    }
  }

  // Fallback for single-tenant / local development mode when unauthenticated
  if (!user) {
    const fallbackEmail = process.env.DEFAULT_USER_EMAIL;
    if (fallbackEmail) {
      user = await prisma.user.findUnique({ where: { email: fallbackEmail } });
    }
    if (!user) {
      // Resolve the primary user in the database
      user = await prisma.user.findFirst({
        orderBy: { createdAt: "asc" },
      });
    }
    if (!user) {
      const defaultEmail = fallbackEmail || "owner@anily.local";
      user = await prisma.user.create({
        data: {
          email: defaultEmail,
          name: "Owner",
        },
      });
    }
  }

  c.set("user" as any, user);
  return user;
};

