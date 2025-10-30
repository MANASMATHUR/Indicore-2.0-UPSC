'use client';

import { useState, useRef, useEffect } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';

const ChatInput = ({ 
  onSendMessage, 
  onVoiceClick, 
  onImageUpload, 
  onSendAssistantMessage,
  disabled = false 
}) => {
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
      alert('Please select a valid image file (.png, .jpg, .jpeg, .webp)');
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      alert('Image size too large. Please select an image smaller than 10MB.');
      return;
    }

    setIsProcessingImage(true);
    setShowImageDropdown(false);

    try {
      console.log('Starting OCR for image:', file.name, 'Size:', file.size);
      
      // OCR the image
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      console.log('Worker created, recognizing text...');
      
      const { data: { text: ocrText } } = await worker.recognize(file);
      console.log('OCR result received, text length:', (ocrText || '').length);
      
      await worker.terminate();

      const extractedText = (ocrText || '').trim();
      
      if (extractedText) {
        console.log('Extracted text:', extractedText.substring(0, 100) + '...');
        
        // Send the OCR text as a normal user message
        
        onSendMessage(extractedText);
      } else {
        console.warn('No text extracted from image');
        onSendMessage(' No readable text found in the image. Please try a clearer photo with better lighting.');
      }
    } catch (error) {
      console.error('OCR error:', error);
      onSendMessage(` Failed to process the image: ${error.message}. Please try again or upload a clearer image.`);
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
    <div className="input-container p-3 sm:p-4">
      <form onSubmit={handleSubmit} className="chat-input-form flex gap-2 sm:gap-3 items-center">
        <Input
          ref={inputRef}
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Message Indicore AI..."
          className="flex-1 text-sm sm:text-base"
          disabled={disabled}
          aria-label="Chat message input"
          aria-describedby="chat-input-help"
        />
        
        <div id="chat-input-help" className="sr-only">
          Type your message and press Enter to send, or Shift+Enter for a new line
        </div>
        
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onVoiceClick}
          disabled={disabled}
          title="Voice input"
          className="mic-button p-2 sm:p-3 hover:bg-red-100 dark:hover:bg-red-900/20 hover:scale-110 transition-all duration-200 group"
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 dark:text-red-400 group-hover:text-red-700 dark:group-hover:text-red-300 transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 p-2 sm:p-3 hover:scale-110 transition-all duration-200 group"
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
            <div className="absolute bottom-full right-0 mb-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
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
          className="send-button group"
          title="Send message"
          aria-label="Send message"
        >
          <svg className="w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </Button>
      </form>
    </div>
  );
};

export default ChatInput;
