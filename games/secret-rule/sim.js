// Rule difficulty check. Run: node games/secret-rule/sim.js
// Single-card rules: share of the deck that passes. Sequence rules: average pass chance
// of a random card after a random valid line.

import { CARDS } from './cards.js';
import { RULES } from './rules.js';
import { mulberry32, shuffle } from '../../shared/util.js';

export const PASS_MIN = 0.2;
export const PASS_MAX = 0.7;

export function passRate(rule, trials = 1000, seed = 1) {
  if (rule.level <= 3) {
    return CARDS.filter((c) => rule.test(c, null, [])).length / CARDS.length;
  }
  const rng = mulberry32(seed);
  let pass = 0;
  for (let t = 0; t < trials; t++) {
    const deck = shuffle(CARDS, rng);
    const line = [];
    for (const c of deck) {
      if (line.length >= 1 + Math.floor(rng() * 6)) break;
      if (rule.test(c, line.at(-1) ?? null, line)) line.push(c);
    }
    const probe = deck[Math.floor(rng() * deck.length)];
    if (rule.test(probe, line.at(-1) ?? null, line)) pass++;
  }
  return pass / trials;
}

/** Signature over the deck — two rules with the same signature behave the same. */
export function signature(rule) {
  return CARDS.map((c) => (rule.test(c, null, []) ? '1' : '0')).join('');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const r of RULES) {
    const p = passRate(r);
    const flag = p < PASS_MIN || p > PASS_MAX ? '  <-- out of range' : '';
    console.log(`L${r.level}  ${(p * 100).toFixed(0).padStart(3)}%  ${r.id.padEnd(16)} ${r.th}${flag}`);
  }
}
