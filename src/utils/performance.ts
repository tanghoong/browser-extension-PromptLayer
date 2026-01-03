/**
 * Performance optimization utilities
 */

/**
 * Memoize function results to avoid recomputation
 * Useful for expensive operations like parsing or calculations
 * Uses FIFO (First-In-First-Out) cache eviction when maxCacheSize is reached
 */
export function memoize<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult,
  options?: {
    maxCacheSize?: number;
    keyGenerator?: (...args: TArgs) => string;
  }
): (...args: TArgs) => TResult {
  const cache = new Map<string, TResult>();
  const maxCacheSize = options?.maxCacheSize || 100;
  const keyGenerator =
    options?.keyGenerator ||
    ((...args: TArgs) => {
      // Safe key generation - handle non-serializable values
      try {
        return JSON.stringify(args);
      } catch {
        // Fallback for circular references or non-serializable values
        return args.map((arg) => String(arg)).join('|');
      }
    });

  return function (...args: TArgs): TResult {
    const key = keyGenerator(...args);

    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = fn(...args);

    // Implement FIFO cache eviction
    if (cache.size >= maxCacheSize) {
      const firstKey = cache.keys().next().value as string | undefined;
      if (firstKey) {
        cache.delete(firstKey);
      }
    }

    cache.set(key, result);
    return result;
  };
}

/**
 * Create an async memoize function
 * Uses FIFO (First-In-First-Out) cache eviction when maxCacheSize is reached
 */
export function memoizeAsync<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options?: {
    maxCacheSize?: number;
    keyGenerator?: (...args: TArgs) => string;
    ttl?: number; // Time to live in milliseconds
  }
): (...args: TArgs) => Promise<TResult> {
  const cache = new Map<string, { value: TResult; timestamp: number }>();
  const maxCacheSize = options?.maxCacheSize || 100;
  const keyGenerator =
    options?.keyGenerator ||
    ((...args: TArgs) => {
      // Safe key generation - handle non-serializable values
      try {
        return JSON.stringify(args);
      } catch {
        // Fallback for circular references or non-serializable values
        return args.map((arg) => String(arg)).join('|');
      }
    });
  const ttl = options?.ttl;

  return async function (...args: TArgs): Promise<TResult> {
    const key = keyGenerator(...args);
    const now = Date.now();

    // Check if cached and not expired
    if (cache.has(key)) {
      const cached = cache.get(key)!;
      if (!ttl || now - cached.timestamp < ttl) {
        return cached.value;
      }
      cache.delete(key);
    }

    const result = await fn(...args);

    // Implement FIFO cache eviction
    if (cache.size >= maxCacheSize) {
      const firstKey = cache.keys().next().value as string | undefined;
      if (firstKey) {
        cache.delete(firstKey);
      }
    }

    cache.set(key, { value: result, timestamp: now });
    return result;
  };
}

/**
 * Batch multiple operations to reduce overhead
 */
export class Batcher<T> {
  private queue: T[] = [];
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private readonly batchSize: number;
  private readonly delay: number;
  private readonly processBatch: (items: T[]) => void;

  constructor(
    processBatch: (items: T[]) => void,
    options?: {
      batchSize?: number;
      delay?: number;
    }
  ) {
    this.processBatch = processBatch;
    this.batchSize = options?.batchSize || 10;
    this.delay = options?.delay || 100;
  }

  add(item: T): void {
    this.queue.push(item);

    if (this.queue.length >= this.batchSize) {
      // Clear timeout when flushing due to batch size to prevent double flush
      if (this.timeout) {
        clearTimeout(this.timeout);
        this.timeout = null;
      }
      this.flush();
    } else if (!this.timeout) {
      this.timeout = setTimeout(() => this.flush(), this.delay);
    }
  }

  flush(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    if (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.batchSize);
      this.processBatch(batch);
    }
  }
}

/**
 * Lazy evaluation - compute value only when needed
 */
export class Lazy<T> {
  private value?: T;
  private computed = false;

  constructor(private readonly factory: () => T) {}

  get(): T {
    if (!this.computed) {
      this.value = this.factory();
      this.computed = true;
    }
    return this.value!;
  }

  reset(): void {
    this.computed = false;
    this.value = undefined;
  }
}

/**
 * Request animation frame throttle for smooth UI updates
 */
export function rafThrottle<T extends (...args: unknown[]) => unknown>(
  fn: T
): (...args: Parameters<T>) => void {
  let rafId: number | null = null;
  let lastArgs: Parameters<T> | null = null;

  return function (...args: Parameters<T>) {
    lastArgs = args;

    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        fn(...(lastArgs as Parameters<T>));
        rafId = null;
        lastArgs = null;
      });
    }
  };
}

/**
 * Idle callback for non-critical work
 */
export function runWhenIdle(callback: () => void, timeout = 1000): void {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(callback, { timeout });
  } else {
    // Fallback for browsers that don't support requestIdleCallback
    setTimeout(callback, 0);
  }
}

/**
 * Chunk large arrays for processing without blocking UI
 */
export async function chunkProcess<T, R>(
  items: T[],
  processor: (item: T) => R,
  chunkSize = 50
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);

    // Process chunk
    const chunkResults = chunk.map(processor);
    results.push(...chunkResults);

    // Yield to browser between chunks
    if (i + chunkSize < items.length) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return results;
}

/**
 * Create a pool for reusable objects to reduce GC pressure
 */
export class ObjectPool<T> {
  private available: T[] = [];
  private readonly factory: () => T;
  private readonly reset: (obj: T) => void;
  private readonly maxSize: number;

  constructor(factory: () => T, reset: (obj: T) => void, maxSize = 50) {
    this.factory = factory;
    this.reset = reset;
    this.maxSize = maxSize;
  }

  acquire(): T {
    return this.available.pop() || this.factory();
  }

  release(obj: T): void {
    if (this.available.length < this.maxSize) {
      this.reset(obj);
      this.available.push(obj);
    }
  }

  clear(): void {
    this.available = [];
  }
}
