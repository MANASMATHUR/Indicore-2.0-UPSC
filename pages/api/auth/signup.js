/**
 * User Signup API
 * Handles email/password user registration
 */

import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import { validateEmail, validatePassword, hashPassword, sanitizeEmail } from '@/lib/authUtils';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { name, email, password } = req.body;

        // Validate required fields
        if (!name || !email || !password) {
            return res.status(400).json({
                error: 'Missing required fields',
                details: 'Name, email, and password are required'
            });
        }

        // Validate email format
        if (!validateEmail(email)) {
            return res.status(400).json({
                error: 'Invalid email format',
                details: 'Please provide a valid email address'
            });
        }

        // Validate password strength
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            return res.status(400).json({
                error: 'Weak password',
                details: passwordValidation.errors
            });
        }

        // Sanitize email
        const sanitizedEmail = sanitizeEmail(email);

        // Connect to database
        await connectToDatabase();

        // Check if user already exists
        const existingUser = await User.findOne({ email: sanitizedEmail });
        if (existingUser) {
            return res.status(409).json({
                error: 'User already exists',
                details: 'An account with this email already exists. Please sign in instead.'
            });
        }

        // Hash password
        const hashedPassword = await hashPassword(password);

        // Create new user
        const newUser = await User.create({
            name: name.trim(),
            email: sanitizedEmail,
            password: hashedPassword,
            authProvider: 'email',
            lastLogin: new Date(),
        });

        // Return success (don't send password back)
        return res.status(201).json({
            success: true,
            message: 'Account created successfully',
            user: {
                id: newUser._id.toString(),
                name: newUser.name,
                email: newUser.email,
                authProvider: newUser.authProvider,
            }
        });

    } catch (error) {
        console.error('Signup error:', error);

        // Handle duplicate key error (race condition)
        if (error.code === 11000) {
            return res.status(409).json({
                error: 'User already exists',
                details: 'An account with this email already exists.'
            });
        }

        return res.status(500).json({
            error: 'Internal server error',
            details: 'Failed to create account. Please try again.'
        });
    }
}
