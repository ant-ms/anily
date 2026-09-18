import { mount } from 'svelte';
import './app.scss';
import App from './App.svelte';
import { clearAuthSession } from './lib/auth';

const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  const token = localStorage.getItem('authToken');
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
    const urlStr = typeof input === 'string'
      ? input
      : input instanceof Request
      ? input.url
      : input instanceof URL
      ? input.toString()
      : '';
    const isApi = urlStr.includes('/api/') && !urlStr.includes('/api/login') && !urlStr.includes('/info');
    const hasAuthData = !!localStorage.getItem('authToken') || !!localStorage.getItem('anily:profile_data');
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

  const urlStr = typeof input === 'string'
    ? input
    : input instanceof Request
    ? input.url
    : input instanceof URL
    ? input.toString()
    : '';

  const isApi = urlStr.includes('/api/') && !urlStr.includes('/api/login') && !urlStr.includes('/info');
  const hasAuthData = !!localStorage.getItem('authToken') || !!localStorage.getItem('anily:profile_data');

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
