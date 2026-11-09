import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, applyAction, publicState, handOf, giveUp } from '../games/secret-rule/engine.js';
import { CARD_BY_ID } from '../games/secret-rule/cards.js';
import { RULE_BY_ID } from '../games/secret-rule/rules.js';

const PLAYERS = [
  { id: 'a', name: 'A' },
  { id: 'b', name: 'B' },
  { id: 'c', name: 'C' },
  { id: 'd', name: 'D' },
];

const newGame = (ruleId = 'red', seed = 42) => createGame({ players: PLAYERS, seed, ruleId });
const fits = (state, id) => RULE_BY_ID[state.secretRuleId].test(CARD_BY_ID[id], null, []);

test('setup deals 7 each and starts the line with a fitting card', () => {
  const s = newGame();
  assert.equal(s.players.length, 4);
  for (const p of s.players) assert.equal(p.hand.length, 7);
  assert.equal(s.line.length, 1);
  assert.ok(fits(s, s.line[0]));
  assert.equal(s.deck.length, 72 - 28 - 1);
  assert.equal(s.phase, 'turn');
});

test('same seed gives the same game', () => {
  assert.deepEqual(newGame('odd', 7), newGame('odd', 7));
});

test('a fitting card joins the line and the turn passes', () => {
  // Find a seed where player A holds a red card.
  let s, id;
  for (let seed = 1; seed < 200; seed++) {
    s = newGame('red', seed);
    id = handOf(s, 'a').find((x) => fits(s, x));
    if (id) break;
  }
  const { state, events } = applyAction(s, { type: 'play', playerId: 'a', cardIds: [id] });
  assert.equal(state.line.at(-1), id);
  assert.equal(handOf(state, 'a').length, 6);
  assert.equal(state.turn, 1);
  assert.equal(events[0].ok, true);
});

test('a wrong card goes back to the hand and is recorded under the line end', () => {
  let s, id;
  for (let seed = 1; seed < 200; seed++) {
    s = newGame('red', seed);
    id = handOf(s, 'a').find((x) => !fits(s, x));
    if (id) break;
  }
  const { state, events } = applyAction(s, { type: 'play', playerId: 'a', cardIds: [id] });
  assert.equal(state.line.length, 1);
  assert.equal(handOf(state, 'a').length, 7);
  assert.deepEqual(state.rejects[0], [[id]]);
  assert.equal(events[0].ok, false);
  assert.equal(state.turn, 1);
});

test('several cards must all fit, otherwise all return', () => {
  let s, good, bad;
  for (let seed = 1; seed < 500; seed++) {
    s = newGame('red', seed);
    good = handOf(s, 'a').find((x) => fits(s, x));
    bad = handOf(s, 'a').find((x) => !fits(s, x));
    if (good && bad) break;
  }
  const { state } = applyAction(s, { type: 'play', playerId: 'a', cardIds: [good, bad] });
  assert.equal(state.line.length, 1);
  assert.equal(handOf(state, 'a').length, 7);
  assert.deepEqual(state.rejects[0], [[good, bad]]);
});

test('actions out of turn or with cards not in hand are ignored', () => {
  const s = newGame();
  const bCard = handOf(s, 'b')[0];
  assert.equal(applyAction(s, { type: 'play', playerId: 'b', cardIds: [bCard] }).state, s);
  assert.equal(applyAction(s, { type: 'play', playerId: 'a', cardIds: [bCard] }).state, s);
  assert.equal(applyAction(s, { type: 'play', playerId: 'a', cardIds: [] }).state, s);
});

test('emptying your hand ends the game and reveals the rule', () => {
  const s = newGame('odd');
  // Rig A's hand with one odd card.
  const oddCard = Object.values(CARD_BY_ID).find((c) => c.n % 2 === 1 && !s.line.includes(c.id));
  s.players[0].hand = [oddCard.id];
  const { state, events } = applyAction(s, { type: 'play', playerId: 'a', cardIds: [oddCard.id] });
  assert.equal(state.phase, 'ended');
  assert.equal(state.winnerId, 'a');
  assert.ok(events.some((e) => e.type === 'ended'));
  assert.equal(publicState(state).secretRule.id, 'odd');
});

test('giving up ends the game with no winner and reveals the rule', () => {
  const s = newGame('odd');
  const { state, events } = giveUp(s);
  assert.equal(state.phase, 'ended');
  assert.equal(state.winnerId, null);
  const pub = publicState(state);
  assert.equal(pub.gaveUp, true);
  assert.equal(pub.secretRule.id, 'odd');
  assert.equal(events[0].gaveUp, true);
  // no effect once the game is over
  assert.equal(giveUp(state).state, state);
});

test('public state never contains hands or the secret rule mid-game', () => {
  const pub = publicState(newGame());
  const json = JSON.stringify(pub);
  assert.equal(pub.secretRule, null);
  assert.ok(!json.includes('secretRuleId'));
  assert.ok(!json.includes('"hand"'));
  assert.equal(pub.players[0].handCount, 7);
});

test('a true trade-in discards the hand and draws one fewer', () => {
  const s = newGame('red');
  const notRed = Object.values(CARD_BY_ID).filter((c) => c.color !== 'red' && !s.line.includes(c.id));
  s.players[0].hand = notRed.slice(0, 5).map((c) => c.id);
  s.deck = s.deck.filter((id) => !s.players[0].hand.includes(id));
  const { state, events } = applyAction(s, { type: 'trade', playerId: 'a' });
  assert.equal(handOf(state, 'a').length, 4);
  assert.equal(state.discard.length, 5);
  assert.equal(events[0].ok, true);
  assert.equal(state.turn, 1);
});

test('a false trade-in plays one fitting card for you and you draw one', () => {
  const s = newGame('red');
  const red = Object.values(CARD_BY_ID).find((c) => c.color === 'red' && !s.line.includes(c.id));
  const others = Object.values(CARD_BY_ID).filter((c) => c.color !== 'red').slice(0, 3);
  s.players[0].hand = [others[0].id, red.id, others[1].id];
  s.deck = s.deck.filter((id) => !s.players[0].hand.includes(id));
  const { state, events } = applyAction(s, { type: 'trade', playerId: 'a' });
  assert.equal(state.line.at(-1), red.id);
  assert.equal(handOf(state, 'a').length, 3);
  assert.ok(!handOf(state, 'a').includes(red.id));
  assert.equal(events[0].ok, false);
});

test('trading in your last card wins (MVP 1)', () => {
  const s = newGame('red');
  const blue = Object.values(CARD_BY_ID).find((c) => c.color === 'blue');
  s.players[0].hand = [blue.id];
  const { state } = applyAction(s, { type: 'trade', playerId: 'a' });
  assert.equal(state.phase, 'ended');
  assert.equal(state.winnerId, 'a');
});

test('a random bot game always finishes', () => {
  for (let seed = 1; seed <= 30; seed++) {
    let s = createGame({ players: PLAYERS, seed, settings: { level: 'random' } });
    let guard = 0;
    while (s.phase === 'turn' && guard++ < 2000) {
      const p = s.players[s.turn];
      // Bot: play a fitting card if it has one (cheating), else a random card.
      const rule = RULE_BY_ID[s.secretRuleId];
      const prev = CARD_BY_ID[s.line.at(-1)];
      const good = p.hand.find((id) => rule.test(CARD_BY_ID[id], prev, []));
      const action = good
        ? { type: 'play', playerId: p.id, cardIds: [good] }
        : { type: 'trade', playerId: p.id };
      s = applyAction(s, action).state;
    }
    assert.equal(s.phase, 'ended', `seed ${seed}`);
  }
});
