const joinScreen = document.getElementById('join-screen');
const chatScreen = document.getElementById('chat-screen');
const joinForm = document.getElementById('join-form');
const nameInput = document.getElementById('name-input');
const passcodeInput = document.getElementById('passcode-input');
const joinError = document.getElementById('join-error');

const familyTitleEl = document.getElementById('family-title');
const chatTitleEl = document.getElementById('chat-title');
const whoList = document.getElementById('who-list');
const onlineCountEl = document.getElementById('online-count');
const messageList = document.getElementById('message-list');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const typingIndicator = document.getElementById('typing-indicator');

const emojiBtn = document.getElementById('emoji-btn');
const emojiPanel = document.getElementById('emoji-panel');
const themeBtn = document.getElementById('theme-btn');
const themeMenu = document.getElementById('theme-menu');
const notifBtn = document.getElementById('notif-btn');

const socket = io();
let me = null;
let typingTimeout = null;
const typingUsers = new Map(); // name -> timeout id

// Restore saved name for convenience (passcode is never stored)
const savedName = localStorage.getItem('family-chat-name');
if (savedName) nameInput.value = savedName;

joinForm.addEventListener('submit', (e) => {
  e.preventDefault();
  joinError.textContent = '';
  const name = nameInput.value.trim();
  const passcode = passcodeInput.value;
  if (!name || !passcode) return;
  socket.emit('join', { name, passcode });
});

socket.on('join-error', (msg) => {
  joinError.textContent = msg;
});

socket.on('joined', ({ familyName, you, history }) => {
  me = you;
  localStorage.setItem('family-chat-name', you.name);

  familyTitleEl.textContent = familyName;
  chatTitleEl.textContent = familyName;
  document.title = familyName;

  joinScreen.classList.add('hidden');
  chatScreen.classList.remove('hidden');

  messageList.innerHTML = '';
  history.forEach(renderMessage);
  scrollToBottom();
  messageInput.focus();
});

let onlineNames = [];

socket.on('presence', ({ online, count }) => {
  onlineCountEl.textContent = count;
  onlineNames = online.map(u => u.name);
  whoList.innerHTML = '';
  online.forEach(user => {
    const item = document.createElement('div');
    item.className = 'who-item';
    item.innerHTML = `
      <div class="avatar" style="background:${user.color}">
        ${initials(user.name)}
        <span class="dot"></span>
      </div>
      <span class="who-name">${escapeHtml(user.name)}</span>
    `;
    whoList.appendChild(item);
  });
});

socket.on('message', (msg) => {
  renderMessage(msg);
  scrollToBottom();
});

socket.on('mention', (msg) => {
  notifyMention(msg);
});

socket.on('typing', ({ name }) => {
  clearTimeout(typingUsers.get(name));
  typingUsers.set(name, setTimeout(() => {
    typingUsers.delete(name);
    updateTypingIndicator();
  }, 2000));
  updateTypingIndicator();
});

function updateTypingIndicator() {
  const names = Array.from(typingUsers.keys());
  if (names.length === 0) {
    typingIndicator.textContent = '';
  } else if (names.length === 1) {
    typingIndicator.textContent = `${names[0]} is typing…`;
  } else {
    typingIndicator.textContent = `${names.length} people are typing…`;
  }
}

messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;
  socket.emit('message', text);
  messageInput.value = '';
});

messageInput.addEventListener('input', () => {
  clearTimeout(typingTimeout);
  socket.emit('typing');
});

function renderMessage(msg) {
  const el = document.createElement('div');

  if (msg.type === 'system') {
    el.className = 'msg system';
    el.innerHTML = `<div class="msg-text">${escapeHtml(msg.text)}</div>`;
    messageList.appendChild(el);
    return;
  }

  const iMentioned = me && isMentioned(msg.text, me.name);
  el.className = 'msg' + (iMentioned ? ' mentions-me' : '');
  el.innerHTML = `
    <div class="avatar" style="background:${msg.color}">${initials(msg.name)}</div>
    <div class="msg-body">
      <div class="msg-meta">
        <span class="msg-name">${escapeHtml(msg.name)}</span>
        <span class="msg-time">${formatTime(msg.ts)}</span>
      </div>
      <div class="msg-text">${highlightMentions(msg.text)}</div>
    </div>
  `;
  messageList.appendChild(el);
}

