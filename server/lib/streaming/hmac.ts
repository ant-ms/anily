import crypto from "node:crypto";
import { URL } from "node:url";

const DEFAULT_SECRET = "anily-secure-stream-proxy-secret-key";
export const DEFAULT_STREAM_EXPIRY_SECONDS = 48 * 60 * 60; // 48 hours

export function getStreamSecret(): string {
  return process.env.STREAM_HMAC_SECRET || DEFAULT_SECRET;
}

/**
 * Generates an HMAC-SHA256 signature for a target stream URL and expiration timestamp.
 */
export function generateStreamSignature(
  targetUrl: string,
  expiresAtUnixSeconds: number,
  secret: string = getStreamSecret(),
): string {
  const payload = `${targetUrl}:${expiresAtUnixSeconds}`;
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Verifies an HMAC signature and checks that the URL has not expired.
 * Allows a 5-minute clock drift margin.
 */
export function verifyStreamSignature(
  targetUrl: string,
  expiresAtUnixSeconds: number,
  providedSignature: string,
  secret: string = getStreamSecret(),
): boolean {
  if (!targetUrl || !expiresAtUnixSeconds || !providedSignature) {
    return false;
  }

  // Check expiration: current time must be <= expires + 300s clock drift
  const nowUnixSeconds = Math.floor(Date.now() / 1000);
  if (nowUnixSeconds > expiresAtUnixSeconds + 300) {
    return false;
  }

  const expectedSignature = generateStreamSignature(targetUrl, expiresAtUnixSeconds, secret);

  try {
    const expectedBuf = Buffer.from(expectedSignature, "hex");
    const providedBuf = Buffer.from(providedSignature, "hex");
    if (expectedBuf.length !== providedBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuf, providedBuf);
  } catch {
    return false;
  }
}

/**
 * Validates that the target URL is a safe public HTTP(S) address, preventing SSRF attacks.
 * Disallows localhost, private IPv4/IPv6 networks, cloud metadata endpoints, and non-HTTP protocols.
 */
export function isSafeStreamUrl(targetUrl: string): boolean {
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // Block standard local and cloud metadata hostnames
    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname === "metadata.google.internal"
    ) {
      return false;
    }

    // Check IPv4 addresses
    const ipv4Match = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ipv4Match) {
      const [o1, o2, o3, o4] = [
        parseInt(ipv4Match[1], 10),
        parseInt(ipv4Match[2], 10),
        parseInt(ipv4Match[3], 10),
        parseInt(ipv4Match[4], 10),
      ];

      // 0.0.0.0/8 (Broadcast/Current network)
      if (o1 === 0) return false;
      // 127.0.0.0/8 (Loopback)
      if (o1 === 127) return false;
      // 10.0.0.0/8 (Private)
      if (o1 === 10) return false;
      // 172.16.0.0/12 (Private: 172.16.0.0 - 172.31.255.255)
      if (o1 === 172 && o2 >= 16 && o2 <= 31) return false;
      // 192.168.0.0/16 (Private)
      if (o1 === 192 && o2 === 168) return false;
      // 169.254.0.0/16 (Link-local / Cloud metadata AWS/GCP/Azure)
      if (o1 === 169 && o2 === 254) return false;
      // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
      if (o1 >= 224) return false;
    }

    // Check IPv6 addresses (enclosed in brackets or plain)
    const cleanIpv6 = hostname.replace(/^\[|\]$/g, "");
    if (
      cleanIpv6 === "::1" ||
      cleanIpv6 === "::" ||
      cleanIpv6.startsWith("fe80:") || // link-local
      cleanIpv6.startsWith("fc") || // unique local
      cleanIpv6.startsWith("fd") // unique local
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
