'use client';

import { useEffect, useState } from 'react';

export default function RenameChatModal({ isOpen, initialName, onCancel, onConfirm }) {
  const [name, setName] = useState(initialName || '');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(initialName || '');
      setError('');
    }
  }, [isOpen, initialName]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const trimmed = String(name || '').trim();
    if (!trimmed) {
      setError('Name cannot be empty');
      return;
    }
    if (trimmed.length > 100) {
      setError('Name is too long (max 100 characters)');
      return;
    }
    onConfirm?.(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onCancel} />

      <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">Rename chat</h3>
        <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">Set a clear, concise name for your conversation.</p>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-800 dark:text-slate-100"
          placeholder="Enter chat name"
          maxLength={120}
        />
        {error ? (
          <p className="mt-2 text-xs text-red-500">{error}</p>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}


