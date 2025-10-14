const express = require('express');
const router = express.Router();
const { findOrCreateUserByEmail } = require('../utils/store');

// Google login verification (JWT token from frontend)
router.post('/google', async (req, res) => {
    try {
        const { googleId, name, email } = req.body;

        // Store only googleId and name, no picture/avatar in DB
        const user = await findOrCreateUserByEmail(email, { 
            googleId, 
            name
        });

        res.json({ success: true, user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
});

module.exports = router;
