/**
 * Animated Modal Component
 * Premium modal with smooth animations and backdrop
 */

import { motion, AnimatePresence } from 'framer-motion';
import { modalVariants, fadeVariants } from '@/lib/animations';
import { useEffect } from 'react';

export default function AnimatedModal({
    isOpen,
    onClose,
    children,
    title,
    size = 'medium',
    showCloseButton = true
}) {
    const sizeClasses = {
        small: 'max-w-md',
        medium: 'max-w-2xl',
        large: 'max-w-4xl',
        full: 'max-w-6xl'
    };

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }

        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    // Handle ESC key
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        className="modal-backdrop"
                        variants={fadeVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        onClick={onClose}
                    >
                        <style jsx>{`
              .modal-backdrop {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(4px);
                z-index: 9998;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 1rem;
              }
            `}</style>
                    </motion.div>

                    {/* Modal */}
                    <div className="modal-wrapper">
                        <motion.div
                            className={`modal-content ${sizeClasses[size]}`}
                            variants={modalVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            {(title || showCloseButton) && (
                                <div className="modal-header">
                                    {title && <h2>{title}</h2>}
                                    {showCloseButton && (
                                        <button
                                            onClick={onClose}
                                            className="close-button"
                                            aria-label="Close modal"
                                        >
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Body */}
                            <div className="modal-body">
                                {children}
                            </div>

                            <style jsx>{`
                .modal-wrapper {
                  position: fixed;
                  inset: 0;
                  z-index: 9999;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  padding: 1rem;
                  pointer-events: none;
                }

                .modal-content {
                  background: white;
                  border-radius: 1rem;
                  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                  width: 100%;
                  max-height: 90vh;
                  overflow: hidden;
                  display: flex;
                  flex-direction: column;
                  pointer-events: auto;
                  position: relative;
                }

                .modal-header {
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  padding: 1.5rem;
                  border-bottom: 1px solid #e5e7eb;
                }

                .modal-header h2 {
                  font-size: 1.5rem;
                  font-weight: 600;
                  margin: 0;
                  color: #111827;
                }

                .close-button {
                  background: none;
                  border: none;
                  cursor: pointer;
                  padding: 0.5rem;
                  color: #6b7280;
                  transition: all 0.2s;
                  border-radius: 0.5rem;
                }

                .close-button:hover {
                  background: #f3f4f6;
                  color: #111827;
                }

                .modal-body {
                  padding: 1.5rem;
                  overflow-y: auto;
                  flex: 1;
                }

                @media (prefers-color-scheme: dark) {
                  .modal-content {
                    background: #1f2937;
                  }

                  .modal-header {
                    border-bottom-color: #374151;
                  }

                  .modal-header h2 {
                    color: #f9fafb;
                  }

                  .close-button:hover {
                    background: #374151;
                    color: #f9fafb;
                  }
                }
              `}</style>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
