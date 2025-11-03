'use client';

import { useState } from 'react';

const themes = [
  { id: 'light', name: 'Light', icon: '☀️' },
  { id: 'dark', name: 'Dark', icon: '🌙' },
];

export default function ThemeDropdown({ currentTheme, onThemeChange }) {
  const [isOpen, setIsOpen] = useState(false);

  const currentThemeData = themes.find(theme => theme.id === currentTheme) || themes[0];

  const handleThemeChange = (themeId) => {
    onThemeChange(themeId);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-white bg-opacity-25 hover:bg-opacity-40 dark:bg-slate-800 dark:bg-opacity-50 dark:hover:bg-opacity-70 p-2 rounded-lg transition-all duration-200 flex items-center gap-2 text-gray-700 dark:text-gray-300"
        title="Change theme"
      >
        <span className="text-lg">{currentThemeData.icon}</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-[90]" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-gray-200 dark:border-slate-700 z-[100]">
            <div className="p-2">
              {themes.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => handleThemeChange(theme.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors duration-200 ${
                    currentTheme === theme.id
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                      : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300'
                  }`}
                >
                  <span className="text-lg">{theme.icon}</span>
                  <span>{theme.name}</span>
                  {currentTheme === theme.id && (
                    <svg className="w-4 h-4 ml-auto text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
