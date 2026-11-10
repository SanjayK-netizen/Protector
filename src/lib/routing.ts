export type AppRoute =
  | { page: 'dashboard' }
  | { page: 'inspect' }
  | { page: 'history' }
  | { page: 'limitations' };

const VALID_PAGES = new Set(['dashboard', 'inspect', 'history', 'limitations']);

export function parseHash(hash: string): AppRoute {
  const normalized = hash.startsWith('#') ? hash.slice(1) : hash;
  const [path = '/dashboard'] = normalized.split('?');
  const page = path.replace(/^\/+/, '') || 'dashboard';
  if (!VALID_PAGES.has(page)) return { page: 'dashboard' };
  return { page } as AppRoute;
}

export function formatHash(route: AppRoute): string {
  return `#/${route.page}`;
}

export function getHashSnapshot(): string {
  return typeof window === 'undefined' ? '#/dashboard' : window.location.hash || '#/dashboard';
}

export const getServerHashSnapshot = (): string => '#/dashboard';

export function subscribeToHash(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}
