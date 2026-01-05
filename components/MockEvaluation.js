'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { supportedLanguages } from '@/lib/messageUtils';

const examTypes = [
  { code: 'pcs', name: 'PCS', description: 'Provincial Civil Service' },
  { code: 'upsc', name: 'UPSC', description: 'Union Public Service Commission' },
  { code: 'ssc', name: 'SSC', description: 'Staff Selection Commission' },
  { code: 'other', name: 'Other', description: 'Other Competitive Exams' }
];

const questionTypes = [
  { code: 'essay', name: 'Essay Writing', description: 'Long-form essay questions' },
  { code: 'short_answer', name: 'Short Answer', description: 'Brief descriptive answers' },
  { code: 'analytical', name: 'Analytical', description: 'Critical analysis questions' },
  { code: 'current_affairs', name: 'Current Affairs', description: 'Contemporary issues' },
  { code: 'general_studies', name: 'General Studies', description: 'Comprehensive GS questions' }
];

export default function MockEvaluation({ isOpen, onClose, onEvaluate }) {
  const { showToast } = useToast();
  const [examType, setExamType] = useState('pcs');
  const [language, setLanguage] = useState('hi');
  const [questionType, setQuestionType] = useState('essay');
  const [questionText, setQuestionText] = useState('');
  const [answerText, setAnswerText] = useState('');
  const [wordLimit, setWordLimit] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [showResults, setShowResults] = useState(false);

  const handleEvaluate = async () => {
    if (!answerText.trim()) {
      showToast('Please enter your answer for evaluation.', { type: 'error' });
      return;
    }

    if (!subject.trim()) {
      showToast('Please specify the subject/topic.', { type: 'error' });
      return;
    }

    try {
      setIsEvaluating(true);

      const endpoint = questionType === 'analytical' || examType === 'upsc'
        ? '/api/ai/evaluate-mains'
        : '/api/ai/mock-evaluation';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examType,
          language,
          questionType,
          subject,
          question: questionText || subject, // Fallback to subject if no dedicated question
          answer: answerText,
          wordLimit: wordLimit ? parseInt(wordLimit) : null
        }),
      });

      if (!response.ok) throw new Error('Evaluation failed');
      const data = await response.json();

      setEvaluation(data);
      setShowResults(true);
      showToast('Evaluation complete!', { type: 'success' });
    } catch (error) {
      showToast('Evaluation failed. Please try again.', { type: 'error' });
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleReset = () => {
    setAnswerText('');
    setEvaluation('');
    setShowResults(false);
  };

  const handleUseEvaluation = () => {
    onEvaluate(evaluation, language);
    onClose();
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
                <h2 className="text-2xl font-bold text-gradient">📊 Mock Answer Evaluation</h2>
                <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                  Submit your answers and get instant feedback in your preferred language
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

            {!showResults ? (
              <div className="space-y-6">
                {/* Exam Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-3">
                    Exam Type
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {examTypes.map((exam) => (
                      <button
                        key={exam.code}
                        onClick={() => setExamType(exam.code)}
                        className={`p-3 rounded-lg border-2 transition-all duration-200 ${examType === exam.code
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                            : 'border-gray-200 dark:border-slate-600 hover:border-indigo-300'
                          }`}
                      >
                        <div className="font-medium text-sm text-gray-800 dark:text-slate-200">
                          {exam.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                          {exam.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Language Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                    Answer Language
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

                {/* Question Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-3">
                    Question Type
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {questionTypes.map((type) => (
                      <button
                        key={type.code}
                        onClick={() => setQuestionType(type.code)}
                        className={`p-3 rounded-lg border-2 transition-all duration-200 ${questionType === type.code
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                            : 'border-gray-200 dark:border-slate-600 hover:border-indigo-300'
                          }`}
                      >
                        <div className="font-medium text-sm text-gray-800 dark:text-slate-200">
                          {type.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                          {type.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Question Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                    The Question *
                  </label>
                  <textarea
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    placeholder="Paste the Mains question here..."
                    className="w-full h-24 p-3 border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                  />
                </div>

                {/* Subject Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                    Subject/Topic
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g., Indian Polity, History, Ethics"
                    className="w-full p-3 border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>

                {/* Word Limit */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                    Word Limit (Optional)
                  </label>
                  <input
                    type="number"
                    value={wordLimit}
                    onChange={(e) => setWordLimit(e.target.value)}
                    placeholder="e.g., 200, 500, 1000"
                    className="w-full p-3 border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    Specify the expected word count for your answer
                  </p>
                </div>

                {/* Answer Text Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                    Your Answer *
                  </label>
                  <textarea
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    placeholder="Write your answer here in the selected language..."
                    className="w-full h-48 p-3 border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                  />
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    Word count: {answerText.split(/\s+/).filter(word => word.length > 0).length}
                    {wordLimit && ` / ${wordLimit} words`}
                  </p>
                </div>

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
                    disabled={isEvaluating || !answerText.trim() || !subject.trim()}
                    className="flex-1 bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    {isEvaluating ? 'Evaluating...' : 'Evaluate Answer'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Evaluation Results */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-slate-200">
                      Evaluation Results
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={handleReset}
                        className="text-sm text-gray-600 hover:text-gray-700 font-medium"
                      >
                        New Evaluation
                      </button>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-6 max-h-[60vh] overflow-y-auto space-y-6">
                    {evaluation && evaluation.score ? (
                      <div className="space-y-6">
                        {/* Score Breakdown */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-4 border-b border-gray-200 dark:border-slate-700">
                          {[
                            { label: 'Total', value: evaluation.score.total, max: 10, color: 'text-red-600' },
                            { label: 'Intro', value: evaluation.score.intro, max: 2, color: 'text-blue-600' },
                            { label: 'Body', value: evaluation.score.body, max: 6, color: 'text-purple-600' },
                            { label: 'Conclusion', value: evaluation.score.conclusion, max: 2, color: 'text-green-600' }
                          ].map((s, i) => (
                            <div key={i} className="text-center p-3 bg-white dark:bg-slate-900 rounded-lg shadow-sm">
                              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{s.label}</div>
                              <div className={`text-xl font-bold ${s.color}`}>{s.value}<span className="text-xs text-slate-300 font-normal">/{s.max}</span></div>
                            </div>
                          ))}
                        </div>

                        {/* Structural Feedback */}
                        <div className="space-y-3">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                            <span className="w-1.5 h-4 bg-red-600 rounded-full" />
                            Structural Analysis
                          </h4>
                          <div className="grid gap-3">
                            {['intro', 'body', 'conclusion'].map(part => (
                              <div key={part} className="p-3 bg-slate-100/50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                                <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">{part}</div>
                                <p className="text-xs text-slate-700 dark:text-slate-300 italic">"{evaluation.feedback[part]}"</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Value Additions */}
                        {evaluation.valueAddition && (
                          <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                            <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-400 mb-3 flex items-center gap-2">
                              ✨ Smart Value-Additions
                            </h4>
                            <div className="space-y-3">
                              <div>
                                <div className="text-[10px] font-bold text-indigo-600 uppercase mb-1">Articles & Case Laws</div>
                                <div className="flex flex-wrap gap-2">
                                  {evaluation.valueAddition.articles_cases.map((ac, i) => (
                                    <span key={i} className="px-2 py-1 bg-white dark:bg-slate-800 rounded text-[10px] font-bold text-indigo-700 dark:text-indigo-300 shadow-sm border border-indigo-100 dark:border-indigo-800">
                                      {ac}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <div className="text-[10px] font-bold text-indigo-600 uppercase mb-1">Keywords for Impact</div>
                                <div className="flex flex-wrap gap-2">
                                  {evaluation.valueAddition.keywords.map((kw, i) => (
                                    <span key={i} className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 rounded text-[10px] font-semibold text-indigo-800 dark:text-indigo-200">
                                      {kw}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Overall Comment */}
                        <div className="p-4 bg-slate-900 text-white rounded-xl">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Evaluator's Final Note</h4>
                          <p className="text-sm leading-relaxed opacity-90">{evaluation.overallComment}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <pre className="whitespace-pre-wrap text-gray-700 dark:text-slate-300 font-sans">
                          {typeof evaluation === 'string' ? evaluation : JSON.stringify(evaluation, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleReset}
                    className="flex-1 bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-slate-200 py-3 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors duration-200"
                  >
                    New Evaluation
                  </button>
                  <button
                    onClick={handleUseEvaluation}
                    className="flex-1 bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 transition-colors duration-200"
                  >
                    Add to Chat
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
