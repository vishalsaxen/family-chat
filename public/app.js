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

socket.on('presence', ({ online, count }) => {
  onlineCountEl.textContent = count;
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

  el.className = 'msg';
  el.innerHTML = `
    <div class="avatar" style="background:${msg.color}">${initials(msg.name)}</div>
    <div class="msg-body">
      <div class="msg-meta">
        <span class="msg-name">${escapeHtml(msg.name)}</span>
        <span class="msg-time">${formatTime(msg.ts)}</span>
      </div>
      <div class="msg-text">${escapeHtml(msg.text)}</div>
    </div>
  `;
  messageList.appendChild(el);
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
