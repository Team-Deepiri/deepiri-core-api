import cacheService from '../src/services/cacheService';

describe('cacheService breaker behavior', () => {
  test('get returns null when breaker is open', async () => {
    // simulate breaker open
    (cacheService as any)._breaker = { opened: true };
    (cacheService as any).isConnected = true;
    const v = await cacheService.get('somekey');
    expect(v).toBeNull();
  });

  test('set is skipped when breaker is open', async () => {
    const calls: any[] = [];
    (cacheService as any)._breaker = { opened: true, fire: async (fn: any) => { calls.push('skipped'); } };
    (cacheService as any).isConnected = true;
    await cacheService.set('k', { a: 1 }, 10);
    expect(calls.length).toBe(0); // set returns early, no fire
  });
});
