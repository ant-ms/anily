import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import {
  isAllowedOrigin,
  setupAuthHandlers,
  DEFAULT_SESSION_EXPIRY_SECONDS,
  appendMaxAgeToCookie,
} from "./auth";

describe("CORS configuration", () => {
  it("allows https://codeee-5173.ant.ms and variants with trailing slash", () => {
    expect(isAllowedOrigin("https://codeee-5173.ant.ms")).toBe(true);
    expect(isAllowedOrigin("https://codeee-5173.ant.ms/")).toBe(true);
  });

  it("allows localhost origins", () => {
    expect(isAllowedOrigin("http://localhost:5173")).toBe(true);
    expect(isAllowedOrigin("http://localhost:3000")).toBe(true);
    expect(isAllowedOrigin("https://localhost")).toBe(true);
    expect(isAllowedOrigin("capacitor://localhost")).toBe(true);
  });

  it("allows ant.ms domains", () => {
    expect(isAllowedOrigin("https://ant.ms")).toBe(true);
    expect(isAllowedOrigin("https://codeee-3000.ant.ms")).toBe(true);
  });

  it("rejects unauthorized origins", () => {
    expect(isAllowedOrigin("https://evil.com")).toBe(false);
    expect(isAllowedOrigin("https://notant.ms.evil.com")).toBe(false);
    expect(isAllowedOrigin("")).toBe(false);
  });

  it("handles CORS headers in Hono app for allowed origins", async () => {
    const app = new Hono();
    setupAuthHandlers(app);
    app.get("/info", (c) => c.json({ status: "ok" }));

    // Test preflight OPTIONS request
    const optionsRes = await app.request("/info", {
      method: "OPTIONS",
      headers: {
        Origin: "https://codeee-5173.ant.ms/",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "Content-Type, Authorization",
      },
    });

    expect(optionsRes.status).toBe(204);
    expect(optionsRes.headers.get("Access-Control-Allow-Origin")).toBe("https://codeee-5173.ant.ms/");
    expect(optionsRes.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    expect(optionsRes.headers.get("Access-Control-Allow-Methods")).toContain("GET");
    expect(optionsRes.headers.get("Access-Control-Allow-Headers")).toContain("Content-Type");

    // Test GET request
    const getRes = await app.request("/info", {
      method: "GET",
      headers: {
        Origin: "https://codeee-5173.ant.ms",
      },
    });

    expect(getRes.status).toBe(200);
    expect(getRes.headers.get("Access-Control-Allow-Origin")).toBe("https://codeee-5173.ant.ms");
    expect(getRes.headers.get("Access-Control-Allow-Credentials")).toBe("true");

    // Test unauthorized origin
    const unauthorizedRes = await app.request("/info", {
      method: "GET",
      headers: {
        Origin: "https://evil.com",
      },
    });

    expect(unauthorizedRes.status).toBe(200);
    expect(unauthorizedRes.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("app singleton applies CORS to attached routes", async () => {
    const { app } = await import("./app");
    app.get("/api/test-cors-route", (c) => c.json({ ok: true }));

    const res = await app.request("/api/test-cors-route", {
      headers: {
        Origin: "https://codeee-5173.ant.ms",
      },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://codeee-5173.ant.ms");
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  it("handles /api/login redirect parameter safely", async () => {
    const { app } = await import("./app");

    // Default redirect to /
    const defaultRes = await app.request("/api/login");
    expect(defaultRes.status).toBe(302);
    expect(defaultRes.headers.get("Location")).toBe("/");

    // Allowed origin redirect (e.g. Capacitor mobile origin)
    const allowedRes = await app.request("/api/login?redirect=https%3A%2F%2Flocalhost");
    expect(allowedRes.status).toBe(302);
    expect(allowedRes.headers.get("Location")).toBe("https://localhost");

    // Disallowed origin redirect falls back to /
    const evilRes = await app.request("/api/login?redirect=https%3A%2F%2Fevil.com%2Fphish");
    expect(evilRes.status).toBe(302);
    expect(evilRes.headers.get("Location")).toBe("/");
  });

  it("handles /api/login?mobile=1 deep link redirect with session cookie", async () => {
    const { app } = await import("./app");

    const res = await app.request("/api/login?mobile=1", {
      headers: {
        Cookie: "oidc-auth=jwt-session-token-12345",
      },
    });

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("ms.ant.anily://auth?session=jwt-session-token-12345");
  });

  it("translates Authorization: Bearer header to oidc-auth cookie", async () => {
    const testApp = new Hono();
    setupAuthHandlers(testApp);
    testApp.get("/api/test-bearer-auth", (c) => {
      return c.json({ cookie: c.req.header("cookie") });
    });

    const res = await testApp.request("/api/test-bearer-auth", {
      headers: {
        Authorization: "Bearer my-jwt-token-xyz",
      },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.cookie).toContain("oidc-auth=my-jwt-token-xyz");
  });

  it("translates ?token= or ?session= query param to oidc-auth cookie", async () => {
    const testApp = new Hono();
    setupAuthHandlers(testApp);
    testApp.get("/api/test-token-auth", (c) => {
      return c.json({ cookie: c.req.header("cookie") });
    });

    const res = await testApp.request("/api/test-token-auth?token=my-query-token-abc");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.cookie).toContain("oidc-auth=my-query-token-abc");
  });

  it("returns 401 Unauthorized for unauthenticated /api/* requests when OIDC is active", async () => {
    process.env.OIDC_ISSUER = "https://example.com";
    process.env.OIDC_CLIENT_ID = "test-client";
    try {
      const testApp = new Hono();
      setupAuthHandlers(testApp);
      testApp.get("/api/episodes/123", (c) => c.json({ episodes: [] }));

      const res = await testApp.request("/api/episodes/123", {
        headers: {
          Origin: "https://codeee-5173.ant.ms",
        },
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("Unauthorized");
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://codeee-5173.ant.ms");
    } finally {
      delete process.env.OIDC_ISSUER;
      delete process.env.OIDC_CLIENT_ID;
    }
  });

  it("configures default session expiration to 1 week (604,800 seconds)", () => {
    expect(DEFAULT_SESSION_EXPIRY_SECONDS).toBe(604800);
    expect(Number(process.env.OIDC_AUTH_EXPIRES)).toBe(604800);
  });

  it("includes Max-Age on oidc-auth session cookie when refreshed/set on /api/*", async () => {
    const testApp = new Hono();
    setupAuthHandlers(testApp);
    testApp.use("/api/*", async (c, next) => {
      // Simulate refreshed session token set by OIDC handler
      c.set("oidcAuthJwt" as any, "refreshed-session-jwt");
      await next();
    });
    testApp.get("/api/test-session-cookie", (c) => c.json({ ok: true }));

    const res = await testApp.request("/api/test-session-cookie");
    expect(res.status).toBe(200);
    const setCookieHeader = res.headers.get("set-cookie");
    expect(setCookieHeader).toContain("oidc-auth=refreshed-session-jwt");
    expect(setCookieHeader).toContain("Max-Age=604800");
  });

  it("appendMaxAgeToCookie appends Max-Age only when needed", () => {
    const original = "oidc-auth=jwt-token; Path=/; HttpOnly; Secure";
    const updated = appendMaxAgeToCookie(original, "oidc-auth", 604800);
    expect(updated).toBe("oidc-auth=jwt-token; Path=/; HttpOnly; Secure; Max-Age=604800");

    // Does not re-append if already present
    const withMaxAge = "oidc-auth=jwt-token; Path=/; Max-Age=3600";
    expect(appendMaxAgeToCookie(withMaxAge, "oidc-auth", 604800)).toBe(withMaxAge);

    // Does not modify different cookies
    const otherCookie = "other=value; Path=/";
    expect(appendMaxAgeToCookie(otherCookie, "oidc-auth", 604800)).toBe(otherCookie);
  });
});
