// Provider-independent model layer.
// Every provider implements: chatJSON({ system, user }) ->
//   { provider, model, parsed, rawText, usage }
// Swap providers with env only — no agent/workflow code changes:
//   MODEL_PROVIDER=meta              (default) Meta Model API (Muse Wonder/Spark)
//   MODEL_PROVIDER=openai-compatible  any OpenAI-compatible endpoint
//   MODEL_PROVIDER=hermes             a local Hermes agent CLI (one-shot mode);
//                                     Hermes holds the credentials, so no key
//                                     lives in this repo or its .env. Text only.
// Env: MODEL_API_KEY (or META_API_KEY), MODEL_NAME, MODEL_BASE_URL;
//      hermes: HERMES_BIN, HERMES_PROVIDER (default zai), HERMES_TOOLSETS (default web)
import { execFile } from 'node:child_process';
import path from 'node:path';

const HERMES_ARGV_LIMIT = 30_000; // Windows command lines cap near 32k characters

function parseModelJSON(provider, rawText) {
  const cleaned = rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(cleaned); } catch { throw new Error(`${provider}: model did not return valid JSON: ${rawText.slice(0, 400)}`); }
}

export function createProvider(env = process.env, { runCommand = defaultRunCommand } = {}) {
  const provider = (env.MODEL_PROVIDER || 'meta').toLowerCase();
  const apiKey = env.META_API_KEY || env.MODEL_API_KEY || env.OPENAI_API_KEY || '';
  const defaults = {
    meta: { baseUrl: 'https://api.meta.ai/v1', model: 'muse-wonder-1.0' },
    'openai-compatible': { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    hermes: { baseUrl: 'hermes-cli', model: 'glm-5.3' },
  };
  const cfg = defaults[provider];
  if (!cfg) throw new Error(`Unknown MODEL_PROVIDER: ${provider}`);
  const baseUrl = (env.MODEL_BASE_URL || cfg.baseUrl).replace(/\/$/, '');
  const model = env.MODEL_NAME || cfg.model;
  // A hung call must fail the run, not stall it forever (MODEL_TIMEOUT_MS).
  const timeoutMs = Number(env.MODEL_TIMEOUT_MS) || 120_000;

  if (provider === 'hermes') {
    const bin = env.HERMES_BIN || path.join(env.LOCALAPPDATA || '', 'hermes', 'bin', 'hermes.exe');
    const hermesProvider = env.HERMES_PROVIDER || 'zai';
    const toolsets = env.HERMES_TOOLSETS || 'web';
    return {
      provider: `hermes/${hermesProvider}`,
      model,
      baseUrl,
      supportsImages: false,
      async chatJSON({ system, user }) {
        const prompt = `SYSTEM INSTRUCTIONS:\n${system}\nDo not use any tools. Answer only from the material below.\n\nTASK:\n${user}`;
        if (prompt.length > HERMES_ARGV_LIMIT) throw new Error(`hermes: prompt is ${prompt.length} chars, over the ${HERMES_ARGV_LIMIT} command-line limit`);
        const rawText = await runCommand(bin, ['-z', prompt, '--provider', hermesProvider, '-m', model, '-t', toolsets], timeoutMs);
        // Hermes one-shot mode returns only the final text: no response id or token usage.
        return { provider: `hermes/${hermesProvider}`, model, parsed: parseModelJSON('hermes', rawText), rawText, usage: null, id: null };
      },
    };
  }

  if (!apiKey) throw new Error(`No API key: set MODEL_API_KEY (provider=${provider})`);
  // MODEL_IMAGES=off for text-only models: screenshots are then not sent, and
  // run records say so (vision.included=false) instead of claiming vision.
  const supportsImages = String(env.MODEL_IMAGES || 'on').toLowerCase() !== 'off';

  return {
    provider,
    model,
    baseUrl,
    supportsImages,
    async chatJSON({ system, user, images = [] }) {
      if (!supportsImages) images = [];
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
      return { provider, model, parsed: parseModelJSON(provider, rawText), rawText, usage: data.usage ?? null, id: data.id ?? null };
    },
  };
}

function defaultRunCommand(bin, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: timeoutMs, windowsHide: true, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8' }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`hermes failed (${err.code ?? err.signal ?? 'error'}): ${String(stderr || stdout || err.message).trim().slice(-300)}`));
      if (!stdout.trim()) return reject(new Error('hermes returned no output'));
      resolve(stdout);
    });
  });
}
