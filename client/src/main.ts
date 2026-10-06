import { mount } from 'svelte';
import './app.scss';
import App from './App.svelte';
import { Capacitor, CapacitorCookies } from '@capacitor/core';
import { clearAuthSession } from './lib/auth';
import { STORAGE_KEYS } from './lib/storageKeys';

const getUrlString = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') return input;
  if (input instanceof Request) return input.url;
  if (input instanceof URL) return input.toString();
  return '';
};

const isCoreApiRequest = (urlStr: string): boolean => {
  if (
    !urlStr ||
    urlStr.includes('/api/stream/proxy') ||
    urlStr.includes('/api/login') ||
    urlStr.includes('/info')
  ) {
    return false;
  }
  return urlStr.includes('/api/');
};

const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  let res: Response;
  try {
    if (token) {
      const nextInit: RequestInit = init ? { ...init } : {};
      const headers = new Headers(nextInit.headers || {});
      if (!headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      nextInit.headers = headers;
      res = await originalFetch(input, nextInit);
    } else {
      res = await originalFetch(input, init);
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw err;
    }
    throw err;
  }

  const refreshedToken = res.headers?.get('x-session-token');
  if (refreshedToken) {
    localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, refreshedToken);
    if (Capacitor.isNativePlatform()) {
      try {
        const savedBackend = localStorage.getItem(STORAGE_KEYS.BACKEND_URL);
        if (savedBackend) {
          const cleaned = JSON.parse(savedBackend).trim().replace(/\/+$/, "");
          CapacitorCookies.setCookie({
            url: cleaned,
            key: "oidc-auth",
            value: refreshedToken,
          }).catch(() => {});
        }
      } catch {}
    }
  }

  const urlStr = getUrlString(input);
  const isApi = isCoreApiRequest(urlStr);
  const hasAuthData = !!localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) || !!localStorage.getItem(STORAGE_KEYS.PROFILE_DATA);

  if (hasAuthData && isApi) {
    if (
      res.status === 401 ||
      res.type === 'opaqueredirect' ||
      (res.redirected && !res.url.includes('/api/'))
    ) {
      clearAuthSession();
    }
  }

  return res;
};

const app = mount(App, {
	target: document.getElementById('app')!
});

export default app;

