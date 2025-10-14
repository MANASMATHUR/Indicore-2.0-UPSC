'use client';

import { useState, useEffect, useRef } from 'react';

export default function VoiceDialog({ isOpen, onClose, onSendMessage, language }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (isOpen && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      const recognition = recognitionRef.current;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = getLanguageCode(language);

      recognition.onstart = () => setIsListening(true);

      recognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptPart = event.results[i][0].transcript;
          if (event.results[i].isFinal) finalTranscript += transcriptPart;
          else interimTranscript += transcriptPart;
        }

        setTranscript(finalTranscript + interimTranscript);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => setIsListening(false);
    }
  }, [isOpen, language]);

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
    return languageMap[lang] || 'en-US';
  };

  const startListening = () => {
    if (recognitionRef.current) {
      setTranscript('');
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const handleSend = async () => {
    if (!transcript.trim()) return;

    setIsProcessing(true);
    stopListening();

    try {
      await onSendMessage(transcript.trim());
      setTranscript('');
      onClose();
    } catch (err) {
      console.error('Error sending voice message:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    stopListening();
    setTranscript('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="voice-dialog">
      <div className="voice-dialog-content">
        <div className="flex justify-between items-center mb-6 w-full">
          <h3 className="text-xl font-semibold text-gray-800">🎤 Voice Input</h3>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="w-full mb-4">
          <p className="text-sm text-gray-600 text-center">
            {isListening ? 'Listening... Speak now.' : 'Click "Start Listening" to begin speaking...'}
          </p>
        </div>

        <div className="w-full mb-6">
          <textarea
            value={transcript}
            placeholder="Your speech will appear here..."
            className="w-full p-4 border border-gray-300 rounded-lg bg-gray-50 min-h-[100px] resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            readOnly
          />
        </div>

        <div className="flex gap-3 w-full">
          <button onClick={startListening} disabled={isListening || isProcessing} className="flex-1 bg-green-500 text-white py-3 px-4 rounded-lg hover:bg-green-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
            {isListening ? 'Listening...' : 'Start Listening'}
          </button>
          <button onClick={stopListening} disabled={!isListening || isProcessing} className="flex-1 bg-red-500 text-white py-3 px-4 rounded-lg hover:bg-red-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
            Stop
          </button>
        </div>

        {transcript.trim() && (
          <button onClick={handleSend} disabled={isProcessing} className="w-full mt-4 bg-blue-500 text-white py-3 px-4 rounded-lg hover:bg-blue-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
            {isProcessing ? 'Processing...' : 'Send'}
          </button>
        )}

        {isProcessing && (
          <div className="mt-4 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Processing your message...</p>
          </div>
        )}
      </div>
    </div>
  );
}
