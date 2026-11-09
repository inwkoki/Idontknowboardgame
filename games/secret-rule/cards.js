import { mulberry32, shuffle } from '../../shared/util.js';

export const ANIMALS = [
  { id: 'elephant', emoji: '🐘', th: 'ช้าง' },
  { id: 'tiger', emoji: '🐯', th: 'เสือ' },
  { id: 'cat', emoji: '🐱', th: 'แมว' },
  { id: 'dog', emoji: '🐶', th: 'หมา' },
  { id: 'rabbit', emoji: '🐰', th: 'กระต่าย' },
  { id: 'monkey', emoji: '🐒', th: 'ลิง' },
  { id: 'fish', emoji: '🐟', th: 'ปลา' },
  { id: 'turtle', emoji: '🐢', th: 'เต่า' },
  { id: 'dolphin', emoji: '🐬', th: 'โลมา' },
  { id: 'octopus', emoji: '🐙', th: 'หมึก' },
  { id: 'crab', emoji: '🦀', th: 'ปู' },
  { id: 'crocodile', emoji: '🐊', th: 'จระเข้' },
  { id: 'bird', emoji: '🐦', th: 'นก' },
  { id: 'owl', emoji: '🦉', th: 'นกฮูก' },
  { id: 'bee', emoji: '🐝', th: 'ผึ้ง' },
  { id: 'butterfly', emoji: '🦋', th: 'ผีเสื้อ' },
  { id: 'bat', emoji: '🦇', th: 'ค้างคาว' },
  { id: 'eagle', emoji: '🦅', th: 'อินทรี' },
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
    c = { id, animal, emoji: a.emoji, nameTh: a.th, color, n: Number(n) };
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
