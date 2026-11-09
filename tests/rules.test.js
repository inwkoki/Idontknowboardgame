import test from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../games/secret-rule/rules.js';
import { passRate, signature, PASS_MIN, PASS_MAX } from '../games/secret-rule/sim.js';

test('at least 8 rules for each of levels 1–3', () => {
  for (const level of [1, 2, 3]) {
    assert.ok(RULES.filter((r) => r.level === level).length >= 8, `level ${level}`);
  }
});

test('rule ids are unique and every rule has Thai text', () => {
  assert.equal(new Set(RULES.map((r) => r.id)).size, RULES.length);
  for (const r of RULES) assert.ok(r.th && r.th.length > 0, r.id);
});

test('every rule passes between 20% and 70% of cards', () => {
  for (const r of RULES) {
    const p = passRate(r);
    assert.ok(p >= PASS_MIN && p <= PASS_MAX, `${r.id}: ${(p * 100).toFixed(1)}%`);
  }
});

test('no two single-card rules behave identically on the deck', () => {
  const seen = new Map();
  for (const r of RULES.filter((r) => r.level <= 3)) {
    const sig = signature(r);
    assert.ok(!seen.has(sig), `${r.id} duplicates ${seen.get(sig)}`);
    seen.set(sig, r.id);
  }
});
