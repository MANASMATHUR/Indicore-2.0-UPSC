require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { setDbReady } = require('./utils/store');

const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // replaces body-parser
app.use('/static', express.static('public')); // serve static files (avatars, images)

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
        console.log('MongoDB connected');
        setDbReady(true);
    })
    .catch(err => {
        console.error('MongoDB connection failed, using in-memory store.', err.message);
        setDbReady(false);
    });

// Routes
app.use('/api/auth', require('./api/auth'));
app.use('/api/chats', require('./api/chats'));
app.use('/api/chat', require('./api/chat'));
app.use('/api/ping', require('./api/ping'));
app.use('/api/echo', require('./api/echo'));

// Start Server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
