import type { Context } from "hono";

export function getPublicOrigin(c: Context): string {
  const forwardedProto = c.req.header("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = (c.req.header("x-forwarded-host") || c.req.header("host"))
    ?.split(",")[0]
    ?.trim();

  if (forwardedHost) {
    const proto = forwardedProto || "http";
    return `${proto}://${forwardedHost}`;
  }

  return new URL(c.req.url).origin;
}
