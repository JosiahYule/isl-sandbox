// =====================================================================
// db.js: a small helper for reading and writing the chat's tables through Supabase's REST API.
//
// The edge functions and scripts/send-job-alerts.mjs both use it. It needs the project URL and the
// service role key, which only ever live in secrets (Supabase function secrets, GitHub secrets),
// never in the website or this repository.
// =====================================================================

export function restClient(url, key) {
  if (!url || !key) return null;
  const base = url.replace(/\/+$/, '') + '/rest/v1/';
  return async function rest(path, { method = 'GET', body, prefer } = {}) {
    const res = await fetch(base + path, {
      method,
      signal: AbortSignal.timeout(15000),
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        ...(prefer ? { Prefer: prefer } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const err = new Error(`Supabase ${method} ${path.split('?')[0]}: ${res.status}`);
      err.status = res.status;
      err.code = data?.code;
      throw err;
    }
    return data;
  };
}
