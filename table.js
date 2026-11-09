// HOST + TV screen. This page is the Rule Keeper: it owns the full game state
// (including the secret rule and every hand) and is the only place actions are judged.

import { createRoomNet, pickMode } from './shared/net.js';
import { roomCode, normalizeRoomCode, randomSeed } from './shared/util.js';
import { cardEl } from './shared/cardview.js';
import { createGame, applyAction, publicState, handOf, giveUp } from './games/secret-rule/engine.js';
import { ANIMALS, COLORS, ANIMAL_SETS, NUMBER_RANGES, DEFAULT_DECK, buildDeck, deckLabel } from './games/secret-rule/cards.js';
import { LEVELS, rulesFor, makeContext } from './games/secret-rule/rules.js';

const $ = (id) => document.getElementById(id);

const params = new URLSearchParams(location.search);
const mode = pickMode();
const code = normalizeRoomCode(params.get('room')) || roomCode();
history.replaceState(null, '', `?room=${code}${mode === 'local' ? '&net=local' : ''}${params.has('debug') ? '&debug' : ''}`);

// ---------- state ----------
const lobby = new Map(); // playerId -> { id, name, secret }
let online = [];
let game = null; // full engine state (secret!)
let lastLineLen = 0;
let lastRejectKey = '';

const net = await createRoomNet(code, { mode, presenceKey: 'host' });

// ---------- networking ----------
function broadcastState() {
  const pub = game ? publicState(game) : { phase: 'lobby', players: [...lobby.values()].map(({ id, name }) => ({ id, name })) };
  net.send('state', pub);
}

function sendHand(playerId) {
  const p = lobby.get(playerId);
  if (!p || !game) return;
  net.sendPrivate(p.secret, 'hand', { cards: handOf(game, playerId) });
}

net.onPresence((keys) => {
  online = keys;
  render();
});

net.on('join', ({ playerId, secret, name }) => {
  if (!playerId || !secret) return;
  const known = lobby.get(playerId);
  if (!known && game) {
    // Game already running: late joiners only get to watch.
    net.send('state', publicState(game));
    return;
  }
  lobby.set(playerId, { id: playerId, name: String(name || 'ผู้เล่น').slice(0, 16), secret });
  if (game) {
    const gp = game.players.find((p) => p.id === playerId);
    if (gp) gp.name = lobby.get(playerId).name;
  }
  broadcastState();
  sendHand(playerId);
  render();
});

net.on('sync', ({ playerId }) => {
  broadcastState();
  sendHand(playerId);
});

function handleAction(action) {
  if (!game) return;
  const { state, events } = applyAction(game, action);
  if (state === game) return; // invalid, ignore quietly
  game = state;
  for (const e of events) {
    if (e.type === 'judged' || e.type === 'traded') {
      net.send('judged', e);
      if (game.phase !== 'ended') showToast(e);
    }
  }
  broadcastState();
  sendHand(action.playerId);
  render();
}

net.on('play', ({ playerId, cardIds }) => handleAction({ type: 'play', playerId, cardIds }));
net.on('trade', ({ playerId }) => handleAction({ type: 'trade', playerId }));

// ---------- give up: reveal the rule, nobody wins ----------
// Tap twice within 4 s so a stray click can't end the game.
let giveUpArmed = null;
$('giveup').onclick = () => {
  if (!game || game.phase !== 'turn') return;
  if (!giveUpArmed) {
    $('giveup').classList.add('armed');
    $('giveup').textContent = 'กดอีกครั้งเพื่อเฉลย';
    giveUpArmed = setTimeout(disarmGiveUp, 4000);
    return;
  }
  disarmGiveUp();
  game = giveUp(game).state;
  broadcastState();
  render();
};
function disarmGiveUp() {
  clearTimeout(giveUpArmed);
  giveUpArmed = null;
  $('giveup').classList.remove('armed');
  $('giveup').textContent = 'ยอมแพ้ · เฉลยกฎ';
}

// ---------- lobby controls ----------
$('start').onclick = startGame;
$('again').onclick = () => {
  disarmGiveUp();
  game = null;
  render();
  startGame();
};

function startGame() {
  const players = [...lobby.values()].map(({ id, name }) => ({ id, name }));
  if (players.length < 2) return;
  game = createGame({ players, seed: randomSeed(), settings: { level: levelValue(), deck: deckOpts() } });
  lastLineLen = game.line.length;
  lastRejectKey = '';
  broadcastState();
  for (const p of players) sendHand(p.id);
  render();
}

// ---------- rendering ----------
const nameOf = (id) => lobby.get(id)?.name ?? '?';

function render() {
  $('hdr-code').textContent = code;
  const inGame = !!game;
  $('lobby').classList.toggle('hidden', inGame);
  $('game').classList.toggle('hidden', !inGame);
  $('bar').classList.toggle('hidden', !inGame);
  const ended = !!game && game.phase === 'ended';
  $('ended').classList.toggle('hidden', !ended);
  if (ended) $('toast').className = '';
  if (inGame) renderGame();
  else renderLobby();
}

