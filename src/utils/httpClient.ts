import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import pRetry from 'p-retry';
import CircuitBreaker from 'opossum';
import logger from './logger';
import proxyClient from './proxyClient';

type Host = string;

const hostAxiosInstances: Map<Host, ReturnType<typeof axios.create>> = new Map();
const hostBreakers: Map<Host, CircuitBreaker> = new Map();

const DEFAULT_TIMEOUT = parseInt(process.env.HTTP_CLIENT_TIMEOUT_MS || '10000', 10);
const DEFAULT_RETRIES = parseInt(process.env.HTTP_CLIENT_MAX_RETRIES || '2', 10);

function getOriginFromUrl(url: string): string {
  try {
    return new URL(url).origin;
  } catch (e) {
    return ''; // caller should provide absolute URLs for host-based breakers
  }
}

function getAxiosForHost(origin: string) {
  if (!hostAxiosInstances.has(origin)) {
    const instance = axios.create({
      baseURL: origin,
      timeout: DEFAULT_TIMEOUT,
      validateStatus: () => true
    });
    hostAxiosInstances.set(origin, instance);
  }
  return hostAxiosInstances.get(origin)!;
}

function getBreakerForHost(origin: string) {
  if (!hostBreakers.has(origin)) {
    const options: CircuitBreaker.Options = {
      errorThresholdPercentage: parseInt(process.env.HTTP_BREAKER_ERROR_THRESHOLD_PCT || '50', 10),
      timeout: parseInt(process.env.HTTP_BREAKER_TIMEOUT_MS || '5000', 10),
      resetTimeout: parseInt(process.env.HTTP_BREAKER_RESET_MS || '30000', 10),
      rollingCountTimeout: 10000,
      rollingCountBuckets: 10
    };

    const action = async (config: AxiosRequestConfig) => {
      const inst = getAxiosForHost(origin);

      const attempt = async () => {
        const resp = await inst.request(config);
        if (resp.status >= 500) {
          const err: any = new Error(`HTTP ${resp.status}`);
          err.response = resp;
          throw err;
        }
        return resp;
      };

      const resp = await pRetry(attempt, {
        retries: DEFAULT_RETRIES,
        factor: 2,
        minTimeout: 100,
        randomize: true,
        onFailedAttempt: (err) => {
          logger.debug('HTTP attempt failed for host', { origin, attempt: (err as any).attemptNumber, retriesLeft: (err as any).retriesLeft, message: (err as any).message });
        }
      });

      return resp as AxiosResponse;
    };

    const breaker = new CircuitBreaker(action, options);
    breaker.on('open', () => logger.warn('HTTP breaker open', { origin }));
    breaker.on('halfOpen', () => logger.info('HTTP breaker half-open', { origin }));
    breaker.on('close', () => logger.info('HTTP breaker closed', { origin }));
    breaker.on('failure', (err) => logger.warn('HTTP breaker failure', { origin, err: err?.message }));

    hostBreakers.set(origin, breaker);
  }
  return hostBreakers.get(origin)!;
}

export interface HttpRequestOptions extends AxiosRequestConfig {
  serviceName?: string; // optional registered service name in serviceRegistry
}

/**
 * Centralized HTTP request helper. If `serviceName` is provided, it delegates
 * to the proxyClient (which uses per-service breakers configured via serviceRegistry).
 * Otherwise it will use a per-origin breaker and retry strategy.
 */
export async function httpRequest(opts: HttpRequestOptions): Promise<AxiosResponse> {
  if (opts.serviceName) {
    // delegate to proxyClient which manages per-service breakers
    return proxyClient.request(opts.serviceName, opts as AxiosRequestConfig);
  }

  if (!opts.url) throw new Error('httpRequest requires url when serviceName is not provided');

  const origin = getOriginFromUrl(String(opts.url));
  if (!origin) {
    // If url isn't absolute, fall back to a direct axios call with retries
    const attempt = async () => {
      const resp = await axios.request({ ...opts, timeout: opts.timeout ?? DEFAULT_TIMEOUT });
      if (resp.status >= 500) throw new Error(`HTTP ${resp.status}`);
      return resp;
    };
    return pRetry(attempt, { retries: DEFAULT_RETRIES, factor: 2, minTimeout: 100, randomize: true });
  }

  const breaker = getBreakerForHost(origin);

  try {
    const response = await breaker.fire(opts as AxiosRequestConfig);
    return response as AxiosResponse;
  } catch (err: any) {
    if (err && err.code === 'EOPENBREAKER') {
      const e = new Error(`Circuit open for host ${origin}`);
      (e as any).isCircuitOpen = true;
      throw e;
    }
    throw err;
  }
}

/**
 * Return lightweight breaker states for observability.
 * This is intentionally coarse: it returns the origin and one of 'closed'|'open'|'halfOpen'.
 */
export function getBreakerStates(): { [origin: string]: 'open' | 'halfOpen' | 'closed' } {
  const res: { [origin: string]: 'open' | 'halfOpen' | 'closed' } = {};
  for (const [origin, breaker] of hostBreakers.entries()) {
    if ((breaker as any).opened) res[origin] = 'open';
    else if ((breaker as any).halfOpen) res[origin] = 'halfOpen';
    else res[origin] = 'closed';
  }
  return res;
}

export default { httpRequest, getBreakerStates };
