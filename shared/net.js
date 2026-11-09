// Room networking. Two adapters with the same interface:
//   'local'    — BroadcastChannel, for many tabs on one computer (no server)
//   'supabase' — Supabase Realtime Broadcast + Presence
//
// const net = await createRoomNet(code, { mode, presenceKey, privateKey });
// net.send(type, payload)                 public, to everyone else in the room
// net.sendPrivate(key, type, payload)     to the one device listening on that private key
// net.on(type, fn) / net.onPrivate(type, fn)
// net.onPresence(fn(keys:string[]))       who is online (presence keys)
// net.close()

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

export function pickMode() {
  const q = new URLSearchParams(location.search).get('net');
  if (q === 'local') return 'local';
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return 'local';
  return 'supabase';
}

export async function createRoomNet(code, opts) {
  return opts.mode === 'local' ? createLocal(code, opts) : createSupabase(code, opts);
}

function makeEmitter() {
  const handlers = {};
  return {
    on(type, fn) {
      (handlers[type] ||= []).push(fn);
    },
    emit(type, payload) {
      for (const fn of handlers[type] || []) fn(payload);
    },
  };
}

// ---------- local (BroadcastChannel) ----------

function createLocal(code, { presenceKey, privateKey }) {
  const pub = new BroadcastChannel(`sr:${code}`);
  const priv = privateKey ? new BroadcastChannel(`sr:${code}:${privateKey}`) : null;
  const pubE = makeEmitter();
  const privE = makeEmitter();
  const presE = makeEmitter();
  const seen = new Map(); // key -> last seen ms
  const outPriv = new Map();

  pub.onmessage = (ev) => {
    const { type, payload } = ev.data || {};
    if (type === '_hb') {
      seen.set(payload.key, Date.now());
      return;
    }
    pubE.emit(type, payload);
  };
  if (priv) priv.onmessage = (ev) => privE.emit(ev.data.type, ev.data.payload);

  let lastKeys = '';
  const beat = () => {
    if (presenceKey) {
      seen.set(presenceKey, Date.now());
      pub.postMessage({ type: '_hb', payload: { key: presenceKey } });
    }
    const now = Date.now();
    const keys = [...seen].filter(([, t]) => now - t < 5000).map(([k]) => k).sort();
    const sig = keys.join(',');
    if (sig !== lastKeys) {
      lastKeys = sig;
      presE.emit('change', keys);
    }
  };
  beat();
  const timer = setInterval(beat, 1500);

  return {
    mode: 'local',
    send: (type, payload) => pub.postMessage({ type, payload }),
    sendPrivate(key, type, payload) {
      if (!outPriv.has(key)) outPriv.set(key, new BroadcastChannel(`sr:${code}:${key}`));
      outPriv.get(key).postMessage({ type, payload });
    },
    on: pubE.on,
    onPrivate: privE.on,
    onPresence: (fn) => presE.on('change', fn),
    close() {
      clearInterval(timer);
      pub.close();
      priv?.close();
      for (const c of outPriv.values()) c.close();
    },
  };
}

// ---------- Supabase Realtime ----------

let clientPromise = null;
function getClient() {
  clientPromise ||= import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm').then(
    ({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY),
  );
  return clientPromise;
}

function subscribe(channel) {
  return new Promise((resolve, reject) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve(channel);
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(status));
    });
  });
}

async function createSupabase(code, { presenceKey, privateKey }) {
  const sb = await getClient();
  const pubE = makeEmitter();
  const privE = makeEmitter();
  const presE = makeEmitter();

  const pub = sb.channel(`sr:${code}`, {
    config: { broadcast: { self: false }, presence: { key: presenceKey || '' } },
  });
  pub.on('broadcast', { event: 'm' }, ({ payload }) => pubE.emit(payload.type, payload.payload));
  pub.on('presence', { event: 'sync' }, () => {
    presE.emit('change', Object.keys(pub.presenceState()).filter(Boolean).sort());
  });
  await subscribe(pub);
  if (presenceKey) await pub.track({ at: Date.now() });

  let priv = null;
  if (privateKey) {
    priv = sb.channel(`sr:${code}:${privateKey}`, { config: { broadcast: { self: false } } });
    priv.on('broadcast', { event: 'm' }, ({ payload }) => privE.emit(payload.type, payload.payload));
    await subscribe(priv);
  }

  const outPriv = new Map(); // key -> Promise<channel>
  const outChannel = (key) => {
    if (!outPriv.has(key)) {
      outPriv.set(key, subscribe(sb.channel(`sr:${code}:${key}`, { config: { broadcast: { self: false } } })));
    }
    return outPriv.get(key);
  };

  return {
    mode: 'supabase',
    send: (type, payload) => pub.send({ type: 'broadcast', event: 'm', payload: { type, payload } }),
    async sendPrivate(key, type, payload) {
      const ch = await outChannel(key);
      return ch.send({ type: 'broadcast', event: 'm', payload: { type, payload } });
    },
    on: pubE.on,
    onPrivate: privE.on,
    onPresence: (fn) => presE.on('change', fn),
    async close() {
      await sb.removeChannel(pub);
      if (priv) await sb.removeChannel(priv);
      for (const p of outPriv.values()) sb.removeChannel(await p);
    },
  };
}
