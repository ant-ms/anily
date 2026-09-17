import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { isAllowedOrigin, setupAuthHandlers } from "./auth";

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
});
