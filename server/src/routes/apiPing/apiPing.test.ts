import { describe, it, expect, vi } from "vitest";
import { app } from "$src/app";
import "./index";

describe("apiPing route", () => {
  it("responds to /api/ping request", async () => {
    const res = await app.request("/api/ping");
    expect([200, 401]).toContain(res.status);
    const data = await res.json();
    if (res.status === 200) {
      expect(data.status).toBe("ok");
      expect(data).toHaveProperty("serverTime");
    } else {
      expect(data.error).toBe("Unauthorized");
    }
  });

  it("returns 401 Unauthorized when OIDC is configured and unauthenticated", async () => {
    process.env.OIDC_ISSUER = "https://example.com";
    process.env.OIDC_CLIENT_ID = "test-client";
    try {
      const res = await app.request("/api/ping");
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("Unauthorized");
    } finally {
      delete process.env.OIDC_ISSUER;
      delete process.env.OIDC_CLIENT_ID;
    }
  });
});
