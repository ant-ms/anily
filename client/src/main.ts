import { mount } from 'svelte';
import './app.scss';
import App from './App.svelte';

const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    const nextInit: RequestInit = init ? { ...init } : {};
    const headers = new Headers(nextInit.headers || {});
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    nextInit.headers = headers;
    return originalFetch(input, nextInit);
  }
  return originalFetch(input, init);
};

const app = mount(App, {
	target: document.getElementById('app')!
});

export default app;
