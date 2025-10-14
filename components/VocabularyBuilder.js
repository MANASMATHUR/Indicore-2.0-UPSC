'use client';

import { useState, useEffect } from 'react';

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

const examCategories = [
  { code: 'general', name: 'General Studies', color: 'bg-blue-100 text-blue-800' },
  { code: 'history', name: 'History & Culture', color: 'bg-green-100 text-green-800' },
  { code: 'geography', name: 'Geography', color: 'bg-yellow-100 text-yellow-800' },
  { code: 'polity', name: 'Polity & Governance', color: 'bg-purple-100 text-purple-800' },
  { code: 'economics', name: 'Economics', color: 'bg-indigo-100 text-indigo-800' },
  { code: 'science', name: 'Science & Technology', color: 'bg-pink-100 text-pink-800' },
  { code: 'environment', name: 'Environment', color: 'bg-emerald-100 text-emerald-800' },
  { code: 'current_affairs', name: 'Current Affairs', color: 'bg-orange-100 text-orange-800' },
  { code: 'ethics', name: 'Ethics & Philosophy', color: 'bg-rose-100 text-rose-800' },
  { code: 'international', name: 'International Relations', color: 'bg-cyan-100 text-cyan-800' }
];

export default function VocabularyBuilder({ isOpen, onClose, onAddToChat }) {
  const [selectedCategory, setSelectedCategory] = useState('general');
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const [targetLanguage, setTargetLanguage] = useState('hi');
  const [difficulty, setDifficulty] = useState('intermediate');
  const [isGenerating, setIsGenerating] = useState(false);
  const [flashcards, setFlashcards] = useState([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [studyMode, setStudyMode] = useState(false);

  const generateFlashcards = async () => {
    try {
      setIsGenerating(true);
      
      const response = await fetch('/api/ai/generate-vocabulary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: selectedCategory,
          sourceLanguage,
          targetLanguage,
          difficulty,
          count: 10
        }),
      });

      if (!response.ok) throw new Error('Generation failed');
      const data = await response.json();
      
      setFlashcards(data.flashcards);
      setCurrentCardIndex(0);
      setShowAnswer(false);
      setStudyMode(true);
    } catch (error) {
      console.error('Generation error:', error);
      alert('Failed to generate vocabulary. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const nextCard = () => {
    if (currentCardIndex < flashcards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
      setShowAnswer(false);
    }
  };

  const previousCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1);
      setShowAnswer(false);
    }
  };

  const toggleAnswer = () => {
    setShowAnswer(!showAnswer);
  };

  const resetStudy = () => {
    setStudyMode(false);
    setFlashcards([]);
    setCurrentCardIndex(0);
    setShowAnswer(false);
  };

  const addToChat = () => {
    if (flashcards.length > 0) {
      const vocabularyList = flashcards.map((card, index) => 
        `${index + 1}. **${card.term}** (${card.pronunciation})\n   - ${card.definition}\n   - ${card.translation}\n   - Example: ${card.example}`
      ).join('\n\n');
      
      onAddToChat(`Here are the ${selectedCategory} vocabulary flashcards I generated:\n\n${vocabularyList}`, targetLanguage);
      onClose();
    }
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
                <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100">📚 Bilingual Vocabulary Builder</h2>
                <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                  Learn exam-relevant vocabulary with bilingual flashcards
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

            {!studyMode ? (
              <div className="space-y-6">
                {/* Category Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-3">
                    Select Subject Category
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {examCategories.map((category) => (
                      <button
                        key={category.code}
                        onClick={() => setSelectedCategory(category.code)}
                        className={`p-3 rounded-lg border-2 transition-all duration-200 ${
                          selectedCategory === category.code
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                            : 'border-gray-200 dark:border-slate-600 hover:border-indigo-300'
                        }`}
                      >
                        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${category.color}`}>
                          {category.name}
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

                {/* Difficulty Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-3">
                    Difficulty Level
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { code: 'beginner', name: 'Beginner', desc: 'Basic terms' },
                      { code: 'intermediate', name: 'Intermediate', desc: 'Moderate complexity' },
                      { code: 'advanced', name: 'Advanced', desc: 'Expert level' }
                    ].map((level) => (
                      <button
                        key={level.code}
                        onClick={() => setDifficulty(level.code)}
                        className={`p-3 rounded-lg border-2 transition-all duration-200 ${
                          difficulty === level.code
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                            : 'border-gray-200 dark:border-slate-600 hover:border-indigo-300'
                        }`}
                      >
                        <div className="font-medium text-sm text-gray-800 dark:text-slate-200">
                          {level.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                          {level.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Generate Button */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={onClose}
                    className="flex-1 bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-slate-200 py-3 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={generateFlashcards}
                    disabled={isGenerating}
                    className="flex-1 bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    {isGenerating ? 'Generating...' : 'Generate Flashcards'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Study Mode Header */}
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-slate-200">
                      {examCategories.find(c => c.code === selectedCategory)?.name} Vocabulary
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-slate-400">
                      Card {currentCardIndex + 1} of {flashcards.length}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={addToChat}
                      className="text-sm bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200"
                    >
                      Add to Chat
                    </button>
                    <button
                      onClick={resetStudy}
                      className="text-sm bg-gray-600 text-white px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors duration-200"
                    >
                      New Set
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                  <div 
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${((currentCardIndex + 1) / flashcards.length) * 100}%` }}
                  />
                </div>

                {/* Flashcard */}
                {flashcards.length > 0 && (
                  <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-8 min-h-[400px] flex flex-col justify-center">
                    <div className="text-center space-y-6">
                      {/* Term */}
                      <div>
                        <h4 className="text-2xl font-bold text-gray-800 dark:text-slate-200 mb-2">
                          {flashcards[currentCardIndex]?.term}
                        </h4>
                        {flashcards[currentCardIndex]?.pronunciation && (
                          <p className="text-sm text-gray-600 dark:text-slate-400 italic">
                            {flashcards[currentCardIndex].pronunciation}
                          </p>
                        )}
                      </div>

                      {/* Answer Section */}
                      {showAnswer ? (
                        <div className="space-y-4">
                          <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm">
                            <h5 className="font-semibold text-gray-800 dark:text-slate-200 mb-2">
                              Definition:
                            </h5>
                            <p className="text-gray-700 dark:text-slate-300">
                              {flashcards[currentCardIndex]?.definition}
                            </p>
                          </div>
                          
                          <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm">
                            <h5 className="font-semibold text-gray-800 dark:text-slate-200 mb-2">
                              Translation ({supportedLanguages.find(l => l.code === targetLanguage)?.name}):
                            </h5>
                            <p className="text-gray-700 dark:text-slate-300">
                              {flashcards[currentCardIndex]?.translation}
                            </p>
                          </div>
                          
                          {flashcards[currentCardIndex]?.example && (
                            <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm">
                              <h5 className="font-semibold text-gray-800 dark:text-slate-200 mb-2">
                                Example:
                              </h5>
                              <p className="text-gray-700 dark:text-slate-300 italic">
                                {flashcards[currentCardIndex].example}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center">
                          <p className="text-gray-600 dark:text-slate-400 mb-4">
                            Click "Show Answer" to see the definition and translation
                          </p>
                          <button
                            onClick={toggleAnswer}
                            className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors duration-200"
                          >
                            Show Answer
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Navigation Controls */}
                <div className="flex justify-between items-center">
                  <button
                    onClick={previousCard}
                    disabled={currentCardIndex === 0}
                    className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Previous
                  </button>

                  <div className="flex gap-2">
                    {showAnswer && (
                      <button
                        onClick={toggleAnswer}
                        className="px-4 py-2 text-gray-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors duration-200"
                      >
                        Hide Answer
                      </button>
                    )}
                  </div>

                  <button
                    onClick={nextCard}
                    disabled={currentCardIndex === flashcards.length - 1}
                    className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    Next
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
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
