// Secret rules. test(card, prev, line) → boolean
//   card: the card being judged
//   prev: last card already in the line (null when the line is empty)
//   line: all cards already in the line, oldest first
// Sequence rules (level 4–5) must return true when prev is null.

const odd = (c) => c.n % 2 === 1;
const even = (c) => c.n % 2 === 0;

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

  // Level 2 — or / not / range
  { id: 'red-or-blue', level: 2, th: 'สีแดงหรือสีฟ้า', test: (c) => c.color === 'red' || c.color === 'blue' },
  { id: 'yellow-or-green', level: 2, th: 'สีเหลืองหรือสีเขียว', test: (c) => c.color === 'yellow' || c.color === 'green' },
  { id: 'not-water', level: 2, th: 'ไม่ใช่สัตว์น้ำ', test: (c) => c.habitat !== 'water' },
  { id: 'not-land', level: 2, th: 'ไม่ใช่สัตว์บก', test: (c) => c.habitat !== 'land' },
  { id: 'high', level: 2, th: 'เลข 5 ขึ้นไป', test: (c) => c.n >= 5 },
  { id: 'mid', level: 2, th: 'เลข 3–6', test: (c) => c.n >= 3 && c.n <= 6 },
  { id: 'not-5-7', level: 2, th: 'เลขไม่ใช่ 5, 6, 7', test: (c) => c.n < 5 || c.n > 7 },
  { id: 'edges', level: 2, th: 'เลข 1–3 หรือ 8–9', test: (c) => c.n <= 3 || c.n >= 8 },

  // Level 3 — two conditions
  { id: 'notwater-odd', level: 3, th: 'ไม่ใช่สัตว์น้ำ และเป็นเลขคี่', test: (c) => c.habitat !== 'water' && odd(c) },
  { id: 'sky-or-red', level: 3, th: 'สัตว์ฟ้า หรือสีแดง', test: (c) => c.habitat === 'sky' || c.color === 'red' },
  { id: 'water-or-even', level: 3, th: 'สัตว์น้ำ หรือเลขคู่', test: (c) => c.habitat === 'water' || even(c) },
  { id: 'odd-not-red', level: 3, th: 'เลขคี่ ที่ไม่ใช่สีแดง', test: (c) => odd(c) && c.color !== 'red' },
  { id: 'land-or-blue', level: 3, th: 'สัตว์บก หรือสีฟ้า', test: (c) => c.habitat === 'land' || c.color === 'blue' },
  { id: 'even-not-sky', level: 3, th: 'เลขคู่ ที่ไม่ใช่สัตว์ฟ้า', test: (c) => even(c) && c.habitat !== 'sky' },
  { id: 'high-not-green', level: 3, th: 'เลข 6 ขึ้นไป ที่ไม่ใช่สีเขียว', test: (c) => c.n >= 6 && c.color !== 'green' },
  { id: 'warm-low', level: 3, th: 'สีแดงหรือเหลือง ที่เลขไม่เกิน 5', test: (c) => (c.color === 'red' || c.color === 'yellow') && c.n <= 5 },
];

export const RULE_BY_ID = Object.fromEntries(RULES.map((r) => [r.id, r]));

export function rulesForLevel(level) {
  if (level === 'random' || level == null) return RULES;
  return RULES.filter((r) => r.level === Number(level));
}

/** Does the whole ordered list of cards pass, starting after `line`? */
export function judgeSequence(rule, line, cards) {
  const seq = line.slice();
  for (const c of cards) {
    const prev = seq.length ? seq[seq.length - 1] : null;
    if (!rule.test(c, prev, seq)) return false;
    seq.push(c);
  }
  return true;
}
