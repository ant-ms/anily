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

    // Verify GET /api/details reflects unbookmarked groupingId (null)
    const getRes = await app.request(`/api/details/${FRIEREN_ID}`);
    expect(getRes.status).toBe(200);
    const details = await getRes.json();
    expect(details.groupingId).toBeNull();
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

  describe("grouping deduplication and concurrency", () => {
    const BLEACH_ID = 269;

    const cleanupBleach = async () => {
      const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
      if (user) {
        await prisma.userBookmark.deleteMany({
          where: { userId: user.id, anilistId: BLEACH_ID },
        });
      }
      await prisma.animeGrouping.deleteMany({
        where: {
          OR: [
            { displayAnimeId: BLEACH_ID },
            { items: { some: { anilistId: BLEACH_ID } } },
          ],
        },
      });
    };

    beforeEach(async () => {
      await cleanupBleach();
    });

    afterAll(async () => {
      await cleanupBleach();
    });

    it("concurrent bookmark requests do not create duplicate AnimeGrouping rows", async () => {
      // Send multiple concurrent requests to bookmark the same anime
      const requests = [
        app.request(`/api/details/${BLEACH_ID}/grouping`, { method: "POST" }),
        app.request(`/api/details/${BLEACH_ID}/grouping`, { method: "POST" }),
        app.request(`/api/details/${BLEACH_ID}/grouping`, { method: "POST" }),
      ];

      const responses = await Promise.all(requests);
      for (const res of responses) {
        expect(res.status).toBe(204);
      }

      // Check DB: exactly one AnimeGrouping should exist for BLEACH_ID
      const groupings = await prisma.animeGrouping.findMany({
        where: {
          OR: [
            { displayAnimeId: BLEACH_ID },
            { items: { some: { anilistId: BLEACH_ID } } },
          ],
        },
      });
      expect(groupings.length).toBe(1);
      expect(groupings[0].displayAnimeId).toBe(BLEACH_ID);
    });

    it("duplicate sequential bookmark requests do not create duplicate AnimeGrouping rows", async () => {
      const res1 = await app.request(`/api/details/${BLEACH_ID}/grouping`, {
        method: "POST",
      });
      expect(res1.status).toBe(204);

      const res2 = await app.request(`/api/details/${BLEACH_ID}/grouping`, {
        method: "POST",
      });
      expect(res2.status).toBe(204);

      const groupings = await prisma.animeGrouping.findMany({
        where: {
          OR: [
            { displayAnimeId: BLEACH_ID },
            { items: { some: { anilistId: BLEACH_ID } } },
          ],
        },
      });
      expect(groupings.length).toBe(1);
    });

    it("consolidates pre-existing duplicate AnimeGroupings when bookmarking", async () => {
      // Manually create two duplicate groupings in DB
      const g1 = await prisma.animeGrouping.create({
        data: {
          displayAnimeId: BLEACH_ID,
          items: { connect: [{ anilistId: BLEACH_ID }] },
        },
      });
      const g2 = await prisma.animeGrouping.create({
        data: {
          displayAnimeId: BLEACH_ID,
          items: { connect: [{ anilistId: BLEACH_ID }] },
        },
      });

      const beforeGroupings = await prisma.animeGrouping.findMany({
        where: { displayAnimeId: BLEACH_ID },
      });
      expect(beforeGroupings.length).toBe(2);

      // Bookmark request should consolidate them into one
      const res = await app.request(`/api/details/${BLEACH_ID}/grouping`, {
        method: "POST",
      });
      expect(res.status).toBe(204);

      const afterGroupings = await prisma.animeGrouping.findMany({
        where: { displayAnimeId: BLEACH_ID },
      });
      expect(afterGroupings.length).toBe(1);
      expect(afterGroupings[0].id).toBe(g1.id);
    });
  });
});
