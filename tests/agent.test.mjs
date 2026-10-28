import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateRepair, applyAndVerify } from '../src/agent.mjs';

const css = '.a { bottom: 16px; }\n.b { color: red; }\n';

test('validateRepair accepts a single exact-once CSS replacement', () => {
  assert.equal(validateRepair({ file: 'styles.css', old: 'bottom: 16px;', new: 'bottom: 96px;' }, css), null);
});
test('validateRepair rejects edits outside styles.css', () => {
  assert.match(validateRepair({ file: 'index.html', old: 'a', new: 'b' }, css), /styles\.css/);
});
test('validateRepair rejects old text that does not occur exactly once', () => {
  assert.match(validateRepair({ file: 'styles.css', old: 'missing', new: 'x' }, css), /exactly once/);
});

test('a repair that still fails verification is rolled back', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'acra-'));
  const root = path.join(dir, 'storefront');
  await cp(path.resolve('storefront'), root, { recursive: true });
  const before = await readFile(path.join(root, 'styles.css'), 'utf8');
  // bottom:8px keeps the CTA under the 84px promo — deterministic check must fail
  const outcome = await applyAndVerify({ root, repair: { file: 'styles.css', old: 'bottom: 16px;', new: 'bottom: 8px;' } });
  assert.equal(outcome.status, 'rolled-back');
  assert.equal(outcome.after.pass, false);
  assert.equal(await readFile(path.join(root, 'styles.css'), 'utf8'), before);
});
