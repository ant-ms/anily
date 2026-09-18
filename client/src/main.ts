import { mount } from 'svelte';
import './app.scss';
import App from './App.svelte';
import { clearAuthSession } from './lib/auth';
import { STORAGE_KEYS } from './lib/storageKeys';

const getUrlString = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') return input;
  if (input instanceof Request) return input.url;
  if (input instanceof URL) return input.toString();
  return '';
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
  } catch (err) {
    const urlStr = getUrlString(input);
    const isApi = urlStr.includes('/api/') && !urlStr.includes('/api/login') && !urlStr.includes('/info');
    const hasAuthData = !!localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) || !!localStorage.getItem(STORAGE_KEYS.PROFILE_DATA);
    if (isApi && hasAuthData && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const infoUrl = new URL('/info', urlStr).toString();
        const check = await originalFetch(infoUrl);
        if (check.ok) {
          clearAuthSession();
        }
      } catch {}
    }
    throw err;
  }

  const urlStr = getUrlString(input);
  const isApi = urlStr.includes('/api/') && !urlStr.includes('/api/login') && !urlStr.includes('/info');
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

