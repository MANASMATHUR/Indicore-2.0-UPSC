const { Chat } = require('../utils/store');

module.exports = async (req, res) => {
  const { id } = req.query || {};
  const chat = id ? await Chat.findById(id).lean() : null;
  res.json({ chat });
};


