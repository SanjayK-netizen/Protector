export type AppRoute =
  | { page: 'dashboard' }
  | { page: 'inspect'; scenarioId?: string }
  | { page: 'compare'; scenarioId?: string }
  | { page: 'session' }
  | { page: 'history' }
  | { page: 'limitations' };

const VALID_PAGES = new Set(['dashboard', 'inspect', 'compare', 'session', 'history', 'limitations']);

export function parseHash(hash: string): AppRoute {
  const normalized = hash.startsWith('#') ? hash.slice(1) : hash;
  const [path = '/dashboard', query = ''] = normalized.split('?');
  const page = path.replace(/^\/+/, '') || 'dashboard';
  if (!VALID_PAGES.has(page)) return { page: 'dashboard' };
  if (page === 'inspect' || page === 'compare') {
    return {
      page,
      scenarioId: new URLSearchParams(query).get('scenario') ?? undefined,
    };
  }
  return { page } as AppRoute;
}

export function formatHash(route: AppRoute): string {
  if (route.page === 'inspect' || route.page === 'compare') {
    return route.scenarioId
      ? `#/${route.page}?scenario=${encodeURIComponent(route.scenarioId)}`
      : `#/${route.page}`;
  }
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
