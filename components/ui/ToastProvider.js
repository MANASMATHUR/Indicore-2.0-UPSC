import { createContext, useContext, useState, useCallback, useMemo } from 'react';

const ToastContext = createContext({ showToast: () => {} });

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    const toast = {
      id,
      message,
      type: opts.type || 'info',
      duration: typeof opts.duration === 'number' ? opts.duration : 1600,
    };
    setToasts((prev) => [...prev, toast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, toast.duration);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-3 py-2 rounded-md shadow-md text-sm backdrop-blur bg-white/90 dark:bg-gray-800/90 border ${
              t.type === 'success'
                ? 'border-green-300 text-green-800 dark:border-green-700 dark:text-green-200'
                : t.type === 'error'
                ? 'border-red-300 text-red-800 dark:border-red-700 dark:text-red-200'
                : 'border-slate-300 text-slate-800 dark:border-slate-700 dark:text-slate-200'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
