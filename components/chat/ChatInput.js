'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useToast } from '@/components/ui/ToastProvider';

const ChatInput = ({
  onSendMessage,
  onVoiceClick,
  onImageUpload,
  onSendAssistantMessage,
  onGenerateFlashcards,
  disabled = false
}) => {
  const { showToast } = useToast();
  const [message, setMessage] = useState('');
  const [attachedFile, setAttachedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showImageDropdown, setShowImageDropdown] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const noteInputRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if ((message.trim() || attachedFile) && !disabled) {
      // Pass message and optional context (attached file text)
      onSendMessage(message.trim(), false, undefined, attachedFile?.text);
      setMessage('');
      setAttachedFile(null);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleNoteUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      showToast('Please select a PDF file', { type: 'error' });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast('File size too large. Max 10MB.', { type: 'error' });
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/notes/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();
      setAttachedFile({
        name: file.name,
        text: data.extractedText
      });
      showToast('Notes attached successfully!', { type: 'success' });
    } catch (error) {
      console.error('Upload error:', error);
      showToast('Failed to upload notes', { type: 'error' });
    } finally {
      setIsUploading(false);
      if (noteInputRef.current) noteInputRef.current.value = '';
    }
  };

  const removeAttachment = () => {
    setAttachedFile(null);
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

    // Show progress toast
    showToast('Processing image with OCR... This may take a moment.', { type: 'info', duration: 3000 });

    try {
      // OCR the image with multi-language support
      const { createWorker } = await import('tesseract.js');

      // Try English first, then fallback to multi-language if needed
      // For Indic languages, use eng+hin (or other) for better accuracy
      const tesseractLang = 'eng+hin+tam+ben'; // Multi-language: English + Hindi + Tamil + Bengali

      const worker = await createWorker(tesseractLang);

      // Recognize text from image (logger removed to prevent DataCloneError with Web Workers)
      const { data: { text: ocrText } } = await worker.recognize(file);

      await worker.terminate();

      const extractedText = (ocrText || '').trim();

      if (extractedText && extractedText.length > 10) {
        // Send the OCR text as a normal user message
        showToast('Text extracted successfully!', { type: 'success' });
        onSendMessage(extractedText);
      } else {
        showToast('No readable text found in the image.', { type: 'warning' });
        onSendMessage('⚠️ No readable text found in the image.\n\nPlease try:\n• A clearer photo with better lighting\n• Ensuring text is not too small or blurry\n• An image with visible, readable text');
      }
    } catch (error) {
      console.error('OCR error:', error);
      showToast('OCR processing failed. Please try again.', { type: 'error' });
      onSendMessage(`❌ Failed to process the image: ${error.message || 'Unknown error'}.\n\nPlease try:\n• Another image with clearer text\n• Ensuring the image is not corrupted\n• A different image format`);
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
      {/* Attached File Chip */}
      {attachedFile && (
        <div className="max-w-4xl mx-auto mb-2 flex items-center">
          <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-3 py-1.5 rounded-full text-sm border border-red-200 dark:border-red-800/30 animate-in fade-in slide-in-from-bottom-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="truncate max-w-[200px]">{attachedFile.name}</span>
            <button
              onClick={removeAttachment}
              className="ml-1 hover:bg-red-100 dark:hover:bg-red-800/40 rounded-full p-0.5 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Generate Flashcards Button */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onGenerateFlashcards && onGenerateFlashcards(attachedFile.text)}
            className="ml-auto text-xs bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800/30 rounded-full px-3 py-1 flex items-center gap-1.5 animate-in fade-in slide-in-from-bottom-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            Generate Flashcards
          </Button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="chat-input-form flex gap-3 sm:gap-4 items-end max-w-4xl mx-auto">
        {/* Plus Button for Notes */}
        <div className="relative">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => noteInputRef.current?.click()}
            disabled={disabled || isUploading}
            title="Upload Notes (PDF)"
            className="p-3 sm:p-4 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-300 group shadow-sm hover:shadow-md border border-gray-200 dark:border-gray-700"
          >
            {isUploading ? (
              <svg className="w-5 h-5 sm:w-6 sm:h-6 animate-spin text-red-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-500 dark:text-gray-400 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            )}
          </Button>
          <input
            ref={noteInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleNoteUpload}
            className="hidden"
          />
        </div>

        <div className="flex-1 relative space-y-2">
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={attachedFile ? "Ask questions about your notes..." : "Ask me anything about PCS, UPSC, or SSC exams..."}
            className="w-full text-[15px] sm:text-base px-4 sm:px-6 py-4 sm:py-5 rounded-3xl border-2 border-gray-200/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl focus:border-red-500 dark:focus:border-red-500 focus:ring-4 focus:ring-red-500/15 dark:focus:ring-red-500/25 transition-all duration-300 placeholder:text-gray-500 dark:placeholder:text-slate-400 focus:outline-none shadow-lg hover:shadow-xl focus:shadow-2xl focus:shadow-red-500/10 dark:focus:shadow-red-500/20 font-normal leading-relaxed touch-manipulation"
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
          disabled={(!message.trim() && !attachedFile) || disabled || isProcessingImage || isUploading}
          className="send-button group bg-gradient-to-r from-red-500 via-red-600 to-orange-600 hover:from-red-600 hover:via-red-700 hover:to-orange-700 text-white p-3 sm:p-4 rounded-2xl shadow-xl hover:shadow-2xl hover:shadow-red-500/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-500/30 focus-visible:ring-offset-2 transform hover:scale-105 active:scale-95 touch-manipulation"
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
