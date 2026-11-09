// Pure game logic. (state, action) → { state, events }. No DOM, no network.
// The host page owns the full state; publicState() strips secrets before broadcast.

import { getCard, buildDeck, DEFAULT_DECK } from './cards.js';
import { RULE_BY_ID, rulesFor, judgeSequence, makeContext, ruleText } from './rules.js';
import { mulberry32, shuffle } from '../../shared/util.js';

export const DEFAULT_SETTINGS = {
  level: 1, // 1, 2, 3, 'trick' or 'random'
  handSize: 7,
  deck: DEFAULT_DECK, // { animals: 'all'|'four', maxN: 9|6 }
};

const card = getCard;
const cards = (ids) => ids.map(card);

/**
 * @param {{players:{id:string,name:string}[], settings?:object, seed:number, ruleId?:string, ctx?:object}} opts
 * ctx: facts for 'trick' rules (date, player count). Defaults to today; pass a fixed one in tests.
 */
export function createGame({ players, settings = {}, seed, ruleId, ctx }) {
  if (!players || players.length < 2) throw new Error('need at least 2 players');
  const s = { ...DEFAULT_SETTINGS, ...settings, deck: { ...DEFAULT_DECK, ...(settings.deck || {}) } };
  const rng = mulberry32(seed);
  const context = { ...makeContext(new Date(), players.length), ...(ctx || {}), players: players.length };
  const fullDeck = buildDeck(s.deck);

  const pool = rulesFor({ level: s.level, deck: fullDeck, ctx: context });
  const rule = ruleId ? RULE_BY_ID[ruleId] : pool[Math.floor(rng() * pool.length)];
  if (!rule) throw new Error('no rule fits these settings');

  let deck = shuffle(fullDeck.map((c) => c.id), rng);
  const ps = players.map((p) => ({ id: p.id, name: p.name, hand: deck.splice(0, s.handSize) }));

  // Starting card: first card in the draw pile that fits the rule.
  const startIdx = deck.findIndex((id) => rule.test(card(id), null, [], context));
  const start = deck.splice(startIdx, 1)[0];

  return {
    phase: 'turn',
    settings: s,
    secretRuleId: rule.id,
    ctx: context,
    deck,
    discard: [],
    players: ps,
    turn: 0,
    line: [start],
    // rejects[i] = list of rejected attempts made right after line[i]; each attempt is an array of ids
    rejects: {},
    log: [],
    winnerId: null,
    round: 1,
  };
}

function nextTurn(state) {
  state.turn = (state.turn + 1) % state.players.length;
  if (state.turn === 0) state.round += 1;
}

function pushLog(state, entry) {
  state.log.push(entry);
  if (state.log.length > 30) state.log.shift();
}

/**
 * @returns {{state:object, events:object[]}} events are for UI/audio; an invalid action returns the same state and no events.
 */
