import { NextResponse } from 'next/server';

/**
 * API endpoint for logging client-side errors
 * This is called by ErrorBoundary and can be used for centralized error logging
 */
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { error, errorInfo, timestamp } = req.body;

        // In production, you would send this to your logging service
        // For now, we'll just log to console (will be removed in production by next.config)
        console.error('Client Error Logged:', {
            error,
            errorInfo,
            timestamp,
            userAgent: req.headers['user-agent'],
            url: req.headers.referer,
        });

        // Optionally, send to external logging service like Sentry, LogRocket, etc.
        // if (process.env.SENTRY_DSN && global.Sentry) {
        //   global.Sentry.captureException(new Error(error), {
        //     extra: { errorInfo, timestamp },
        //   });
        // }

        // You could also store in database for analytics
        // await ErrorLog.create({ error, errorInfo, timestamp, ...metadata });

        return res.status(200).json({ success: true, message: 'Error logged' });
    } catch (err) {
        console.error('Failed to log error:', err);
        return res.status(500).json({ error: 'Failed to log error' });
    }
}
