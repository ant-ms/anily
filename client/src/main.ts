import { mount } from 'svelte';
import './app.scss';
import App from './App.svelte';
import { clearAuthSession } from './lib/auth';

const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  const token = localStorage.getItem('authToken');
  let res: Response;
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

  if (res.status === 401) {
    const urlStr = typeof input === 'string'
      ? input
      : input instanceof Request
      ? input.url
      : input instanceof URL
      ? input.toString()
      : '';

    const isInfo = urlStr.includes('/info');
    const hasAuthData = !!localStorage.getItem('authToken') || !!localStorage.getItem('anily:profile_data');
    if (!isInfo && hasAuthData) {
      clearAuthSession();
    }
  }

  return res;
};

const app = mount(App, {
	target: document.getElementById('app')!
});

export default app;
