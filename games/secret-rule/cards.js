import { mulberry32, shuffle } from '../../shared/util.js';

export const HABITATS = {
  land: { th: 'บก' },
  water: { th: 'น้ำ' },
  sky: { th: 'ฟ้า' },
};

export const ANIMALS = [
  { id: 'elephant', emoji: '🐘', th: 'ช้าง', habitat: 'land' },
  { id: 'tiger', emoji: '🐯', th: 'เสือ', habitat: 'land' },
  { id: 'cat', emoji: '🐱', th: 'แมว', habitat: 'land' },
  { id: 'dog', emoji: '🐶', th: 'หมา', habitat: 'land' },
  { id: 'rabbit', emoji: '🐰', th: 'กระต่าย', habitat: 'land' },
  { id: 'monkey', emoji: '🐒', th: 'ลิง', habitat: 'land' },
  { id: 'fish', emoji: '🐟', th: 'ปลา', habitat: 'water' },
  { id: 'turtle', emoji: '🐢', th: 'เต่า', habitat: 'water' },
  { id: 'dolphin', emoji: '🐬', th: 'โลมา', habitat: 'water' },
  { id: 'octopus', emoji: '🐙', th: 'หมึก', habitat: 'water' },
  { id: 'crab', emoji: '🦀', th: 'ปู', habitat: 'water' },
  { id: 'crocodile', emoji: '🐊', th: 'จระเข้', habitat: 'water' },
  { id: 'bird', emoji: '🐦', th: 'นก', habitat: 'sky' },
  { id: 'owl', emoji: '🦉', th: 'นกฮูก', habitat: 'sky' },
  { id: 'bee', emoji: '🐝', th: 'ผึ้ง', habitat: 'sky' },
  { id: 'butterfly', emoji: '🦋', th: 'ผีเสื้อ', habitat: 'sky' },
  { id: 'bat', emoji: '🦇', th: 'ค้างคาว', habitat: 'sky' },
  { id: 'eagle', emoji: '🦅', th: 'อินทรี', habitat: 'sky' },
];

// Shape marks keep colours distinguishable for colour-blind players.
export const COLORS = {
  red: { th: 'แดง', mark: '●' },
  yellow: { th: 'เหลือง', mark: '▲' },
  green: { th: 'เขียว', mark: '■' },
  blue: { th: 'ฟ้า', mark: '◆' },
};

export const DECK_SEED = 20261109;

/** The same 72 cards every game: 18 animals × 4 colours, numbers 1–9 eight times each. */
export function buildDeck() {
  const numbers = shuffle(
    Array.from({ length: 72 }, (_, i) => (i % 9) + 1),
    mulberry32(DECK_SEED),
  );
  const cards = [];
  let i = 0;
  for (const a of ANIMALS) {
    for (const color of Object.keys(COLORS)) {
      cards.push({
        id: `c${i}`,
        animal: a.id,
        emoji: a.emoji,
        nameTh: a.th,
        habitat: a.habitat,
        color,
        n: numbers[i],
      });
      i++;
    }
  }
  return cards;
}

export const CARDS = buildDeck();
export const CARD_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));
