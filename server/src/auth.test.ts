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
});
