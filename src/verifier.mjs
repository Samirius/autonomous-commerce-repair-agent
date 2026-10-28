// Independent open-weight verifier adapter (Muse Spark Open via Baseten).
// Provider-independent interface: createVerifier(env) ->
//   { available, reason?, review({repair, evidenceBefore, evidenceAfter}) }
// The verifier only reviews; deterministic browser checks remain the final
// authority. With no BASETEN_API_KEY it reports unavailable — it never
// fabricates a response.
export function createVerifier(env = process.env) {
  const apiKey = env.BASETEN_API_KEY || '';
  const baseUrl = (env.BASETEN_BASE_URL || 'https://inference.baseten.co/v1').replace(/\/$/, '');
  const model = env.VERIFIER_MODEL || 'meta-models/muse-spark-open';
  if (!apiKey) return { available: false, provider: 'baseten', model, baseUrl, reason: 'BASETEN_API_KEY not set' };
  return {
    available: true, provider: 'baseten', model, baseUrl,
    async review({ repair, evidenceBefore, evidenceAfter }) {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model, temperature: 0,
          messages: [
            { role: 'system', content: 'You independently review an autonomous storefront repair. Reply with ONLY JSON: {"verdict":"approve|concern|reject","rationale":"..."}' },
            { role: 'user', content: JSON.stringify({ repair, evidenceBefore, evidenceAfter }) },
          ],
        }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`Baseten HTTP ${res.status}: ${text.slice(0, 300)}`);
      const data = JSON.parse(text);
      const rawText = data.choices?.[0]?.message?.content ?? '';
      let parsed = null;
      try { parsed = JSON.parse(rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); } catch { /* keep raw */ }
      return { provider: 'baseten', model, id: data.id ?? null, usage: data.usage ?? null, parsed, rawText };
    },
  };
}

if (process.argv[1]?.endsWith('verifier.mjs')) {
  const v = createVerifier();
  console.log(JSON.stringify(v.available ? { available: true, provider: v.provider, model: v.model, baseUrl: v.baseUrl } : v, null, 2));
}
