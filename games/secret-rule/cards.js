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
export const ANIMAL_BY_ID = Object.fromEntries(ANIMALS.map((a) => [a.id, a]));

// Shape marks keep colours distinguishable for colour-blind players.
export const COLORS = {
  red: { th: 'แดง', mark: '●' },
  yellow: { th: 'เหลือง', mark: '▲' },
  green: { th: 'เขียว', mark: '■' },
  blue: { th: 'ฟ้า', mark: '◆' },
};

/** Deck options chosen in the lobby. */
export const ANIMAL_SETS = {
  all: { th: 'สัตว์ 18 ตัว', ids: ANIMALS.map((a) => a.id) },
  four: { th: 'สัตว์ 4 ตัว (ง่าย)', ids: ['elephant', 'cat', 'fish', 'bird'] },
};
export const NUMBER_RANGES = {
  9: { th: 'เลข 1–9' },
  6: { th: 'เลข 1–6 (ง่าย)' },
};
export const DEFAULT_DECK = { animals: 'all', maxN: 9 };

export const DECK_SEED = 20261109;
const TARGET_SIZE = 72;

/**
 * Card ids describe the card ("elephant.red.7.0" = animal.color.number.copy), so any screen can
 * draw any card without knowing which deck options the host picked.
 */
export function cardId(animal, color, n, copy) {
  return `${animal}.${color}.${n}.${copy}`;
}

const cache = new Map();
export function getCard(id) {
  let c = cache.get(id);
  if (!c) {
    const [animal, color, n] = id.split('.');
    const a = ANIMAL_BY_ID[animal];
    if (!a || !COLORS[color]) throw new Error(`bad card id ${id}`);
    c = { id, animal, emoji: a.emoji, nameTh: a.th, habitat: a.habitat, color, n: Number(n) };
    cache.set(id, c);
  }
  return c;
}

/**
 * Same deck for the same options, every game.
 * Every animal × colour pair appears equally often (≈72 cards total), numbers 1..maxN spread evenly.
 */
export function buildDeck(opts = DEFAULT_DECK) {
  const { animals = 'all', maxN = 9 } = opts;
  const ids = ANIMAL_SETS[animals].ids;
  const colors = Object.keys(COLORS);
  const pairs = ids.length * colors.length;
  const copies = Math.max(1, Math.round(TARGET_SIZE / pairs));
  const size = pairs * copies;
  const numbers = shuffle(
    Array.from({ length: size }, (_, i) => (i % maxN) + 1),
    mulberry32(DECK_SEED + maxN * 100 + ids.length),
  );
  const cards = [];
  let i = 0;
  for (let copy = 0; copy < copies; copy++) {
    for (const animal of ids) {
      for (const color of colors) {
        cards.push(getCard(cardId(animal, color, numbers[i++], copy)));
      }
    }
  }
  return cards;
}

export function deckLabel(opts = DEFAULT_DECK) {
  return `${ANIMAL_SETS[opts.animals].th} · ${NUMBER_RANGES[opts.maxN].th}`;
}
