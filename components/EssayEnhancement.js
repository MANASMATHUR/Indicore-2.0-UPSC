'use client';

import { useState } from 'react';

const supportedLanguages = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi' },
  { code: 'mr', name: 'Marathi' },
  { code: 'ta', name: 'Tamil' },
  { code: 'bn', name: 'Bengali' },
  { code: 'pa', name: 'Punjabi' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'te', name: 'Telugu' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'kn', name: 'Kannada' },
];

const essayTypes = [
  { code: 'general', name: 'General Essay', description: 'General topic essay writing' },
  { code: 'current_affairs', name: 'Current Affairs', description: 'Contemporary issues and events' },
  { code: 'social_issues', name: 'Social Issues', description: 'Society, culture, and social problems' },
  { code: 'economic', name: 'Economic Issues', description: 'Economics, development, and finance' },
  { code: 'political', name: 'Political Science', description: 'Governance, polity, and administration' },
  { code: 'history', name: 'History & Culture', description: 'Historical events and cultural aspects' },
  { code: 'science_tech', name: 'Science & Technology', description: 'Scientific developments and technology' },
  { code: 'environment', name: 'Environment', description: 'Environmental issues and conservation' },
  { code: 'ethics', name: 'Ethics & Philosophy', description: 'Moral and ethical considerations' },
  { code: 'international', name: 'International Relations', description: 'Global affairs and diplomacy' }
];

export default function EssayEnhancement({ isOpen, onClose, onEnhance }) {
  const [essayText, setEssayText] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const [targetLanguage, setTargetLanguage] = useState('hi');
  const [essayType, setEssayType] = useState('general');
  const [wordLimit, setWordLimit] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [enhancedText, setEnhancedText] = useState('');
  const [showEnhanced, setShowEnhanced] = useState(false);

  const handleEnhance = async () => {
    if (!essayText.trim()) {
      alert('Please enter your essay text.');
      return;
    }

    try {
      setIsProcessing(true);
      
      const response = await fetch('/api/ai/enhance-essay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          essayText,
          sourceLanguage,
          targetLanguage,
          essayType,
          wordLimit: wordLimit ? parseInt(wordLimit) : null
        }),
      });

      if (!response.ok) throw new Error('Enhancement failed');
      const data = await response.json();
      
      setEnhancedText(data.enhancedEssay);
      setShowEnhanced(true);
    } catch (error) {
      alert('Enhancement failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUseEnhanced = () => {
    onEnhance(enhancedText, targetLanguage);
    onClose();
  };

  const handleReset = () => {
    setEssayText('');
    setEnhancedText('');
    setShowEnhanced(false);
  };

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100">✍️ Essay & Answer Writing Enhancement</h2>
                <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                  Improve your essay writing with AI-powered enhancement and translation
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors duration-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {!showEnhanced ? (
              <div className="space-y-6">
                {/* Essay Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-3">
                    Essay Type
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {essayTypes.map((type) => (
                      <button
                        key={type.code}
                        onClick={() => setEssayType(type.code)}
                        className={`p-3 rounded-lg border-2 transition-all duration-200 text-left ${
                          essayType === type.code
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                            : 'border-gray-200 dark:border-slate-600 hover:border-indigo-300'
                        }`}
                      >
                        <div className="font-medium text-sm text-gray-800 dark:text-slate-200">
                          {type.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                          {type.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Language Selection */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                      Source Language
                    </label>
                    <select
                      value={sourceLanguage}
                      onChange={(e) => setSourceLanguage(e.target.value)}
                      className="w-full p-3 border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    >
                      {supportedLanguages.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                      Target Language
                    </label>
                    <select
                      value={targetLanguage}
                      onChange={(e) => setTargetLanguage(e.target.value)}
                      className="w-full p-3 border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    >
                      {supportedLanguages.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Word Limit */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                    Word Limit (Optional)
                  </label>
                  <input
                    type="number"
                    value={wordLimit}
                    onChange={(e) => setWordLimit(e.target.value)}
                    placeholder="e.g., 500, 1000, 2000"
                    className="w-full p-3 border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    Specify if you want the enhanced essay to be within a certain word limit
                  </p>
                </div>

                {/* Essay Text Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                    Your Essay Text *
                  </label>
                  <textarea
                    value={essayText}
                    onChange={(e) => setEssayText(e.target.value)}
                    placeholder="Enter your essay or answer here. The AI will enhance it with better structure, vocabulary, and flow..."
                    className="w-full h-48 p-3 border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                  />
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    Word count: {essayText.split(/\s+/).filter(word => word.length > 0).length}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={onClose}
                    className="flex-1 bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-slate-200 py-3 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEnhance}
                    disabled={isProcessing || !essayText.trim()}
                    className="flex-1 bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    {isProcessing ? 'Enhancing...' : 'Enhance Essay'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Enhanced Essay Display */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-slate-200">
                      Enhanced Essay
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowEnhanced(false)}
                        className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        Edit Original
                      </button>
                      <button
                        onClick={handleReset}
                        className="text-sm text-gray-600 hover:text-gray-700 font-medium"
                      >
                        Start Over
                      </button>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-4 max-h-96 overflow-y-auto">
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <pre className="whitespace-pre-wrap text-gray-700 dark:text-slate-300 font-sans">
                        {enhancedText}
                      </pre>
                    </div>
                  </div>
                  
                  <div className="mt-2 text-sm text-gray-500 dark:text-slate-400">
                    Word count: {enhancedText.split(/\s+/).filter(word => word.length > 0).length}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowEnhanced(false)}
                    className="flex-1 bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-slate-200 py-3 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors duration-200"
                  >
                    Back to Edit
                  </button>
                  <button
                    onClick={handleUseEnhanced}
                    className="flex-1 bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 transition-colors duration-200"
                  >
                    Use Enhanced Essay
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
