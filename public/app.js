const socket = io();
let userRole = "listener";
let telegramId = null;
let banned = false;
let userName = "Гость";
let hostPeerId = null;
let peerAudio = null;
let peer = null;

// Получение данных Telegram
if(window.Telegram && Telegram.WebApp && Telegram.WebApp.initData) {
  Telegram.WebApp.ready();
  try {
    let urlParams = new URLSearchParams(Telegram.WebApp.initData);
    const user = JSON.parse(urlParams.get("user") || "{}");
    telegramId = user.id;
    userName = user.first_name || user.last_name || user.username || "Гость";
  } catch (e) {}
}

// Проверка роли, статуса, бана
fetch(`/api/check-role?initData=${Telegram.WebApp.initData || ""}`)
  .then(r => r.json())
  .then(data => {
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
      🚫 Вы забанены. Чтение эфира доступно, но чат закрыт.
    </div>`
  );
}

// Подсчёт слушателей
socket.on('listeners', cnt => {
  document.getElementById("listeners-block").innerHTML = `👥 ${cnt}`;
});

// Метаданные эфира (название трека и пр)
socket.on('meta', meta => {
  document.getElementById("meta-title").textContent = meta.title || "";
  document.getElementById("meta-host").textContent = meta.host || "";
  document.getElementById("meta-server").textContent = meta.server || "";
  document.getElementById("meta-location").textContent = meta.location || "";
});

// Переписка
socket.on("messages", ms => {
  renderMessages(ms);
});
socket.on("chat:message", msg => {
  addMessage(msg);
});
socket.on("chat:delete", id => {
  deleteMessage(id);
});
socket.on("chat:clear", () => {
  renderMessages([]);
});
socket.on("chat:ban", id => {
  if(id === telegramId) {
    banned = true; showBanned();
    document.getElementById("msg-input").disabled = true;
  }
});

// Отправка сообщения
document.getElementById("message-form").addEventListener("submit", (e)=>{
  e.preventDefault();
  if (banned) return;
  let text = document.getElementById("msg-input").value.trim();
  if(!text) return;
  socket.emit("chat:message", {
    telegramId: telegramId,
    name: userName,
    text
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
  row.innerHTML = `<span class="msg-from">${msg.from}</span>
    <span class="msg-text">${msg.text}</span>${actions}`;
  msgBlock.append(row);
  msgBlock.scrollTop = msgBlock.scrollHeight;
  window.banUser = (tid) => socket.emit("chat:ban", {telegramId: tid});
  window.deleteMsg = (id) => socket.emit("chat:delete", {id});
}
function renderMessages(msgs) {
  document.getElementById("messages-block").innerHTML = "";
  (msgs || []).forEach(addMessage);
}

// --- Эфир и WebRTC через PeerJS
document.getElementById("play-btn").onclick = async function() {
  if(this.classList.contains("playing")) {
    stopAudio();
    return;
  }
  socket.emit("host-peer", {}); // запросить актуальный PeerID
  socket.once("host-peer", async function (hid) {
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

// --- Панель ведущего / модератора
const serversList = ["Суматоха","Переполох","Позитивчик","Солнечный день"];
const locationsList = [
"Пляж Лазурный","Автодром","Ромашковая долина","Сити","Автосалон","Экомаркет",
"Заводик","Бюро путешествий","Аэрополис","ЦУМ","Кафе","Игролэнд","Египет","Страна Роботов","Джунгли",
"Мюра","Космодром","Дремучий Лес","Парк аттракционов","Площадь у Больнички","Площадь Перед Диско",
"Больничка","Школа Магов","Каньон","Главная Площадь","Детский Садик","Смешмаг","Дом Мод","Пиратская Бухта","Морской Порт",
"Подводный мир","Умная Гора","Заповедник","Волшебный сад","Снежная Гора","КосмоСтанция","Студия Блогеров","Диско"
];

function renderAdminPanel() {
  const block = document.getElementById("admin-panel");
  if(userRole === "host") {
    block.innerHTML = `
      <form id="host-panel">
        <button id="btn-broadcast">${isBroadcasting ? "Остановить эфир" : "Начать эфир"}</button>
        <div style="margin:12px 0 7px 0;">
          <input type="text" id="input-track" placeholder="Трек" style="width:90%;margin-bottom:7px;"/>
          <input type="text" id="input-host" placeholder="Ведущий" value="${userName}" style="width:90%;margin-bottom:7px;"/>
          <select id="select-server">${serversList.map(s=>`<option>${s}</option>`)}</select>
          <select id="select-location">${locationsList.map(l=>`<option>${l}</option>`)}</select>
          <input type="text" id="input-location" placeholder="Другое местоположение" style="width:86%;margin-bottom:6px"/>
        </div>
        <button id="btn-update" type="button">Обновить эфир</button>
      </form>`;
    document.getElementById("btn-broadcast").addEventListener("click", startOrStopBroadcast);
    document.getElementById("btn-update").addEventListener("click", () => {
      let title = document.getElementById("input-track").value||"";
      let host = document.getElementById("input-host").value||userName;
      let server = document.getElementById("select-server").value;
      let location = document.getElementById("input-location").value.trim() || document.getElementById("select-location").value;
      socket.emit("update_meta", {title, host, server, location});
    });
  } else if(userRole === "moderator") {
    block.innerHTML = `<button id="btn-clear-chat" style="margin:10px 0;">Очистить чат 💢</button>`;
    document.getElementById("btn-clear-chat").onclick = () =>
      socket.emit("chat:clear");
  } else {
    block.innerHTML = "";
  }
}

// ВЕДУЩИЙ: ЭФИР (WebRTC)
let isBroadcasting = false;
let localStream = null;
function startOrStopBroadcast(e) {
  e.preventDefault();
  if(isBroadcasting) {
    stopBroadcast();
    return;
  }
  navigator.mediaDevices.getDisplayMedia({ video: false, audio: true })
    .then(stream=>{
      localStream = stream;
      isBroadcasting = true;
      document.getElementById("btn-broadcast").textContent = "Остановить эфир";
      peer = new Peer("host-"+telegramId);
      peer.on("open", id=>{
        hostPeerId = id;
        socket.emit("host-peer", {hostPeerId: id});
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
  // (дополнительно можно сбросить мета/peerId)
}

// Модератор может банить, удалять сообщения (см. addMessage выше)
renderAdminPanel();