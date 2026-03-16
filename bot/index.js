const TelegramBot = require('node-telegram-bot-api');
const UserRole = require("../models/UserRole");
const BannedUser = require("../models/BannedUser");
const ADMIN_IDS = process.env.ADMIN_IDS.split(",").map(id => id.trim());

const URL = process.env.APP_URL;

let bot;
module.exports.run = function() {
  if (!process.env.BOT_TOKEN) return;
  bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

  bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id,
      'Shararam Radio!\n\n🔊 Слушать радио, общаться и быть ведущим — прямо в Telegram! Жми кнопку ниже.',
      {
        reply_markup: {
          inline_keyboard: [[{
            text: "Открыть радио",
            web_app: { url: URL }
          }]]
        }
      }
    );
  });

  // Команды для управления ролями (admin only)
  bot.onText(/\/add_role (\d+) (host|moderator)/, async (msg, match) => {
    if (!ADMIN_IDS.includes(String(msg.from.id))) return;
    const [_, telegramId, role] = match;
    let user = await UserRole.findOne({ telegramId });
    if (!user) user = new UserRole({ telegramId, roles: [role] });
    else if (!user.roles.includes(role)) user.roles.push(role);
    await user.save();
    bot.sendMessage(msg.chat.id, `Роль ${role} назначена пользователю ${telegramId}`);
  });

  bot.onText(/\/remove_role (\d+) (host|moderator)/, async (msg, match) => {
    if (!ADMIN_IDS.includes(String(msg.from.id))) return;
    const [_, telegramId, role] = match;
    let user = await UserRole.findOne({ telegramId });
    if (!user || !user.roles.includes(role)) {
      bot.sendMessage(msg.chat.id, `Нет такой роли у пользователя ${telegramId}`);
      return;
    }
    user.roles = user.roles.filter(r => r !== role);
    await user.save();
    bot.sendMessage(msg.chat.id, `Роль ${role} удалена у пользователя ${telegramId}`);
  });

  bot.onText(/\/list_roles/, async (msg) => {
    if (!ADMIN_IDS.includes(String(msg.from.id))) return;
    let users = await UserRole.find({});
    let text = users.map(u => `${u.telegramId}: ${u.roles.join(", ")}`).join("\n");
    if (!text) text = "Нет назначенных ролей";
    bot.sendMessage(msg.chat.id, text);
  });
};