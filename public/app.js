const socket = io();
let userRole = "listener";
let telegramId = null, userName = "Гость", userAvatar = "";
let banned = false, hostPeerId = null, isBroadcasting = false, localStream = null, peer = null;
let hostUser = { name: "Автодиджей", avatar: "" };

// Получим initData Telegram
const tg = Telegram.WebApp;
tg.ready();
let urlParams = new URLSearchParams(tg.initData);
if (urlParams.has("user")) {
  let u = JSON.parse(urlParams.get("user"));
  telegramId = u.id;
  userName = u.first_name ?? u.username ?? "Гость";
  userAvatar = u.photo_url ?? "https://telegram.org/img/t_logo.svg";
}

// Проверка роли+бана и загрузка инфо юзера/аватара
fetch(`/api/check-role?initData=${tg.initData || ""}`)
  .then(r => r.json())
  .then((data) => {
    userRole = data.role;
    telegramId = data.telegramId || telegramId;
    if (userRole === "banned") {
      banned = true;
      showBanned();
    }
    renderAdminPanel();
  });

function showBanned() {
  document.getElementById("msg-input").disabled = true;
  document.getElementById("messages-block").insertAdjacentHTML("beforeend",
    `<div class="banned-label">
      🚫 Вас забанили! Чат закрыт, но эфир можно слушать.
    </div>`
  );
}

// Смена темы
const themeSelect = document.getElementById("theme-select");
themeSelect.onchange = ()=> {
  document.body.className = `theme-${themeSelect.value}`;
};
themeSelect.value = "lavender";
document.body.className = "theme-lavender";

// Анимированный заголовок
function animateTitle() {
  const el = document.getElementById('main-title');
  if(!el) return;
  el.style.filter = `drop-shadow(0 2px 32px #e655ff9a) blur(0.5px)`;
}
setInterval(animateTitle, 1000);

// Ловим актуальный PeerJS host-а
socket.on("host-peer", id=>{ hostPeerId = id; });

// Кол-во слушателей
socket.on('listeners', cnt => {
  document.getElementById("listeners-block").innerHTML = `👥 ${cnt}`;
});

// Метаданные эфира (треки, ведущий, сервер, локация)
socket.on('meta', meta => {
  document.getElementById("meta-title").textContent = meta.title || "";
  document.getElementById("meta-host").textContent = meta.host || "";
  document.getElementById("meta-server").textContent = meta.server || "";
  document.getElementById("meta-location").textContent = meta.location || "";
  // Для аватарки ведущего
  if(meta.hostUser && meta.hostUser.avatar) {
    document.getElementById("host-avatar").src = meta.hostUser.avatar;
  } else {
    document.getElementById("host-avatar").src = "/tg.svg";
  }
});

// Чат-логика
socket.on("messages", msgs => renderMessages(msgs));
socket.on("chat:message", msg => addMessage(msg));
socket.on("chat:delete", id => deleteMessage(id));
socket.on("chat:clear", ()=> renderMessages([]));
socket.on("chat:ban", id=>{
  if(id === telegramId) {
    banned=true;showBanned();document.getElementById("msg-input").disabled=true;
  }
});

// Отправка сообщения
document.getElementById("message-form").addEventListener("submit", (e)=>{
  e.preventDefault();
  if (banned) return;
  let text = document.getElementById("msg-input").value.trim();
  if(!text) return;
  socket.emit("chat:message", {
    telegramId, name: userName, text, avatar: userAvatar
  });
  document.getElementById("msg-input").value = "";
});
function addMessage(msg) {
  const msgBlock = document.getElementById("messages-block");
  let actions = "";
  if(["host","moderator"].includes(userRole)) {
    actions = `<span class="msg-actions">
      <button class="msg-btn" onclick="banUser(${msg.telegramId})">Ban</button>
      <button class="msg-btn" onclick="deleteMsg('${msg.id}')">✖</button>
    </span>`;
  }
  let row = document.createElement("div");
  row.className = "msg-row";
  row.id = "msg-"+msg.id;
  row.innerHTML = `
    <img src="${msg.avatar || "/tg.svg"}" class="msg-avatar" alt="avatar">
    <span class="msg-from">${msg.from}</span>
    <span class="msg-text">${msg.text}</span>${actions}`;
  msgBlock.append(row);
  msgBlock.scrollTop = msgBlock.scrollHeight;
  window.banUser = (tid) => socket.emit("chat:ban", {telegramId:tid});
  window.deleteMsg = (id) => socket.emit("chat:delete", {id});
}
function renderMessages(msgs) {
  document.getElementById("messages-block").innerHTML = "";
  (msgs || []).forEach(addMessage);
}

