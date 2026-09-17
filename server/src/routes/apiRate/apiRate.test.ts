import { describe, it, expect } from "vitest";
import { ratingEnumSchema } from "./index";

describe("apiRate", () => {
  it("validates valid rating values", () => {
    expect(ratingEnumSchema.safeParse("LIKE").success).toBe(true);
    expect(ratingEnumSchema.safeParse("NEUTRAL").success).toBe(true);
    expect(ratingEnumSchema.safeParse("DISLIKE").success).toBe(true);
  });

  it("rejects invalid rating values", () => {
    expect(ratingEnumSchema.safeParse("INVALID").success).toBe(false);
    expect(ratingEnumSchema.safeParse("").success).toBe(false);
    expect(ratingEnumSchema.safeParse(123).success).toBe(false);
  });

  it("PUT /api/rate/:anilistId returns 400 for invalid payload", async () => {
    const { app } = await import("$src/app");
    const res = await app.request("/api/rate/154587", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: "SUPER_LIKE" }),
    });
    expect(res.status).toBe(400);
  });
});
