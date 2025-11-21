'use client';

import { useState, useEffect, useRef } from 'react';
import errorHandler from '@/lib/errorHandler';
import { validateInput } from '@/lib/validation';
import { useLoadingState, StatusIndicator } from '@/lib/loadingStates';
import azureSpeechRecognition from '@/lib/azureSpeechRecognition';

export default function VoiceDialog({ isOpen, onClose, onSendMessage, language }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recognitionError, setRecognitionError] = useState('');
  const [isAzureReady, setIsAzureReady] = useState(false);
  const [recognitionProvider, setRecognitionProvider] = useState('browser');
  
  const voiceLoading = useLoadingState();
  const processingLoading = useLoadingState();
  const displayedTranscript = interimTranscript
    ? `${transcript}${transcript ? ' ' : ''}[interim]${interimTranscript}`
    : transcript;

  useEffect(() => {
    let isMounted = true;
    const ensureAzure = async () => {
      try {
        const available = await azureSpeechRecognition.initialize();
        if (isMounted) {
          setIsAzureReady(available);
          setRecognitionProvider(available ? 'azure' : 'browser');
        }
      } catch {
        if (isMounted) {
          setIsAzureReady(false);
          setRecognitionProvider('browser');
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
      setInterimTranscript(interimText);
    };

    const handleError = (error) => {
      const message = error?.message || 'Speech recognition error. Please try again.';
      setRecognitionError(message);
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
  }, []);

  useEffect(() => {
    if (!isListening) {
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
  }, [isListening]);

  const voiceLoadingResetRef = useRef(voiceLoading.reset);

  useEffect(() => {
    voiceLoadingResetRef.current = voiceLoading.reset;
  }, [voiceLoading.reset]);

  useEffect(() => {
    if (!isOpen) {
      azureSpeechRecognition.stopRecognition();
      setIsListening(false);
      setTranscript('');
      setInterimTranscript('');
      setRecognitionError('');
      setAudioLevel(0);
      voiceLoadingResetRef.current?.();
    }
  }, [isOpen]);

  const getLanguageCode = (lang) => {
    const languageMap = {
      en: 'en-US',
      hi: 'hi-IN',
      mr: 'mr-IN',
      ta: 'ta-IN',
      bn: 'bn-IN',
      pa: 'pa-IN',
      gu: 'gu-IN',
      te: 'te-IN',
      ml: 'ml-IN',
      kn: 'kn-IN',
      es: 'es-ES'
    };
    
    const selectedLang = languageMap[lang] || lang;
    return selectedLang;
  };

  const startListening = async () => {
    if (isListening) {
      setRecognitionError('Speech recognition is already running.');
      return;
    }

    try {
      setTranscript('');
      setInterimTranscript('');
      setRecognitionError('');
      voiceLoading.setLoading('Initializing microphone...', 10);

      await azureSpeechRecognition.startRecognition(language);

      const provider = azureSpeechRecognition.isAzureAvailable ? 'azure' : 'browser';
      setRecognitionProvider(provider);
      voiceLoading.setSuccess(
        provider === 'azure'
          ? 'Azure speech recognition active'
          : 'Browser speech recognition active'
      );
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      const message = error?.message || 'Failed to start speech recognition. Please try again.';
      setRecognitionError(message);
      voiceLoading.setError(message);
    }
  };

  const stopListening = () => {
    try {
      azureSpeechRecognition.stopRecognition();
      voiceLoading.setSuccess('Voice capture stopped');
    } catch (error) {
      console.error('Error stopping speech recognition:', error);
    } finally {
      setIsListening(false);
      setInterimTranscript('');
      setAudioLevel(0);
    }
  };

  const handleSend = async () => {
    if (!transcript.trim()) return;

    try {
      // Clean transcript to remove interim results
      const cleanTranscript = transcript.trim();
      
      if (!cleanTranscript) {
        setRecognitionError('No final transcript available. Please try speaking again.');
        return;
      }

      const validation = validateInput('voiceInput', cleanTranscript);
      if (!validation.isValid) {
        const error = validation.errors[0];
        setRecognitionError(error.message);
        return;
      }

      processingLoading.setLoading('Processing voice message...', 0);
      setIsProcessing(true);
      stopListening();

      processingLoading.updateProgress(50, 'Sending message...');

      // Send with the language the user is speaking in (from VoiceDialog's language prop)
      await onSendMessage(validation.value.trim(), language);
      
      processingLoading.updateProgress(100, 'Message sent successfully');
      processingLoading.setSuccess('Voice message sent');
      
      setTranscript('');
      setInterimTranscript('');
      onClose();
      
    } catch (err) {
      const errorResult = errorHandler.handleChatError(err, {
        type: 'voice_send_error',
        transcriptLength: transcript.length,
        language
      });
      
      processingLoading.setError(errorResult.userMessage || 'Failed to send voice message');
      setRecognitionError(errorResult.userMessage || 'Failed to send voice message');
      
      errorHandler.logError(err, {
        type: 'voice_send_error',
        transcriptLength: transcript.length,
        language
      }, 'error');
      
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    stopListening();
    setTranscript('');
    setInterimTranscript('');
    setRecognitionError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="voice-dialog">
      <div className="voice-dialog-content">
        <div className="flex justify-between items-center mb-6 w-full">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <span className="text-2xl">🎤</span>
            Voice Input
          </h3>
          <button 
            onClick={handleClose} 
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="w-full mb-6 flex justify-center">
          <div className="flex items-center gap-2">
            <div className="w-2 h-8 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="w-full bg-gradient-to-t from-red-500 to-red-400 transition-all duration-100 ease-out"
                style={{ height: `${Math.max(20, audioLevel)}%` }}
              />
            </div>
            <div className="w-2 h-12 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="w-full bg-gradient-to-t from-red-500 to-red-400 transition-all duration-100 ease-out"
                style={{ height: `${Math.max(30, audioLevel)}%` }}
              />
            </div>
            <div className="w-2 h-16 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="w-full bg-gradient-to-t from-red-500 to-red-400 transition-all duration-100 ease-out"
                style={{ height: `${Math.max(40, audioLevel)}%` }}
              />
            </div>
            <div className="w-2 h-12 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="w-full bg-gradient-to-t from-red-500 to-red-400 transition-all duration-100 ease-out"
                style={{ height: `${Math.max(30, audioLevel)}%` }}
              />
            </div>
            <div className="w-2 h-8 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="w-full bg-gradient-to-t from-red-500 to-red-400 transition-all duration-100 ease-out"
                style={{ height: `${Math.max(20, audioLevel)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="w-full mb-4">
          <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
            {isListening ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                Listening... Speak now. Click "Stop" when finished.
              </span>
            ) : transcript.trim() ? (
              'Click "Start Listening" to add more, or "Send Message" to send.'
            ) : (
              'Click "Start Listening" to begin speaking. Make sure your microphone is connected and permissions are granted.'
            )}
          </p>
        </div>

        {recognitionError && (
          <div className="w-full mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-300">{recognitionError}</p>
          </div>
        )}

        <div className="w-full mb-6">
          <textarea
            value={displayedTranscript}
            placeholder="Your speech will appear here..."
            className="w-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 min-h-[100px] resize-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-200"
            readOnly
          />
        </div>

        <div className="flex gap-3 w-full">
          <button 
            onClick={startListening} 
            disabled={isListening || isProcessing} 
            className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white py-3 px-4 rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-md hover:shadow-lg flex items-center justify-center gap-2"
          >
            {isListening ? (
              <>
                <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                Listening...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                Start Listening
              </>
            )}
          </button>
          <button 
            onClick={stopListening} 
            disabled={!isListening || isProcessing} 
            className="flex-1 bg-gradient-to-r from-red-500 to-red-600 text-white py-3 px-4 rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-md hover:shadow-lg flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
            Stop
          </button>
        </div>

        {transcript.trim() && (
          <button 
            onClick={handleSend} 
            disabled={isProcessing} 
            className="w-full mt-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 px-4 rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-md hover:shadow-lg flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Send Message
              </>
            )}
          </button>
        )}

        <div className="mt-4 flex flex-col items-center space-y-2">
          <div className="flex items-center space-x-2">
            <StatusIndicator 
              status={voiceLoading.state} 
              message={voiceLoading.message}
              showIcon={true}
            />
            <StatusIndicator 
              status={processingLoading.state} 
              message={processingLoading.message}
              showIcon={true}
            />
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
            Language: {getLanguageCode(language).toUpperCase()}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
            Engine: {recognitionProvider === 'azure' ? 'Azure Speech-to-Text' : 'Browser Speech Recognition'}
            {!isAzureReady && recognitionProvider !== 'azure' ? ' (Azure unavailable)' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
