// Limits apply before parsing or contacting a paid service.
export class BodyError extends Error {
  constructor(status, code) { super(code); this.status = status; }
}

export async function readJson(req, maxBytes = 65536) {
  if (Number(req.headers.get('content-length')) > maxBytes) throw new BodyError(413, 'too_large');
  if (!req.body) throw new BodyError(400, 'json');
  const reader = req.body.getReader();
  const decoder = new TextDecoder();
  let size = 0, text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new BodyError(413, 'too_large'); }
      text += decoder.decode(value, { stream: true });
    }
    try { return JSON.parse(text + decoder.decode()); }
    catch { throw new BodyError(400, 'json'); }
  } finally { reader.releaseLock(); }
}

// A per-instance brake, not a distributed abuse-prevention service. Bound both keys and hits.
export function rateLimiter(max, windowMs, capacity = 5000) {
  const hits = new Map();
  let swept = 0;
  return (key) => {
    const now = Date.now();
    if (now - swept > windowMs || hits.size >= capacity) {
      for (const [ip, values] of hits) if (now - values.at(-1) >= windowMs) hits.delete(ip);
      swept = now;
    }
    if (!hits.has(key) && hits.size >= capacity) return true;
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
    recent.push(now);
    hits.set(key, recent.slice(-max - 1));
    return recent.length > max;
  };
}
