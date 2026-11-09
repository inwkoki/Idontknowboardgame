// TV sound: short synth effects (WebAudio, no files) + Thai announcements (speechSynthesis).
// Browsers block sound until the page has been clicked once — call unlock() from a click/keydown.

let ctx = null;
let muted = localStorage.getItem('sr:muted') === '1';
let thaiVoice = null;

function pickVoice() {
  const voices = globalThis.speechSynthesis?.getVoices?.() || [];
  thaiVoice = voices.find((v) => v.lang?.toLowerCase().startsWith('th')) || null;
}
if (globalThis.speechSynthesis) {
  pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
}

export function unlock() {
  try {
    ctx ||= new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
  } catch {
    /* no WebAudio */
  }
}
export const isUnlocked = () => !!ctx && ctx.state === 'running';
export const isMuted = () => muted;
export const hasThaiVoice = () => !!thaiVoice;
export function setMuted(m) {
  muted = m;
  localStorage.setItem('sr:muted', m ? '1' : '0');
  if (m) globalThis.speechSynthesis?.cancel();
}

// [frequency Hz, duration s] notes played one after another
const SFX = {
  join: [[880, 0.07], [1175, 0.09]],
  start: [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.2]],
  turn: [[659, 0.07], [880, 0.1]],
  ok: [[784, 0.07], [1047, 0.14]],
  nope: [[233, 0.16], [175, 0.26]],
  trade: [[587, 0.07], [587, 0.07], [784, 0.12]],
  win: [[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.12], [784, 0.1], [1047, 0.35]],
  giveup: [[440, 0.16], [392, 0.16], [330, 0.16], [262, 0.4]],
};

export function sfx(name) {
  if (muted || !ctx || ctx.state !== 'running') return;
  const notes = SFX[name];
  if (!notes) return;
  let t = ctx.currentTime + 0.01;
  for (const [f, d] of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = name === 'nope' ? 'sawtooth' : 'triangle';
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + d);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + d + 0.02);
    t += d * 0.9;
  }
}

/** Speak Thai. Skipped when no Thai voice is installed (a non-Thai voice reads Thai as gibberish). */
export function say(text, { interrupt = false } = {}) {
  const ss = globalThis.speechSynthesis;
  if (muted || !ss || !thaiVoice || !text) return;
  if (interrupt) ss.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = thaiVoice;
  u.lang = thaiVoice.lang;
  u.rate = 1.05;
  ss.speak(u);
}

/** Effect + announcement in one call. */
export function cue(name, text, opts) {
  sfx(name);
  if (text) setTimeout(() => say(text, opts), name === 'win' || name === 'start' ? 700 : 250);
}
