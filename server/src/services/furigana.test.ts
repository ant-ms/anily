import { describe, it, expect } from "vitest";
import {
  assTimeToVtt,
  convertAssToVtt,
  convertSrtToVtt,
  addFuriganaToVtt,
  getCachedSubtitle,
  setCachedSubtitle,
} from "./furigana";

describe("Furigana Service", () => {
  it("converts ASS timestamp to WebVTT timestamp", () => {
    expect(assTimeToVtt("0:01:23.45")).toBe("00:01:23.450");
    expect(assTimeToVtt("1:20:05.12")).toBe("01:20:05.120");
    expect(assTimeToVtt("00:00:01.00")).toBe("00:00:01.000");
  });

  it("converts ASS subtitles to WebVTT format and strips ASS tags", () => {
    const assContent = `
[Script Info]
Title: Test ASS
ScriptType: v4.00+

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:01:23.45,0:01:26.89,Default,,0,0,0,,{\\pos(192,200)}こんにちは、\\N世界！
Dialogue: 0,0:01:28.00,0:01:30.50,Default,,0,0,0,,{\\fad(200,200)}さようなら。
`;

    const vtt = convertAssToVtt(assContent);
    expect(vtt).toContain("WEBVTT");
    expect(vtt).toContain("00:01:23.450 --> 00:01:26.890");
    expect(vtt).toContain("こんにちは、\n世界！");
    expect(vtt).toContain("00:01:28.000 --> 00:01:30.500");
    expect(vtt).toContain("さようなら。");
    expect(vtt).not.toContain("{\\pos");
    expect(vtt).not.toContain("{\\fad");
  });

  it("converts SRT subtitles to WebVTT format", () => {
    const srt = `1
00:01:20,000 --> 00:01:23,000
テスト字幕です。

2
00:01:25,500 --> 00:01:28,500
第二のセリフです。
`;

    const vtt = convertSrtToVtt(srt);
    expect(vtt).toContain("WEBVTT");
    expect(vtt).toContain("00:01:20.000 --> 00:01:23.000");
    expect(vtt).toContain("00:01:25.500 --> 00:01:28.500");
    expect(vtt).toContain("テスト字幕です。");
  });

  it("generates HTML <ruby> furigana for Japanese Kanji", async () => {
    const inputVtt = `WEBVTT

00:01:20.500 --> 00:01:23.750
こんにちは、世界！

00:01:24.000 --> 00:01:27.000
葬送のフリーレン
`;

    const result = await addFuriganaToVtt(inputVtt);
    expect(result).toContain("WEBVTT");
    expect(result).toContain("00:01:20.500 --> 00:01:23.750");
    // "世界" should be annotated with <ruby>世界<rt>せかい</rt></ruby>
    expect(result).toMatch(/<ruby>世界<rt>せかい<\/rt><\/ruby>/);
    // "葬送" should be annotated with <ruby>葬送<rt>そうそう</rt></ruby>
    expect(result).toMatch(/<ruby>葬送<rt>そうそう<\/rt><\/ruby>/);
    // Timing headers should be unchanged
    expect(result).toContain("00:01:24.000 --> 00:01:27.000");
    // No <rp> tags should remain
    expect(result).not.toContain("<rp>");
  });

  it("caches and retrieves subtitles from in-memory cache", () => {
    setCachedSubtitle("test-key", "WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nCached!");
    const retrieved = getCachedSubtitle("test-key");
    expect(retrieved).toBe("WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nCached!");
  });
});
