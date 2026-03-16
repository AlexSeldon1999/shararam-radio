const BannedUser = require("../models/BannedUser");
const UserRole = require("../models/UserRole");

let listeners = 0;
let messages = [];
let streamMeta = {
  title: 'Музыкальная пауза',
  host: 'Автодиджей',
  server: 'Суматоха',
  location: 'Главная Площадь'
};

module.exports = function(io) {
  io.on('connection', async (socket) => {
    listeners++;
    io.emit('listeners', listeners);

    socket.emit("meta", streamMeta);
    socket.emit("messages", messages);

    // Новое сообщение
    socket.on("chat:message", async (data) => {
      const { telegramId, text, name } = data;
      if (await BannedUser.findOne({ telegramId })) return;

      const msg = {
        id: Date.now().toString() + Math.floor(Math.random()*1000), // уникальный id
        from: name || "Гость",
        text,
        telegramId
      };
      messages.push(msg);
      io.emit("chat:message", msg);
    });

    // Бан юзера
    socket.on("chat:ban", async ({ telegramId }) => {
      await BannedUser.updateOne({ telegramId }, { telegramId }, { upsert: true });
      io.emit("chat:ban", telegramId);
    });

    // Удаление сообщения
    socket.on("chat:delete", ({ id }) => {
      messages = messages.filter(m => m.id !== id);
      io.emit("chat:delete", id);
    });

    // Очистить чат (только для модератора/ведущего)
    socket.on("chat:clear", () => {
      messages = [];
      io.emit("chat:clear");
    });

    // Метаданные эфира
    socket.on("update_meta", (meta) => {
      Object.assign(streamMeta, meta);
      io.emit("meta", streamMeta);
    });

    // Ведущий обьявляет свой PeerId (для WebRTC аудио)
    socket.on("host-peer", ({hostPeerId}) => {
      // Бэкенд отдаёт этот hostPeerId всем слушателям
      io.emit("host-peer", hostPeerId);
    });

    socket.on('disconnect', () => {
      listeners--;
      if (listeners < 0) listeners = 0;
      io.emit('listeners', listeners);
    });
  });
};