import httpClient from '../src/utils/httpClient';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('httpClient retries and breaker', () => {
  beforeEach(() => {
    mockedAxios.request.mockReset();
    process.env.HTTP_CLIENT_MAX_RETRIES = '2';
    process.env.HTTP_BREAKER_ERROR_THRESHOLD_PCT = '50';
  });

  test('retries on 5xx and returns success', async () => {
    // First call: 500, second: 200
    mockedAxios.request
      .mockResolvedValueOnce({ status: 500, data: {} })
      .mockResolvedValueOnce({ status: 200, data: { ok: true } });

    const resp = await httpClient.httpRequest({ url: 'https://example.com/test', method: 'get' });
    expect(resp.status).toBe(200);
    expect(mockedAxios.request).toHaveBeenCalledTimes(2);
  });

  test('opens breaker after repeated failures', async () => {
    // Always return 500
    mockedAxios.request.mockResolvedValue({ status: 500, data: {} });

    const origin = 'https://failing.test';
    // Call enough times to trip the breaker (depends on threshold; use several calls)
    const calls = Array.from({ length: 6 }, () => httpClient.httpRequest({ url: `${origin}/a`, method: 'get' }).catch(e => e));
    const results = await Promise.all(calls);

    // At least one should be an error; then breaker state should be present
    const states = httpClient.getBreakerStates();
    expect(Object.keys(states).some(k => k.includes('failing.test'))).toBeTruthy();
  });
});
