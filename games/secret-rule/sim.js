// Which rules are playable with each deck option. Run: node games/secret-rule/sim.js
import { buildDeck, ANIMAL_SETS, NUMBER_RANGES } from './cards.js';
import { RULES, rulesFor, passRate, makeContext, ruleText } from './rules.js';

export function deckOptions() {
  const out = [];
  for (const animals of Object.keys(ANIMAL_SETS)) {
    for (const maxN of Object.keys(NUMBER_RANGES).map(Number)) out.push({ animals, maxN });
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ctx = makeContext(new Date(), 4);
  for (const opts of deckOptions()) {
    const deck = buildDeck(opts);
    console.log(`\n== ${opts.animals} animals, 1–${opts.maxN} (${deck.length} cards) ==`);
    for (const level of [1, 2, 3, 'trick']) {
      const ok = new Set(rulesFor({ level, deck, ctx }).map((r) => r.id));
      for (const r of RULES.filter((r) => String(r.level) === String(level))) {
        const p = passRate(r, deck, ctx);
        console.log(`${ok.has(r.id) ? '  ✓' : '  ·'} L${String(level).padEnd(5)} ${(p * 100).toFixed(0).padStart(3)}%  ${ruleText(r, ctx)}`);
      }
    }
  }
}
