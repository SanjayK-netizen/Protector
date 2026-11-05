import { describe, expect, it, vi } from 'vitest';

describe('Baseline view engine boundary', () => {
  it('loads without importing the risk engine', async () => {
    vi.resetModules();
    vi.doMock('../src/lib/riskRules', () => {
      throw new Error('BaselineView must not import the risk engine');
    });
    await expect(import('../src/components/BaselineView')).resolves.toHaveProperty('BaselineView');
    vi.doUnmock('../src/lib/riskRules');
  });
});
