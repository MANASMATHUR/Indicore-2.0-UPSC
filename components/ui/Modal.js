'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import Button from './Button';

const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'md',
  showCloseButton = true,
  className = ''
}) => {
  // Debug logging - log every render
  useEffect(() => {
    console.log('[Modal] Render:', { isOpen, title, size, hasOnClose: !!onClose });
  });

  useEffect(() => {
    if (!isOpen) return;

    console.log('[Modal] Setting up event listeners and body scroll lock');

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        console.log('[Modal] Escape key pressed, closing');
        onClose();
      }
    };

    // Prevent body scroll when modal is open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEscape);

    return () => {
      console.log('[Modal] Cleaning up event listeners');
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    console.log('[Modal] Not rendering - isOpen is false');
    return null;
  }

  console.log('[Modal] Rendering modal content');

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-full'
  };

  const modalContent = (
    <>
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] transition-all duration-300"
        onClick={onClose}
        aria-hidden="true"
        style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999
        }}
      />
      
      <div 
        className="fixed inset-0 z-[10000] flex items-center justify-center p-0 sm:p-4 pointer-events-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 10000
        }}
      >
        <div 
          className={`
            bg-white dark:bg-slate-900 rounded-none sm:rounded-2xl shadow-2xl w-full h-full sm:h-auto pointer-events-auto
            ${sizes[size]} ${className}
            transform transition-all duration-300 ease-out
            ${isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'}
            border-0 sm:border border-gray-200 dark:border-slate-700
            flex flex-col max-h-screen sm:max-h-[95vh]
          `}
          style={{
            position: 'relative',
            zIndex: 10001,
            backgroundColor: 'white'
          }}
        >
          {title && (
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 sticky top-0 bg-white dark:bg-slate-900 z-10">
              <h2 id="modal-title" className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
                {title}
              </h2>
              {showCloseButton && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  aria-label="Close modal"
                  className="touch-manipulation"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </Button>
              )}
            </div>
          )}
          
          <div className="p-4 sm:p-6 overflow-y-auto flex-1" style={{ backgroundColor: 'inherit' }}>
            {children}
          </div>
        </div>
      </div>
    </>
  );

  // Use portal to render modal at document body level to avoid z-index issues
  if (typeof window !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  
  return modalContent;
};

export default Modal;
