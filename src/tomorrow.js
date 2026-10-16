// -----------------------------------------------------------------------------
// Tomorrow.io v4 client: the three read-only calls the integration makes.
//
//   GET  /v4/weather/realtime   current conditions (one call)
//   GET  /v4/weather/forecast   every timeline the plan gives, in ONE call:
//                               minutely (next hour), hourly, daily
//   POST /v4/timelines          air quality, pollen and fire index (premium
//                               data layers, absent from the free plan)
//
// Tomorrow.io counts one call per endpoint and location, whatever the fields
// and timelines in the answer. The key travels in the `apikey` header, never
// in the URL: an URL ends up in error messages and logs, a header does not.
// Values are always requested in metric units.
// -----------------------------------------------------------------------------

export const API_BASE = 'https://api.tomorrow.io/v4';
export const REQUEST_TIMEOUT_MS = 15_000;

// The premium fields, read in the `current` timestep of the Timelines API.
export const PREMIUM_FIELDS = [
  'particulateMatter25',
  'particulateMatter10',
  'pollutantO3',
  'epaIndex',
  'treeIndex',
  'grassIndex',
  'weedIndex',
  'fireIndex',
];

/**
 * A failed call, classified by what the integration does about it:
 * - `auth`: the key is refused (401, or 403 on a core endpoint);
 * - `plan`: the key works, but this data is not in its plan (premium layers);
 * - `rate`: a quota of the plan is spent (429), `retryAfterMs` when given;
 * - `network`: no answer (DNS, timeout, connection refused);
 * - `api`: any other answer (5xx, unexpected payload).
 */
export class TomorrowError extends Error {
  constructor(kind, message, { status, code, retryAfterMs } = {}) {
    super(message);
    this.name = 'TomorrowError';
    this.kind = kind;
    this.status = status;
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}

/** `lat,lon` with 4 decimals (about 10 m): enough, and stable in the URL. */
export function formatLocation({ latitude, longitude }) {
  return `${Number(latitude).toFixed(4)},${Number(longitude).toFixed(4)}`;
}

function retryAfter(headers) {
  const value = headers?.get?.('retry-after');
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : undefined;
}

/**
 * Turn an error answer into a TomorrowError. The body is `{ code, type,
 * message }`; only `type` and `message` are kept, never the request.
 */
async function errorFrom(response, { premium }) {
  let body = null;
  try {
    body = await response.json();
  } catch {
    // An HTML error page or an empty body: the status says enough.
  }
  const detail = [body?.type, body?.message].filter((part) => typeof part === 'string').join(': ');
  const message = `HTTP ${response.status}${detail ? ` (${detail.slice(0, 200)})` : ''}`;
  const options = { status: response.status, code: body?.code };
  if (response.status === 429) {
    return new TomorrowError('rate', message, {
      ...options,
      retryAfterMs: retryAfter(response.headers),
    });
  }
  if (response.status === 401) {
    return new TomorrowError('auth', message, options);
  }
  // The premium call comes after a successful core call with the same key:
  // a refusal there is the plan, not the key.
  if (premium && (response.status === 403 || response.status === 400)) {
    return new TomorrowError('plan', message, options);
  }
  if (response.status === 403) {
    return new TomorrowError('auth', message, options);
  }
  return new TomorrowError('api', message, options);
}

/**
 * @param {object} options
 * @param {typeof fetch} [options.fetch] injected by the tests
 * @param {string} [options.baseUrl]
 */
export function createTomorrowClient({
  fetch: fetchImpl = globalThis.fetch,
  baseUrl = API_BASE,
} = {}) {
  async function call(path, { apiKey, query, body, premium = false }) {
    const url = new URL(`${baseUrl}${path}`);
    for (const [key, value] of Object.entries(query ?? {})) {
      url.searchParams.set(key, value);
    }
    let response;
    try {
      response = await fetchImpl(url, {
        method: body ? 'POST' : 'GET',
        headers: {
          apikey: apiKey,
          accept: 'application/json',
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      const reason = err?.name === 'TimeoutError' ? 'timeout' : (err?.cause?.code ?? err?.message);
      throw new TomorrowError('network', `Tomorrow.io unreachable (${reason})`);
    }
    if (!response.ok) {
      throw await errorFrom(response, { premium });
    }
    try {
      return await response.json();
    } catch {
      throw new TomorrowError('api', `HTTP ${response.status} (the answer is not JSON)`);
    }
  }

  return {
    /** Current conditions: `{ data: { time, values }, location }`. */
    async realtime(apiKey, place) {
      const json = await call('/weather/realtime', {
        apiKey,
        query: { location: formatLocation(place), units: 'metric' },
      });
      if (!json?.data?.values || typeof json.data.values !== 'object') {
        throw new TomorrowError('api', 'realtime answer without data.values');
      }
      return json;
    },

    /**
     * Every timeline of the plan in one call — no `timesteps` parameter, so
     * the minutely timeline comes along when the plan has it:
     * `{ timelines: { minutely?, hourly?, daily? }, location }`.
     */
    async forecast(apiKey, place) {
      const json = await call('/weather/forecast', {
        apiKey,
        query: { location: formatLocation(place), units: 'metric' },
      });
      if (!json?.timelines || typeof json.timelines !== 'object') {
        throw new TomorrowError('api', 'forecast answer without timelines');
      }
      return json;
    },

    /** Premium layers, current values: `{ data: { timelines: [...] } }`. */
    async premium(apiKey, place) {
      const json = await call('/timelines', {
        apiKey,
        premium: true,
        body: {
          location: formatLocation(place),
          fields: PREMIUM_FIELDS,
          timesteps: ['current'],
          units: 'metric',
        },
      });
      if (!Array.isArray(json?.data?.timelines)) {
        throw new TomorrowError('api', 'timelines answer without data.timelines');
      }
      return json;
    },
  };
}
