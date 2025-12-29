/**
 * Authentication Utilities
 * Handles password hashing, validation, and token generation
 */

import bcrypt from 'bcryptjs';
import crypto from 'crypto';

/**
 * Password validation rules
 */
export const PASSWORD_RULES = {
    minLength: 8,
    requireUppercase: true,
    requireNumber: true,
    requireSpecialChar: true,
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
export function validatePassword(password) {
    const errors = [];

    if (!password || typeof password !== 'string') {
        return { valid: false, errors: ['Password is required'] };
    }

    if (password.length < PASSWORD_RULES.minLength) {
        errors.push(`Password must be at least ${PASSWORD_RULES.minLength} characters long`);
    }

    if (PASSWORD_RULES.requireUppercase && !/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }

    if (PASSWORD_RULES.requireNumber && !/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }

    if (PASSWORD_RULES.requireSpecialChar && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Hash password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Hashed password
 */
export async function hashPassword(password) {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
}

/**
 * Compare password with hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} - True if password matches
 */
export async function comparePassword(password, hash) {
    return await bcrypt.compare(password, hash);
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid email format
 */
export function validateEmail(email) {
    if (!email || typeof email !== 'string') return false;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.toLowerCase());
}

/**
 * Generate random token for email verification
 * @returns {string} - Random token
 */
export function generateVerificationToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Sanitize email (lowercase, trim)
 * @param {string} email - Email to sanitize
 * @returns {string} - Sanitized email
 */
export function sanitizeEmail(email) {
    if (!email || typeof email !== 'string') return '';
    return email.toLowerCase().trim();
}
