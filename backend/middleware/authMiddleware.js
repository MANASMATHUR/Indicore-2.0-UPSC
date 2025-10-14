module.exports = function(req, res, next) {
    const { email } = req.query;
    if (!email) return res.status(401).json({ error: 'Unauthorized' });
    next();
};
