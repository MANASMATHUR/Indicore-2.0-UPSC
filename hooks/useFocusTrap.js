import { useEffect, useRef } from 'react';

/**
 * Custom hook to trap focus within a container (for modals, dropdowns)
 * Improves accessibility by keeping keyboard navigation within the active element
 * 
 * @param {boolean} isActive - Whether the focus trap should be active
 * @returns {React.RefObject} - Ref to attach to the container element
 */
export function useFocusTrap(isActive) {
    const containerRef = useRef(null);

    useEffect(() => {
        if (!isActive) return;

        const container = containerRef.current;
        if (!container) return;

        // Get all focusable elements within the container
        const getFocusableElements = () => {
            const focusableSelectors = [
                'a[href]',
                'button:not([disabled])',
                'textarea:not([disabled])',
                'input:not([disabled])',
                'select:not([disabled])',
                '[tabindex]:not([tabindex="-1"])',
            ];
            return container.querySelectorAll(focusableSelectors.join(','));
        };

        const handleTabKey = (e) => {
            const focusableElements = getFocusableElements();
            if (focusableElements.length === 0) return;

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            // If shift + tab on first element, focus last element
            if (e.shiftKey && document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            }
            // If tab on last element, focus first element
            else if (!e.shiftKey && document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Tab') {
                handleTabKey(e);
            }
        };

        // Focus first element when trap activates
        const focusableElements = getFocusableElements();
        if (focusableElements.length > 0) {
            focusableElements[0].focus();
        }

        container.addEventListener('keydown', handleKeyDown);

        return () => {
            container.removeEventListener('keydown', handleKeyDown);
        };
    }, [isActive]);

    return containerRef;
}
