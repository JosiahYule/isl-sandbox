// =====================================================================
// claude.js: one call to the Claude API, the same way for the website and for the tests.
//
// The fixed instructions and the tool list are marked for caching ("cache_control"): the API
// keeps them ready for a few minutes, so every message after the first is cheaper and quicker.
// Any error (including the monthly spend limit) throws, and converse.js answers with the offices.
// =====================================================================

export function claudeCaller({ apiKey, model = "claude-haiku-5-5", signal, maxTokens = 1024, fetchImpl = fetch }) {
  return async ({ system, tools, messages }) => {
    const [fixed, page] = system;
    const res = await fetchImpl("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal,
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: [{ type: "text", text: fixed, cache_control: { type: "ephemeral" } }, { type: "text", text: page }],
        tools: tools.map((t, i) => (i === tools.length - 1 ? { ...t, cache_control: { type: "ephemeral" } } : t)),
        messages,
      }),
    });
    if (!res.ok) throw new Error("Claude API " + res.status);
    return await res.json();
  };
}
