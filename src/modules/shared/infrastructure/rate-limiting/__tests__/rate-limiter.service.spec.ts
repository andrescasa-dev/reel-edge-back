import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { RateLimiterService } from '../rate-limiter.service';

describe('RateLimiterService', () => {
  let service: RateLimiterService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, number | undefined> = {
        PERPLEXITY_RATE_LIMIT_RPM: 20,
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimiterService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<RateLimiterService>(RateLimiterService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize with configured rate limit', () => {
      expect(service).toBeDefined();
      const stats = service.getStats();
      expect(stats.requestsPerMinute).toBe(20);
    });

    it('should use default rate limit when not configured', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RateLimiterService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      const defaultService = module.get<RateLimiterService>(RateLimiterService);
      const stats = defaultService.getStats();
      expect(stats.requestsPerMinute).toBe(20);
    });
  });

  describe('execute', () => {
    it('should execute a function and return its result', async () => {
      const testFn = jest.fn().mockResolvedValue('test result');

      const promise = service.execute(testFn);
      await jest.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('test result');
      expect(testFn).toHaveBeenCalledTimes(1);
    });

    it('should execute multiple functions sequentially', async () => {
      const executionOrder: number[] = [];

      const fn1 = jest.fn().mockImplementation(() => {
        executionOrder.push(1);
        return Promise.resolve('result1');
      });

      const fn2 = jest.fn().mockImplementation(() => {
        executionOrder.push(2);
        return Promise.resolve('result2');
      });

      const fn3 = jest.fn().mockImplementation(() => {
        executionOrder.push(3);
        return Promise.resolve('result3');
      });

      const promises = Promise.all([
        service.execute(fn1),
        service.execute(fn2),
        service.execute(fn3),
      ]);

      await jest.runAllTimersAsync();
      const [result1, result2, result3] = await promises;

      expect(result1).toBe('result1');
      expect(result2).toBe('result2');
      expect(result3).toBe('result3');
      expect(executionOrder).toEqual([1, 2, 3]);
    });

    it('should apply minimum delay between requests', async () => {
      const fn1 = jest.fn().mockResolvedValue('result1');
      const fn2 = jest.fn().mockResolvedValue('result2');

      const promise1 = service.execute(fn1);
      const promise2 = service.execute(fn2);

      await jest.advanceTimersByTimeAsync(3000);
      await jest.advanceTimersByTimeAsync(3000);

      await promise1;
      await promise2;

      expect(fn1).toHaveBeenCalled();
      expect(fn2).toHaveBeenCalled();
    });

    it('should handle function errors and reject promise', async () => {
      const testError = new Error('Test error');
      const errorFn = jest.fn().mockRejectedValue(testError);

      const promise = service.execute(errorFn);

      const expectPromise = expect(promise).rejects.toThrow('Test error');
      await jest.runAllTimersAsync();
      await expectPromise;
    });

    it('should continue processing queue after error', async () => {
      const errorFn = jest.fn().mockRejectedValue(new Error('Error'));
      const successFn = jest.fn().mockResolvedValue('success');

      const errorPromise = service.execute(errorFn);
      await jest.runAllTimersAsync();

      try {
        await errorPromise;
      } catch {
        // Expected error
      }

      const successPromise = service.execute(successFn);
      await jest.runAllTimersAsync();
      const result = await successPromise;

      expect(result).toBe('success');
      expect(successFn).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return current rate limit statistics', async () => {
      const fn = jest.fn().mockResolvedValue('result');

      const promise = service.execute(fn);
      await jest.runAllTimersAsync();
      await promise;

      const stats = service.getStats();

      expect(stats.requestsPerMinute).toBe(20);
      expect(stats.requestsInLastMinute).toBe(1);
      expect(stats.queueLength).toBe(0);
    });

    it('should track multiple requests correctly', async () => {
      const fn1 = jest.fn().mockResolvedValue('result1');
      const fn2 = jest.fn().mockResolvedValue('result2');
      const fn3 = jest.fn().mockResolvedValue('result3');

      const promise1 = service.execute(fn1);
      await jest.advanceTimersByTimeAsync(3000);
      await promise1;

      const promise2 = service.execute(fn2);
      await jest.advanceTimersByTimeAsync(3000);
      await promise2;

      const promise3 = service.execute(fn3);
      await jest.advanceTimersByTimeAsync(3000);
      await promise3;

      const stats = service.getStats();

      expect(stats.requestsInLastMinute).toBe(3);
      expect(stats.queueLength).toBe(0);
    });

    it('should not count old requests in statistics', async () => {
      const fn = jest.fn().mockResolvedValue('result');

      const promise = service.execute(fn);
      await jest.runAllTimersAsync();
      await promise;

      await jest.advanceTimersByTimeAsync(61000);

      const stats = service.getStats();

      expect(stats.requestsInLastMinute).toBe(0);
    });
  });

  describe('handleRateLimitError', () => {
    it('should wait for specified retry-after duration', async () => {
      const promise = service.handleRateLimitError(1);

      await jest.advanceTimersByTimeAsync(1000);
      await promise;

      await expect(promise).resolves.toBeUndefined();
    });

    it('should use default wait time when retry-after not provided', async () => {
      const promise = service.handleRateLimitError();

      await jest.advanceTimersByTimeAsync(60000);
      await promise;

      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe('rate limiting behavior', () => {
    it('should enforce rate limit per minute', async () => {
      const mockConfigWithLowLimit = {
        get: jest.fn((key: string) => {
          const config: Record<string, number | undefined> = {
            PERPLEXITY_RATE_LIMIT_RPM: 3,
          };
          return config[key];
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RateLimiterService,
          {
            provide: ConfigService,
            useValue: mockConfigWithLowLimit,
          },
        ],
      }).compile();

      const limitedService = module.get<RateLimiterService>(RateLimiterService);

      const fn = jest.fn().mockResolvedValue('result');

      const promise1 = limitedService.execute(fn);
      await jest.advanceTimersByTimeAsync(3000);

      const promise2 = limitedService.execute(fn);
      await jest.advanceTimersByTimeAsync(3000);

      const promise3 = limitedService.execute(fn);
      await jest.advanceTimersByTimeAsync(3000);

      const promise4 = limitedService.execute(fn);
      await jest.advanceTimersByTimeAsync(60000);

      await Promise.all([promise1, promise2, promise3, promise4]);

      expect(fn).toHaveBeenCalledTimes(4);
    });

    it('should queue requests when rate limit is reached', async () => {
      const mockConfigWithLowLimit = {
        get: jest.fn((key: string) => {
          const config: Record<string, number | undefined> = {
            PERPLEXITY_RATE_LIMIT_RPM: 2,
          };
          return config[key];
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RateLimiterService,
          {
            provide: ConfigService,
            useValue: mockConfigWithLowLimit,
          },
        ],
      }).compile();

      const limitedService = module.get<RateLimiterService>(RateLimiterService);

      const fn1 = jest.fn().mockResolvedValue('result1');
      const fn2 = jest.fn().mockResolvedValue('result2');
      const fn3 = jest.fn().mockResolvedValue('result3');

      const promise1 = limitedService.execute(fn1);
      const promise2 = limitedService.execute(fn2);
      const promise3 = limitedService.execute(fn3);

      await jest.advanceTimersByTimeAsync(3000);
      await jest.advanceTimersByTimeAsync(3000);
      await jest.advanceTimersByTimeAsync(60000);

      await Promise.all([promise1, promise2, promise3]);

      expect(fn1).toHaveBeenCalled();
      expect(fn2).toHaveBeenCalled();
      expect(fn3).toHaveBeenCalled();
    });

    it('should clean old requests from history', async () => {
      const fn = jest.fn().mockResolvedValue('result');

      const promise = service.execute(fn);
      await jest.runAllTimersAsync();
      await promise;

      let stats = service.getStats();
      expect(stats.requestsInLastMinute).toBe(1);

      await jest.advanceTimersByTimeAsync(61000);

      stats = service.getStats();
      expect(stats.requestsInLastMinute).toBe(0);
    });
  });

  describe('concurrent requests', () => {
    it('should handle concurrent requests correctly', async () => {
      const results: string[] = [];

      const createFunction = (id: number) => {
        return jest.fn().mockImplementation(() => {
          const result = `result${id}`;
          results.push(result);
          return Promise.resolve(result);
        });
      };

      const functions = Array.from({ length: 5 }, (_, i) =>
        createFunction(i + 1),
      );

      const promises = functions.map((fn) => service.execute(fn));

      await jest.runAllTimersAsync();
      await Promise.all(promises);

      expect(results).toHaveLength(5);
      functions.forEach((fn) => {
        expect(fn).toHaveBeenCalledTimes(1);
      });
    });

    it('should maintain queue integrity with concurrent submissions', async () => {
      const fn = jest.fn().mockResolvedValue('result');

      const promises = Array.from({ length: 10 }, () => service.execute(fn));

      await jest.runAllTimersAsync();
      await Promise.all(promises);

      expect(fn).toHaveBeenCalledTimes(10);

      const stats = service.getStats();
      expect(stats.queueLength).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle very fast sequential calls', async () => {
      const fn = jest.fn().mockResolvedValue('result');

      const promise1 = service.execute(fn);
      const promise2 = service.execute(fn);
      const promise3 = service.execute(fn);

      await jest.runAllTimersAsync();
      await Promise.all([promise1, promise2, promise3]);

      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should handle function that returns undefined', async () => {
      const fn = jest.fn().mockResolvedValue(undefined);

      const promise = service.execute(fn);
      await jest.runAllTimersAsync();
      const result = await promise;

      expect(result).toBeUndefined();
      expect(fn).toHaveBeenCalled();
    });

    it('should handle function that returns null', async () => {
      const fn = jest.fn().mockResolvedValue(null);

      const promise = service.execute(fn);
      await jest.runAllTimersAsync();
      const result = await promise;

      expect(result).toBeNull();
      expect(fn).toHaveBeenCalled();
    });

    it('should handle synchronous errors in async functions', async () => {
      const fn = jest.fn().mockImplementation(() => {
        throw new Error('Sync error');
      });

      const promise = service.execute(fn);

      const expectPromise = expect(promise).rejects.toThrow('Sync error');
      await jest.runAllTimersAsync();
      await expectPromise;
    });
  });
});
