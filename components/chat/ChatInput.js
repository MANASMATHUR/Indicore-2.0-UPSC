'use client';

import { useState, useRef, useEffect } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { useToast } from '@/components/ui/ToastProvider';

const ChatInput = ({ 
  onSendMessage, 
  onVoiceClick, 
  onImageUpload, 
  onSendAssistantMessage,
  disabled = false 
}) => {
  const { showToast } = useToast();
  const [message, setMessage] = useState('');
  const [showImageDropdown, setShowImageDropdown] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleImageSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      showToast('Please select a valid image file (.png, .jpg, .jpeg, .webp)', { type: 'error' });
      return;
    }
    
    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      showToast('Image size too large. Please select an image smaller than 10MB.', { type: 'error' });
      return;
    }

    setIsProcessingImage(true);
    setShowImageDropdown(false);

    try {
      // OCR the image
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      
      const { data: { text: ocrText } } = await worker.recognize(file);
      
      await worker.terminate();
      
      const extractedText = (ocrText || '').trim();
      
      if (extractedText) {
        // Send the OCR text as a normal user message
        onSendMessage(extractedText);
      } else {
        onSendMessage(' No readable text found in the image. Please try a clearer photo with better lighting.');
      }
    } catch (error) {
      onSendMessage(` Failed to process the image: ${error.message || 'Unknown error'}. Please try again or upload a clearer image.`);
    } finally {
      setIsProcessingImage(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleImageUpload = () => {
    fileInputRef.current?.click();
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showImageDropdown && !event.target.closest('.image-dropdown-container')) {
        setShowImageDropdown(false);
      }
    };

    if (showImageDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showImageDropdown]);

  return (
    <div className="input-container p-4 sm:p-5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-gray-200/50 dark:border-slate-700/50 shadow-2xl dark:shadow-2xl">
      <form onSubmit={handleSubmit} className="chat-input-form flex gap-3 sm:gap-4 items-end max-w-4xl mx-auto">
        <div className="flex-1 relative space-y-2">
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything about PCS, UPSC, or SSC exams..."
            className="w-full text-[15px] sm:text-base px-6 py-5 rounded-3xl border-2 border-gray-200/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl focus:border-red-500 dark:focus:border-red-500 focus:ring-4 focus:ring-red-500/15 dark:focus:ring-red-500/25 transition-all duration-300 placeholder:text-gray-500 dark:placeholder:text-slate-400 focus:outline-none shadow-lg hover:shadow-xl focus:shadow-2xl focus:shadow-red-500/10 dark:focus:shadow-red-500/20 font-normal leading-relaxed"
            disabled={disabled}
            aria-label="Chat message input"
            aria-describedby="chat-input-help"
            style={{
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.85))',
            }}
          />
          <div id="chat-input-help" className="sr-only">
            Type your message and press Enter to send, or Shift+Enter for a new line
          </div>
        </div>
        
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onVoiceClick}
          disabled={disabled}
          title="Voice input"
          className="mic-button p-3 sm:p-4 rounded-2xl hover:bg-red-100 dark:hover:bg-red-900/30 hover:scale-110 transition-all duration-300 group shadow-md hover:shadow-lg backdrop-blur-sm border border-transparent hover:border-red-200 dark:hover:border-red-800"
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 dark:text-red-400 group-hover:text-red-700 dark:group-hover:text-red-300 transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </Button>

        {/* Image Upload Dropdown */}
        <div className="relative image-dropdown-container">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowImageDropdown(!showImageDropdown)}
            disabled={disabled || isProcessingImage}
            title="Upload Image"
            className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100/80 dark:hover:bg-gray-700/80 p-3 sm:p-4 rounded-2xl hover:scale-110 transition-all duration-300 group shadow-md hover:shadow-lg backdrop-blur-sm border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
          >
            {isProcessingImage ? (
              <svg className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4-4 4 4 4-4 4 4M4 4h16v16H4z" />
              </svg>
            )}
          </Button>

          {showImageDropdown && (
            <div className="absolute bottom-full right-0 mb-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
              <div className="p-2">
                <Button
                  variant="ghost"
                  onClick={handleImageUpload}
                  className="w-full justify-start text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4-4 4 4 4-4 4 4M4 4h16v16H4z" />
                  </svg>
                  Upload Image for OCR
                </Button>
                <div className="text-xs text-gray-500 dark:text-gray-400 px-3 py-1">
                  Supports: PNG, JPG, WEBP
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          onChange={handleImageSelect}
          className="hidden"
        />
        
        <Button
          type="submit"
          disabled={!message.trim() || disabled || isProcessingImage}
          className="send-button group bg-gradient-to-r from-red-500 via-red-600 to-orange-600 hover:from-red-600 hover:via-red-700 hover:to-orange-700 text-white p-3 sm:p-4 rounded-2xl shadow-xl hover:shadow-2xl hover:shadow-red-500/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-500/30 focus-visible:ring-offset-2 transform hover:scale-105 active:scale-95"
          title="Send message"
          aria-label="Send message"
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </Button>
      </form>
    </div>
  );
};

export default ChatInput;
