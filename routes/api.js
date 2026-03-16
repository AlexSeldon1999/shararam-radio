const express = require("express");
const UserRole = require("../models/UserRole");
const BannedUser = require("../models/BannedUser");
const crypto = require("crypto");
const router = express.Router();

// Проверка подписи от Telegram
function checkTelegramAuth(initData) {
  // Простая проверка: по-хорошему нужен весь механизм проверки!
  return true;
}

// Проверка роли пользователя
router.get("/check-role", async (req, res) => {
  const { initData } = req.query;

  // Парсим telegramId (упрощённо для демо)
  try {
    const urlParams = new URLSearchParams(initData);
    const telegramId = urlParams.get("user") ? JSON.parse(urlParams.get("user")).id : null;

    if (!telegramId)
      return res.json({ role: "listener", telegramId: null });

    const banned = await BannedUser.findOne({ telegramId });
    if (banned)
      return res.json({ role: "banned", telegramId });

    const user = await UserRole.findOne({ telegramId });
    let role = "listener";
    if (user) {
      if (user.roles.includes("host")) role = "host";
      else if (user.roles.includes("moderator")) role = "moderator";
    }
    res.json({ role, telegramId });
  } catch (e) {
    res.json({ role: "listener", telegramId: null });
  }
});

// Получить PeerID ведущего (PeerJS)
let currentStream = { hostPeerId: null };
router.get("/stream-info", (req, res) => {
  res.json(currentStream);
});
router.post("/set-host-peer", (req, res) => {
  currentStream.hostPeerId = req.body.hostPeerId;
  res.json({success: true});
});

module.exports = router;