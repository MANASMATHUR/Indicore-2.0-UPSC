'use client';

import { useState } from 'react';
import { Languages } from 'lucide-react';
import { supportedLanguages } from '@/lib/messageUtils';

export default function LanguageSelector({ 
  selectedLanguage = 'en', 
  onLanguageChange, 
  showLabel = true,
  size = 'md',
  variant = 'default'
}) {
  const [isOpen, setIsOpen] = useState(false);

  const handleLanguageChange = (langCode) => {
    onLanguageChange(langCode);
    setIsOpen(false);
  };

  const selectedLang = supportedLanguages.find(lang => lang.code === selectedLanguage) || supportedLanguages[0];

  const buttonClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  const variantClasses = {
    default: 'bg-white border-2 border-gray-200 hover:border-red-300',
    primary: 'bg-red-50 border-2 border-red-200 hover:border-red-400',
    minimal: 'bg-transparent border-0 hover:bg-gray-50'
  };

  return (
    <div className="relative">
      {showLabel && (
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          <Languages className="inline h-4 w-4 mr-1 text-red-600" />
          Language
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between ${buttonClasses[size]} ${variantClasses[variant]} rounded-lg transition-all focus:ring-2 focus:ring-red-500 focus:outline-none`}
        >
          <span className="flex items-center">
            <Languages className="h-4 w-4 mr-2 text-red-600" />
            <span className="font-medium">{selectedLang.name}</span>
          </span>
          <svg
            className={`h-4 w-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute z-20 mt-1 w-full bg-white border-2 border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
              {supportedLanguages.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleLanguageChange(lang.code)}
                  className={`w-full text-left px-4 py-2 hover:bg-red-50 transition-colors ${
                    selectedLanguage === lang.code ? 'bg-red-100 font-semibold' : ''
                  }`}
                >
                  {lang.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

