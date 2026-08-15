/**
 * Backend integration tests — REST auth + JWT + realtime Socket.io.
 *
 * Boots a throwaway server instance on its own port so it never disturbs the
 * running dev backend, then exercises the real endpoints and socket events.
 *
 * Usage: node scripts/test-backend.js
 */
const path = require('path');
const jwt = require(path.join(__dirname, '..', 'backend', 'node_modules', 'jsonwebtoken'));
const { io } = require(path.join(__dirname, '..', 'node_modules', 'socket.io-client'));

const PORT = 4555;
const BASE = `http://127.0.0.1:${PORT}`;
const SECRET = 'test_secret_for_integration';

process.env.PORT = String(PORT);
process.env.JWT_SECRET = SECRET;
process.env.ALLOW_DEMO_AUTH = 'true';
process.env.HOST = '127.0.0.1';

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `  — ${detail}`}`);
};

const { server } = require(path.join(__dirname, '..', 'backend', 'server.js'));

const waitListening = () =>
  new Promise((resolve) => (server.listening ? resolve() : server.once('listening', resolve)));

const signIn = (name) =>
  fetch(`${BASE}/api/auth/demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  }).then((r) => r.json());

const directId = (a, b) => [a, b].sort().join('::');

(async () => {
  await waitListening();
  console.log('=== REST ===');

  const health = await (await fetch(`${BASE}/api/health`)).json();
  check('health ok', health.status === 'ok' && health.service === 'chipapp-backend', JSON.stringify(health));
  check('health reports version', health.version === '5.0.0');
  check('health reports storage', health.storage === 'memory');

  const auth = await signIn('Test User');
  check('demo auth 200', auth.status === 'success');
  check('returns user profile', !!auth.user && auth.user.name === 'Test User');
  check('profile has stable id', !!auth.user.id && auth.user.id.startsWith('demo-'));

  let decoded = null;
  try {
    decoded = jwt.verify(auth.token, SECRET);
  } catch (e) {
    /* handled below */
  }
  check('JWT verifies with secret', !!decoded && decoded.name === 'Test User');
  check('JWT has 30d expiry', !!decoded && decoded.exp - decoded.iat === 30 * 24 * 3600);

  const me = await fetch(`${BASE}/api/me`, { headers: { Authorization: `Bearer ${auth.token}` } }).then((r) => r.json());
  check('valid token accepted', me.user && me.user.name === 'Test User');

  const meBad = await fetch(`${BASE}/api/me`, { headers: { Authorization: `Bearer ${auth.token}xxx` } });
  check('tampered JWT rejected (401)', meBad.status === 401);
  const meNone = await fetch(`${BASE}/api/me`);
  check('missing token rejected (401)', meNone.status === 401);

  const gBad = await fetch(`${BASE}/api/auth/google`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: 'not-a-token' }),
  });
  check('google: invalid id token -> 401', gBad.status === 401);
  const forged = jwt.sign({ sub: '1', email: 'a@b.c' }, SECRET);
  const gForged = await fetch(`${BASE}/api/auth/google`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: forged }),
  });
  check('google: forged token -> 401', gForged.status === 401);
  const gEmpty = await fetch(`${BASE}/api/auth/google`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
  });
  check('google: missing token -> 400', gEmpty.status === 400);

  // Direct chat creation.
  const peer = await signIn('Peer Friend');
  const direct = await fetch(`${BASE}/api/chats/direct`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
    body: JSON.stringify({ peerId: peer.user.id }),
  }).then((r) => r.json());
  check('create direct chat', direct.chat && direct.chat.peer.name === 'Peer Friend');
  check('direct room id convention', direct.chat.id === directId(auth.user.id, peer.user.id));

  const list = await fetch(`${BASE}/api/users`, { headers: { Authorization: `Bearer ${auth.token}` } }).then((r) => r.json());
  check('user directory lists peer', list.users.some((u) => u.id === peer.user.id));

  /* ------------------------------- realtime ------------------------------- */
  console.log('\n=== Socket.io ===');
  const room = direct.chat.id;

  const a = io(BASE, { transports: ['websocket'], auth: { token: auth.token }, forceNew: true });
  const b = io(BASE, { transports: ['websocket'], auth: { token: peer.token }, forceNew: true });

  const readyPromise = new Promise((res) => a.once('ready', res));

  const connected = await Promise.all([
    new Promise((res) => a.on('connect', () => res(true))),
    new Promise((res) => b.on('connect', () => res(true))),
  ]);
  check('both clients connect', connected.every(Boolean));

  const identity = await Promise.race([
    readyPromise,
    new Promise((r) => setTimeout(() => r({ identity: null }), 2500)),
  ]);
  check('socket attaches verified identity', identity.userId === auth.user.id, JSON.stringify(identity));

  a.emit('join_chat', room);
  b.emit('join_chat', room);
  await new Promise((r) => setTimeout(r, 250));

  const received = new Promise((res) => b.on('receive_message', res));
  const acked = new Promise((res) => a.on('message_ack', res));
  let selfEcho = false;
  a.on('receive_message', () => { selfEcho = true; });

  const payload = { room, id: 'm-1', text: 'hello from A', timestamp: new Date().toISOString() };
  a.emit('send_message', payload);

  const got = await Promise.race([received, new Promise((r) => setTimeout(() => r(null), 2500))]);
  check('peer receives message', got && got.text === 'hello from A' && got.author === auth.user.id, JSON.stringify(got));

  const ack = await Promise.race([acked, new Promise((r) => setTimeout(() => r(null), 2500))]);
  check('sender gets delivery ack', ack && ack.id === 'm-1' && ack.status === 'delivered');
  check('no self-echo to sender', selfEcho === false);

  // Real-time reaction broadcast.
  const reaction = new Promise((res) => a.on('reaction', res));
  b.emit('react', { room, messageId: got ? got.id : 'm-1', emoji: '👍' });
  const reacted = await Promise.race([reaction, new Promise((r) => setTimeout(() => r(null), 2000))]);
  check('reaction broadcast', reacted && reacted.emoji === '👍' && reacted.reactions['👍'].includes(peer.user.id), JSON.stringify(reacted));

  // Edit message (author only).
  const edited = new Promise((res) => b.on('message_edited', res));
  a.emit('edit_message', { room, messageId: 'm-1', text: 'hello edited' });
  const editEvt = await Promise.race([edited, new Promise((r) => setTimeout(() => r(null), 1500))]);
  check('edit broadcast', editEvt && editEvt.text === 'hello edited' && !!editEvt.editedAt, JSON.stringify(editEvt));

  // Delete for everyone.
  const deleted = new Promise((res) => b.on('message_deleted', res));
  a.emit('delete_message', { room, messageId: 'm-1', forEveryone: true });
  const delEvt = await Promise.race([deleted, new Promise((r) => setTimeout(() => r(null), 1500))]);
  check('delete for everyone broadcast', delEvt && delEvt.forEveryone === true, JSON.stringify(delEvt));

  // Typing relay.
  const typing = new Promise((res) => b.on('peer_typing', res));
  a.emit('typing', { room, typing: true });
  const typed = await Promise.race([typing, new Promise((r) => setTimeout(() => r(null), 2000))]);
  check('typing indicator relayed', typed && typed.typing === true);

  // Anonymous sockets cannot message.
  const c = io(BASE, { transports: ['websocket'], forceNew: true });
  await new Promise((res) => c.on('connect', res));
  c.emit('join_chat', room);
  await new Promise((r) => setTimeout(r, 200));
  let anonymousDelivered = false;
  b.on('receive_message', (msg) => {
    if (msg.id === 'evil') anonymousDelivered = true;
  });
  c.emit('send_message', { room, id: 'evil', text: 'spam', timestamp: new Date().toISOString() });
  await new Promise((r) => setTimeout(r, 600));
  check('anonymous cannot inject messages', anonymousDelivered === false);

  [a, b, c].forEach((s) => s.close());
  server.close();

  console.log(`\nBACKEND: ${failures === 0 ? 'PASS' : `FAIL (${failures})`}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error('backend test harness failed:', e);
  process.exit(1);
});
