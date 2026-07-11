import "dotenv/config";

const BASE_URL = "https://api4.thetvdb.com/v4";

export type TvdbLinks = {
  prev: string | null;
  self: string | null;
  next: string | null;
  total_items: number;
  page_size: number;
};

export type TvdbResponse<T> = {
  status: string;
  data: T;
  links?: TvdbLinks;
};

let tokenRequest: Promise<string> | null = null;

const login = async (): Promise<string> => {
  const apikey = process.env.THETVDB_API_KEY;
  if (!apikey) {
    throw new Error("THETVDB_API_KEY is not set");
  }

  const pin = process.env.THETVDB_PIN;

  const response = await fetch(`${BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pin ? { apikey, pin } : { apikey }),
  });

  if (!response.ok) {
    throw new Error(
      `TheTVDB login failed: ${response.status} ${response.statusText}`,
    );
  }

  const body = (await response.json()) as TvdbResponse<{ token: string }>;
  return body.data.token;
};

const getToken = () => (tokenRequest ??= login());

export const tvdbRequest = async <T>(
  path: string,
  query?: Record<string, string | number>,
): Promise<TvdbResponse<T>> => {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.set(key, String(value));
  }

  const send = async () => {
    const token = await getToken();
    return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  };

  let response = await send();

  if (response.status === 401) {
    tokenRequest = null;
    response = await send();
  }

  if (!response.ok) {
    throw new Error(
      `TheTVDB request failed: ${response.status} ${response.statusText} (${path})`,
    );
  }

  return (await response.json()) as TvdbResponse<T>;
};
