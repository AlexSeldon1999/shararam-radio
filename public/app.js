const tg = window.Telegram.WebApp;
tg.expand();

const socket = io();
let peer = null;
let currentRole = 'listener';
let hostStreamingPeerId = null;
let localStream = null;
let currentCall = null;

// Данные пользователя Telegram
const user = tg.initDataUnsafe?.user || { id: 12345, first_name: 'Слушатель (Тест)' };

// DOM Элементы
const chatBox = document.getElementById('chat-box');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const playBtn = document.getElementById('play-btn');
const audioPlayer = document.getElementById('audio-player');
const toggleStreamBtn = document.getElementById('toggle-stream-btn');
const adminPanel = document.getElementById('admin-panel');

// Анимация кнопки
const playIcon = document.querySelector('.play');
const pauseIcon = document.querySelector('.pause');
const circleBtn = document.querySelector('.circle__btn');
const wave1 = document.getElementById('wave1');
const wave2 = document.getElementById('wave2');

let isPlaying = false;

// Инициализация
async function initApp() {
  const res = await fetch('/api/check-role', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telegramId: user.id })
  });
  const data = await res.json();
  currentRole = data.role;
  
  if (data.isBanned) {
    chatInput.disabled = true;
    chatInput.placeholder = 'Вы забанены в чате';
  }

  if (currentRole === 'host') {
    adminPanel.style.display = 'block';
    document.getElementById('clear-chat-btn').style.display = 'flex';
  }
  if (currentRole === 'moderator') {
    document.getElementById('clear-chat-btn').style.display = 'flex';
  }

  updateMetaUI(data.streamState);
  initPeer();
}

// Инициализация WebRTC (PeerJS)
function initPeer() {
  peer = new Peer();
  peer.on('open', (id) => {
    console.log('Мой Peer ID:', id);
  });

  // Если мы ведущий, отвечаем на звонки слушателей
  peer.on('call', (call) => {
    if (currentRole === 'host' && localStream) {
      call.answer(localStream);
    }
  });
}

// Слушатель: подключение к потоку
function startListening() {
  if (!hostStreamingPeerId) {
    tg.showAlert('Эфир пока не начался!');
    return false;
  }
  currentCall = peer.call(hostStreamingPeerId, null);
  currentCall.on('stream', (stream) => {
    audioPlayer.srcObject = stream;
    audioPlayer.play();
  });
  return true;
}

function stopListening() {
  audioPlayer.srcObject = null;
  if (currentCall) currentCall.close();
}

// Ведущий: Начать эфир (захват вкладки)
toggleStreamBtn.addEventListener('click', async () => {
  if (localStream) {
    // Остановка
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
    socket.emit('host_stopped');
    toggleStreamBtn.querySelector('p').innerText = 'Начать эфир';
  } else {
    // Запуск
    try {
      localStream = await navigator.mediaDevices.getDisplayMedia({ video: false, audio: true });
      socket.emit('host_started', peer.id);
      toggleStreamBtn.querySelector('p').innerText = 'Остановить эфир';
      
      localStream.getTracks()[0].onended = () => {
        localStream = null;
        socket.emit('host_stopped');
        toggleStreamBtn.querySelector('p').innerText = 'Начать эфир';
      };
    } catch (err) {
      tg.showAlert('Ошибка захвата звука: ' + err.message);
    }
  }
});

// Управление кнопкой Play
playBtn.addEventListener('click', (e) => {
  if (!isPlaying) {
    if (startListening()) togglePlayUI(true);
  } else {
    stopListening();
    togglePlayUI(false);
  }
});

function togglePlayUI(play) {
  isPlaying = play;
  if(play) {
    playIcon.classList.add('visibility');
    pauseIcon.classList.remove('visibility');
    circleBtn.classList.add('shadow');
    wave1.classList.remove('paused');
    wave2.classList.remove('paused');
    wave1.style.display = 'block'; wave2.style.display = 'block';
  } else {
    playIcon.classList.remove('visibility');
    pauseIcon.classList.add('visibility');
    circleBtn.classList.remove('shadow');
    wave1.style.display = 'none'; wave2.style.display = 'none';
  }
}

// Сокеты: Обновления метаданных
socket.on('update_meta', (meta) => {
  hostStreamingPeerId = meta.hostPeerId;
  updateMetaUI(meta);
  if (!hostStreamingPeerId && isPlaying) {
    stopListening();
    togglePlayUI(false);
    tg.showAlert('Эфир завершен ведущим.');
  }
});

function updateMetaUI(meta) {
  document.getElementById('meta-track').innerText = meta.track;
  document.getElementById('meta-host').innerText = meta.hostName;
  document.getElementById('meta-server').innerText = meta.serverName;
  document.getElementById('meta-location').innerText = meta.location;
}

// Ведущий: Отправка метаданных
document.getElementById('update-meta-btn')?.addEventListener('click', () => {
  const track = document.getElementById('input-track').value || 'Неизвестно';
  const serverName = document.getElementById('input-server').value;
  const location = document.getElementById('input-location').value || 'Где-то';
  socket.emit('update_meta', { track, hostName: user.first_name, serverName, location });
});

// Сокеты: Чат
socket.on('listeners_count', count => document.getElementById('listener-count').innerText = count);

socket.on('new_message', (msg) => {
  const div = document.createElement('div');
  div.className = 'chat-msg';
  div.id = `msg-${msg.id}`;
  
  let modTools = '';
  if (currentRole === 'moderator' || currentRole === 'host') {
    modTools = `
      <ion-icon name="close-circle" class="mod-btn" onclick="deleteMsg(${msg.id})"></ion-icon>
      <ion-icon name="hammer" class="mod-btn" onclick="banUser(${msg.telegramId})"></ion-icon>
    `;
  }

  div.innerHTML = `[${msg.time}] <span class="name">${msg.name}:</span> ${msg.text} ${modTools}`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
});

socket.on('message_deleted', (msgId) => {
  const msgEl = document.getElementById(`msg-${msgId}`);
  if (msgEl) msgEl.remove();
});

socket.on('chat_cleared', () => { chatBox.innerHTML = ''; });
socket.on('chat_error', (err) => { tg.showAlert(err); });

// Отправка сообщений
sendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') sendMessage() });

function sendMessage() {
  const text = chatInput.value.trim();
  if (!text || chatInput.disabled) return;
  socket.emit('send_message', { telegramId: user.id, name: user.first_name, text });
  chatInput.value = '';
}

// Функции модерации (глобальные для onclick)
window.deleteMsg = (id) => socket.emit('delete_message', id);
window.banUser = (id) => { if(confirm('Забанить пользователя?')) socket.emit('ban_user', id); };
document.getElementById('clear-chat-btn').addEventListener('click', () => {
  if(confirm('Очистить весь чат?')) socket.emit('clear_chat');
});

initApp();