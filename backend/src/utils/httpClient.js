const axios = require('axios');
const axiosRetry = require('axios-retry');

const attachRetry = axiosRetry.default;
const { exponentialDelay, isNetworkOrIdempotentRequestError } = axiosRetry;

// Creates an axios instance with automatic retry on network errors and 5xx responses.
// 429 (rate-limit) responses are never retried — callers must respect upstream limits.
function createHttpClient({ retries = 3, retryCondition } = {}) {
  const client = axios.create();
  attachRetry(client, {
    retries,
    retryDelay: (n) => exponentialDelay(n, undefined, 500), // 500 ms, 1 s, 2 s
    retryCondition: retryCondition || (
      (err) =>
        isNetworkOrIdempotentRequestError(err) ||
        (err.response?.status >= 500 && err.response?.status !== 429)
    ),
    onRetry: (retryCount, err, cfg) => {
      console.warn(`[HTTP] Retry ${retryCount} → ${cfg.url}: ${err.message}`);
    },
  });
  return client;
}

module.exports = { createHttpClient };
