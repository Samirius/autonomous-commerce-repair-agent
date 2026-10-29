// Provider-independent model layer.
// Every provider implements: chatJSON({ system, user }) ->
//   { provider, model, parsed, rawText, usage }
// Swap providers with env only — no agent/workflow code changes:
//   MODEL_PROVIDER=meta              (default) Meta Model API (Muse Wonder/Spark)
//   MODEL_PROVIDER=openai-compatible  any OpenAI-compatible endpoint
// Env: MODEL_API_KEY (or META_API_KEY), MODEL_NAME, MODEL_BASE_URL
export function createProvider(env = process.env) {
  const provider = (env.MODEL_PROVIDER || 'meta').toLowerCase();
  const apiKey = env.META_API_KEY || env.MODEL_API_KEY || env.OPENAI_API_KEY || '';
  const defaults = {
    meta: { baseUrl: 'https://api.meta.ai/v1', model: 'muse-wonder-1.0' },
    'openai-compatible': { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  };
  const cfg = defaults[provider];
  if (!cfg) throw new Error(`Unknown MODEL_PROVIDER: ${provider}`);
  const baseUrl = (env.MODEL_BASE_URL || cfg.baseUrl).replace(/\/$/, '');
  const model = env.MODEL_NAME || cfg.model;
  if (!apiKey) throw new Error(`No API key: set MODEL_API_KEY (provider=${provider})`);
  // A hung call must fail the run, not stall it forever (MODEL_TIMEOUT_MS).
  const timeoutMs = Number(env.MODEL_TIMEOUT_MS) || 120_000;

  return {
    provider,
    model,
    baseUrl,
    async chatJSON({ system, user, images = [] }) {
      const userContent = images.length
        ? [{ type: 'text', text: user }, ...images.map((url) => ({ type: 'image_url', image_url: { url } }))]
        : user;
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature: 0,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: userContent },
          ],
        }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`${provider} API HTTP ${res.status}: ${text.slice(0, 400)}`);
      const data = JSON.parse(text);
      const rawText = data.choices?.[0]?.message?.content ?? '';
      const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      let parsed;
      try { parsed = JSON.parse(cleaned); } catch { throw new Error(`Model did not return valid JSON: ${rawText.slice(0, 400)}`); }
      return { provider, model, parsed, rawText, usage: data.usage ?? null, id: data.id ?? null };
    },
  };
}
