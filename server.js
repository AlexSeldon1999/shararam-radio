require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// База данных
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB подключена'))
  .catch(err => console.error('Ошибка БД:', err));

// Подключение моделей и модулей
const Role = require('./models/Role');
const BannedUser = require('./models/BannedUser');
require('./bot/index'); // Запуск бота
const setupSocket = require('./socket/index');

// Глобальное состояние эфира
const streamState = {
  hostPeerId: null,
  track: 'Музыкальная пауза',
  hostName: 'Автодиджей',
  serverName: 'Суматоха',
  location: 'Главная Площадь'
};

// API: Проверка роли пользователя при входе
app.post('/api/check-role', async (req, res) => {
  const { telegramId } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'No ID' });

  const roleDoc = await Role.findOne({ telegramId });
  const isBanned = await BannedUser.exists({ telegramId });
  
  const role = roleDoc ? roleDoc.role : 'listener';
  res.json({ role, isBanned: !!isBanned, streamState });
});

setupSocket(io, streamState);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));