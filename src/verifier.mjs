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
  const timeoutMs = Number(env.MODEL_TIMEOUT_MS) || 120_000;
  return {
    available: true, provider: 'baseten', model, baseUrl,
    async review({ repair, evidenceBefore, evidenceAfter }) {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        signal: AbortSignal.timeout(timeoutMs),
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

// Separate, explicit review statuses. Deterministic browser tests are the
// only pass/fail authority; the open-weight review is advisory and can flag
// human review, never overrule tests and never modify code.
export function classifyReview({ deterministicPass, openWeight = null, evidenceAfter = null }) {
  let owStatus = 'unavailable';
  let owVerdict = openWeight?.parsed?.verdict || null;
  if (openWeight && !openWeight.error && owVerdict) {
    if (owVerdict === 'approve') {
      // Missing post-repair evidence must never silently become an approval.
      owStatus = evidenceAfter && Object.keys(evidenceAfter).length ? 'approved' : 'concern';
      if (owStatus === 'concern') owVerdict = 'concern (approval downgraded: no post-repair evidence)';
    } else if (owVerdict === 'concern') owStatus = 'concern';
    else if (owVerdict === 'reject') owStatus = 'rejected';
    else owStatus = 'concern';
  }
  const humanReviewRequired = owStatus === 'concern' || owStatus === 'rejected';
  return {
    deterministic: deterministicPass ? 'passed' : 'failed',
    openWeight: owStatus,
    openWeightVerdict: owVerdict,
    humanReviewRequired,
    action: humanReviewRequired ? 'run one bounded additional deterministic verification, then flag for human review' : (owStatus === 'approved' ? 'none' : 'none (review unavailable)'),
  };
}

if (process.argv[1]?.endsWith('verifier.mjs')) {
  const v = createVerifier();
  console.log(JSON.stringify(v.available ? { available: true, provider: v.provider, model: v.model, baseUrl: v.baseUrl } : v, null, 2));
}
