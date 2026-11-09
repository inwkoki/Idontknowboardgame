// Player phone: shows your secret hand and sends actions to the host. Never judges anything itself.

import { createRoomNet, pickMode } from './shared/net.js';
import { normalizeRoomCode, uid } from './shared/util.js';
import { cardEl } from './shared/cardview.js';

const $ = (id) => document.getElementById(id);
const show = (id, on = true) => $(id).classList.toggle('hidden', !on);

const params = new URLSearchParams(location.search);
const mode = pickMode();

let code = normalizeRoomCode(params.get('room'));
let net = null;
let me = null; // { playerId, secret, name }
let state = null; // public state from host
let hand = [];
let selected = []; // card ids in chosen order
let lastTurnMine = false;
let joinTimer = null;
// Browsers only allow vibrate() after the user has touched the page.
let userTapped = false;
addEventListener('pointerdown', () => (userTapped = true), { once: true });

// ---------- join form ----------
$('in-code').value = code;
$('in-name').value = localStorage.getItem('sr:name') || '';
show('join-form');
if (code && $('in-name').value) join();
else ($('in-code').value ? $('in-name') : $('in-code')).focus();

$('btn-join').onclick = join;
$('in-name').addEventListener('keydown', (e) => e.key === 'Enter' && join());

async function join() {
  code = normalizeRoomCode($('in-code').value);
  const name = $('in-name').value.trim();
  if (code.length !== 4) return ($('join-msg').textContent = 'รหัสห้องมี 4 ตัวอักษร');
  if (!name) return ($('join-msg').textContent = 'ใส่ชื่อก่อน');
  localStorage.setItem('sr:name', name);
  history.replaceState(null, '', `?room=${code}${mode === 'local' ? '&net=local' : ''}${params.get('seat') ? `&seat=${params.get('seat')}` : ''}`);

  // Same phone + same room = same player after a refresh.
  // ?seat=N lets several test tabs in one browser act as different players.
  const key = `sr:id:${code}${params.get('seat') || ''}`;
  me = JSON.parse(localStorage.getItem(key) || 'null') || { playerId: uid(10), secret: uid(16) };
  me.name = name;
  localStorage.setItem(key, JSON.stringify(me));

  $('join-msg').textContent = 'กำลังเชื่อมต่อ…';
  try {
    net = await createRoomNet(code, { mode, presenceKey: me.playerId, privateKey: me.secret });
  } catch (err) {
    $('join-msg').textContent = 'เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง';
    console.error(err);
    return;
  }
  wire();
  show('join-form', false);
  for (const id of ['top', 'status', 'tail', 'hand', 'actions']) show(id);
  $('me').textContent = name;
  $('room').textContent = `ห้อง ${code}`;
  sendJoin();
  // Keep knocking until the host has us (host may open after us, or reload).
  joinTimer = setInterval(() => {
    if (!state || !state.players.some((p) => p.id === me.playerId)) sendJoin();
  }, 2500);
  keepAwake();
}

function sendJoin() {
  net.send('join', { playerId: me.playerId, secret: me.secret, name: me.name });
}

function wire() {
  net.on('state', (s) => {
    state = s;
    render();
  });
  net.onPrivate('hand', ({ cards }) => {
    hand = cards;
    selected = selected.filter((id) => hand.includes(id));
    render();
  });
  net.on('judged', (e) => {
    if (e.playerId !== me.playerId) return;
    selected = [];
    if (e.type === 'traded') toast(e.ok ? 'จริง! จั่วใหม่ ✓' : 'มีใบที่ผ่านอยู่ ✗', e.ok);
    else toast(e.ok ? 'ผ่าน ✓' : 'ไม่ผ่าน ✗', e.ok);
    render();
  });
}

// ---------- actions ----------
$('btn-play').onclick = () => {
  if (!isMyTurn() || !selected.length) return;
  net.send('play', { playerId: me.playerId, cardIds: selected.slice() });
  lockButtons();
};
$('btn-clear').onclick = () => {
  selected = [];
  render();
};
$('btn-trade').onclick = () => {
  if (!isMyTurn()) return;
  if (!confirmTrade()) return;
  net.send('trade', { playerId: me.playerId });
  lockButtons();
};

