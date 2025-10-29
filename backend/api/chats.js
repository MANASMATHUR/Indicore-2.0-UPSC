const { Chat } = require('../utils/store');

module.exports = async (req, res) => {
  const chats = await Chat.find({}).limit(10).lean();
  res.json({ chats });
};


