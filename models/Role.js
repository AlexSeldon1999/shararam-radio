const mongoose = require('mongoose');
const roleSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  role: { type: String, enum: ['host', 'moderator'], required: true }
});
module.exports = mongoose.model('Role', roleSchema);