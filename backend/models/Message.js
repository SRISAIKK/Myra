const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true }, // simple: "global" or "<user1>_<user2>"
    sender: { type: String, required: true }, // username
    text: { type: String, default: '' },
    fileUrl: { type: String, default: null },
    fileName: { type: String, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Message', messageSchema);
