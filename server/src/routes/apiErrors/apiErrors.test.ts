import { describe, it, expect, beforeEach } from "vitest";
import { app } from "$src/app";
import { errorTracker } from "$src/errorTracker";
import "./index";

describe("apiErrors routes & errorTracker", () => {
  beforeEach(() => {
    errorTracker.clear();
  });

  it("starts a trace and records execution steps up to failure", () => {
    const trace = errorTracker.startTrace("DOWNLOAD", "Download Test Episode 1", {
      episodeId: 101,
      animeTitle: "Frieren",
      token: "secret123",
    });

    trace.step("Searching providers for episode");
    trace.warn("Provider A timed out, trying Provider B");
    const entry = trace.fail(new Error("FFmpeg muxing failed with code 1"), {
      statusCode: 502,
      endpoint: "/api/stream/download/101",
      method: "GET",
    });

    expect(entry).toBeDefined();
    expect(entry.id).toMatch(/^err_/);
    expect(entry.category).toBe("DOWNLOAD");
    expect(entry.action).toBe("Download Test Episode 1");
    expect(entry.message).toContain("FFmpeg muxing failed");
    expect(entry.statusCode).toBe(502);
    expect(entry.endpoint).toBe("/api/stream/download/101");
    expect(entry.trace.length).toBe(4); // Started, Step, Warn, Fail
    expect(entry.trace[0].message).toContain("Trace started");
    expect(entry.trace[1].message).toBe("Searching providers for episode");
    expect(entry.trace[2].level).toBe("warn");
    expect(entry.trace[3].level).toBe("error");

    // Check token was sanitized
    expect(entry.params?.token).toBe("[REDACTED]");
    expect(entry.params?.animeTitle).toBe("Frieren");
  });

  it("GET /api/errors returns empty list when no errors", async () => {
    const res = await app.request("/api/errors");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.errors).toEqual([]);
    expect(data.total).toBe(0);
    expect(data.countsByCategory.ALL).toBe(0);
  });

  it("GET /api/errors returns recorded errors with category filtering and search", async () => {
    errorTracker.recordError({
      category: "DOWNLOAD",
      action: "Download Frieren Ep 1",
      message: "Candidate stream unreachable",
      statusCode: 502,
    });

    errorTracker.recordError({
      category: "STREAM",
      action: "Proxy Stream Segment",
      message: "HLS upstream 504 Gateway Timeout",
      statusCode: 504,
    });

    // All errors
    const allRes = await app.request("/api/errors");
    expect(allRes.status).toBe(200);
    const allData = await allRes.json();
    expect(allData.total).toBe(2);
    expect(allData.countsByCategory.DOWNLOAD).toBe(1);
    expect(allData.countsByCategory.STREAM).toBe(1);

    // Filter by category
    const dlRes = await app.request("/api/errors?category=DOWNLOAD");
    const dlData = await dlRes.json();
    expect(dlData.total).toBe(1);
    expect(dlData.errors[0].category).toBe("DOWNLOAD");

    // Search query
    const searchRes = await app.request("/api/errors?query=Frieren");
    const searchData = await searchRes.json();
    expect(searchData.total).toBe(1);
    expect(searchData.errors[0].action).toContain("Frieren");
  });

  it("GET /api/errors/:id returns full trace details", async () => {
    const trace = errorTracker.startTrace("SYNC", "Metadata Sync");
    trace.step("Connecting to TheTVDB");
    const entry = trace.fail(new Error("API rate limit exceeded"), {
      statusCode: 429,
    });

    const res = await app.request(`/api/errors/${entry.id}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(entry.id);
    expect(data.message).toContain("API rate limit exceeded");
    expect(data.trace.length).toBeGreaterThanOrEqual(2);
  });

  it("POST /api/errors/clear clears error history", async () => {
    errorTracker.recordError({
      category: "SYSTEM",
      action: "Test error",
      message: "Something broke",
    });

    const clearRes = await app.request("/api/errors/clear", { method: "POST" });
    expect(clearRes.status).toBe(200);

    const getRes = await app.request("/api/errors");
    const getData = await getRes.json();
    expect(getData.total).toBe(0);
  });

  it("POST /api/errors/report allows reporting client-side download failure", async () => {
    const reportPayload = {
      category: "DOWNLOAD",
      action: "Android Download Failed: Ep 2",
      message: "Received 0 bytes",
      statusCode: 500,
      params: {
        episodeId: 456,
        animeTitle: "Delicious in Dungeon",
      },
    };

    const res = await app.request("/api/errors/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reportPayload),
    });

    expect(res.status).toBe(200);
    const resData = await res.json();
    expect(resData.status).toBe("recorded");
    expect(resData.id).toBeDefined();

    const fetchRes = await app.request(`/api/errors/${resData.id}`);
    expect(fetchRes.status).toBe(200);
    const detail = await fetchRes.json();
    expect(detail.action).toBe("Android Download Failed: Ep 2");
    expect(detail.message).toBe("Received 0 bytes");
    expect(detail.params.animeTitle).toBe("Delicious in Dungeon");
  });
});
