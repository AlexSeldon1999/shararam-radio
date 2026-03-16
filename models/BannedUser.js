const mongoose = require('mongoose');
const bannedUserSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true }
});
module.exports = mongoose.model('BannedUser', bannedUserSchema);