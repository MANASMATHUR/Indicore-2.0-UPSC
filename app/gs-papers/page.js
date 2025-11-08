'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { 
  ArrowLeft, 
  BookOpen,
  Loader2,
  ChevronRight,
  Sparkles,
  FileText,
  Layers,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  Target
} from 'lucide-react';

const EXAM_LEVELS = [
  { id: 'Mains', name: 'Mains', description: 'GS, Essay, and Optional papers', icon: '📝' },
  { id: 'Prelims', name: 'Prelims', description: 'GS and CSAT papers', icon: '✏️' }
];

export default function GSPapersPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [selectedExam, setSelectedExam] = useState('UPSC');
  const [selectedLevel, setSelectedLevel] = useState('Mains');
  const [availablePapers, setAvailablePapers] = useState([]);
  const [selectedPaper, setSelectedPaper] = useState('');
  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingPapers, setLoadingPapers] = useState(false);
  const [expandedTheme, setExpandedTheme] = useState(null);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [questionAnalysis, setQuestionAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (selectedExam && selectedLevel) {
      loadAvailablePapers();
    }
  }, [selectedExam, selectedLevel]);

  useEffect(() => {
    if (selectedPaper && selectedLevel) {
      loadThemes();
    }
  }, [selectedPaper, selectedLevel, selectedExam]);

  const loadAvailablePapers = async () => {
    setLoadingPapers(true);
    try {
      const response = await fetch(`/api/pyq/papers?exam=${selectedExam}&level=${selectedLevel}`);
      const data = await response.json();
      
      if (data.ok) {
        const papers = data.papers || [];
        setAvailablePapers(papers);
        if (papers.length > 0) {
          const currentPaperExists = papers.some(p => p.paper === selectedPaper);
          if (!currentPaperExists || !selectedPaper) {
            setSelectedPaper(papers[0].paper);
          }
        } else {
          setSelectedPaper('');
          setThemes([]);
        }
      } else {
        setAvailablePapers([]);
        setSelectedPaper('');
        setThemes([]);
      }
    } catch (error) {
      console.error('Error loading papers:', error);
      setAvailablePapers([]);
      setSelectedPaper('');
      setThemes([]);
    } finally {
      setLoadingPapers(false);
    }
  };

  const loadThemes = async () => {
    if (!selectedPaper) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/pyq/themes?exam=${selectedExam}&paper=${selectedPaper}&level=${selectedLevel}`);
      const data = await response.json();
      
      if (data.ok) {
        setThemes(data.themes || []);
      } else {
        setThemes([]);
      }
    } catch (error) {
      console.error('Error loading themes:', error);
      setThemes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuestionClick = async (question, theme) => {
    setSelectedQuestion({ ...question, theme });
    setQuestionAnalysis(null);
    
    const themeQuestions = themes.find(t => t.theme === theme)?.questions || [];
    const relatedQuestions = themeQuestions
      .filter(q => q._id !== question._id)
      .slice(0, 3);

    setAnalyzing(true);
    try {
      const response = await fetch('/api/ai/analyze-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.question,
          theme: theme,
          paper: selectedPaper,
          relatedQuestions: relatedQuestions
        })
      });

      const data = await response.json();
      if (data.ok) {
        setQuestionAnalysis(data.analysis);
      }
    } catch (error) {
      console.error('Error analyzing question:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const closeQuestionDetail = () => {
    setSelectedQuestion(null);
    setQuestionAnalysis(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2 text-gray-700 hover:text-gray-900">
              <ArrowLeft className="h-5 w-5" />
              <span className="text-sm font-medium">Home</span>
            </Link>
            <div className="flex items-center space-x-2">
              <BookOpen className="h-6 w-6 text-red-600" />
              <span className="text-xl font-bold text-gray-900">Subject-wise PYQs with AI Analysis</span>
            </div>
            <Link href="/pyq-archive">
              <Button variant="secondary" size="sm">
                PYQ Archive
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Select Exam and Level</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Exam Type</label>
              <select
                value={selectedExam}
                onChange={(e) => {
                  setSelectedExam(e.target.value);
                  setSelectedPaper('');
                  setThemes([]);
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
              >
                <option value="UPSC">UPSC</option>
                <option value="PCS">PCS</option>
                <option value="MPSC">MPSC</option>
                <option value="TNPSC">TNPSC</option>
                <option value="BPSC">BPSC</option>
                <option value="UPPSC">UPPSC</option>
                <option value="MPPSC">MPPSC</option>
                <option value="RAS">RAS</option>
                <option value="GPSC">GPSC</option>
                <option value="KPSC">KPSC</option>
                <option value="WBPSC">WBPSC</option>
                <option value="SSC">SSC</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Exam Level</label>
              <div className="grid grid-cols-2 gap-3">
                {EXAM_LEVELS.map(level => (
                  <button
                    key={level.id}
                    onClick={() => {
                      setSelectedLevel(level.id);
                      setSelectedPaper('');
                      setThemes([]);
                    }}
                    className={`p-4 rounded-lg border-2 transition-all duration-300 text-left hover-lift ${
                      selectedLevel === level.id
                        ? 'bg-gradient-to-br from-red-100 to-red-200 text-red-800 border-red-300 shadow-lg scale-105 animate-scale-bounce'
                        : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md hover:scale-105'
                    }`}
                  >
                    <div className="text-2xl mb-1">{level.icon}</div>
                    <h3 className="font-bold text-sm mb-1">{level.name}</h3>
                    <p className="text-xs opacity-80">{level.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {loadingPapers ? (
          <Card className="p-6 text-center border border-gray-200 mb-8">
            <Loader2 className="h-8 w-8 animate-spin text-red-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading available papers...</p>
          </Card>
        ) : availablePapers.length > 0 ? (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Select Paper/Subject</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {availablePapers.map((paperData, idx) => {
                const paper = paperData.paper;
                const isSelected = selectedPaper === paper;
                const getPaperColor = (paperName) => {
                  const name = (paperName || '').toUpperCase();
                  if (name.includes('GS-1') || name.includes('GS1')) return 'bg-blue-100 text-blue-800 border-blue-300';
                  if (name.includes('GS-2') || name.includes('GS2')) return 'bg-green-100 text-green-800 border-green-300';
                  if (name.includes('GS-3') || name.includes('GS3')) return 'bg-purple-100 text-purple-800 border-purple-300';
                  if (name.includes('GS-4') || name.includes('GS4')) return 'bg-orange-100 text-orange-800 border-orange-300';
                  if (name.includes('ESSAY')) return 'bg-pink-100 text-pink-800 border-pink-300';
                  if (name.includes('PRELIM') || name.includes('CSAT')) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
                  if (name.includes('PUBLIC ADMIN') || name.includes('PA')) return 'bg-indigo-100 text-indigo-800 border-indigo-300';
                  if (name.includes('SOCIOLOGY')) return 'bg-teal-100 text-teal-800 border-teal-300';
                  if (name.includes('GEOGRAPHY') && !name.includes('GS')) return 'bg-cyan-100 text-cyan-800 border-cyan-300';
                  if (name.includes('HISTORY') && !name.includes('GS')) return 'bg-amber-100 text-amber-800 border-amber-300';
                  if (name.includes('POLITICAL') || name.includes('POL SCIENCE')) return 'bg-rose-100 text-rose-800 border-rose-300';
                  return 'bg-gray-100 text-gray-800 border-gray-300';
                };

                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedPaper(paper)}
                    className={`p-4 rounded-lg border-2 transition-all duration-300 text-left hover-lift ${
                      isSelected
                        ? `${getPaperColor(paper)} shadow-lg scale-105 animate-scale-bounce`
                        : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md hover:scale-105'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-sm">{paper}</h3>
                      <span className="text-xs opacity-60">({paperData.count})</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <Card className="p-6 text-center border border-gray-200 mb-8">
            <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No papers found for {selectedExam} {selectedLevel}. Try selecting a different exam or level.</p>
          </Card>
        )}

        {loading ? (
          <Card className="p-6 text-center border border-gray-200">
            <Loader2 className="h-8 w-8 animate-spin text-red-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading themes and questions...</p>
          </Card>
        ) : selectedPaper && themes.length > 0 ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                Themes in {selectedPaper}
              </h2>
              <div className="text-sm text-gray-600">
                {themes.length} themes • {themes.reduce((sum, t) => sum + t.count, 0)} questions
              </div>
            </div>

            {themes.map((themeData, idx) => (
              <Card key={idx} className="p-6 border border-gray-200">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedTheme(expandedTheme === idx ? null : idx)}
                >
                  <div className="flex items-center gap-3">
                    <Layers className="h-5 w-5 text-red-600" />
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{themeData.theme}</h3>
                      <p className="text-sm text-gray-600">
                        {themeData.count} question{themeData.count !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <ChevronRight
                    className={`h-5 w-5 text-gray-400 transition-transform ${
                      expandedTheme === idx ? 'rotate-90' : ''
                    }`}
                  />
                </div>

                {expandedTheme === idx && (
                  <div className="mt-4 space-y-3 border-t border-gray-200 pt-4">
                    {themeData.questions.map((question, qIdx) => (
                      <div
                        key={qIdx}
                        onClick={() => handleQuestionClick(question, themeData.theme)}
                        className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-red-300 hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                                {question.year || 'N/A'}
                              </span>
                              {question.verified === true || (question.sourceLink && question.sourceLink.includes('.gov.in')) ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" title="Verified" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-yellow-600" title="Unverified" />
                              )}
                            </div>
                            <p className="text-sm text-gray-900 leading-relaxed">{question.question}</p>
                            {question.topicTags && question.topicTags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {question.topicTags.slice(0, 3).map((tag, tagIdx) => (
                                  <span
                                    key={tagIdx}
                                    className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <Sparkles className="h-5 w-5 text-red-600 flex-shrink-0" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        ) : selectedPaper ? (
          <Card className="p-6 text-center border border-gray-200">
            <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No themes found for {selectedPaper}. Try selecting a different paper or check back later.</p>
          </Card>
        ) : (
          <Card className="p-6 text-center border border-gray-200">
            <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Please select a paper/subject above to view theme-wise PYQs.</p>
          </Card>
        )}
      </div>

      {selectedQuestion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Question Analysis</h2>
              <button
                onClick={closeQuestionDetail}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                    {selectedQuestion.year || 'N/A'}
                  </span>
                  <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                    {selectedPaper}
                  </span>
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                    {selectedQuestion.theme}
                  </span>
                </div>
                <p className="text-gray-900 font-medium">{selectedQuestion.question}</p>
              </div>

              {analyzing ? (
                <div className="text-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-red-600 mx-auto mb-4" />
                  <p className="text-gray-600">Analyzing question structure and generating insights...</p>
                </div>
              ) : questionAnalysis ? (
                <div className="space-y-6">
                  {questionAnalysis.subParts && questionAnalysis.subParts.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <FileText className="h-5 w-5 text-red-600" />
                        Sub-parts Breakdown
                      </h3>
                      <div className="space-y-2">
                        {questionAnalysis.subParts.map((part, idx) => (
                          <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="font-medium text-gray-900">{part.title || `Part ${idx + 1}`}</div>
                            {part.description && (
                              <div className="text-sm text-gray-600 mt-1">{part.description}</div>
                            )}
                            {part.wordCount && (
                              <div className="text-xs text-gray-500 mt-1">Word count: {part.wordCount}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {questionAnalysis.structure && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Layers className="h-5 w-5 text-red-600" />
                        Answer Structure
                      </h3>
                      <div className="space-y-4">
                        {questionAnalysis.structure.introduction && (
                          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                            <div className="font-medium text-green-900 mb-2">Introduction</div>
                            <div className="text-sm text-green-800">
                              {typeof questionAnalysis.structure.introduction === 'string' 
                                ? questionAnalysis.structure.introduction
                                : JSON.stringify(questionAnalysis.structure.introduction)}
                            </div>
                          </div>
                        )}
                        {questionAnalysis.structure.mainBody && (
                          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="font-medium text-blue-900 mb-2">Main Body</div>
                            {Array.isArray(questionAnalysis.structure.mainBody) ? (
                              <div className="space-y-3">
                                {questionAnalysis.structure.mainBody.map((section, idx) => (
                                  <div key={idx} className="pl-4 border-l-2 border-blue-300">
                                    <div className="font-medium text-blue-800">{section.section || `Section ${idx + 1}`}</div>
                                    {section.content && (
                                      <div className="text-sm text-blue-700 mt-1">{section.content}</div>
                                    )}
                                    {section.examples && section.examples.length > 0 && (
                                      <div className="mt-2">
                                        <div className="text-xs font-medium text-blue-600">Examples:</div>
                                        <ul className="list-disc list-inside text-sm text-blue-700">
                                          {section.examples.map((ex, exIdx) => (
                                            <li key={exIdx}>{ex}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-sm text-blue-800">
                                {typeof questionAnalysis.structure.mainBody === 'string'
                                  ? questionAnalysis.structure.mainBody
                                  : JSON.stringify(questionAnalysis.structure.mainBody)}
                              </div>
                            )}
                          </div>
                        )}
                        {questionAnalysis.structure.conclusion && (
                          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                            <div className="font-medium text-purple-900 mb-2">Conclusion</div>
                            <div className="text-sm text-purple-800">
                              {typeof questionAnalysis.structure.conclusion === 'string'
                                ? questionAnalysis.structure.conclusion
                                : JSON.stringify(questionAnalysis.structure.conclusion)}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {questionAnalysis.reusableExamples && questionAnalysis.reusableExamples.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-red-600" />
                        Reusable Examples (Across Theme Questions)
                      </h3>
                      <div className="space-y-3">
                        {questionAnalysis.reusableExamples.map((example, idx) => (
                          <div key={idx} className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                            <div className="font-medium text-yellow-900 mb-1">
                              {example.example || `Example ${idx + 1}`}
                            </div>
                            {example.applicability && (
                              <div className="text-sm text-yellow-800 mb-2">{example.applicability}</div>
                            )}
                            {example.keyPoints && example.keyPoints.length > 0 && (
                              <ul className="list-disc list-inside text-sm text-yellow-700">
                                {example.keyPoints.map((point, pIdx) => (
                                  <li key={pIdx}>{point}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {questionAnalysis.reusableArguments && questionAnalysis.reusableArguments.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-red-600" />
                        Reusable Arguments (Across Theme Questions)
                      </h3>
                      <div className="space-y-3">
                        {questionAnalysis.reusableArguments.map((argument, idx) => (
                          <div key={idx} className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                            <div className="font-medium text-indigo-900 mb-1">
                              {argument.argument || `Argument ${idx + 1}`}
                            </div>
                            {argument.applicability && (
                              <div className="text-sm text-indigo-800 mb-2">{argument.applicability}</div>
                            )}
                            {argument.supportingExamples && argument.supportingExamples.length > 0 && (
                              <div className="mt-2">
                                <div className="text-xs font-medium text-indigo-600">Supporting Examples:</div>
                                <ul className="list-disc list-inside text-sm text-indigo-700">
                                  {argument.supportingExamples.map((ex, exIdx) => (
                                    <li key={exIdx}>{ex}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {questionAnalysis.keyPoints && questionAnalysis.keyPoints.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Key Points</h3>
                      <ul className="list-disc list-inside space-y-1 text-gray-700">
                        {questionAnalysis.keyPoints.map((point, idx) => (
                          <li key={idx}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {(questionAnalysis.wordCount || questionAnalysis.timeAllocation) && (
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-4 text-sm">
                        {questionAnalysis.wordCount && (
                          <div>
                            <span className="font-medium text-gray-700">Word Count: </span>
                            <span className="text-gray-600">{questionAnalysis.wordCount}</span>
                          </div>
                        )}
                        {questionAnalysis.timeAllocation && (
                          <div>
                            <span className="font-medium text-gray-700">Time Allocation: </span>
                            <span className="text-gray-600">{questionAnalysis.timeAllocation}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {questionAnalysis.rawResponse && (
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Analysis</h3>
                      <div className="text-sm text-gray-700 whitespace-pre-wrap">{questionAnalysis.rawResponse}</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-600">Click on a question to see its analysis</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

