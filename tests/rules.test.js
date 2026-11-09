import test from 'node:test';
import assert from 'node:assert/strict';
import { RULES, rulesFor, passRate, makeContext, ruleText, PASS_MIN, PASS_MAX } from '../games/secret-rule/rules.js';
import { buildDeck } from '../games/secret-rule/cards.js';
import { deckOptions } from '../games/secret-rule/sim.js';

const CTX = { year: 2026, month: 11, day: 9, players: 4 };

test('rule ids are unique and every rule has Thai text', () => {
  assert.equal(new Set(RULES.map((r) => r.id)).size, RULES.length);
  for (const r of RULES) assert.ok(ruleText(r, CTX).length > 0, r.id);
});

test('every deck option has at least 5 playable rules per level', () => {
  for (const opts of deckOptions()) {
    const deck = buildDeck(opts);
    for (const level of [1, 2, 3]) {
      const n = rulesFor({ level, deck, ctx: CTX }).length;
      assert.ok(n >= 5, `${JSON.stringify(opts)} level ${level}: ${n}`);
    }
    assert.ok(rulesFor({ level: 'trick', deck, ctx: CTX }).length >= 2, `${JSON.stringify(opts)} trick`);
  }
});

test('playable rules pass 20–70% of the deck and never duplicate each other', () => {
  for (const opts of deckOptions()) {
    const deck = buildDeck(opts);
    const rules = rulesFor({ level: 'random', deck, ctx: CTX });
    const sigs = new Set();
    for (const r of rules) {
      const p = passRate(r, deck, CTX);
      assert.ok(p >= PASS_MIN && p <= PASS_MAX, `${r.id} ${p}`);
      const sig = deck.map((c) => (r.test(c, null, [], CTX) ? 1 : 0)).join('');
      assert.ok(!sigs.has(sig), `${r.id} duplicates another rule`);
      sigs.add(sig);
    }
  }
});

test('the default deck still has 8 rules on levels 1–3 like before', () => {
  const deck = buildDeck();
  for (const level of [1, 2, 3]) assert.ok(rulesFor({ level, deck, ctx: CTX }).length >= 8, `level ${level}`);
});

test('trick rules read the context', () => {
  const y = RULES.find((r) => r.id === 'ce-year-digits');
  assert.match(ruleText(y, CTX), /2026/);
  assert.equal(y.test({ n: 6 }, null, [], CTX), true);
  assert.equal(y.test({ n: 5 }, null, [], CTX), false);
  const be = RULES.find((r) => r.id === 'be-year-digits');
  assert.match(ruleText(be, CTX), /2569/);
  assert.equal(be.test({ n: 9 }, null, [], CTX), true);
  const lp = RULES.find((r) => r.id === 'le-players');
  assert.equal(lp.test({ n: 4 }, null, [], CTX), true);
  assert.equal(lp.test({ n: 5 }, null, [], CTX), false);
  const dp = RULES.find((r) => r.id === 'day-parity');
  assert.equal(dp.test({ n: 3 }, null, [], CTX), true); // day 9 is odd
});

test('makeContext uses the given date', () => {
  assert.deepEqual(makeContext(new Date(2026, 10, 9), 5), { year: 2026, month: 11, day: 9, players: 5 });
});
