// #150: Naver drops a few connections every run ("fetch failed"), and each drop lost a whole stock for the day.
// GET/HEAD only (safe to repeat): a dropped connection, 429 or 5xx is tried again after a short wait.
const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);

export function retryingFetch(base: typeof fetch, waitsMs: readonly number[] = [1_000, 3_000], sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))): typeof fetch {
  return async (input, init) => {
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') return base(input, init);
    for (let attempt = 0; ; attempt++) {
      const last = attempt >= waitsMs.length;
      try {
        const response = await base(input, init);
        if (last || !RETRY_STATUS.has(response.status)) return response;
      } catch (error) {
        // undici reports a dropped connection as TypeError('fetch failed'); a timeout or abort is not retried.
        if (last || !(error instanceof TypeError) || init?.signal?.aborted) throw error;
      }
      await sleep(waitsMs[attempt]!);
    }
  };
}
