import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseVttTimestampToSeconds,
  formatVttTimestamp,
  parseVttCueTimings,
  calculateSubtitleOffset,
  shiftVttTimestamps,
  fetchReferenceSubtitleText,
  normalizeRefSubForCache,
  convertToVtt,
  clearRefTextCache,
} from "./subtitleSync";
import { generateStreamSignature } from "@medialy/stream-core";

describe("SubtitleSync Service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearRefTextCache();
  });

  it("parses and formats VTT timestamps correctly", () => {
    expect(parseVttTimestampToSeconds("00:01:23.456")).toBeCloseTo(83.456, 3);
    expect(parseVttTimestampToSeconds("01:23.456")).toBeCloseTo(83.456, 3);
    expect(parseVttTimestampToSeconds("01:02:03.004")).toBeCloseTo(3723.004, 3);
    expect(parseVttTimestampToSeconds("invalid")).toBeNull();

    expect(formatVttTimestamp(83.456)).toBe("00:01:23.456");
    expect(formatVttTimestamp(3723.004)).toBe("01:02:03.004");
    expect(formatVttTimestamp(0)).toBe("00:00:00.000");
  });

  it("extracts cue timings from WebVTT content", () => {
    const vtt = `WEBVTT

00:00:02.000 --> 00:00:05.500
First line of dialogue

00:00:06.100 --> 00:00:09.200 line:90%
Second line
`;
    const cues = parseVttCueTimings(vtt);
    expect(cues.length).toBe(2);
    expect(cues[0].start).toBeCloseTo(2.0, 1);
    expect(cues[0].end).toBeCloseTo(5.5, 1);
    expect(cues[1].start).toBeCloseTo(6.1, 1);
    expect(cues[1].end).toBeCloseTo(9.2, 1);
  });

  it("detects zero offset when subtitles are already aligned", () => {
    const cues = [
      { start: 10.0, end: 13.0 },
      { start: 15.0, end: 18.0 },
      { start: 25.0, end: 30.0 },
      { start: 40.0, end: 45.0 },
    ];

    const result = calculateSubtitleOffset(cues, cues);
    expect(result.offset).toBe(0);
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it("detects positive offset when target subtitle is earlier/needs positive shift to match ref", () => {
    // Ref is at 12.5s, target was cut earlier at 10.0s (e.g. video has a 2.5s intro bumper)
    const shift = 2.5;
    const targetCues = [
      { start: 10.0, end: 13.0 },
      { start: 15.0, end: 18.0 },
      { start: 25.0, end: 30.0 },
      { start: 40.0, end: 45.0 },
    ];
    const refCues = targetCues.map((c) => ({
      start: +(c.start + shift).toFixed(1),
      end: +(c.end + shift).toFixed(1),
    }));

    const result = calculateSubtitleOffset(refCues, targetCues);
    expect(result.offset).toBeCloseTo(2.5, 1);
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it("detects negative offset when target subtitle is delayed/needs negative shift to match ref", () => {
    // Target is at 13.0s, ref is at 10.0s (target had 3s extra intro, needs -3.0s shift)
    const shift = -3.0;
    const refCues = [
      { start: 10.0, end: 13.0 },
      { start: 15.0, end: 18.0 },
      { start: 25.0, end: 30.0 },
      { start: 40.0, end: 45.0 },
    ];
    const targetCues = refCues.map((c) => ({
      start: +(c.start - shift).toFixed(1),
      end: +(c.end - shift).toFixed(1),
    }));

    const result = calculateSubtitleOffset(refCues, targetCues);
    expect(result.offset).toBeCloseTo(-3.0, 1);
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it("returns zero offset if confidence is below threshold for unrelated subtitles", () => {
    const refCues = [{ start: 50.0, end: 52.0 }];
    const targetCues = [{ start: 500.0, end: 502.0 }];

    const result = calculateSubtitleOffset(refCues, targetCues);
    expect(result.offset).toBe(0);
  });

  it("shifts VTT timestamps accurately", () => {
    const vtt = `WEBVTT

00:00:10.000 --> 00:00:12.500
Line 1

00:00:20.000 --> 00:00:25.000
Line 2
`;
    const shifted = shiftVttTimestamps(vtt, 2.5);
    expect(shifted).toContain("00:00:12.500 --> 00:00:15.000");
    expect(shifted).toContain("00:00:22.500 --> 00:00:27.500");
    expect(shifted).toContain("Line 1");
    expect(shifted).toContain("Line 2");
  });

  it("drops cues that shift before 0:00", () => {
    const vtt = `WEBVTT

00:00:01.000 --> 00:00:02.000
Intro cue dropped

00:00:10.000 --> 00:00:12.000
Surviving cue
`;
    const shifted = shiftVttTimestamps(vtt, -5.0);
    expect(shifted).not.toContain("Intro cue dropped");
    expect(shifted).toContain("00:00:05.000 --> 00:00:07.000");
    expect(shifted).toContain("Surviving cue");
  });

  it("safely fetches reference subtitle text and validates signature", async () => {
    const expires = Math.floor(Date.now() / 1000) + 3600;
    const upstreamUrl = "https://example.com/subs/en.vtt";
    const sig = generateStreamSignature(upstreamUrl, expires);
    const refSubUrl = `http://localhost:3000/api/stream/proxy/sub_en.vtt?url=${encodeURIComponent(
      upstreamUrl,
    )}&expires=${expires}&sig=${sig}`;

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello", { status: 200 }),
    );

    const text = await fetchReferenceSubtitleText(refSubUrl);
    expect(text).toContain("WEBVTT");
    expect(text).toContain("Hello");
  });

  it("rejects unsigned refSub URLs to protect against arbitrary SSRF", async () => {
    const unsignedRefSub = "http://localhost:3000/api/stream/proxy/sub_en.vtt?url=https%3A%2F%2Fattacker.com%2Fevil.vtt";
    const result = await fetchReferenceSubtitleText(unsignedRefSub);
    expect(result).toBeNull();
  });

  it("buffers cue identifiers and drops orphaned IDs when cues shift before 0:00", () => {
    const vtt = `WEBVTT

cue-1
00:00:01.000 --> 00:00:02.000
First dropped cue

cue-2
00:00:10.000 --> 00:00:12.000
Second surviving cue
`;
    const shifted = shiftVttTimestamps(vtt, -5.0);
    expect(shifted).not.toContain("cue-1");
    expect(shifted).not.toContain("First dropped cue");
    expect(shifted).toContain("cue-2\n00:00:05.000 --> 00:00:07.000\nSecond surviving cue");
  });

  it("does not corrupt dialogue lines containing arrow symbols", () => {
    const vtt = `WEBVTT

00:00:10.000 --> 00:00:12.000
Follow step A --> step B
`;
    const shifted = shiftVttTimestamps(vtt, 2.0);
    expect(shifted).toContain("00:00:12.000 --> 00:00:14.000");
    expect(shifted).toContain("Follow step A --> step B");
  });

  it("handles UTF-8 BOM in convertToVtt and normalizes cache keys", () => {
    const bomVtt = "\uFEFFWEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHi";
    expect(convertToVtt(bomVtt)).toMatch(/^WEBVTT/);

    const fullUrl = "https://example.com/api/proxy?url=https%3A%2F%2Fcdn.com%2Fsub.vtt&sig=123&expires=999";
    expect(normalizeRefSubForCache(fullUrl)).toBe("https://cdn.com/sub.vtt");
  });
});
