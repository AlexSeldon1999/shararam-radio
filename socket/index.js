const BannedUser = require('../models/BannedUser');

module.exports = function (io, streamState) {
  let listenersCount = 0;

  io.on('connection', (socket) => {
    listenersCount++;
    io.emit('listeners_count', listenersCount);
    socket.emit('update_meta', streamState);

    // Чат: новое сообщение
    socket.on('send_message', async (data) => {
      const { telegramId, name, text } = data;
      const isBanned = await BannedUser.exists({ telegramId });
      if (isBanned) return socket.emit('chat_error', 'Вы забанены в чате.');
      
      const message = { id: Date.now(), telegramId, name, text, time: new Date().toLocaleTimeString() };
      io.emit('new_message', message);
    });

    // Модерация: удаление и бан
    socket.on('delete_message', (msgId) => {
      io.emit('message_deleted', msgId);
    });

    socket.on('ban_user', async (telegramId) => {
      await BannedUser.findOneAndUpdate({ telegramId }, { telegramId }, { upsert: true });
      io.emit('user_banned', telegramId);
    });

    socket.on('clear_chat', () => {
      io.emit('chat_cleared');
    });

    // Ведущий: управление потоком и метаданными
    socket.on('host_started', (peerId) => {
      streamState.hostPeerId = peerId;
      io.emit('update_meta', streamState);
    });

    socket.on('host_stopped', () => {
      streamState.hostPeerId = null;
      io.emit('update_meta', streamState);
    });

    socket.on('update_meta', (newMeta) => {
      Object.assign(streamState, newMeta);
      io.emit('update_meta', streamState);
    });

    socket.on('disconnect', () => {
      listenersCount--;
      io.emit('listeners_count', listenersCount);
    });
  });
};