// ---------- deck + rule options (remembered on this computer) ----------
const saved = (() => {
  try { return JSON.parse(localStorage.getItem('sr:options')) || {}; } catch { return {}; }
})();
const options = {
  animals: ANIMAL_SETS[saved.animals] ? saved.animals : DEFAULT_DECK.animals,
  maxN: NUMBER_RANGES[saved.maxN] ? Number(saved.maxN) : DEFAULT_DECK.maxN,
  level: LEVELS[saved.level] ? saved.level : '1',
};
function fillSelect(el, entries, value) {
  el.innerHTML = '';
  for (const [v, label] of entries) el.append(new Option(label, v, false, String(v) === String(value)));
}
fillSelect($('opt-animals'), Object.entries(ANIMAL_SETS).map(([k, v]) => [k, v.th]), options.animals);
fillSelect($('opt-numbers'), Object.entries(NUMBER_RANGES).sort((a, b) => b[0] - a[0]).map(([k, v]) => [k, v.th]), options.maxN);
fillSelect($('level'), Object.entries(LEVELS), options.level);
for (const id of ['opt-animals', 'opt-numbers', 'level']) {
  $(id).onchange = () => {
    options.animals = $('opt-animals').value;
    options.maxN = Number($('opt-numbers').value);
    options.level = $('level').value;
    localStorage.setItem('sr:options', JSON.stringify(options));
    renderDeckInfo();
    render();
  };
}
const deckOpts = () => ({ animals: options.animals, maxN: options.maxN });
const levelValue = () => (/^\d$/.test(options.level) ? Number(options.level) : options.level);
function playableRuleCount() {
  const players = Math.max(2, lobby.size);
  return rulesFor({ level: levelValue(), deck: buildDeck(deckOpts()), ctx: makeContext(new Date(), players) }).length;
}

// What's on the cards — something to read while friends join.
function renderDeckInfo() {
  const el = $('deck-info');
  const deck = buildDeck(deckOpts());
  const animalIds = ANIMAL_SETS[options.animals].ids;
  const nums = Array.from({ length: options.maxN }, (_, i) => `<span class="num-chip">${i + 1}</span>`).join('');
  const colors = Object.entries(COLORS)
    .map(([k, c]) => `<span class="color-chip"><span class="sw" style="background:var(--${k})">${c.mark}</span>${c.th}</span>`)
    .join('');
  const animals = ANIMALS.filter((a) => animalIds.includes(a.id))
    .map((a) => `<span class="animal"><span class="e">${a.emoji}</span><span class="t">${a.th}</span></span>`)
    .join('');
  const sample = [deck[0], deck[Math.floor(deck.length / 2) + 1], deck[deck.length - 3]].map((c) => c.id);
  el.innerHTML = `
    <div class="info-head">
      <div><h2>ไพ่ในเกมนี้</h2><p class="lead muted">${deck.length} ใบ · กฎลับใช้ เลข สี หรือสัตว์</p></div>
      <div class="example" id="example-cards"></div>
    </div>
    <div class="info-row"><span class="k">เลข</span><span class="v">${nums}</span></div>
    <div class="info-row"><span class="k">สี</span><span class="v">${colors}</span></div>
    <div class="info-row"><span class="k">สัตว์</span><span class="v animals">${animals}</span></div>
    <ul class="tips">
      <li>ลงไพ่ที่คิดว่าผ่านกฎ — ผ่านจะต่อแถว ไม่ผ่านจะแขวนไว้ใต้แถว</li>
      <li>ลงหลายใบพร้อมกันได้ แต่ต้องผ่านทุกใบตามลำดับ</li>
      <li>ไม่มีใบไหนผ่านจริง? กด "ไม่มีใบไหนผ่าน" จะได้ไพ่ลดลง 1 ใบ</li>
      <li>ใครหมดมือก่อนชนะ · ยอมแพ้เมื่อไหร่ก็เฉลยกฎได้</li>
    </ul>`;
  const ex = $('example-cards');
  for (const id of sample) ex.append(cardEl(id, { size: 'sm' }));
}
renderDeckInfo();

