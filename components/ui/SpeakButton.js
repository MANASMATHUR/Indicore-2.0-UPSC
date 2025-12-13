'use client';

import { useState } from 'react';
import speechService from '@/lib/speechService';
import { validateInput } from '@/lib/validation';
import errorHandler from '@/lib/errorHandler';

/**
 * Reusable SpeakButton component for Text-to-Speech
 * 
 * @param {string} text - Text to speak
 * @param {string} language - Language code (e.g., 'en', 'hi', 'mr')
 * @param {string} className - Additional CSS classes
 * @param {string} variant - Button variant: 'default' | 'icon' | 'minimal'
 * @param {boolean} disabled - Disable button
 * @param {function} onStart - Callback when speech starts
 * @param {function} onEnd - Callback when speech ends
 * @param {function} onError - Callback on error
 */
export default function SpeakButton({
    text,
    language = 'en',
    className = '',
    variant = 'default',
    disabled = false,
    onStart,
    onEnd,
    onError
}) {
    const [isSpeaking, setIsSpeaking] = useState(false);

    const handleSpeak = async () => {
        if (!text || isSpeaking) return;

        try {
            const validation = validateInput('multilingualText', text);
            if (!validation.isValid) {
                const error = new Error(validation.errors[0]?.message || 'Invalid text');
                if (onError) onError(error);
                return;
            }

            setIsSpeaking(true);
            if (onStart) onStart();

            await speechService.speak(validation.value, language, {
                rate: 0.9,
                pitch: 1.0,
                volume: 1.0
            });

            setIsSpeaking(false);
            if (onEnd) onEnd();

        } catch (error) {
            console.error('Speech error:', error);
            setIsSpeaking(false);

            const errorResult = errorHandler.handleSpeechError(error, {
                textLength: text?.length || 0,
                language,
                type: 'speak_button'
            });

            if (onError) {
                onError(errorResult);
            }

            errorHandler.logError(error, {
                type: 'speak_button_error',
                textLength: text?.length || 0,
                language
            }, 'warning');
        }
    };

    const handleStop = () => {
        speechService.stop();
        setIsSpeaking(false);
        if (onEnd) onEnd();
    };

    // Variant styles
    const variantStyles = {
        default: `px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-red-200 to-orange-200 dark:from-red-800/50 dark:to-red-900/50 text-red-700 dark:text-red-200 rounded-lg hover:from-red-300 hover:to-orange-300 dark:hover:from-red-700 dark:hover:to-red-800 transition-all duration-200 shadow-sm hover:shadow-md backdrop-blur-sm hover:scale-105 focus:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`,
        icon: `p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed`,
        minimal: `text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 underline disabled:opacity-50 disabled:cursor-not-allowed`
    };

    const buttonClass = `${variantStyles[variant]} ${className} ${isSpeaking ? 'opacity-75' : ''}`;

    return (
        <button
            onClick={isSpeaking ? handleStop : handleSpeak}
            disabled={disabled || !text}
            className={buttonClass}
            title={isSpeaking ? 'Stop speaking' : 'Speak text'}
            aria-label={isSpeaking ? 'Stop speaking' : 'Speak text'}
        >
            {variant === 'icon' ? (
                isSpeaking ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                    </svg>
                ) : (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                    </svg>
                )
            ) : (
                <>
                    {isSpeaking ? (
                        <>
                            <svg className="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                            </svg>
                            {variant === 'minimal' ? 'Stop' : 'Stop Speaking'}
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                            </svg>
                            {variant === 'minimal' ? 'Speak' : '🔊 Speak'}
                        </>
                    )}
                </>
            )}
        </button>
    );
}
