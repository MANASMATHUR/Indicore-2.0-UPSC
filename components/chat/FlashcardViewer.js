'use client';

import { useState } from 'react';
import { Button } from '../ui/Button';

const FlashcardViewer = ({ flashcards, onClose, onAddToChat, isOpen }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);

    if (!isOpen || !flashcards || flashcards.length === 0) return null;

    const currentCard = flashcards[currentIndex];

    const handleNext = () => {
        if (currentIndex < flashcards.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setIsFlipped(false);
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
            setIsFlipped(false);
        }
    };

    const handleFlip = () => {
        setIsFlipped(!isFlipped);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/50">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                        <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        Study Flashcards
                    </h3>
                    <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full relative z-50">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </Button>
                </div>

                {/* Card Area */}
                <div className="flex-1 p-6 sm:p-10 flex flex-col items-center justify-center bg-gray-100 dark:bg-slate-950/50 relative perspective-1000">
                    <div
                        className={`relative w-full aspect-[3/2] sm:aspect-[2/1] cursor-pointer transition-all duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}
                        onClick={handleFlip}
                    >
                        {/* Front */}
                        <div className={`absolute inset-0 w-full h-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-700 p-8 flex flex-col items-center justify-center text-center backface-hidden transition-opacity duration-300 ${isFlipped ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                            <div className="text-xs font-bold text-red-500 uppercase tracking-wider mb-4">Question</div>
                            <p className="text-xl sm:text-2xl font-medium text-gray-800 dark:text-gray-100 leading-relaxed">
                                {currentCard.question || currentCard.front}
                            </p>
                            <div className="absolute bottom-4 text-xs text-gray-400 dark:text-gray-500">
                                Click to flip
                            </div>
                        </div>

                        {/* Back */}
                        <div className={`absolute inset-0 w-full h-full bg-gradient-to-br from-red-50 to-orange-50 dark:from-slate-800 dark:to-slate-900 rounded-2xl shadow-xl border border-red-100 dark:border-slate-700 p-8 flex flex-col items-center justify-center text-center backface-hidden rotate-y-180 transition-opacity duration-300 ${isFlipped ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                            <div className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wider mb-4">Answer</div>
                            <p className="text-lg sm:text-xl text-gray-700 dark:text-gray-200 leading-relaxed">
                                {currentCard.answer || currentCard.back}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div className="p-4 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex justify-between items-center">
                    <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                        Card {currentIndex + 1} of {flashcards.length}
                    </div>
                    <div className="flex gap-2">
                        {onAddToChat && (
                            <Button
                                onClick={() => onAddToChat(currentCard)}
                                variant="outline"
                                className="rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-400 dark:hover:bg-blue-900/20 mr-2"
                                title="Add to chat memory"
                            >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                </svg>
                                Add to Chat
                            </Button>
                        )}
                        <Button
                            onClick={handlePrev}
                            disabled={currentIndex === 0}
                            variant="outline"
                            className="rounded-xl border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800"
                        >
                            Previous
                        </Button>
                        <Button
                            onClick={handleNext}
                            disabled={currentIndex === flashcards.length - 1}
                            className="rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20"
                        >
                            Next
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FlashcardViewer;
