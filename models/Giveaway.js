const mongoose = require('mongoose');

const giveawaySchema = new mongoose.Schema({
  _id: String,
  channel: String,
  message: String,
  item: String,
  endsAt: Date,
  winners: Number,
  participants: [String],
});

module.exports = mongoose.model('Giveaway', giveawaySchema);
