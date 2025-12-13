'use client';

import { useState, useRef } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { useToast } from '@/components/ui/ToastProvider';

const DAFUploadModal = ({ isOpen, onClose, onQuestionsGenerated }) => {
  const [formData, setFormData] = useState({
    examType: 'UPSC',
    dafFile: null
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [dafFileName, setDafFileName] = useState('');
  const [dafExtractedText, setDafExtractedText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState('');
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [isGeneratingCommon, setIsGeneratingCommon] = useState(false);
  const fileInputRef = useRef(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (submitStatus === 'error') {
      setSubmitStatus(null);
      setErrorMessage('');
    }
  };

  // Import Toast


  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/jpg',
      'text/plain'
    ];

    if (!allowedTypes.includes(file.type)) {
      setErrorMessage('Please upload a valid file (PDF, Word, Image, or Text file)');
      setSubmitStatus('error');
      return;
    }

    // Validate file size (max 10MB for DAF)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setErrorMessage('File size too large. Please select a file smaller than 10MB.');
      setSubmitStatus('error');
      return;
    }

    setFormData(prev => ({ ...prev, dafFile: file }));
    setDafFileName(file.name);
    setIsExtracting(true);
    setErrorMessage('');

    try {
      // Extract text from file
      const formDataToSend = new FormData();
      formDataToSend.append('file', file);

      const response = await fetch('/api/contact/extract-daf', {
        method: 'POST',
        body: formDataToSend,
      });

      const data = await response.json();

      if (!response.ok) {
        // Check if it's a scanned PDF error
        if (data.error === 'Could not extract text from PDF' || (data.details && data.details.includes('scanned'))) {
          console.log('Server extraction failed (scanned PDF). Attempting client-side OCR...');
          await performOCR(file);
          return;
        }

        // Build detailed error message
        let errorMsg = data.error || 'Failed to extract text from DAF';
        if (data.details) {
          errorMsg += `\n${data.details}`;
        }
        if (data.suggestion) {
          errorMsg += `\n\n💡 Suggestion: ${data.suggestion}`;
        }
        throw new Error(errorMsg);
      }

      setDafExtractedText(data.extractedText || '');
      if (data.extractedText && data.extractedText.length > 0) {
        setErrorMessage('');
        setSubmitStatus(null);
      }
    } catch (error) {
      console.error('Error extracting DAF:', error);
      setErrorMessage(error.message || 'Failed to extract text from DAF. Please try a different file format.');
      setSubmitStatus('error');
    } finally {
      setIsExtracting(false);
    }
  };

  const performOCR = async (file) => {
    try {
      // Only for PDFs or Images
      if (file.type !== 'application/pdf' && !file.type.startsWith('image/')) {
        throw new Error('OCR fallback only available for PDFs and Images.');
      }

      setErrorMessage('Scanned document detected. Performing OCR (Standard quality)...');

      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng+hin'); // Support Hindi/English

      let extractedText = '';

      if (file.type === 'application/pdf') {
        // Dynamic import PDFJS (works reliably with v3.11.174)
        // Use minified build to avoid node-specific dependencies like canvas
        const pdfjsModule = await import('pdfjs-dist/build/pdf.min.js');
        const pdfjsLib = pdfjsModule.default || pdfjsModule;

        console.log('PDFJS Lib loaded (v3):', pdfjsLib.version);

        // Explicitly use version 3.11.174
        const workerVersion = '3.11.174';

        // Set worker source
        if (pdfjsLib.GlobalWorkerOptions) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${workerVersion}/build/pdf.worker.min.js`;
          console.log(`PDFJS Worker configured: ${pdfjsLib.GlobalWorkerOptions.workerSrc}`);
        }

        const arrayBuffer = await file.arrayBuffer();

        if (!pdfjsLib.getDocument) {
          throw new Error('PDFJS.getDocument is not available. Library load failed.');
        }

        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        const maxPages = Math.min(pdf.numPages, 10); // Limit to 10 pages for performance

        for (let i = 1; i <= maxPages; i++) {
          setErrorMessage(`Scanning page ${i} of ${pdf.numPages} with OCR...`);
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 }); // Reasonable scale

          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({ canvasContext: context, viewport: viewport }).promise;

          const blob = await new Promise(resolve => canvas.toBlob(resolve));
          const { data: { text } } = await worker.recognize(blob);

          extractedText += `\n--- Page ${i} ---\n` + text;
        }
      } else {
        // Image OCR
        const { data: { text } } = await worker.recognize(file);
        extractedText = text;
      }

      await worker.terminate();

      if (!extractedText || extractedText.trim().length < 20) {
        throw new Error('OCR could not extract readable text.');
      }

      setDafExtractedText(extractedText);
      setErrorMessage('');
      setSubmitStatus(null);

    } catch (error) {
      console.error("OCR Error:", error);
      throw new Error('OCR Failed: ' + (error.message || 'Could not read scanned document'));
    }
  };

  const removeFile = () => {
    setFormData(prev => ({ ...prev, dafFile: null }));
    setDafFileName('');
    setDafExtractedText('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Generate questions from DAF (personalized)
  const handleGenerateQuestionsFromDAF = async () => {
    if (!dafExtractedText) {
      setErrorMessage('Please upload a DAF file first');
      setSubmitStatus('error');
      return;
    }

    setIsGeneratingQuestions(true);
    setErrorMessage('');
    setSubmitStatus(null);

    try {
      const response = await fetch('/api/interview/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dafExtractedText,
          examType: formData.examType,
          personalized: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate questions');
      }

      setGeneratedQuestions(data.questions);
      setSubmitStatus('success_questions');

      if (onQuestionsGenerated && data.questions) {
        onQuestionsGenerated(data.questions, 'daf');
      }
    } catch (error) {
      console.error('Error generating questions:', error);
      setErrorMessage('Failed to generate questions. Please try again.');
      setSubmitStatus('error');
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  // Generate common interview questions (no DAF required)
  const handleGenerateCommonQuestions = async () => {
    setIsGeneratingCommon(true);
    setErrorMessage('');
    setSubmitStatus(null);

    try {
      const response = await fetch('/api/interview/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          examType: formData.examType,
          personalized: false,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate questions');
      }

      setGeneratedQuestions(data.questions);
      setSubmitStatus('success_questions');

      if (onQuestionsGenerated && data.questions) {
        onQuestionsGenerated(data.questions, 'common');
      }
    } catch (error) {
      console.error('Error generating questions:', error);
      setErrorMessage('Failed to generate questions. Please try again.');
      setSubmitStatus('error');
    } finally {
      setIsGeneratingCommon(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting && !isGeneratingQuestions && !isGeneratingCommon) {
      setFormData({
        examType: 'UPSC',
        dafFile: null
      });
      setDafFileName('');
      setDafExtractedText('');
      setGeneratedQuestions('');
      setSubmitStatus(null);
      setErrorMessage('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onClose();
    }
  };

  const isLoading = isGeneratingQuestions || isGeneratingCommon || isExtracting;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Generate Interview Questions"
      size="lg"
    >
      <div className="space-y-6">
        {/* Success - Generated Questions */}
        {submitStatus === 'success_questions' && generatedQuestions && (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-green-800 dark:text-green-200 font-medium">
                ✓ Interview questions generated successfully!
              </p>
            </div>
            <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm max-h-96 overflow-y-auto">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Generated Questions:</h4>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <div className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {generatedQuestions}
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSubmitStatus(null);
                setGeneratedQuestions('');
              }}
              className="w-full"
            >
              Generate More Questions
            </Button>
          </div>
        )}

        {/* Error Message */}
        {submitStatus === 'error' && errorMessage && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-800 dark:text-red-200 font-medium whitespace-pre-wrap">
              {errorMessage}
            </p>
          </div>
        )}

        {/* Main Form - Only show when not viewing results */}
        {submitStatus !== 'success_questions' && (
          <>
            {/* Info Box */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Choose how to generate questions:</strong><br />
                • <strong>With DAF:</strong> Upload your Detailed Application Form to get personalized questions based on your profile, hobbies, and experience.<br />
                • <strong>Without DAF:</strong> Generate common interview questions for your exam type.
              </p>
            </div>

            {/* Exam Type Selection */}
            <div>
              <label htmlFor="examType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Exam Type <span className="text-red-500">*</span>
              </label>
              <select
                id="examType"
                name="examType"
                value={formData.examType}
                onChange={handleChange}
                required
                disabled={isLoading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="UPSC">UPSC</option>
                <option value="PCS">PCS</option>
                <option value="SSC">SSC</option>
              </select>
            </div>

            {/* DAF Upload Section */}
            <div className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Upload DAF (Optional - for personalized questions)
              </label>
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  id="dafFile"
                  name="dafFile"
                  type="file"
                  onChange={handleFileSelect}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
                  disabled={isLoading}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                />
                {isExtracting && (
                  <p className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Extracting text from DAF...
                  </p>
                )}
                {dafFileName && !isExtracting && (
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{dafFileName}</span>
                    </div>
                    <button
                      type="button"
                      onClick={removeFile}
                      disabled={isLoading}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Remove
                    </button>
                  </div>
                )}
                {dafExtractedText && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <p className="text-xs text-green-700 dark:text-green-300 font-medium">
                      ✓ DAF text extracted successfully ({dafExtractedText.length} characters)
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {/* Generate from DAF Button */}
              <Button
                type="button"
                onClick={handleGenerateQuestionsFromDAF}
                disabled={isLoading || !dafExtractedText}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isGeneratingQuestions ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating Personalized Questions...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Generate Questions from DAF
                  </span>
                )}
              </Button>
              {!dafExtractedText && (
                <p className="text-xs text-center text-gray-500 -mt-1">
                  Upload a DAF file above to enable personalized questions
                </p>
              )}

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
                <span className="text-sm text-gray-500 dark:text-gray-400">OR</span>
                <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
              </div>

              {/* Generate Common Questions Button */}
              <Button
                type="button"
                variant="secondary"
                onClick={handleGenerateCommonQuestions}
                disabled={isLoading}
                className="w-full border-2 border-gray-300 dark:border-gray-600"
              >
                {isGeneratingCommon ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating Common Questions...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Generate Common Interview Questions
                  </span>
                )}
              </Button>
            </div>

            {/* Close Button */}
            <div className="flex justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
              >
                Close
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default DAFUploadModal;
