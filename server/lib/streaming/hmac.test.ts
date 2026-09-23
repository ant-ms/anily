import { describe, it, expect } from "vitest";
import {
  generateStreamSignature,
  verifyStreamSignature,
  isSafeStreamUrl,
  DEFAULT_STREAM_EXPIRY_SECONDS,
} from "./hmac";

describe("Streaming HMAC & Security", () => {
  const secret = "test-secret-12345";
  const targetUrl = "https://cdn.example.com/video/ep1.m3u8";

  it("successfully signs and verifies with 48h expiration", () => {
    expect(DEFAULT_STREAM_EXPIRY_SECONDS).toBe(48 * 60 * 60);

    const now = Math.floor(Date.now() / 1000);
    const expires = now + DEFAULT_STREAM_EXPIRY_SECONDS;
    const sig = generateStreamSignature(targetUrl, expires, secret);

    expect(verifyStreamSignature(targetUrl, expires, sig, secret)).toBe(true);
  });

  it("rejects expired signatures", () => {
    const pastExpires = Math.floor(Date.now() / 1000) - 400; // 400s in the past (> 300s grace)
    const sig = generateStreamSignature(targetUrl, pastExpires, secret);

    expect(verifyStreamSignature(targetUrl, pastExpires, sig, secret)).toBe(false);
  });

  it("rejects tampered URL or expiration", () => {
    const expires = Math.floor(Date.now() / 1000) + 3600;
    const sig = generateStreamSignature(targetUrl, expires, secret);

    // Tamper URL
    const tamperedUrl = "https://evil.com/video/ep1.m3u8";
    expect(verifyStreamSignature(tamperedUrl, expires, sig, secret)).toBe(false);

    // Tamper expires
    expect(verifyStreamSignature(targetUrl, expires + 100, sig, secret)).toBe(false);

    // Tamper signature
    expect(verifyStreamSignature(targetUrl, expires, "invalid-sig", secret)).toBe(false);
  });

  it("blocks SSRF target URLs", () => {
    expect(isSafeStreamUrl("http://localhost/test")).toBe(false);
    expect(isSafeStreamUrl("http://127.0.0.1/admin")).toBe(false);
    expect(isSafeStreamUrl("http://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isSafeStreamUrl("http://10.0.0.1/internal")).toBe(false);
    expect(isSafeStreamUrl("http://192.168.1.100/router")).toBe(false);
    expect(isSafeStreamUrl("http://172.16.5.1/db")).toBe(false);
    expect(isSafeStreamUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeStreamUrl("gopher://127.0.0.1")).toBe(false);
    expect(isSafeStreamUrl("http://[::1]/")).toBe(false);
  });

  it("allows safe public streaming URLs", () => {
    expect(isSafeStreamUrl("https://cdn.myanimecdn.to/hls/stream.m3u8")).toBe(true);
    expect(isSafeStreamUrl("https://storage.googleapis.com/anime/ep1.mp4")).toBe(true);
    expect(isSafeStreamUrl("http://8.8.8.8/public-feed")).toBe(true);
  });
});
