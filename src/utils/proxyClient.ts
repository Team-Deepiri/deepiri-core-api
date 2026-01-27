import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import pRetry from 'p-retry';
import CircuitBreaker from 'opossum';
import { getServiceUrl } from '../config/serviceRegistry';
import logger from './logger';

type ServiceName = string;

export interface ProxyClientOptions {
  timeoutMs?: number;
  maxRetries?: number;
  retryMinTimeout?: number;
  retryFactor?: number;
  breakerOptions?: CircuitBreaker.Options;
}

class ProxyClient {
  private breakers: Map<ServiceName, CircuitBreaker> = new Map();
  private axiosInstances: Map<ServiceName, AxiosInstance> = new Map();
  private opts: Required<ProxyClientOptions>;

  constructor(opts?: ProxyClientOptions) {
    this.opts = {
      timeoutMs: opts?.timeoutMs ?? 10_000,
      maxRetries: opts?.maxRetries ?? 2,
      retryMinTimeout: opts?.retryMinTimeout ?? 100,
      retryFactor: opts?.retryFactor ?? 2,
      breakerOptions: opts?.breakerOptions ?? {
        errorThresholdPercentage: 50,
        timeout: 5000,
        resetTimeout: 30_000,
        rollingCountTimeout: 10000,
        rollingCountBuckets: 10
      }
    };
  }

  private getAxiosInstance(service: ServiceName): AxiosInstance {
    if (this.axiosInstances.has(service)) return this.axiosInstances.get(service)!;

    const baseURL = getServiceUrl(service);
    const instance = axios.create({
      baseURL: baseURL,
      timeout: this.opts.timeoutMs,
      // allow examining all responses
      validateStatus: () => true
    });

    this.axiosInstances.set(service, instance);
    return instance;
  }

  private getBreaker(service: ServiceName): CircuitBreaker {
    if (this.breakers.has(service)) return this.breakers.get(service)!;

    // The action given to circuit will be executed when fired.
    const action = async (config: AxiosRequestConfig) => {
      const axiosInstance = this.getAxiosInstance(service);

      // Wrap axios call with p-retry
      const attempt = async () => {
        let response: AxiosResponse;
        try {
          response = await axiosInstance.request(config);
        } catch (err: any) {
          // network error or timeout
          logger.warn('axios network error, will be retried', { service, err: err?.message });
          // rethrow to trigger retry
          throw err;
        }

        // Retry on 5xx
        if (response.status >= 500) {
          const err = new Error(`HTTP ${response.status}`);
          // attach response for logging
          (err as any).response = response;
          logger.warn('axios received 5xx, will be retried', { service, status: response.status });
          throw err;
        }

        // Do not retry 4xx - return as-is
        return response;
      };

      const response = await pRetry(attempt, {
        onFailedAttempt: (error) => {
          const a = error as any;
          logger.debug('Request attempt failed', { service, attempt: a.attemptNumber, retriesLeft: a.retriesLeft, message: a.message });
        },
        retries: this.opts.maxRetries,
        factor: this.opts.retryFactor,
        minTimeout: this.opts.retryMinTimeout,
        randomize: true
      });

      return response;
    };

    const breaker = new CircuitBreaker(action, this.opts.breakerOptions);

    breaker.on('open', () => logger.warn('circuit open', { service }));
    breaker.on('halfOpen', () => logger.info('circuit half-open', { service }));
    breaker.on('close', () => logger.info('circuit closed', { service }));
    breaker.on('failure', (err) => logger.warn('circuit failure', { service, err: err?.message }));

    this.breakers.set(service, breaker);
    return breaker;
  }

  /**
   * Make a proxied request to a downstream service with retries + circuit breaker.
   * Throws when circuit is open or when final attempt fails.
   */
  public async request(service: ServiceName, config: AxiosRequestConfig): Promise<AxiosResponse> {
    const breaker = this.getBreaker(service);

    try {
      const result = await breaker.fire(config);
      // result is AxiosResponse
      return result as AxiosResponse;
    } catch (err: any) {
      // opossum wraps errors; detect open circuit
      if (err && err.code === 'EOPENBREAKER') {
        const e: any = new Error(`Circuit open for service ${service}`);
        e.isCircuitOpen = true;
        throw e;
      }
      // if inner error includes axios response, rethrow for caller to handle
      throw err;
    }
  }
}

export default new ProxyClient();