export function applyAction(prev, action) {
  if (!prev || prev.phase !== 'turn') return { state: prev, events: [] };
  const state = structuredClone(prev);
  const pi = state.players.findIndex((p) => p.id === action.playerId);
  if (pi < 0 || pi !== state.turn) return { state: prev, events: [] };
  const player = state.players[pi];

  if (action.type === 'play') {
    const ids = action.cardIds;
    if (!Array.isArray(ids) || ids.length === 0) return { state: prev, events: [] };
    if (new Set(ids).size !== ids.length) return { state: prev, events: [] };
    if (!ids.every((id) => player.hand.includes(id))) return { state: prev, events: [] };

    const rule = RULE_BY_ID[state.secretRuleId];
    const ok = judgeSequence(rule, cards(state.line), cards(ids), state.ctx);
    const events = [];

    if (ok) {
      state.line.push(...ids);
      player.hand = player.hand.filter((id) => !ids.includes(id));
      pushLog(state, { playerId: player.id, kind: 'play', ok: true, count: ids.length });
      events.push({ type: 'judged', ok: true, playerId: player.id, cardIds: ids });
    } else {
      const at = state.line.length - 1;
      (state.rejects[at] ||= []).push(ids);
      pushLog(state, { playerId: player.id, kind: 'play', ok: false, count: ids.length });
      events.push({ type: 'judged', ok: false, playerId: player.id, cardIds: ids });
    }

    finishTurn(state, player, events);
    return { state, events };
  }

  if (action.type === 'trade') {
    // Player claims no card in hand fits.
    const rule = RULE_BY_ID[state.secretRuleId];
    const line = cards(state.line);
    const fitting = player.hand.find((id) => judgeSequence(rule, line, [card(id)], state.ctx));
    const events = [];
    if (fitting === undefined) {
      const n = player.hand.length;
      state.discard.push(...player.hand);
      player.hand = [];
      player.hand = draw(state, n - 1);
      pushLog(state, { playerId: player.id, kind: 'trade', ok: true, count: n });
      events.push({ type: 'traded', ok: true, playerId: player.id, count: n });
    } else {
      // Wrong claim: the table plays one fitting card for them, they draw one.
      state.line.push(fitting);
      player.hand = player.hand.filter((id) => id !== fitting);
      player.hand.push(...draw(state, 1));
      pushLog(state, { playerId: player.id, kind: 'trade', ok: false, count: 1 });
      events.push({ type: 'traded', ok: false, playerId: player.id, cardId: fitting });
    }
    finishTurn(state, player, events);
    return { state, events };
  }

  return { state: prev, events: [] };
}

function finishTurn(state, player, events) {
  if (player.hand.length === 0) {
    // MVP 1: emptying your hand wins. MVP 2 adds the rule-guessing step here.
    state.phase = 'ended';
    state.winnerId = player.id;
    events.push({ type: 'ended', winnerId: player.id });
  } else {
    nextTurn(state);
    events.push({ type: 'turn', playerId: state.players[state.turn].id });
  }
}

/** Draw up to n cards, reshuffling the discard pile into the deck when it runs out. */
function draw(state, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    if (state.deck.length === 0 && state.discard.length > 0) {
      state.deck = shuffle(state.discard, mulberry32(state.line.length * 7919 + state.round));
      state.discard = [];
    }
    if (state.deck.length === 0) break;
    out.push(state.deck.shift());
  }
  return out;
}

/** Host-only: pass the turn on (e.g. that player's phone dropped out). */
export function skipTurn(prev) {
  if (!prev || prev.phase !== 'turn') return { state: prev, events: [] };
  const state = structuredClone(prev);
  const skipped = state.players[state.turn].id;
  pushLog(state, { playerId: skipped, kind: 'skip', ok: false, count: 0 });
  nextTurn(state);
  return { state, events: [{ type: 'skipped', playerId: skipped }, { type: 'turn', playerId: state.players[state.turn].id }] };
}

/** The table gives up: end the game with no winner and reveal the rule. Host-only, never sent by phones. */
export function giveUp(prev) {
  if (!prev || prev.phase !== 'turn') return { state: prev, events: [] };
  const state = structuredClone(prev);
  state.phase = 'ended';
  state.winnerId = null;
  state.gaveUp = true;
  return { state, events: [{ type: 'ended', winnerId: null, gaveUp: true }] };
}

/** What every screen may see. The secret rule is only revealed once the game has ended. */
export function publicState(state) {
  return {
    phase: state.phase,
    settings: state.settings,
    players: state.players.map((p) => ({ id: p.id, name: p.name, handCount: p.hand.length })),
    turn: state.turn,
    turnPlayerId: state.players[state.turn]?.id ?? null,
    line: state.line,
    rejects: state.rejects,
    deckCount: state.deck.length,
    log: state.log,
    round: state.round,
    winnerId: state.winnerId,
    gaveUp: !!state.gaveUp,
    secretRule:
      state.phase === 'ended'
        ? { id: state.secretRuleId, th: ruleText(RULE_BY_ID[state.secretRuleId], state.ctx) }
        : null,
  };
}

export function handOf(state, playerId) {
  return state.players.find((p) => p.id === playerId)?.hand ?? [];
}
