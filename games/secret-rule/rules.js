// Secret rules. test(card, prev, line, ctx) → boolean
//   card: the card being judged
//   prev: last card already in the line (null when the line is empty)
//   line: all cards already in the line, oldest first
//   ctx:  facts fixed when the game starts — { year, day, players } (see makeContext)
// th: Thai text shown when the rule is revealed; a function of ctx for the 'trick' rules.
//
// Not every rule suits every deck (e.g. "6 ขึ้นไป" with numbers 1–6). rulesFor() keeps only rules
// that 20–70% of the chosen deck passes and drops rules that behave identically on that deck.
// minN: the rule's wording mentions numbers up to this, so skip it on smaller number ranges.

import { buildDeck } from './cards.js';

const odd = (c) => c.n % 2 === 1;
const even = (c) => c.n % 2 === 0;
const digits = (n) => [...new Set(String(n).split('').map(Number))].filter((d) => d > 0).sort((a, b) => a - b);
const joinTh = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} หรือ ${xs.at(-1)}` : String(xs[0]));

export const LEVELS = {
  1: 'ระดับ 1 — ง่าย',
  2: 'ระดับ 2',
  3: 'ระดับ 3 — ยาก',
  trick: 'พิเศษ — กฎจากปี วันที่ คนเล่น',
  random: 'สุ่มทุกแบบ',
};

export const RULES = [
  // Level 1 — one attribute
  { id: 'red', level: 1, th: 'สีแดงเท่านั้น', test: (c) => c.color === 'red' },
  { id: 'blue', level: 1, th: 'สีฟ้าเท่านั้น', test: (c) => c.color === 'blue' },
  { id: 'odd', level: 1, th: 'เลขคี่เท่านั้น', test: odd },
  { id: 'even', level: 1, th: 'เลขคู่เท่านั้น', test: even },
  { id: 'land', level: 1, th: 'สัตว์บกเท่านั้น', test: (c) => c.habitat === 'land' },
  { id: 'water', level: 1, th: 'สัตว์น้ำเท่านั้น', test: (c) => c.habitat === 'water' },
  { id: 'sky', level: 1, th: 'สัตว์ฟ้า (บินได้) เท่านั้น', test: (c) => c.habitat === 'sky' },
  { id: 'low', level: 1, th: 'เลข 1–4 เท่านั้น', test: (c) => c.n <= 4 },
  { id: 'le3', level: 1, th: 'เลข 1–3 เท่านั้น', test: (c) => c.n <= 3 },
  { id: 'only-elephant', level: 1, th: 'ช้างเท่านั้น', test: (c) => c.animal === 'elephant' },
  { id: 'only-fish', level: 1, th: 'ปลาเท่านั้น', test: (c) => c.animal === 'fish' },

  // Level 2 — or / not / range
  { id: 'red-or-blue', level: 2, th: 'สีแดงหรือสีฟ้า', test: (c) => c.color === 'red' || c.color === 'blue' },
  { id: 'yellow-or-green', level: 2, th: 'สีเหลืองหรือสีเขียว', test: (c) => c.color === 'yellow' || c.color === 'green' },
  { id: 'not-water', level: 2, th: 'ไม่ใช่สัตว์น้ำ', test: (c) => c.habitat !== 'water' },
  { id: 'not-land', level: 2, th: 'ไม่ใช่สัตว์บก', test: (c) => c.habitat !== 'land' },
  { id: 'high', level: 2, th: 'เลข 5 ขึ้นไป', test: (c) => c.n >= 5 },
  { id: 'mid', level: 2, th: 'เลข 3–6', test: (c) => c.n >= 3 && c.n <= 6 },
  { id: 'not-5-7', level: 2, minN: 8, th: 'เลขไม่ใช่ 5, 6, 7', test: (c) => c.n < 5 || c.n > 7 },
  { id: 'edges', level: 2, minN: 8, th: 'เลข 1–3 หรือ 8–9', test: (c) => c.n <= 3 || c.n >= 8 },
  { id: 'ends-1-6', level: 2, th: 'เลข 1, 2, 5 หรือ 6', test: (c) => c.n <= 2 || c.n === 5 || c.n === 6 },
  { id: 'elephant-or-bird', level: 2, th: 'ช้างหรือนก', test: (c) => c.animal === 'elephant' || c.animal === 'bird' },
  { id: 'cat-or-fish', level: 2, th: 'แมวหรือปลา', test: (c) => c.animal === 'cat' || c.animal === 'fish' },

  // Level 3 — two conditions
  { id: 'notwater-odd', level: 3, th: 'ไม่ใช่สัตว์น้ำ และเป็นเลขคี่', test: (c) => c.habitat !== 'water' && odd(c) },
  { id: 'sky-or-red', level: 3, th: 'สัตว์ฟ้า หรือสีแดง', test: (c) => c.habitat === 'sky' || c.color === 'red' },
  { id: 'water-or-even', level: 3, th: 'สัตว์น้ำ หรือเลขคู่', test: (c) => c.habitat === 'water' || even(c) },
  { id: 'odd-not-red', level: 3, th: 'เลขคี่ ที่ไม่ใช่สีแดง', test: (c) => odd(c) && c.color !== 'red' },
  { id: 'land-or-blue', level: 3, th: 'สัตว์บก หรือสีฟ้า', test: (c) => c.habitat === 'land' || c.color === 'blue' },
  { id: 'even-not-sky', level: 3, th: 'เลขคู่ ที่ไม่ใช่สัตว์ฟ้า', test: (c) => even(c) && c.habitat !== 'sky' },
  { id: 'high-not-green', level: 3, minN: 8, th: 'เลข 6 ขึ้นไป ที่ไม่ใช่สีเขียว', test: (c) => c.n >= 6 && c.color !== 'green' },
  { id: 'warm-low', level: 3, th: 'สีแดงหรือเหลือง ที่เลขไม่เกิน 5', test: (c) => (c.color === 'red' || c.color === 'yellow') && c.n <= 5 },
  { id: 'fish-or-red', level: 3, th: 'ปลา หรือสีแดง', test: (c) => c.animal === 'fish' || c.color === 'red' },
  { id: 'land-odd-or-blue', level: 3, th: 'สัตว์บกเลขคี่ หรือสีฟ้า', test: (c) => (c.habitat === 'land' && odd(c)) || c.color === 'blue' },

  // Trick — depends on today's date or the table. ctx is fixed when the game starts.
  {
    id: 'ce-year-digits',
    level: 'trick',
    th: (x) => `เลขที่อยู่ในปี ค.ศ. ${x.year} (คือ ${joinTh(digits(x.year))})`,
    test: (c, p, l, x) => digits(x.year).includes(c.n),
  },
  {
    id: 'be-year-digits',
    level: 'trick',
    th: (x) => `เลขที่อยู่ในปี พ.ศ. ${x.year + 543} (คือ ${joinTh(digits(x.year + 543))})`,
    test: (c, p, l, x) => digits(x.year + 543).includes(c.n),
  },
  {
    id: 'le-players',
    level: 'trick',
    th: (x) => `เลขไม่เกินจำนวนคนเล่น (วันนี้เล่น ${x.players} คน)`,
    test: (c, p, l, x) => c.n <= x.players,
  },
  {
    id: 'day-parity',
    level: 'trick',
    th: (x) => `เลข${x.day % 2 ? 'คี่' : 'คู่'} เหมือนวันที่วันนี้ (วันที่ ${x.day})`,
    test: (c, p, l, x) => c.n % 2 === x.day % 2,
  },
  {
    id: 'day-digits',
    level: 'trick',
    th: (x) => `เลขที่อยู่ในวันที่และเดือนวันนี้ (${x.day}/${x.month} → ${joinTh(digits(`${x.day}${x.month}`))})`,
    test: (c, p, l, x) => digits(`${x.day}${x.month}`).includes(c.n),
  },
];

export const RULE_BY_ID = Object.fromEntries(RULES.map((r) => [r.id, r]));

/** Facts that trick rules may use. Built by the host when a game starts. */
export function makeContext(date = new Date(), players = 4) {
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(), players };
}

export function ruleText(rule, ctx) {
  return typeof rule.th === 'function' ? rule.th(ctx) : rule.th;
}

export const PASS_MIN = 0.2;
export const PASS_MAX = 0.7;

/** Share of a deck that passes a single-card rule. */
export function passRate(rule, deck, ctx) {
  return deck.filter((c) => rule.test(c, null, [], ctx)).length / deck.length;
}

/** Rules that fit this deck, level and context. Order is stable; behavioural duplicates removed. */
export function rulesFor({ level = 1, deck = buildDeck(), ctx = makeContext() } = {}) {
  const pool =
    level === 'random' ? RULES : RULES.filter((r) => String(r.level) === String(level));
  const seen = new Set();
  const out = [];
  const maxN = Math.max(...deck.map((c) => c.n));
  for (const r of pool) {
    if (r.minN && maxN < r.minN) continue; // its wording mentions numbers this deck doesn't have
    const p = passRate(r, deck, ctx);
    if (p < PASS_MIN || p > PASS_MAX) continue;
    const sig = deck.map((c) => (r.test(c, null, [], ctx) ? 1 : 0)).join('');
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(r);
  }
  return out;
}

/** Does the whole ordered list of cards pass, starting after `line`? */
export function judgeSequence(rule, line, cards, ctx) {
  const seq = line.slice();
  for (const c of cards) {
    const prev = seq.length ? seq[seq.length - 1] : null;
    if (!rule.test(c, prev, seq, ctx)) return false;
    seq.push(c);
  }
  return true;
}
