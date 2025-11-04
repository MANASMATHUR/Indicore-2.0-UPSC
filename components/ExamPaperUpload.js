'use client';

import { useState, useRef } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { supportedLanguages } from '@/lib/messageUtils';

const supportedExamTypes = [
  { code: 'pcs', name: 'PCS (Provincial Civil Service)', color: 'bg-blue-100 text-blue-800' },
  { code: 'upsc', name: 'UPSC (Union Public Service Commission)', color: 'bg-green-100 text-green-800' },
  { code: 'ssc', name: 'SSC (Staff Selection Commission)', color: 'bg-purple-100 text-purple-800' },
  { code: 'other', name: 'Other Competitive Exam', color: 'bg-gray-100 text-gray-800' }
];

export default function ExamPaperUpload({ isOpen, onClose, onEvaluate }) {
  const { showToast } = useToast();
  const [selectedFile, setSelectedFile] = useState(null);
  const [examType, setExamType] = useState('pcs');
  const [subject, setSubject] = useState('');
  const [language, setLanguage] = useState('en');
  const [isUploading, setIsUploading] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [manualText, setManualText] = useState('');
  const fileInputRef = useRef(null);

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
        'image/jpeg',
        'image/png',
        'image/jpg'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        showToast('Please select a valid file type (.txt, .md, .pdf, .doc, .docx, .jpg, .png)', { type: 'error' });
        return;
      }
      
      // Validate file size (max 20MB for exam papers)
      const maxSize = 20 * 1024 * 1024; // 20MB
      if (file.size > maxSize) {
        showToast('File size too large. Please select a file smaller than 20MB.', { type: 'error' });
        return;
      }
      
      setSelectedFile(file);
      extractTextFromFile(file);
    }
  };

  const extractTextFromFile = async (file) => {
    setIsUploading(true);
    try {
      let text = '';
      
      if (file.type === 'application/pdf') {
        text = await extractTextFromPDF(file);
      } else if (file.type.startsWith('image/')) {
        text = `[Image File: ${file.name}]\n\n📸 Image uploaded for evaluation\n\nPlease provide a description of the exam paper or questions in the text area below for AI evaluation.`;
        setShowTextInput(true);
      } else {
        text = await readFileAsText(file);
      }
      
      setExtractedText(text);
    } catch (error) {
      setExtractedText(`❌ Error reading file: ${file.name}\n\nPlease ensure the file is not corrupted and try again.`);
    } finally {
      setIsUploading(false);
    }
  };

  const extractTextFromPDF = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    
    try {
      const pdfjsLib = await import('pdfjs-dist');
      
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
            verbosity: 0
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
    
    return `[PDF File: ${file.name}]\n\n⚠️ PDF text extraction failed. This PDF might be image-based or password-protected.\n\nPlease provide the exam paper content manually in the text area below for AI evaluation.`;
  };

  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('File reading failed'));
      reader.readAsText(file, 'UTF-8');
    });
  };

  const handleEvaluate = async () => {
    const textToEvaluate = manualText.trim() || extractedText.trim();
    
    if (!textToEvaluate) {
      showToast('Please upload a file or enter exam paper content manually.', { type: 'error' });
      return;
    }

    if (!subject.trim()) {
      showToast('Please specify the subject of the exam paper.', { type: 'error' });
      return;
    }

    try {
      setIsUploading(true);
      
      // Send to evaluation API
      const response = await fetch('/api/ai/evaluate-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examPaper: textToEvaluate,
          examType,
          subject,
          language
        }),
      });

      if (!response.ok) throw new Error('Evaluation failed');
      const data = await response.json();
      
      onEvaluate(data.evaluation, examType, subject);
      showToast('Evaluation complete!', { type: 'success' });
      onClose();
    } catch (error) {
      showToast('Evaluation failed. Please try again.', { type: 'error' });
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
        'text/plain', 'text/markdown', 'application/pdf',
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg', 'image/png', 'image/jpg'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        showToast('Please select a valid file type', { type: 'error' });
        return;
      }
      
      const maxSize = 20 * 1024 * 1024;
      if (file.size > maxSize) {
        showToast('File size too large. Please select a file smaller than 20MB.', { type: 'error' });
        return;
      }
      
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-slide-up">
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-card w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-slate-700">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gradient">📝 Exam Paper Review</h2>
                <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                  Upload your practice paper and get detailed feedback on your answers
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

            {/* Exam Type Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-3">
                Select Exam Type
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {supportedExamTypes.map((exam) => (
                  <button
                    key={exam.code}
                    onClick={() => setExamType(exam.code)}
                    className={`p-3 rounded-lg border-2 transition-all duration-200 ${
                      examType === exam.code
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                        : 'border-gray-200 dark:border-slate-600 hover:border-indigo-300'
                    }`}
                  >
                    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${exam.color}`}>
                      {exam.name}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Subject Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                Subject/Topic *
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g., General Studies, History, Mathematics, etc."
                      className="w-full p-3 border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            {/* Language Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                      className="w-full p-3 border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                {supportedLanguages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>

            {/* File Upload Area */}
            <div
              className="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg p-8 text-center hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors duration-200 mb-6"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.doc,.docx,.pdf,.jpg,.jpeg,.png"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              {selectedFile ? (
                <div className="space-y-4">
                  <div className="text-green-600">
                    <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500 dark:text-slate-400">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-indigo-600 hover:text-indigo-700 font-medium"
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
                    <p className="text-lg font-medium text-gray-700 dark:text-slate-200">Upload Exam Paper</p>
                    <p className="text-sm text-gray-500 dark:text-slate-400">Drag and drop or click to select</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                      Supports: .txt, .md, .doc, .docx, .pdf, .jpg, .png
                    </p>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200"
                  >
                    Select File
                  </button>
                </div>
              )}
            </div>

            {/* Extracted Text Preview */}
            {extractedText && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                  Extracted Content Preview
                </label>
                <div className="max-h-32 overflow-y-auto p-3 bg-gray-50 dark:bg-slate-800 rounded-lg text-sm text-gray-700 dark:text-slate-300">
                  {extractedText.substring(0, 500)}
                  {extractedText.length > 500 && '...'}
                </div>
                
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
                      You can manually enter the exam paper content below:
                    </p>
                    <button
                      onClick={() => setShowTextInput(!showTextInput)}
                      className="text-sm bg-yellow-600 text-white px-3 py-2 rounded hover:bg-yellow-700 transition-colors duration-200"
                    >
                      {showTextInput ? 'Hide' : 'Enter Content Manually'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Manual Text Input */}
            {showTextInput && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                  Enter Exam Paper Content Manually
                </label>
                <textarea
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder="Copy and paste the exam paper content here..."
                  className="w-full h-32 p-3 border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                />
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  Paste the exam questions, answers, or any content you want evaluated
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
                onClick={handleEvaluate}
                disabled={isUploading || (!extractedText.trim() && !manualText.trim()) || !subject.trim()}
                className="flex-1 bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {isUploading ? 'Evaluating...' : 'Evaluate Exam Paper'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
