const TelegramBot = require('node-telegram-bot-api');
const Role = require('../models/Role');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true }); // Для Render/Heroku polling подойдет на начальном этапе
const appUrl = process.env.APP_URL;
const adminIds = process.env.ADMIN_IDS.split(',').map(Number);

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Добро пожаловать на радио!', {
    reply_markup: {
      inline_keyboard: [[{ text: '🎧 Открыть радио', web_app: { url: appUrl } }]]
    }
  });
});

// Админ команды
bot.onText(/\/(add|remove)_role (\d+) (host|moderator)/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!adminIds.includes(chatId)) return bot.sendMessage(chatId, 'Отказано в доступе.');

  const action = match[1];
  const targetId = Number(match[2]);
  const role = match[3];

  if (action === 'add') {
    await Role.findOneAndUpdate({ telegramId: targetId }, { telegramId: targetId, role }, { upsert: true });
    bot.sendMessage(chatId, `Роль ${role} выдана пользователю ${targetId}`);
  } else {
    await Role.findOneAndDelete({ telegramId: targetId });
    bot.sendMessage(chatId, `Роли пользователя ${targetId} удалены.`);
  }
});