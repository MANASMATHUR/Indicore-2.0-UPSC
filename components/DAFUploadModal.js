'use client';

import { useState, useRef } from 'react';
import Modal from './ui/Modal';
import Input from './ui/Input';
import Button from './ui/Button';

const DAFUploadModal = ({ isOpen, onClose, onAnswerReceived }) => {
  const [formData, setFormData] = useState({
    examType: 'UPSC',
    customQuestion: '',
    dafFile: null
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [dafFileName, setDafFileName] = useState('');
  const [dafExtractedText, setDafExtractedText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [generatedAnswer, setGeneratedAnswer] = useState('');
  const [generatedQuestions, setGeneratedQuestions] = useState('');
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
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
        throw new Error(data.error || 'Failed to extract text from DAF');
      }

      setDafExtractedText(data.extractedText || '');
      if (data.extractedText && data.extractedText.length > 0) {
        setErrorMessage('');
        setSubmitStatus(null);
      }
    } catch (error) {
      console.error('Error extracting DAF:', error);
      setErrorMessage('Failed to extract text from DAF. You can still submit your question.');
      setSubmitStatus('error');
    } finally {
      setIsExtracting(false);
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

  const validateForm = () => {
    if (!formData.customQuestion || !formData.customQuestion.trim()) {
      setErrorMessage('Please enter your customized question');
      return false;
    }
    const questionLength = formData.customQuestion.trim().length;
    if (questionLength < 10) {
      setErrorMessage('Question must be at least 10 characters long');
      return false;
    }
    if (questionLength > 2000) {
      setErrorMessage('Question must be less than 2000 characters');
      return false;
    }
    // DAF is now optional - no validation needed
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      setSubmitStatus('error');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);
    setErrorMessage('');

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('examType', formData.examType);
      formDataToSend.append('customQuestion', formData.customQuestion);
      formDataToSend.append('dafExtractedText', dafExtractedText);

      if (formData.dafFile) {
        formDataToSend.append('dafFile', formData.dafFile);
      }

      const response = await fetch('/api/interview/daf-question', {
        method: 'POST',
        body: formDataToSend,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process your question');
      }

      setSubmitStatus('success');
      setGeneratedAnswer(data.answer || '');

      // If callback provided, pass the answer
      if (onAnswerReceived && data.answer) {
        onAnswerReceived(formData.customQuestion, data.answer);
      }

      // Reset form (but keep answer visible)
      setFormData({
        examType: 'UPSC',
        customQuestion: '',
        dafFile: null
      });
      setDafFileName('');
      setDafExtractedText('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Don't auto-close - let user read the answer
    } catch (error) {
      console.error('Error submitting DAF question:', error);
      setSubmitStatus('error');
      setErrorMessage(error.message || 'Failed to process your question. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateQuestions = async () => {
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
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate questions');
      }

      setGeneratedQuestions(data.questions);
      setSubmitStatus('success_questions');
    } catch (error) {
      console.error('Error generating questions:', error);
      setErrorMessage('Failed to generate questions. Please try again.');
      setSubmitStatus('error');
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setFormData({
        examType: 'UPSC',
        customQuestion: '',
        dafFile: null
      });
      setDafFileName('');
      setDafExtractedText('');
      setDafExtractedText('');
      setGeneratedAnswer('');
      setGeneratedQuestions('');
      setSubmitStatus(null);
      setErrorMessage('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Upload DAF & Ask Customized Questions"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {submitStatus === 'success' && generatedAnswer && (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-green-800 dark:text-green-200 font-medium mb-2">
                ✓ Customized answer generated based on your DAF!
              </p>
            </div>
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Your Question:</h4>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">{formData.customQuestion}</p>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Customized Answer:</h4>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <div className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {generatedAnswer}
                </div>
              </div>
            </div>
          </div>
        )}

        {submitStatus === 'success_questions' && generatedQuestions && (
          <div className="space-y-4">
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <p className="text-purple-800 dark:text-purple-200 font-medium mb-2">
                ✓ AI Generated Questions based on your DAF!
              </p>
            </div>
            <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Suggested Interview Questions:</h4>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <div className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {generatedQuestions}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Tip: Copy any of these questions into the "Customized Question" box below to get a detailed answer!
                </p>
              </div>
            </div>
          </div>
        )}

        {submitStatus === 'error' && errorMessage && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-800 dark:text-red-200 font-medium">
              {errorMessage}
            </p>
          </div>
        )}

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>For Interview Candidates:</strong> Upload your DAF (Detailed Application Form) for personalized questions, or generate common interview questions without uploading.
            With DAF: Get personalized answers based on your profile, hobbies, education, and work experience.
            Without DAF: Get general interview questions for your exam type.
          </p>
        </div>

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
            disabled={isSubmitting}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="UPSC">UPSC</option>
            <option value="PCS">PCS</option>
            <option value="SSC">SSC</option>
          </select>
        </div>

        <div>
          <label htmlFor="dafFile" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Upload DAF (Detailed Application Form) <span className="text-gray-500 text-xs">(Optional)</span>
          </label>
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              id="dafFile"
              name="dafFile"
              type="file"
              onChange={handleFileSelect}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
              disabled={isSubmitting || isExtracting}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {isExtracting && (
              <p className="text-sm text-blue-600 dark:text-blue-400">
                Extracting text from DAF...
              </p>
            )}
            {dafFileName && (
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
                  disabled={isSubmitting}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  Remove
                </button>
              </div>
            )}
            {dafExtractedText && (
              <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-xs text-green-700 dark:text-green-300 font-medium mb-1">
                  ✓ DAF text extracted successfully ({dafExtractedText.length} characters)
                </p>
              </div>
            )}

            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={handleGenerateQuestions}
                disabled={isGeneratingQuestions || isSubmitting}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white border-none"
              >
                {isGeneratingQuestions ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating Questions...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                    {dafExtractedText ? 'Generate Questions from DAF' : 'Generate Common Interview Questions'}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="customQuestion" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Your Customized Question <span className="text-red-500">*</span>
          </label>
          <textarea
            id="customQuestion"
            name="customQuestion"
            value={formData.customQuestion}
            onChange={handleChange}
            placeholder="Ask any question related to your interview preparation. We'll provide answers customized to your profile, hobbies, education, and work experience mentioned in your DAF."
            required
            disabled={isSubmitting}
            rows={6}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Example: "Based on my DAF, what questions might the interview panel ask about my hobby of photography?" or
            "How should I answer questions about my work experience in [your field]?"
          </p>
        </div>

        <div className="flex gap-3 justify-end pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting || isExtracting}
          >
            {isSubmitting ? 'Processing...' : 'Get Customized Answer'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default DAFUploadModal;

