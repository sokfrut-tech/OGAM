import { analyticsBuildAllowed, createAnalyticsClient } from '../../../src/services/analytics/client';

describe('Jarvis analytics transport', () => {
  it('never enables remote analytics', () => {
    expect(analyticsBuildAllowed()).toBe(false);
  });

  it('keeps the analytics compatibility interface local and inert', async () => {
    const client = createAnalyticsClient({
      crashes: true,
      beforeSend: event => event,
    });

    expect(client.capture('test_event', { value: 1 })).toBeUndefined();
    expect(client.screen('Settings')).toBeUndefined();
    expect(client.register({ platform: 'android' })).toBeUndefined();
    expect(client.dropQueued(() => true)).toBeUndefined();
    await expect(client.close()).resolves.toBeUndefined();
    await expect(client.forget()).resolves.toBeUndefined();
  });
});