// A tap-twice confirm instead of window.confirm (dialogs are awkward on TV-side testing too).
let tradeArmed = false;
function confirmTrade() {
  if (tradeArmed) {
    tradeArmed = false;
    $('btn-trade').textContent = 'ไม่มีใบไหนผ่าน';
    return true;
  }
  tradeArmed = true;
  $('btn-trade').textContent = 'แตะอีกครั้งเพื่อยืนยัน';
  setTimeout(() => {
    tradeArmed = false;
    $('btn-trade').textContent = 'ไม่มีใบไหนผ่าน';
  }, 3000);
  return false;
}

function lockButtons() {
  $('btn-play').disabled = true;
  $('btn-trade').disabled = true;
}

const isMyTurn = () => state?.phase === 'turn' && state.turnPlayerId === me?.playerId;

// ---------- render ----------
function render() {
  if (!state) return;
  const mine = isMyTurn();
  document.body.classList.toggle('my-turn', mine);
  if (mine && !lastTurnMine && userTapped) navigator.vibrate?.(200);
  lastTurnMine = mine;

  const ended = state.phase === 'ended';
  show('ended', ended);
  for (const id of ['status', 'tail', 'hand', 'actions']) show(id, !ended);
  if (ended) {
    const w = state.players.find((p) => p.id === state.winnerId);
    $('winner').textContent = w?.id === me.playerId ? '🏆 คุณ!' : `🏆 ${w?.name ?? ''}`;
    $('rule').textContent = state.secretRule?.th ?? '';
    return;
  }

  const inGame = state.players.some((p) => p.id === me.playerId);
  if (state.phase === 'lobby') {
    $('status').textContent = inGame ? 'อยู่ในห้องแล้ว รอโต๊ะเริ่มเกม…' : 'กำลังเข้าห้อง…';
  } else if (!inGame) {
    $('status').textContent = 'เกมเริ่มไปแล้ว ดูบนทีวีได้เลย';
  } else if (mine) {
    $('status').textContent = selected.length ? `เลือกแล้ว ${selected.length} ใบ (เรียงตามเลข)` : 'ตาคุณ! เลือกไพ่ที่จะลง';
  } else {
    const who = state.players.find((p) => p.id === state.turnPlayerId);
    $('status').textContent = `รอ ${who?.name ?? ''} อยู่…`;
  }

  // End of the line, so you don't have to look up at the TV for every move.
  const tail = $('tail');
  tail.innerHTML = '';
  if (state.line?.length) {
    const lbl = document.createElement('span');
    lbl.className = 'label';
    lbl.textContent = 'ท้ายแถว';
    tail.append(lbl);
    for (const id of state.line.slice(-3)) tail.append(cardEl(id, { size: 'sm' }));
  }

  const handEl = $('hand');
  handEl.innerHTML = '';
  for (const id of hand) {
    const order = selected.indexOf(id) + 1;
    const el = cardEl(id, { size: 'md', order: order || undefined });
    if (order) el.classList.add('sel');
    el.onclick = () => {
      if (!isMyTurn()) return;
      selected = order ? selected.filter((x) => x !== id) : [...selected, id];
      render();
    };
    handEl.append(el);
  }

  $('btn-play').disabled = !(mine && selected.length);
  $('btn-play').textContent = selected.length > 1 ? `ลงไพ่ ${selected.length} ใบตามลำดับ` : 'ลงไพ่';
  $('btn-clear').disabled = !selected.length;
  $('btn-trade').disabled = !mine;
}

let toastTimer;
function toast(text, ok) {
  const t = $('toast');
  t.textContent = text;
  t.className = `show ${ok ? 'ok' : 'bad'}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = ''), 1400);
}

// ---------- keep screen on ----------
let wakeLock = null;
async function keepAwake() {
  try {
    wakeLock = await navigator.wakeLock?.request('screen');
  } catch {
    /* not supported or denied — fine */
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    keepAwake();
    if (net && me) net.send('sync', { playerId: me.playerId });
  }
});
