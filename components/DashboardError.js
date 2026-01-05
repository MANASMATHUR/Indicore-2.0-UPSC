'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import {
    AlertCircle,
    RefreshCw,
    Wifi,
    WifiOff,
    XCircle,
    HelpCircle
} from 'lucide-react';

/**
 * Dashboard Error Component
 * Handles different error types with appropriate UI and actions
 */
export default function DashboardError({
    error,
    onRetry,
    type = 'general'
}) {
    const errorConfigs = {
        network: {
            icon: WifiOff,
            title: 'Connection Issue',
            message: 'Unable to connect to the server. Please check your internet connection.',
            color: 'orange',
            action: 'Retry Connection'
        },
        timeout: {
            icon: AlertCircle,
            title: 'Request Timeout',
            message: 'The request took too long to complete. This might be due to slow internet or server issues.',
            color: 'yellow',
            action: 'Try Again'
        },
        server: {
            icon: XCircle,
            title: 'Server Error',
            message: 'Something went wrong on our end. Our team has been notified.',
            color: 'red',
            action: 'Retry'
        },
        general: {
            icon: HelpCircle,
            title: 'Something Went Wrong',
            message: 'We encountered an unexpected error. Please try again.',
            color: 'gray',
            action: 'Retry'
        }
    };

    const config = errorConfigs[type] || errorConfigs.general;
    const Icon = config.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-12 px-4 sm:px-6 lg:px-8"
        >
            <Card className="max-w-2xl mx-auto border-rose-100 dark:border-rose-900/30">
                <CardContent className="p-8 text-center">
                    {/* Icon */}
                    <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center
            ${config.color === 'orange' ? 'bg-orange-100 dark:bg-orange-900/30' : ''}
            ${config.color === 'yellow' ? 'bg-yellow-100 dark:bg-yellow-900/30' : ''}
            ${config.color === 'red' ? 'bg-red-100 dark:bg-red-900/30' : ''}
            ${config.color === 'gray' ? 'bg-gray-100 dark:bg-gray-800' : ''}
          `}>
                        <Icon className={`w-8 h-8
              ${config.color === 'orange' ? 'text-orange-600' : ''}
              ${config.color === 'yellow' ? 'text-yellow-600' : ''}
              ${config.color === 'red' ? 'text-red-600' : ''}
              ${config.color === 'gray' ? 'text-gray-600' : ''}
            `} />
                    </div>

                    {/* Title */}
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        {config.title}
                    </h3>

                    {/* Message */}
                    <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                        {config.message}
                    </p>

                    {/* Error Details (if available) */}
                    {error?.message && (
                        <details className="mb-6 text-left">
                            <summary className="text-sm text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
                                Technical Details
                            </summary>
                            <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                <code className="text-xs text-gray-700 dark:text-gray-300 break-all">
                                    {error.message}
                                </code>
                            </div>
                        </details>
                    )}

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Button
                            onClick={onRetry}
                            className="bg-rose-600 hover:bg-rose-700 text-white"
                        >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            {config.action}
                        </Button>

                        <Button
                            variant="outline"
                            onClick={() => window.location.reload()}
                            className="border-gray-300 dark:border-gray-600"
                        >
                            Refresh Page
                        </Button>
                    </div>

                    {/* Help Text */}
                    <p className="mt-6 text-xs text-gray-500 dark:text-gray-400">
                        If the problem persists, please{' '}
                        <a href="/contact" className="text-rose-600 hover:text-rose-700 underline">
                            contact support
                        </a>
                    </p>
                </CardContent>
            </Card>
        </motion.div>
    );
}

/**
 * Compact Error Component for Inline Use
 */
export function InlineError({ message, onRetry }) {
    return (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                    <p className="text-sm font-medium text-red-900 dark:text-red-100">
                        {message || 'Failed to load data'}
                    </p>
                    {onRetry && (
                        <button
                            onClick={onRetry}
                            className="mt-2 text-xs text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
                        >
                            <RefreshCw className="w-3 h-3" />
                            Try again
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * Network Status Indicator
 */
export function NetworkStatus({ isOnline }) {
    if (isOnline) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed top-0 left-0 right-0 z-50 bg-orange-500 text-white py-2 px-4 text-center text-sm font-medium"
        >
            <div className="flex items-center justify-center gap-2">
                <WifiOff className="w-4 h-4" />
                You're offline. Some features may not be available.
            </div>
        </motion.div>
    );
}
