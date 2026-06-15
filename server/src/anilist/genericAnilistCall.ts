import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { print } from "graphql";

// AniList is currently degraded to 30 req/min; use that as the safe baseline.
const MAX_REQUESTS_PER_MINUTE = 30;
const MIN_INTERVAL_MS = (60 * 1000) / MAX_REQUESTS_PER_MINUTE; // 2 000 ms

let rateLimitQueue = Promise.resolve();
let lastRequestTime = 0;
// Unix-ms timestamp after which we are allowed to send requests again (set on 429).
let blockedUntilMs = 0;

function updateRateLimitState(headers: Headers): void {
  const remaining = headers.get("X-RateLimit-Remaining");
  const reset = headers.get("X-RateLimit-Reset");

  // If the server says we have no budget left, block until the reset timestamp.
  if (remaining !== null && parseInt(remaining) === 0 && reset !== null) {
    blockedUntilMs = parseInt(reset) * 1000;
  }
}

function throttle(): Promise<void> {
  rateLimitQueue = rateLimitQueue.then(() => {
    const now = Date.now();

    // Honor any server-indicated cooldown (set after a 429 or a drained budget).
    const blockedWait = Math.max(0, blockedUntilMs - now);

    // Also enforce the minimum inter-request interval.
    const intervalWait = Math.max(0, lastRequestTime + MIN_INTERVAL_MS - now);

    const wait = Math.max(blockedWait, intervalWait);

    return new Promise<void>((resolve) =>
      setTimeout(() => {
        lastRequestTime = Date.now();
        resolve();
      }, wait),
    );
  });
  return rateLimitQueue;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; status?: number }>;
}

export async function fetchGraphQL<TResult, TVariables>(
  document: TypedDocumentNode<TResult, TVariables>,
  ...[variables]: TVariables extends Record<string, never> ? [] : [TVariables]
): Promise<TResult> {
  const query = document.loc?.source.body ?? print(document);

  await throttle();

  const response = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  // Always sync our local state with whatever the server reports.
  updateRateLimitState(response.headers);

  if (response.status === 429) {
    const retryAfter = response.headers.get("Retry-After");
    const resetHeader = response.headers.get("X-RateLimit-Reset");

    let waitMs: number;
    if (retryAfter !== null) {
      waitMs = parseInt(retryAfter) * 1000;
    } else if (resetHeader !== null) {
      waitMs = Math.max(0, parseInt(resetHeader) * 1000 - Date.now());
    } else {
      waitMs = 60_000; // safe fallback: wait a full minute
    }

    blockedUntilMs = Date.now() + waitMs;

    // Retry once after the cooldown.
    return fetchGraphQL(
      document,
      ...(variables === undefined ? ([] as any) : [variables]),
    );
  }

  if (!response.ok) {
    throw new Error(
      `API error: ${response.statusText}\n\t${JSON.stringify(await response.json(), null, 2)}`,
    );
  }

  const result = (await response.json()) as GraphQLResponse<TResult>;

  if (result.errors) {
    throw new Error(`GraphQL Errors: ${JSON.stringify(result.errors)}`);
  }

  if (!result.data) {
    throw new Error("GraphQL Error: No data returned.");
  }

  return result.data;
}
