'use client';

import { useState, useRef } from 'react';
import { useToast } from '@/components/ui/ToastProvider';

const supportedLanguages = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
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

export default function DocumentUpload({ isOpen, onClose, onTranslate }) {
  const { showToast } = useToast();
  const [selectedFile, setSelectedFile] = useState(null);
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const [targetLanguage, setTargetLanguage] = useState('hi');
  const [detectedLanguage, setDetectedLanguage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [manualText, setManualText] = useState('');
  const [isStudyMaterial, setIsStudyMaterial] = useState(true);
  const fileInputRef = useRef(null);

  // Simple language detection based on common words and characters
  const detectLanguage = (text) => {
    const sample = text.substring(0, 500).toLowerCase();
    
    // Hindi detection
    if (/[\u0900-\u097F]/.test(sample)) return 'hi';
    
    // Bengali detection
    if (/[\u0980-\u09FF]/.test(sample)) return 'bn';
    
    // Tamil detection
    if (/[\u0B80-\u0BFF]/.test(sample)) return 'ta';
    
    // Telugu detection
    if (/[\u0C00-\u0C7F]/.test(sample)) return 'te';
    
    // Gujarati detection
    if (/[\u0A80-\u0AFF]/.test(sample)) return 'gu';
    
    // Punjabi detection
    if (/[\u0A00-\u0A7F]/.test(sample)) return 'pa';
    
    // Marathi detection (uses Devanagari script like Hindi)
    if (/[\u0900-\u097F]/.test(sample) && /मराठी|महाराष्ट्र|मुंबई/.test(sample)) return 'mr';
    
    // Malayalam detection
    if (/[\u0D00-\u0D7F]/.test(sample)) return 'ml';
    
    // Kannada detection
    if (/[\u0C80-\u0CFF]/.test(sample)) return 'kn';
    
    // Spanish detection
    if (/\b(el|la|de|que|y|a|en|un|es|se|no|te|lo|le|da|su|por|son|con|para|al|del|los|las|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b/.test(sample)) return 'es';
    
    // Default to English
    return 'en';
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = [
        'text/plain',
        'text/markdown',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/png',
        'image/jpeg',
        'image/webp'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        showToast('Please select a valid file type (.txt, .md, .pdf, .doc, .docx, .png, .jpg, .webp)', { type: 'error' });
        return;
      }
      
      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        showToast('File size too large. Please select a file smaller than 10MB.', { type: 'error' });
        return;
      }
      
      // Reset previous state
      setExtractedText('');
      setDetectedLanguage(null);
      
      setSelectedFile(file);
      extractTextFromFile(file);
    }
  };

  // PDF text extraction with multiple fallback methods
  const extractTextFromPDF = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    
    // Method 1: Try pdfjs-dist with different worker sources
    try {
      const pdfjsLib = await import('pdfjs-dist');
      
      // Try multiple worker sources
      const workerSources = [
        `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`,
        `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`,
        `//cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`
      ];
      
      for (const workerSrc of workerSources) {
        try {
          pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
          
          const pdf = await pdfjsLib.getDocument({ 
            data: arrayBuffer,
            verbosity: 0 // Reduce console output
          }).promise;
          
          let fullText = '';
          
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
              .filter(item => item.str && item.str.trim())
              .map(item => item.str.trim())
              .join(' ');
            fullText += pageText + '\n';
          }
          
          const extractedText = fullText.trim();
          if (extractedText && extractedText.length > 10) {
            return extractedText;
          }
        } catch (workerError) {
          continue;
        }
      }
    } catch (pdfjsError) {
    }
    
    // Method 2: Try using a different PDF parsing approach
    try {
      // Convert to base64 and try a different approach
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      // Try to extract text using a simple regex approach for basic PDFs
      const pdfString = atob(base64);
      
      // Look for text streams in PDF
      const textMatches = pdfString.match(/BT\s*\/F\d+\s+\d+\s+Tf\s*\((.*?)\)\s*Tj/g);
      if (textMatches && textMatches.length > 0) {
        const extractedText = textMatches
          .map(match => {
            const textMatch = match.match(/\((.*?)\)/);
            return textMatch ? textMatch[1] : '';
          })
          .filter(text => text.trim())
          .join(' ');
        
        if (extractedText.trim()) {
          return extractedText.trim();
        }
      }
    } catch (regexError) {
    }
    
    // Method 3: Return helpful error message with suggestions
    return `[PDF File: ${file.name}]\n\n PDF text extraction failed. This PDF might be:\n\n• Image-based (scanned document) - No text layer available\n• Password-protected - Requires password to access\n• Corrupted or damaged file\n• Using special encoding or fonts\n\n File Details:\n• Size: ${(file.size / 1024).toFixed(1)} KB\n• Type: PDF Document\n\n Solutions:\n1. Try converting the PDF to text format (.txt)\n2. Use OCR tools like Google Drive or Adobe Acrobat\n3. Copy text manually and paste as text file\n4. Try a different PDF file\n\n🔄 The system will still attempt translation with the available information.`;
  };

  const extractTextFromFile = async (file) => {
    setIsUploading(true);
    try {
      let text = '';
      
      if (file.type === 'application/pdf') {
        text = await extractTextFromPDF(file);
      } else if (file.type.startsWith('image/')) {
        // OCR for images using tesseract.js (lazy import)
        try {
          const { createWorker } = await import('tesseract.js');
          
          // Map language codes to Tesseract language codes
          const tesseractLangMap = {
            'en': 'eng',
            'hi': 'hin+eng', // Hindi + English for mixed content
            'mr': 'mar+eng', // Marathi + English
            'ta': 'tam+eng', // Tamil + English
            'bn': 'ben+eng', // Bengali + English
            'pa': 'pan+eng', // Punjabi + English
            'gu': 'guj+eng', // Gujarati + English
            'te': 'tel+eng', // Telugu + English
            'ml': 'mal+eng', // Malayalam + English
            'kn': 'kan+eng', // Kannada + English
            'es': 'spa+eng'  // Spanish + English
          };
          
          // Use detected language or source language, fallback to English
          const detectedLang = detectedLanguage || sourceLanguage || 'en';
          const tesseractLang = tesseractLangMap[detectedLang] || tesseractLangMap[sourceLanguage] || 'eng';
          
          // Show progress
          setExtractedText('🔄 Processing image with OCR...\n\nThis may take a few moments...');
          
          const worker = await createWorker(tesseractLang);
          
          // Add progress callback
          await worker.recognize(file, {
            logger: (m) => {
              if (m.status === 'recognizing text') {
                const progress = Math.round(m.progress * 100);
                setExtractedText(`🔄 Processing image with OCR... ${progress}%\n\nPlease wait...`);
              }
            }
          }).then(({ data: { text: ocrText } }) => {
            text = (ocrText || '').trim();
            if (!text) {
              text = `⚠️ No readable text detected in the image ${file.name}.\n\nSuggestions:\n• Try a clearer photo with better lighting\n• Ensure text is not too small or blurry\n• Check if the image contains text\n• Try a different image format`;
            }
          });
          
          await worker.terminate();
        } catch (e) {
          console.error('OCR error:', e);
          text = `❌ OCR failed for ${file.name}.\n\nError: ${e.message || 'Unknown error'}\n\nPlease try:\n• Another image with clearer text\n• Ensuring the image is not corrupted\n• A different image format (PNG, JPG, JPEG)`;
        }
      } else {
        text = await readFileAsText(file);
      }
      
      setExtractedText(text);
      
      // Auto-detect language and update source language
      if (text.trim() && !text.includes('[PDF File:') && !text.includes('⚠️')) {
        const detected = detectLanguage(text);
        setDetectedLanguage(detected);
        setSourceLanguage(detected);
      }
    } catch (error) {
      setExtractedText(` Error reading file: ${file.name}\n\nPlease ensure the file is not corrupted and try again.\n\nFile size: ${(file.size / 1024).toFixed(1)} KB`);
    } finally {
      setIsUploading(false);
    }
  };

  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          resolve(e.target.result);
        } catch (error) {
          reject(new Error('Failed to read file content'));
        }
      };
      reader.onerror = (e) => {
        reject(new Error('File reading failed. Please check if the file is corrupted.'));
      };
      reader.onabort = () => {
        reject(new Error('File reading was aborted'));
      };
      
      try {
        reader.readAsText(file, 'UTF-8');
      } catch (error) {
        reject(new Error('Unable to read file. Please try a different file.'));
      }
    });
  };

  const handleTranslate = async () => {

    const textToTranslate = manualText.trim() || extractedText.trim();
    
    if (!textToTranslate) {
      showToast('Please upload a file or enter text manually.', { type: 'error' });
      return;
    }

    try {
      setIsUploading(true);
      const response = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToTranslate,
          sourceLanguage,
          targetLanguage,
          isStudyMaterial
        }),
      });

      if (!response.ok) throw new Error('Translation failed');
      const data = await response.json();
      
      onTranslate(data.translatedText, targetLanguage);
      showToast('Translation complete!', { type: 'success' });
      onClose();
    } catch (error) {
      showToast('Translation failed. Please try again.', { type: 'error' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      
  
      const allowedTypes = [
        'text/plain',
        'text/markdown',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        showToast('Please select a valid file type (.txt, .md, .pdf, .doc, .docx)', { type: 'error' });
        return;
      }
      
      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        showToast('File size too large. Please select a file smaller than 10MB.', { type: 'error' });
        return;
      }
      
      // Reset previous state
      setExtractedText('');
      setDetectedLanguage(null);
      
      setSelectedFile(file);
      extractTextFromFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-700">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Document Translation</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Translate study notes into your language—keeps exam vocabulary accurate
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

            {/* File Upload Area */}
            <div
              className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-8 text-center hover:border-slate-400 dark:hover:border-slate-500 transition-colors duration-200"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.doc,.docx,.pdf,.png,.jpg,.jpeg,.webp"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              {selectedFile ? (
                <div className="space-y-4">
                  <div className="text-green-600">
                    {selectedFile.type === 'application/pdf' ? (
                      <svg className="w-12 h-12 mx-auto mb-2" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                      </svg>
                    ) : selectedFile.type.startsWith('image/') ? (
                      <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4-4 4 4 4-4 4 4M4 4h16v16H4z" />
                      </svg>
                    ) : (
                      <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500 dark:text-slate-400">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                      {selectedFile.type === 'application/pdf' && ' • PDF Document'}
                    </p>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Choose different file
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <div>
                    <p className="text-lg font-medium text-gray-700 dark:text-slate-200">Upload a document</p>
                    <p className="text-sm text-gray-500 dark:text-slate-400">Drag and drop or click to select</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Supports: .txt, .md, .doc, .docx, .pdf, .png, .jpg, .webp</p>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200"
                  >
                    Select File
                  </button>
                </div>
              )}
            </div>

            {/* Study Material Toggle */}
            <div className="mt-6">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="studyMaterial"
                      checked={isStudyMaterial}
                      onChange={(e) => setIsStudyMaterial(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                    />
                    <label htmlFor="studyMaterial" className="ml-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                      Study Material Translation
                    </label>
                  </div>
                  <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                    Preserves exam terminology
                  </div>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {isStudyMaterial ? 'Enhanced' : 'Basic'}
                </div>
              </div>
              {isStudyMaterial && (
                <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                  Uses Cohere/Mistral AI for better academic translations with PCS/UPSC exam terminology
                </div>
              )}
            </div>

            {/* Language Selection */}
            {selectedFile && (
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                      From Language
                      {detectedLanguage && (
                        <span className="ml-2 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                          Auto-detected: {supportedLanguages.find(l => l.code === detectedLanguage)?.name}
                        </span>
                      )}
                    </label>
                    <select
                      value={sourceLanguage}
                      onChange={(e) => setSourceLanguage(e.target.value)}
                      className="w-full p-3 border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                      To Language
                    </label>
                    <select
                      value={targetLanguage}
                      onChange={(e) => setTargetLanguage(e.target.value)}
                      className="w-full p-3 border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {supportedLanguages.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Language Detection Info */}
                {detectedLanguage && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        Language automatically detected as <strong>{supportedLanguages.find(l => l.code === detectedLanguage)?.name}</strong>. 
                        You can change it if needed.
                      </p>
                    </div>
                  </div>
                )}

                {/* Extracted Text Preview */}
                {extractedText && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                      Extracted Text Preview
                    </label>
                    <div className="max-h-32 overflow-y-auto p-3 bg-gray-50 dark:bg-slate-800 rounded-lg text-sm text-gray-700 dark:text-slate-300">
                      {extractedText.substring(0, 500)}
                      {extractedText.length > 500 && '...'}
                    </div>
                    
                    {/* Manual Text Input Option for Failed PDFs */}
                    {extractedText.includes('[PDF File:') && (
                      <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <div className="flex items-center gap-2 mb-3">
                          <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                            PDF text extraction failed
                          </p>
                        </div>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
                          You can manually enter the text from your PDF below:
                        </p>
                        <button
                          onClick={() => setShowTextInput(!showTextInput)}
                          className="text-sm bg-yellow-600 text-white px-3 py-2 rounded hover:bg-yellow-700 transition-colors duration-200"
                        >
                          {showTextInput ? 'Hide' : 'Enter Text Manually'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Manual Text Input */}
                {showTextInput && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                      Enter Text Manually
                    </label>
                    <textarea
                      value={manualText}
                      onChange={(e) => setManualText(e.target.value)}
                      placeholder="Copy and paste the text from your PDF here..."
                      className="w-full h-32 p-3 border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    />
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                      Paste the text content from your PDF document here
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={onClose}
                    className="flex-1 bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-slate-200 py-3 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleTranslate}
                    disabled={isUploading || (!extractedText.trim() && !manualText.trim())}
                    className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center space-x-2"
                  >
                    {isUploading ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>{selectedFile?.type === 'application/pdf' ? 'Extracting PDF text...' : 'Translating...'}</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                        </svg>
                        <span>
                          {isStudyMaterial ? 'Translate with AI' : 'Translate Document'}
                        </span>
                      </>
                    )}
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
