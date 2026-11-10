import { describe, expect, it } from 'vitest';
import { formatHash, parseHash } from '../src/lib/routing';

describe('App routing', () => {
  it('round-trips the supported pages', () => {
    for (const page of ['dashboard', 'inspect', 'history', 'limitations'] as const) {
      expect(parseHash(formatHash({ page }))).toEqual({ page });
    }
  });

  it('redirects removed demo routes and unknown routes to the dashboard', () => {
    expect(parseHash('#/compare')).toEqual({ page: 'dashboard' });
    expect(parseHash('#/session')).toEqual({ page: 'dashboard' });
    expect(parseHash('#/unknown')).toEqual({ page: 'dashboard' });
  });
});
