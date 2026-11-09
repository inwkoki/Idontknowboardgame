import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDeck, getCard, ANIMALS, ANIMAL_SETS } from '../games/secret-rule/cards.js';
import { deckOptions } from '../games/secret-rule/sim.js';

test('default deck: 72 unique cards, each number 1–9 eight times', () => {
  const deck = buildDeck();
  assert.equal(deck.length, 72);
  assert.equal(new Set(deck.map((c) => c.id)).size, 72);
  for (let n = 1; n <= 9; n++) assert.equal(deck.filter((c) => c.n === n).length, 8, `number ${n}`);
});

test('18 animals × 4 colours, 6 animals per habitat', () => {
  assert.equal(ANIMALS.length, 18);
  for (const h of ['land', 'water', 'sky']) assert.equal(ANIMALS.filter((a) => a.habitat === h).length, 6);
  const deck = buildDeck();
  for (const color of ['red', 'yellow', 'green', 'blue']) assert.equal(deck.filter((c) => c.color === color).length, 18);
});

test('every deck option: unique ids, only chosen animals, numbers in range, balanced', () => {
  for (const opts of deckOptions()) {
    const deck = buildDeck(opts);
    assert.ok(deck.length >= 64 && deck.length <= 80, `${JSON.stringify(opts)} size ${deck.length}`);
    assert.equal(new Set(deck.map((c) => c.id)).size, deck.length);
    const allowed = new Set(ANIMAL_SETS[opts.animals].ids);
    for (const c of deck) {
      assert.ok(allowed.has(c.animal));
      assert.ok(c.n >= 1 && c.n <= opts.maxN);
    }
    const counts = Array.from({ length: opts.maxN }, (_, i) => deck.filter((c) => c.n === i + 1).length);
    assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, `${JSON.stringify(opts)} ${counts}`);
  }
});

test('4-animal deck has 80 cards (each animal × colour 5 times)', () => {
  assert.equal(buildDeck({ animals: 'four', maxN: 6 }).length, 80);
});

test('deck is identical every build', () => {
  assert.deepEqual(buildDeck({ animals: 'four', maxN: 6 }), buildDeck({ animals: 'four', maxN: 6 }));
});

test('card ids describe the card', () => {
  const c = getCard('elephant.red.7.0');
  assert.equal(c.emoji, '🐘');
  assert.equal(c.habitat, 'land');
  assert.equal(c.color, 'red');
  assert.equal(c.n, 7);
});
