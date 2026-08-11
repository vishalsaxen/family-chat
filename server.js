// Family Table Chat — a small private group chat server.
// Serves the front end and relays messages over Socket.io.
// No accounts, no third-party app — just a shared link and a passcode.

const path = require('path');
const fs = require('fs');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { nanoid } = require('nanoid');

const PORT = process.env.PORT || 3000;
const FAMILY_PASSCODE = process.env.FAMILY_PASSCODE || 'change-me';
const FAMILY_NAME = process.env.FAMILY_NAME || 'The Family Table';
const DATA_FILE = path.join(__dirname, 'messages.json');
const MAX_HISTORY = 500;
const MAX_ONLINE_LIST = 260; // headroom above the ~200-250 expected members

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 2e5 // 200kb, plenty for text messages
});

app.use(express.static(path.join(__dirname, 'public')));

// --- message persistence (flat JSON file, no external DB needed) ---
function loadMessages() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveMessages(messages) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(messages.slice(-MAX_HISTORY)));
  } catch (e) {
    console.error('Could not persist messages:', e.message);
  }
}

let messages = loadMessages();

// --- presence tracking (in memory) ---
// socket.id -> { name, color }
const online = new Map();

const AVATAR_COLORS = [
  '#E8A33D', '#7FA37F', '#C97B63', '#5C8FA8',
  '#B08BC9', '#D9B24C', '#68A6A0', '#C9707E'
];
function colorForName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function presenceList() {
  return Array.from(online.values())
    .slice(0, MAX_ONLINE_LIST)
    .map(u => ({ name: u.name, color: u.color }));
}

function broadcastPresence() {
  io.emit('presence', { online: presenceList(), count: online.size });
}

// Find which online members were tagged with @name in a message.
// Matches longest names first so "@Sam" doesn't wrongly match "Samantha".
function findMentionedSocketIds(text, senderSocketId) {
  const lowerText = text.toLowerCase();
  const matchedNames = new Set();

  if (/@(all|everyone)\b/i.test(text)) {
    return Array.from(online.keys()).filter(id => id !== senderSocketId);
  }

  const uniqueNames = Array.from(new Set(Array.from(online.values()).map(u => u.name)))
    .sort((a, b) => b.length - a.length);

  for (const name of uniqueNames) {
    const token = '@' + name.toLowerCase();
    if (lowerText.includes(token)) matchedNames.add(name);
  }

  const socketIds = [];
  for (const [id, user] of online.entries()) {
    if (id !== senderSocketId && matchedNames.has(user.name)) socketIds.push(id);
  }
  return socketIds;
}

io.on('connection', (socket) => {
  let joined = false;

  socket.on('join', ({ name, passcode }) => {
    if (joined) return;

    if (passcode !== FAMILY_PASSCODE) {
      socket.emit('join-error', 'Wrong passcode. Ask a family member for it.');
      return;
    }
    const cleanName = String(name || '').trim().slice(0, 30);
    if (!cleanName) {
      socket.emit('join-error', 'Please enter your name.');
      return;
    }
    if (online.size >= MAX_ONLINE_LIST) {
      socket.emit('join-error', 'The table is full right now — try again shortly.');
      return;
    }

    joined = true;
    const color = colorForName(cleanName);
    online.set(socket.id, { name: cleanName, color });

    socket.emit('joined', {
      familyName: FAMILY_NAME,
      you: { name: cleanName, color },
      history: messages
    });

    const sysMsg = {
      id: nanoid(8),
      type: 'system',
      text: `${cleanName} joined the table`,
      ts: Date.now()
    };
    messages.push(sysMsg);
    saveMessages(messages);
    io.emit('message', sysMsg);
    broadcastPresence();
  });

  socket.on('message', (text) => {
    if (!joined) return;
    const user = online.get(socket.id);
    if (!user) return;
    const cleanText = String(text || '').trim().slice(0, 2000);
    if (!cleanText) return;

    const msg = {
      id: nanoid(8),
      type: 'message',
      name: user.name,
      color: user.color,
      text: cleanText,
      ts: Date.now()
    };
    messages.push(msg);
    saveMessages(messages);
    io.emit('message', msg);

    const mentionedIds = findMentionedSocketIds(cleanText, socket.id);
    mentionedIds.forEach(id => {
      io.to(id).emit('mention', msg);
    });
  });

  socket.on('typing', () => {
    if (!joined) return;
    const user = online.get(socket.id);
    if (!user) return;
    socket.broadcast.emit('typing', { name: user.name });
  });

  socket.on('disconnect', () => {
    if (!joined) return;
    const user = online.get(socket.id);
    online.delete(socket.id);
    if (user) {
      const sysMsg = {
        id: nanoid(8),
        type: 'system',
        text: `${user.name} left the table`,
        ts: Date.now()
      };
      messages.push(sysMsg);
      saveMessages(messages);
      io.emit('message', sysMsg);
    }
    broadcastPresence();
  });
});

server.listen(PORT, () => {
  console.log(`Family Table Chat running on port ${PORT}`);
  console.log(`Passcode is currently: ${FAMILY_PASSCODE === 'change-me' ? '⚠️  DEFAULT — set FAMILY_PASSCODE env var!' : '(set via env var)'}`);
});
