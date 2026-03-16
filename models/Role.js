const mongoose = require("mongoose");

const userRoleSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  roles: [{ type: String, enum: ['host', 'moderator'] }]
});

module.exports = mongoose.model("UserRole", userRoleSchema);