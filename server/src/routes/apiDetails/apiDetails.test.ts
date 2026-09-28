import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { app } from "$src/app";
import { prisma } from "$src/prisma";
import "./index";

const FRIEREN_ID = 154587;

describe("apiDetails bookmark and grouping endpoints", () => {
  beforeEach(async () => {
    // Ensure clean state before each test
    const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
    if (user) {
      await prisma.userBookmark.deleteMany({
        where: {
          userId: user.id,
          anilistId: FRIEREN_ID,
        },
      });
    }
  });

  afterAll(async () => {
    // Restore bookmark for Frieren if needed for other tests
    const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
    if (user) {
      await prisma.userBookmark.upsert({
        where: {
          userId_anilistId: {
            userId: user.id,
            anilistId: FRIEREN_ID,
          },
        },
        create: {
          userId: user.id,
          anilistId: FRIEREN_ID,
        },
        update: {},
      });
    }
  });

  it("POST /api/details/:anilistId/grouping returns 204 No Content with empty body and persists bookmark", async () => {
    const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
    expect(user).toBeDefined();

    const postRes = await app.request(`/api/details/${FRIEREN_ID}/grouping`, {
      method: "POST",
    });

    expect(postRes.status).toBe(204);
    const bodyText = await postRes.text();
    expect(bodyText).toBe("");

    // Verify bookmark is created in DB
    const bookmark = await prisma.userBookmark.findUnique({
      where: {
        userId_anilistId: {
          userId: user!.id,
          anilistId: FRIEREN_ID,
        },
      },
    });
    expect(bookmark).not.toBeNull();
    expect(bookmark?.anilistId).toBe(FRIEREN_ID);

    // Verify GET /api/details reflects bookmarked groupingId
    const getRes = await app.request(`/api/details/${FRIEREN_ID}`);
    expect(getRes.status).toBe(200);
    const details = await getRes.json();
    expect(details.groupingId).not.toBeNull();
  });

  it("DELETE /api/details/:anilistId/grouping returns 204 No Content with empty body and removes bookmark", async () => {
    const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
    expect(user).toBeDefined();

    // First ensure bookmarked
    await prisma.userBookmark.upsert({
      where: {
        userId_anilistId: {
          userId: user!.id,
          anilistId: FRIEREN_ID,
        },
      },
      create: {
        userId: user!.id,
        anilistId: FRIEREN_ID,
      },
      update: {},
    });

    const delRes = await app.request(`/api/details/${FRIEREN_ID}/grouping`, {
      method: "DELETE",
    });

    expect(delRes.status).toBe(204);
    const bodyText = await delRes.text();
    expect(bodyText).toBe("");

    // Verify bookmark was removed
    const bookmark = await prisma.userBookmark.findUnique({
      where: {
        userId_anilistId: {
          userId: user!.id,
          anilistId: FRIEREN_ID,
        },
      },
    });
    expect(bookmark).toBeNull();
  });

  it("rejects invalid anilistId param with 400", async () => {
    const res = await app.request("/api/details/not-a-number/grouping", {
      method: "POST",
    });
    expect(res.status).toBe(400);
  });

  describe("empty response body handling", () => {
    // Helper that replicates the robust response parser implemented in client/src/lib/api.ts
    const parseApiResponse = async <T>(res: Response): Promise<T> => {
      if (res.status === 204 || res.headers.get("content-length") === "0") {
        return null as T;
      }
      const text = await res.text();
      if (!text || text.trim() === "") {
        return null as T;
      }
      return JSON.parse(text) as T;
    };

    it("parses 204 response as null without throwing SyntaxError", async () => {
      const res = new Response(null, { status: 204 });
      const result = await parseApiResponse(res);
      expect(result).toBeNull();
    });

    it("parses 200 response with empty body as null without throwing SyntaxError", async () => {
      const res = new Response("", { status: 200 });
      const result = await parseApiResponse(res);
      expect(result).toBeNull();
    });

    it("parses 200 response with JSON correctly", async () => {
      const res = new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
      const result = await parseApiResponse<{ success: boolean }>(res);
      expect(result).toEqual({ success: true });
    });
  });
});
