/**
 * Resilient Data Fetching Utility with Exponential Backoff + Jitter & Local Persistent Caching
 * Ensures fast UI responses, zero freeze/stutter, and robust auto-retry against network fluctuations.
 */

interface FetchWithBackoffOptions extends RequestInit {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  timeoutMs?: number;
  useCache?: boolean;
  cacheTtlMs?: number;
}

// In-memory quick cache for read queries
const memoryCache = new Map<string, { data: any; timestamp: number }>();

function getLocalStorageItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(key);
    }
  } catch {
    // ignore
  }
  return null;
}

function setLocalStorageItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(key, value);
    }
  } catch {
    // ignore
  }
}

export function getCachedApiResponse<T = any>(key: string, maxAgeMs = 60000): T | null {
  const entry = memoryCache.get(key);
  if (entry) {
    if (Date.now() - entry.timestamp <= maxAgeMs) {
      return entry.data as T;
    }
    memoryCache.delete(key);
  }

  // Never serve stale inventory or product lists from persistent storage
  if (key.includes('/api/products') || key.includes('/api/inventory')) {
    return null;
  }

  // Persistent storage fallback across page reloads for static metadata only
  const stored = getLocalStorageItem(`apex_cache_${key}`);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed && parsed.data !== undefined) {
        if (Date.now() - parsed.timestamp <= maxAgeMs) {
          memoryCache.set(key, { data: parsed.data, timestamp: parsed.timestamp });
          return parsed.data as T;
        }
      }
    } catch {
      // ignore JSON parse failure
    }
  }

  return null;
}

export function setCachedApiResponse(key: string, data: any): void {
  if (memoryCache.size > 250) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey) memoryCache.delete(oldestKey);
  }
  const timestamp = Date.now();
  memoryCache.set(key, { data, timestamp });
  // Avoid filling localStorage with heavy dynamic product catalogues
  if (!key.includes('/api/products') && !key.includes('/api/inventory')) {
    setLocalStorageItem(`apex_cache_${key}`, JSON.stringify({ data, timestamp }));
  }
}

export function clearCachedApiResponse(keyPrefix?: string): void {
  if (!keyPrefix) {
    memoryCache.clear();
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const toRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith('apex_cache_') || k === 'apex_persisted_products')) {
            toRemove.push(k);
          }
        }
        toRemove.forEach((k) => localStorage.removeItem(k));
      }
    } catch {
      // ignore
    }
    return;
  }

  for (const key of memoryCache.keys()) {
    if (key.startsWith(keyPrefix)) {
      memoryCache.delete(key);
    }
  }

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const targetPrefix = `apex_cache_${keyPrefix}`;
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith(targetPrefix) || k.includes(keyPrefix))) {
          toRemove.push(k);
        }
      }
      toRemove.forEach((k) => localStorage.removeItem(k));
      if (keyPrefix.includes('/api/products')) {
        localStorage.removeItem('apex_persisted_products');
      }
    }
  } catch {
    // ignore
  }
}

/**
 * Returns a safe empty fallback for standard GET endpoints during cold start or disconnect
 */
function getSafeEndpointFallback<T>(url: string): T | null {
  if (url.includes('/api/products') || url.includes('/api/categories') || url.includes('/api/inventory/serials') || url.includes('/api/inventory/movements')) {
    return ([] as unknown) as T;
  }
  return null;
}

/**
 * Executes an authenticated fetch attaching stored token and credentials
 */
export function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('apex_token') : null;
  const headers = new Headers(init?.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (token && !headers.has('x-apex-token')) {
    headers.set('x-apex-token', token);
  }
  return fetch(url, {
    ...init,
    credentials: init?.credentials || 'include',
    headers,
  });
}

/**
 * Executes a network fetch with timeout and exponential backoff retry logic.
 */
export async function fetchWithBackoff<T = any>(
  url: string,
  options: FetchWithBackoffOptions = {}
): Promise<T> {
  const isGet = !options.method || options.method.toUpperCase() === 'GET';

  const {
    maxRetries = isGet ? 4 : 0,
    initialDelayMs = 400,
    maxDelayMs = 3000,
    backoffFactor = 2,
    timeoutMs = 15000,
    useCache = isGet,
    cacheTtlMs = 60000,
    ...fetchInit
  } = options;

  // Return cached payload immediately if fresh
  if (useCache && isGet) {
    const cached = getCachedApiResponse<T>(url, cacheTtlMs);
    if (cached !== null) {
      return cached;
    }
  }

  class HttpError extends Error { status: number; constructor(message: string, status: number) { super(message); this.status = status; } }
  let attempt = 0;
  let currentDelay = initialDelayMs;

  while (attempt <= maxRetries) {
    const controller = new AbortController();
    if (fetchInit.signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
    const cancel = () => controller.abort();
    fetchInit.signal?.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('apex_token') : null;
      const headers = new Headers(fetchInit.headers || {});
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      if (token && !headers.has('x-apex-token')) {
        headers.set('x-apex-token', token);
      }
      const response = await fetch(url, {
        ...fetchInit,
        credentials: fetchInit.credentials || 'include',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timer);
      fetchInit.signal?.removeEventListener('abort', cancel);

      // On server 5xx errors, retry with exponential backoff
      if (!response.ok) {
        if (response.status >= 500 && attempt < maxRetries) {
          throw new Error(`Server error ${response.status}: ${response.statusText}`);
        }
        const errorBody = await response.text();
        let parsedJson: any;
        try {
          parsedJson = JSON.parse(errorBody);
        } catch {
          parsedJson = null;
        }
        throw new HttpError(parsedJson?.error || parsedJson?.message || `HTTP ${response.status}`, response.status);
      }

      // Successful response
      const data: T = await response.json();

      if (useCache && isGet) {
        setCachedApiResponse(url, data);
      }

      return data;
    } catch (err: any) {
      clearTimeout(timer);
      fetchInit.signal?.removeEventListener('abort', cancel);

      if (fetchInit.signal?.aborted || (err instanceof HttpError && err.status < 500)) throw err;
      if (attempt >= maxRetries) {
        // If we have any cached data for GET requests, return it rather than failing
        if (isGet && useCache) {
          const staleCached = getCachedApiResponse<T>(url, 30 * 86400000); // Up to 30 days stale cache
          if (staleCached !== null) {
            return staleCached;
          }
          const safeFallback = getSafeEndpointFallback<T>(url);
          if (safeFallback !== null) {
            return safeFallback;
          }
        }
        throw err;
      }

      // Add full jitter to prevent thundering herd problem
      const jitter = Math.random() * 0.4 + 0.8; // 0.8 - 1.2
      const sleepTime = Math.min(maxDelayMs, Math.round(currentDelay * jitter));

      await new Promise((resolve) => setTimeout(resolve, sleepTime));

      currentDelay *= backoffFactor;
      attempt++;
    }
  }

  // Final fallback to cached response or safe fallback
  if (isGet && useCache) {
    const staleCached = getCachedApiResponse<T>(url, 30 * 86400000);
    if (staleCached !== null) {
      return staleCached;
    }
    const safeFallback = getSafeEndpointFallback<T>(url);
    if (safeFallback !== null) {
      return safeFallback;
    }
  }

  throw new Error(`Failed to fetch ${url} after ${maxRetries} attempts.`);
}