// Эфир через PeerJS
document.getElementById("play-btn").onclick = async function() {
  if(this.classList.contains("playing")) { stopAudio(); return; }
  socket.emit("host-peer", {});
  socket.once("host-peer", function(hid) {
    if (!hid) return alert("В эфире никого нет!");
    peer = new Peer();
    peer.on("open", () => {
      const call = peer.call(hid, null);
      call.on("stream", function (stream) {
        document.getElementById("radio-audio").srcObject = stream;
        document.getElementById("radio-audio").play();
        document.getElementById("play-btn").classList.add("playing");
        document.getElementById("play-btn").innerHTML = "Стоп ⏹";
      });
      call.on("close", stopAudio);
    });
  });
};
function stopAudio() {
  try {
    document.getElementById("radio-audio").pause();
    document.getElementById("radio-audio").srcObject = null;
    document.getElementById("play-btn").classList.remove("playing");
    document.getElementById("play-btn").innerHTML = "Слушать эфир ▶️";
    peer?.destroy();
  } catch(e) {}
}

// --- Панель ведущего / модератора ---
function renderAdminPanel() {
  const block = document.getElementById("admin-panel");
  if(userRole === "host") {
    block.innerHTML = `
      <form id="host-panel">
        <button id="btn-broadcast">${isBroadcasting ? "Остановить эфир" : "Начать эфир"}</button>
        <div style="margin:14px 0 8px 0;">
          <input type="text" id="input-track" placeholder="Трек" style="width:90%;margin-bottom:7px;"/>
          <input type="text" id="input-host" placeholder="Ведущий" value="${userName}" style="width:90%;margin-bottom:7px;"/>
          <input type="text" id="input-server" placeholder="Сервер" style="width:90%;margin-bottom:7px;">
          <input type="text" id="input-location" placeholder="Локация" style="width:90%;">
        </div>
        <button id="btn-update" type="button">Обновить эфир</button>
      </form>`;
    document.getElementById("btn-broadcast").addEventListener("click", startOrStopBroadcast);
    document.getElementById("btn-update").addEventListener("click", () => {
      let title = document.getElementById("input-track").value || "";
      let host = document.getElementById("input-host").value||userName;
      let server = document.getElementById("input-server").value;
      let location = document.getElementById("input-location").value;
      socket.emit("update_meta", { title, host, server, location, hostUser: {name:host, avatar:userAvatar}});
    });
  } else if(userRole === "moderator") {
    block.innerHTML = `<button id="btn-clear-chat" style="margin:12px 0;">Очистить чат 💢</button>`;
    document.getElementById("btn-clear-chat").onclick = () =>
      socket.emit("chat:clear");
  } else {
    block.innerHTML = "";
  }
}

// Ведущий эфирирует
function startOrStopBroadcast(e) {
  e.preventDefault();
  if(isBroadcasting) { stopBroadcast(); return; }
  navigator.mediaDevices.getDisplayMedia({ video: false, audio: true })
    .then(stream=>{
      localStream = stream; isBroadcasting = true;
      document.getElementById("btn-broadcast").textContent = "Остановить эфир";
      peer = new Peer("host-"+telegramId);
      peer.on("open", id=>{
        hostPeerId = id;
        socket.emit("host-peer", {hostPeerId:id});
      });
      peer.on("call", (call) => {
        call.answer(localStream);
        call.on('close', stopBroadcast);
      });
    }).catch(()=>{alert("Нет доступа к микрофону/звуку!");});
}
function stopBroadcast() {
  if(!localStream) return;
  localStream.getTracks().forEach(tr=>tr.stop());
  document.getElementById("btn-broadcast").textContent = "Начать эфир";
  isBroadcasting = false;
  localStream = null;
  peer?.destroy();
}

renderAdminPanel();