let qrDone = false;
function renderLobby() {
  $('hdr-info').textContent = mode === 'local' ? 'โหมดทดสอบ (local)' : '';
  $('big-code').textContent = code;
  const url = new URL(`hand.html?room=${code}${mode === 'local' ? '&net=local' : ''}`, location.href).href;
  $('join-url').textContent = url;
  $('site').textContent = new URL('.', location.href).host;
  if (!qrDone && window.qrcode) {
    const qr = window.qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    $('qr').innerHTML = qr.createSvgTag({ cellSize: 6, margin: 0, scalable: true });
    qrDone = true;
  }

  const list = $('lobby-players');
  const players = [...lobby.values()];
  $('pcount').textContent = players.length;
  list.innerHTML = players.length ? '' : '<div class="muted">รอเพื่อนเข้าห้อง…</div>';
  for (const p of players) {
    const row = document.createElement('div');
    row.className = 'player';
    row.innerHTML = `<span class="dot ${online.includes(p.id) ? 'on' : ''}"></span><span></span>`;
    row.lastChild.textContent = p.name;
    list.append(row);
  }
  const nRules = playableRuleCount();
  $('rule-count').textContent = nRules ? `มีกฎให้สุ่ม ${nRules} แบบ` : 'ไม่มีกฎที่เข้ากับตัวเลือกนี้ ลองเปลี่ยนสัตว์/เลข/ระดับ';
  $('start').disabled = players.length < 2 || nRules === 0;
  $('start-hint').classList.toggle('hidden', players.length >= 2);
}
// The QR library loads with `defer`; draw once it is ready.
window.addEventListener('load', () => render());

function renderGame() {
  const pub = publicState(game);
  $('hdr-info').textContent = `${deckLabel(pub.settings.deck)} · รอบที่ ${pub.round} · กองจั่ว ${pub.deckCount} ใบ`;

  // Line + rejects hanging under the card they were tried after.
  const lineEl = $('line');
  lineEl.innerHTML = '';
  const rejectKey = JSON.stringify(pub.rejects);
  const newReject = rejectKey !== lastRejectKey ? findNewestReject(pub.rejects) : null;
  pub.line.forEach((id, i) => {
    const slot = document.createElement('div');
    slot.className = 'slot';
    const c = cardEl(id, { size: 'md' });
    if (i >= lastLineLen) c.classList.add('new');
    slot.append(c);
    const attempts = pub.rejects[i] || [];
    if (attempts.length) {
      const rj = document.createElement('div');
      rj.className = 'rejects';
      attempts.forEach((ids, ai) => {
        const a = document.createElement('div');
        a.className = `attempt${ids.length > 1 ? ' multi' : ''}`;
        for (const rid of ids) {
          const rc = cardEl(rid, { size: 'sm', dim: true });
          if (newReject && newReject.at === i && newReject.idx === ai) rc.classList.add('rejected-new');
          a.append(rc);
        }
        rj.append(a);
      });
      slot.append(rj);
    }
    lineEl.append(slot);
  });
  lastLineLen = pub.line.length;
  lastRejectKey = rejectKey;
  lineEl.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

  // Player chips
  const chips = $('chips');
  chips.innerHTML = '';
  for (const p of pub.players) {
    const chip = document.createElement('div');
    chip.className = `pchip${p.id === pub.turnPlayerId && pub.phase === 'turn' ? ' turn' : ''}`;
    chip.innerHTML = `<span class="dot ${online.includes(p.id) ? 'on' : ''}"></span><span class="nm"></span><span class="count">${p.handCount}</span>`;
    chip.querySelector('.nm').textContent = p.name;
    chips.append(chip);
  }

  // Log (last 3)
  const log = $('log');
  log.innerHTML = '';
  for (const e of pub.log.slice(-3).reverse()) {
    const row = document.createElement('div');
    const what = e.kind === 'trade' ? (e.ok ? 'แลกทั้งมือ ✓' : 'แลกทั้งมือ แต่มีใบผ่าน ✗') : `ลง ${e.count} ใบ ${e.ok ? '✓' : '✗'}`;
    row.className = e.ok ? 'ok' : 'bad';
    row.textContent = `${nameOf(e.playerId)} ${what}`;
    log.append(row);
  }

  $('giveup').classList.toggle('hidden', pub.phase !== 'turn');
  if (pub.phase === 'ended') {
    $('winner-label').textContent = pub.gaveUp ? 'ทั้งโต๊ะยอมแพ้' : 'ผู้ชนะ';
    $('winner').textContent = pub.gaveUp ? '🏳️ ไม่มีใครชนะ' : `🏆 ${nameOf(pub.winnerId)}`;
    $('rule').textContent = pub.secretRule.th;
  }
}

function findNewestReject(rejects) {
  // The newest attempt is the last one under the highest index that changed; good enough for a shake.
  let best = null;
  for (const [at, list] of Object.entries(rejects)) {
    const k = Number(at);
    if (!best || k >= best.at) best = { at: k, idx: list.length - 1 };
  }
  return best;
}

let toastTimer;
function showToast(e) {
  const t = $('toast');
  const who = nameOf(e.playerId);
  if (e.type === 'traded') t.textContent = e.ok ? `${who} ไม่มีใบไหนผ่านจริง ✓` : `${who} มีใบที่ผ่านอยู่! ✗`;
  else t.textContent = e.ok ? `ผ่าน ✓` : `ไม่ผ่าน ✗`;
  t.className = `show ${e.ok ? 'ok' : 'bad'}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = ''), 1600);
}

render();

// Test hook for automated playtests only (?debug). Exposes the secret state — never use while playing.
if (params.has('debug')) window.__sr = { get game() { return game; } };
