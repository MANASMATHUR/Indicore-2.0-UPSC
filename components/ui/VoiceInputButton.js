'use client';

import { useState, useEffect } from 'react';
import azureSpeechRecognition from '@/lib/azureSpeechRecognition';
import { validateInput } from '@/lib/validation';
import errorHandler from '@/lib/errorHandler';

/**
 * Reusable VoiceInputButton component for Speech-to-Text
 * 
 * @param {string} language - Language code (e.g., 'en', 'hi', 'mr')
 * @param {function} onTranscript - Callback with final transcript
 * @param {function} onInterimTranscript - Callback with interim transcript
 * @param {function} onError - Callback on error
 * @param {string} className - Additional CSS classes
 * @param {string} variant - Button variant: 'default' | 'icon' | 'floating'
 * @param {boolean} disabled - Disable button
 * @param {boolean} showAudioLevel - Show audio level indicator
 */
export default function VoiceInputButton({
    language = 'en',
    onTranscript,
    onInterimTranscript,
    onError,
    className = '',
    variant = 'default',
    disabled = false,
    showAudioLevel = false
}) {
    const [isListening, setIsListening] = useState(false);
    const [audioLevel, setAudioLevel] = useState(0);
    const [transcript, setTranscript] = useState('');
    const [isAzureReady, setIsAzureReady] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const ensureAzure = async () => {
            try {
                const available = await azureSpeechRecognition.initialize();
                if (isMounted) {
                    setIsAzureReady(available);
                }
            } catch {
                if (isMounted) {
                    setIsAzureReady(false);
                }
            }
        };
        ensureAzure();
        return () => {
            isMounted = false;
            azureSpeechRecognition.cleanup();
        };
    }, []);

    useEffect(() => {
        const handleTranscriptUpdate = (finalText = '', interimText = '') => {
            setTranscript(finalText.trim());
            if (onTranscript && finalText.trim()) {
                onTranscript(finalText.trim());
            }
            if (onInterimTranscript && interimText) {
                onInterimTranscript(interimText);
            }
        };

        const handleError = (error) => {
            const message = error?.message || 'Speech recognition error. Please try again.';
            if (onError) {
                onError(new Error(message));
            }
        };

        const handleListeningStateChange = (listening) => {
            setIsListening(listening);
            if (!listening) {
                setAudioLevel(0);
            }
        };

        azureSpeechRecognition.onTranscriptUpdate = handleTranscriptUpdate;
        azureSpeechRecognition.onError = handleError;
        azureSpeechRecognition.onListeningStateChange = handleListeningStateChange;

        return () => {
            if (azureSpeechRecognition.onTranscriptUpdate === handleTranscriptUpdate) {
                azureSpeechRecognition.onTranscriptUpdate = null;
            }
            if (azureSpeechRecognition.onError === handleError) {
                azureSpeechRecognition.onError = null;
            }
            if (azureSpeechRecognition.onListeningStateChange === handleListeningStateChange) {
                azureSpeechRecognition.onListeningStateChange = null;
            }
        };
    }, [onTranscript, onInterimTranscript, onError]);

    useEffect(() => {
        if (!isListening || !showAudioLevel) {
            setAudioLevel(0);
            return;
        }

        let animationFrame;
        const updateLevel = () => {
            setAudioLevel(azureSpeechRecognition.getAudioLevel());
            animationFrame = requestAnimationFrame(updateLevel);
        };

        updateLevel();

        return () => {
            if (animationFrame) {
                cancelAnimationFrame(animationFrame);
            }
        };
    }, [isListening, showAudioLevel]);

    const startListening = async () => {
        if (isListening) return;

        try {
            setTranscript('');
            await azureSpeechRecognition.startRecognition(language);
        } catch (error) {
            console.error('Error starting speech recognition:', error);
            const message = error?.message || 'Failed to start speech recognition. Please try again.';
            if (onError) {
                onError(new Error(message));
            }
        }
    };

    const stopListening = () => {
        try {
            azureSpeechRecognition.stopRecognition();
        } catch (error) {
            console.error('Error stopping speech recognition:', error);
        } finally {
            setIsListening(false);
            setAudioLevel(0);
        }
    };

    // Variant styles
    const variantStyles = {
        default: `px-4 py-2 text-sm font-medium bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed`,
        icon: `p-3 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-full hover:from-red-600 hover:to-orange-600 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed`,
        floating: `fixed bottom-6 right-6 p-4 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-full hover:from-red-600 hover:to-orange-600 transition-all duration-200 shadow-xl hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed z-50`
    };

    const buttonClass = `${variantStyles[variant]} ${className} ${isListening ? 'animate-pulse' : ''}`;

    return (
        <div className="relative inline-block">
            <button
                onClick={isListening ? stopListening : startListening}
                disabled={disabled}
                className={buttonClass}
                title={isListening ? 'Stop listening' : 'Start voice input'}
                aria-label={isListening ? 'Stop listening' : 'Start voice input'}
            >
                {variant === 'icon' || variant === 'floating' ? (
                    isListening ? (
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                        </svg>
                    ) : (
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                        </svg>
                    )
                ) : (
                    <>
                        {isListening ? (
                            <>
                                <svg className="w-5 h-5 inline mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                                </svg>
                                Stop Listening
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5 inline mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                                </svg>
                                Start Voice Input
                            </>
                        )}
                    </>
                )}
            </button>

            {/* Audio level indicator */}
            {showAudioLevel && isListening && (
                <div className="absolute -top-2 -right-2 flex gap-0.5">
                    <div className="w-1 h-4 bg-red-500 rounded-full transition-all duration-100" style={{ height: `${Math.max(16, audioLevel * 0.4)}px` }} />
                    <div className="w-1 h-6 bg-red-500 rounded-full transition-all duration-100" style={{ height: `${Math.max(24, audioLevel * 0.6)}px` }} />
                    <div className="w-1 h-4 bg-red-500 rounded-full transition-all duration-100" style={{ height: `${Math.max(16, audioLevel * 0.4)}px` }} />
                </div>
            )}

            {/* Listening indicator */}
            {isListening && (
                <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2">
                    <span className="flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                </div>
            )}
        </div>
    );
}
