import { useEffect, useCallback } from 'react';

/**
 * Keyboard Shortcuts Hook
 * Provides global keyboard shortcut functionality
 * 
 * @param {Object} shortcuts - Map of key combinations to handlers
 * @param {boolean} enabled - Whether shortcuts are enabled
 * 
 * @example
 * useKeyboardShortcuts({
 *   'r': () => handleRefresh(),
 *   'd': () => toggleDashboard(),
 *   'Escape': () => closeModal(),
 *   'ctrl+k': () => openSearch()
 * });
 */
export default function useKeyboardShortcuts(shortcuts = {}, enabled = true) {
    const handleKeyDown = useCallback((event) => {
        if (!enabled) return;

        // Don't trigger shortcuts when typing in input fields
        const isInputField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName);
        if (isInputField && !event.ctrlKey && !event.metaKey) return;

        // Build key combination string
        const modifiers = [];
        if (event.ctrlKey || event.metaKey) modifiers.push('ctrl');
        if (event.shiftKey) modifiers.push('shift');
        if (event.altKey) modifiers.push('alt');

        const key = event.key.toLowerCase();
        const combination = modifiers.length > 0
            ? `${modifiers.join('+')}+${key}`
            : key;

        // Execute handler if shortcut exists
        const handler = shortcuts[combination] || shortcuts[key];
        if (handler) {
            event.preventDefault();
            handler(event);
        }
    }, [shortcuts, enabled]);

    useEffect(() => {
        if (!enabled) return;

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown, enabled]);
}

/**
 * Common keyboard shortcuts for dashboard
 */
export const DASHBOARD_SHORTCUTS = {
    'r': 'Refresh dashboard',
    'd': 'Toggle dashboard dropdown',
    'Escape': 'Close modals/dropdowns',
    '/': 'Focus search',
    '?': 'Show keyboard shortcuts help',
    '1': 'Navigate to section 1',
    '2': 'Navigate to section 2',
    '3': 'Navigate to section 3',
    '4': 'Navigate to section 4',
    '5': 'Navigate to section 5',
    '6': 'Navigate to section 6',
    '7': 'Navigate to section 7',
    '8': 'Navigate to section 8',
    '9': 'Navigate to section 9'
};

/**
 * Keyboard Shortcuts Help Modal Component
 */
export function KeyboardShortcutsHelp({ isOpen, onClose }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        Keyboard Shortcuts
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                        ✕
                    </button>
                </div>

                <div className="space-y-2">
                    {Object.entries(DASHBOARD_SHORTCUTS).map(([key, description]) => (
                        <div key={key} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                {description}
                            </span>
                            <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded">
                                {key === 'Escape' ? 'ESC' : key.toUpperCase()}
                            </kbd>
                        </div>
                    ))}
                </div>

                <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 text-center">
                    Press <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">?</kbd> anytime to see this help
                </p>
            </div>
        </div>
    );
}