// Wrap @name tokens (matching current online members, or @all/@everyone)
// in a highlighted span. Longest names are matched first so "@Sam" doesn't
// clip inside "@Samantha".
function highlightMentions(text) {
  const escaped = escapeHtml(text);
  const names = Array.from(new Set(onlineNames)).sort((a, b) => b.length - a.length);
  const tokens = [...names.map(escapeHtml), 'all', 'everyone'];
  if (tokens.length === 0) return escaped;
  const pattern = new RegExp('@(' + tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'gi');
  return escaped.replace(pattern, (match) => `<span class="mention-tag">${match}</span>`);
}

function isMentioned(text, name) {
  const lower = text.toLowerCase();
  return lower.includes('@' + name.toLowerCase()) || /@(all|everyone)\b/i.test(text);
}

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0].toUpperCase()).join('');
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function scrollToBottom() {
  messageList.scrollTop = messageList.scrollHeight;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Emoji picker ----------
const EMOJIS = [
  '😀','😂','🥰','😍','😊','😉','😎','🤔','😴','😢',
  '😮','🥳','👍','👎','🙏','👏','💪','🤝','👋','✌️',
  '❤️','💕','🔥','⭐','🎉','🎂','☀️','🌙','🌈','☕',
  '🍕','🍰','🐶','🐱','⚽','🎮','📸','🎵','✅','❓'
];
emojiPanel.innerHTML = EMOJIS.map(e => `<button type="button">${e}</button>`).join('');

emojiBtn.addEventListener('click', () => {
  themeMenu.classList.add('hidden');
  emojiPanel.classList.toggle('hidden');
});

emojiPanel.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const start = messageInput.selectionStart ?? messageInput.value.length;
  const end = messageInput.selectionEnd ?? messageInput.value.length;
  const val = messageInput.value;
  messageInput.value = val.slice(0, start) + btn.textContent + val.slice(end);
  const cursor = start + btn.textContent.length;
  messageInput.focus();
  messageInput.setSelectionRange(cursor, cursor);
});

// ---------- Theme picker ----------
const THEME_KEY = 'family-chat-theme';
function applyTheme(theme) {
  if (theme === 'classic') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
  localStorage.setItem(THEME_KEY, theme);
}
applyTheme(localStorage.getItem(THEME_KEY) || 'classic');

themeBtn.addEventListener('click', () => {
  emojiPanel.classList.add('hidden');
  themeMenu.classList.toggle('hidden');
});

themeMenu.addEventListener('click', (e) => {
  const btn = e.target.closest('.theme-option');
  if (!btn) return;
  applyTheme(btn.dataset.theme);
  themeMenu.classList.add('hidden');
});

document.addEventListener('click', (e) => {
  if (!emojiBtn.contains(e.target) && !emojiPanel.contains(e.target)) {
    emojiPanel.classList.add('hidden');
  }
  if (!themeBtn.contains(e.target) && !themeMenu.contains(e.target)) {
    themeMenu.classList.add('hidden');
  }
});

// ---------- @mention notifications ----------
if ('Notification' in window) {
  if (Notification.permission === 'default') {
    notifBtn.classList.remove('hidden');
  }
  notifBtn.addEventListener('click', () => {
    Notification.requestPermission().then(() => {
      notifBtn.classList.add('hidden');
    });
  });
}

function notifyMention(msg) {
  // Flash the tab title if the window isn't focused.
  if (document.hidden) {
    document.title = `💬 ${msg.name} tagged you!`;
    const restore = () => {
      document.title = document.getElementById('family-title')?.textContent || 'Family Table';
      window.removeEventListener('focus', restore);
    };
    window.addEventListener('focus', restore);
  }

  if ('Notification' in window && Notification.permission === 'granted') {
    const n = new Notification(`${msg.name} tagged you`, {
      body: msg.text,
      tag: 'family-chat-mention'
    });
    n.onclick = () => { window.focus(); n.close(); };
  }
}
