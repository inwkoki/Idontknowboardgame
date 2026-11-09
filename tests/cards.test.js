import test from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, buildDeck, ANIMALS } from '../games/secret-rule/cards.js';

test('deck has 72 unique cards', () => {
  assert.equal(CARDS.length, 72);
  assert.equal(new Set(CARDS.map((c) => c.id)).size, 72);
});

test('each number 1–9 appears exactly 8 times', () => {
  for (let n = 1; n <= 9; n++) {
    assert.equal(CARDS.filter((c) => c.n === n).length, 8, `number ${n}`);
  }
});

test('18 animals × 4 colours, 6 animals per habitat', () => {
  assert.equal(ANIMALS.length, 18);
  for (const h of ['land', 'water', 'sky']) {
    assert.equal(ANIMALS.filter((a) => a.habitat === h).length, 6);
  }
  for (const color of ['red', 'yellow', 'green', 'blue']) {
    assert.equal(CARDS.filter((c) => c.color === color).length, 18);
  }
});

test('deck is identical every build', () => {
  assert.deepEqual(buildDeck(), buildDeck());
});
