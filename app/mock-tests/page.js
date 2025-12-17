'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Clock, CheckCircle2, XCircle, BarChart3, TrendingUp, FileText, ArrowLeft, Sparkles, Loader2, Play, Plus, Award, Languages, ChevronRight, Star } from 'lucide-react';
import LanguageSelector from '@/components/LanguageSelector';
import { getLanguagePreference, saveLanguagePreference, translateText } from '@/lib/translationUtils';
import { Skeleton, SkeletonLine } from '@/components/ui/Skeleton';
import PersonalizationIndicator from '@/components/PersonalizationIndicator';

export default function MockTestsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [view, setView] = useState('list'); // 'list', 'create', 'test', 'results'
  const [tests, setTests] = useState([]);
  const [currentTest, setCurrentTest] = useState(null);
  const [answers, setAnswers] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [testStarted, setTestStarted] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(false);
  const [createForm, setCreateForm] = useState({
    examType: 'UPSC',
    paperType: 'Prelims',
    subject: '',
    duration: 120,
    totalQuestions: 100,
    language: getLanguagePreference(),
    usePYQ: false // New option to use PYQ questions
  });
  const [selectedLanguage, setSelectedLanguage] = useState(getLanguagePreference());
  const [translatedQuestions, setTranslatedQuestions] = useState({});
  const [translating, setTranslating] = useState(false);

  // Personalization state
  const [recommendations, setRecommendations] = useState([]);

  useEffect(() => {
    if (session?.user && view === 'list') {
      loadRecommendations();
    }
  }, [session, view]);

  const loadRecommendations = async () => {
    try {
      const response = await fetch('/api/personalization/recommendations?type=mock_test');
      const data = await response.json();
      if (data.success && data.recommendations?.mock_test) {
        setRecommendations(data.recommendations.mock_test);
      }
    } catch (error) {
      console.error('Error loading recommendations:', error);
    }
  };

  const difficultyInsights = useMemo(() => {
    if (!currentTest?.questions?.length) return null;
    const counts = currentTest.questions.reduce(
      (acc, question) => {
        const level = (question?.difficulty || 'medium').toLowerCase();
        if (acc[level] !== undefined) {
          acc[level] += 1;
        } else {
          acc.other += 1;
        }
        return acc;
      },
      { easy: 0, medium: 0, hard: 0, other: 0 }
    );
    const total = currentTest.questions.length;
    const breakdown = Object.entries(counts)
      .filter(([, value]) => value > 0)
      .map(([level, count]) => ({
        level,
        count,
        percentage: Math.round((count / total) * 100)
      }));
    return {
      total,
      breakdown
    };
  }, [currentTest]);

  const topicInsights = useMemo(() => {
    if (!testResult?.topicWisePerformance || testResult.topicWisePerformance.length === 0) {
      return null;
    }
    const sorted = [...testResult.topicWisePerformance]
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
    const total = sorted.reduce((sum, topic) => sum + topic.total, 0) || 1;
    return {
      totalQuestions: total,
      breakdown: sorted.map(topic => ({
        label: topic.topic || 'General',
        total: topic.total,
        correctRate: topic.total > 0 ? Math.round((topic.correct / topic.total) * 100) : 0,
        percentage: Math.round((topic.total / total) * 100)
      }))
    };
  }, [testResult]);

  useEffect(() => {
    if (view === 'list') {
      fetchTests();
    }
  }, [view]);

  useEffect(() => {
    let interval;
    if (testStarted && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            handleSubmitTest();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [testStarted, timeRemaining]);

  const fetchTests = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/mock-tests/list');
      const data = await response.json();
      if (response.ok) {
        setTests(data.tests);
      }
    } catch (error) {
      console.error('Error fetching tests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTest = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/mock-tests/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createForm,
          language: createForm.language || selectedLanguage
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setCurrentTest(data.mockTest);
      setView('test');
      setTimeRemaining(data.mockTest.duration * 60);
      setTestStarted(false);
    } catch (error) {
      console.error('Error creating test:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartTest = async (testId) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/mock-tests/${testId}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setCurrentTest(data.test);
      setView('test');
      setTimeRemaining(data.test.duration * 60);
      setTestStarted(true);
      setAnswers({});
    } catch (error) {
      console.error('Error starting test:', error);
    } finally {
      setLoading(false);
    }
  };

  const buildAnswerPayload = () => {
    if (!currentTest?.questions?.length) {
      return [];
    }

    return currentTest.questions.map((question, index) => {
      const recordedAnswer = answers[index];
      const isSubjective = (question?.questionType || 'mcq') === 'subjective';
      const cleanedText = typeof recordedAnswer === 'string' ? recordedAnswer.trim() : '';

      return {
        questionIndex: index,
        questionType: question?.questionType || 'mcq',
        selectedAnswer: !isSubjective ? (recordedAnswer || null) : null,
        textAnswer: isSubjective ? (cleanedText || null) : null,
        timeSpent: 60
      };
    });
  };

  const handleSubmitTest = async () => {
    if (!currentTest) return;

    setLoading(true);
    try {
      const startedAt = new Date(Date.now() - (currentTest.duration * 60 - timeRemaining) * 1000);
      const formattedAnswers = buildAnswerPayload();

      const response = await fetch('/api/mock-tests/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testId: currentTest._id || currentTest.id,
          answers: formattedAnswers,
          timeSpent: (currentTest.duration * 60 - timeRemaining),
          startedAt: startedAt.toISOString()
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setTestResult(data.result);

      // Fetch comparison
      const compResponse = await fetch(`/api/mock-tests/results?testId=${currentTest._id}`);
      const compData = await compResponse.json();
      if (compResponse.ok) {
        setComparison(compData.comparison);
      }

      setView('results');
      setTestStarted(false);
    } catch (error) {
      console.error('Error submitting test:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleOptionToggle = (questionIndex, option) => {
    setAnswers(prev => {
      if (option === null || prev[questionIndex] === option) {
        const updated = { ...prev };
        delete updated[questionIndex];
        return updated;
      }
      return { ...prev, [questionIndex]: option };
    });
  };

  useEffect(() => {
    if (status !== 'loading' && !session) {
      const currentPath =
        typeof window !== 'undefined'
          ? window.location.pathname + window.location.search
          : '/mock-tests';
      router.replace(`/login?redirect=${encodeURIComponent(currentPath)}`);
    }
  }, [status, session, router]);

  if (status === 'loading' || !session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center px-4">
        <LoadingSpinner message="Redirecting you to login..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 transition-colors">
              <ArrowLeft className="h-5 w-5" />
              <span className="text-sm font-medium">Home</span>
            </Link>
            <div className="flex items-center space-x-2">
              <FileText className="h-6 w-6 text-red-600" />
              <span className="text-xl font-bold text-gray-900">Mock Test Series</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant={view === 'list' ? 'primary' : 'secondary'}
                onClick={() => setView('list')}
                size="sm"
              >
                Tests
              </Button>
              <Button
                variant={view === 'create' ? 'primary' : 'secondary'}
                onClick={() => setView('create')}
                size="sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                Create
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center mb-8">
          <div className="inline-flex items-center px-4 py-2 bg-red-50 rounded-full mb-6">
            <Sparkles className="h-4 w-4 text-red-600 mr-2" />
            <span className="text-sm font-medium text-red-700">AI-Generated Mock Tests</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Mock Test Series
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Practice with full-length mock tests, track your performance, and compare with previous attempts.
          </p>
        </div>

        <div className="max-w-6xl mx-auto">

          {/* Recommended Tests Section */}
          {view === 'list' && recommendations.length > 0 && (
            <div className="mb-10">
              <div className="flex items-center gap-3 mb-4 pl-1">
                <PersonalizationIndicator
                  visible={true}
                  type="Mock Tests"
                  reason="Tailored to your weak areas"
                  size="md"
                />
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recommendations.map((rec, idx) => (
                  <Card key={`rec-${idx}`} className="border-2 border-purple-100 bg-gradient-to-br from-purple-50 to-white hover:border-purple-300 transition-all cursor-pointer group">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start mb-2">
                        <CardTitle className="text-lg text-purple-900 group-hover:text-purple-700 transition-colors flex items-center gap-2">
                          <Star className="h-4 w-4 fill-purple-600 text-purple-600" />
                          {rec.title}
                        </CardTitle>
                        {rec.priority > 80 && (
                          <Badge className="bg-purple-600 hover:bg-purple-700">Recommended</Badge>
                        )}
                      </div>
                      <CardDescription className="text-purple-700/80 text-xs">
                        {rec.reason ? rec.reason.replace(/_/g, ' ') : 'Personalized for you'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 mb-4">
                        {rec.subject && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <FileText className="w-4 h-4 text-purple-500" />
                            <span>Focus: {rec.subject}</span>
                          </div>
                        )}
                        {rec.difficulty && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Sparkles className="w-4 h-4 text-purple-500" />
                            <span className="capitalize">Difficulty: {rec.difficulty}</span>
                          </div>
                        )}
                      </div>
                      <Button
                        variant="primary"
                        className="w-full bg-purple-600 hover:bg-purple-700 border-purple-600 hover:border-purple-700"
                        size="sm"
                        onClick={() => {
                          // Auto-fill create form with recommendation
                          setCreateForm(prev => ({
                            ...prev,
                            subject: rec.subject || prev.subject,
                            paperType: rec.metadata?.paperType || prev.paperType,
                            examType: rec.metadata?.examType || prev.examType
                          }));
                          setView('create');
                        }}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create This Test
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {view === 'list' && (
            <div>
              {loading ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[0, 1, 2].map((idx) => (
                    <Card key={`test-skeleton-${idx}`} className="border-2 border-red-50 p-6 space-y-4">
                      <SkeletonLine className="h-4 w-3/4" />
                      <div className="space-y-2">
                        <SkeletonLine className="h-3 w-1/2" />
                        <SkeletonLine className="h-3 w-1/3" />
                      </div>
                      <div className="space-y-2">
                        <SkeletonLine className="h-3 w-full" />
                        <SkeletonLine className="h-3 w-4/5" />
                        <SkeletonLine className="h-3 w-2/3" />
                      </div>
                      <Skeleton className="h-10 w-full" />
                    </Card>
                  ))}
                </div>
              ) : tests.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {tests.map((test) => (
                    <Card key={test._id} className="border-2 border-red-100 hover:border-red-300 hover:shadow-lg transition-all cursor-pointer group" onClick={() => handleStartTest(test._id)}>
                      <CardHeader>
                        <div className="flex justify-between items-start mb-2">
                          <CardTitle className="text-lg group-hover:text-red-600 transition-colors">{test.title}</CardTitle>
                          <Badge variant="primary">{test.examType}</Badge>
                        </div>
                        {test.description && (
                          <CardDescription className="text-xs">{test.description}</CardDescription>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3 mb-4">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <FileText className="w-4 h-4 text-red-600" />
                            <span>{test.totalQuestions} Questions</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Clock className="w-4 h-4 text-red-600" />
                            <span>{test.duration} minutes</span>
                          </div>
                          {test.subject && (
                            <Badge variant="secondary" className="text-xs">{test.subject}</Badge>
                          )}
                          {test.paperType && (
                            <Badge variant="secondary" className="text-xs ml-2">{test.paperType}</Badge>
                          )}
                        </div>
                        <Button variant="primary" className="w-full" size="sm">
                          <Play className="w-4 h-4 mr-2" />
                          Start Test
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="border-2 border-red-100 p-12 text-center">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">No tests available yet.</p>
                  <Button variant="primary" onClick={() => setView('create')}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Test
                  </Button>
                </Card>
              )}
            </div>
          )}

          {view === 'create' && (
            <Card className="border-2 border-red-100 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5 text-red-600" />
                  Create Mock Test
                </CardTitle>
                <CardDescription>Generate a new mock test with AI-powered questions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Exam Type</label>
                  <select
                    value={createForm.examType}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, examType: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-800 transition-all"
                  >
                    <option value="UPSC">UPSC</option>
                    <option value="PCS">PCS</option>
                    <option value="SSC">SSC</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Paper Type</label>
                  <select
                    value={createForm.paperType}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, paperType: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-800 transition-all"
                  >
                    <option value="Prelims">Prelims</option>
                    <option value="Mains">Mains</option>
                    <option value="General">General</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Subject (Optional)</label>
                  <input
                    type="text"
                    value={createForm.subject}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, subject: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-800 transition-all"
                    placeholder="e.g., General Studies, Mathematics"
                  />
                </div>

                <LanguageSelector
                  selectedLanguage={createForm.language}
                  onLanguageChange={(lang) => {
                    setCreateForm(prev => ({ ...prev, language: lang }));
                    setSelectedLanguage(lang);
                    saveLanguagePreference(lang);
                  }}
                  showLabel={true}
                  size="md"
                />

                <div className="flex items-center space-x-3 p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 rounded-lg">
                  <input
                    type="checkbox"
                    id="usePYQ"
                    checked={createForm.usePYQ}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, usePYQ: e.target.checked }))}
                    className="w-5 h-5 text-red-600 border-gray-300 rounded focus:ring-red-500"
                  />
                  <label htmlFor="usePYQ" className="text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer">
                    Use Previous Year Questions (PYQ) from Archive
                  </label>
                </div>
                <p className="text-xs text-gray-500 -mt-2 mb-2">
                  {createForm.usePYQ
                    ? 'Mock test will be created using questions from PYQ archive. Missing questions will be AI-generated.'
                    : 'Enable to use real previous year questions from the archive instead of AI-generated questions.'}
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Duration (minutes)</label>
                    <input
                      type="number"
                      value={createForm.duration}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-800 transition-all"
                      min="30"
                      max="300"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Total Questions</label>
                    <input
                      type="number"
                      value={createForm.totalQuestions}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, totalQuestions: parseInt(e.target.value) }))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-800 transition-all"
                      min="10"
                      max="200"
                    />
                  </div>
                </div>

                <Button onClick={handleCreateTest} disabled={loading} className="w-full py-3 text-lg font-semibold" variant="primary">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Creating Test...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-5 w-5" />
                      Create Test
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {view === 'test' && currentTest && (
            <div>
              <Card className="mb-6 border-2 border-red-100 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{currentTest.title}</h2>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>Question {Object.keys(answers).length + 1} of {currentTest.totalQuestions}</span>
                        <Badge variant="secondary">{currentTest.examType}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <LanguageSelector
                        selectedLanguage={selectedLanguage}
                        onLanguageChange={(lang) => {
                          setSelectedLanguage(lang);
                          saveLanguagePreference(lang);
                          setTranslatedQuestions({}); // Clear translations when language changes
                        }}
                        showLabel={false}
                        size="sm"
                        variant="primary"
                      />
                      <div className={`text-3xl font-mono font-bold ${timeRemaining < 300 ? 'text-red-600 animate-pulse' : 'text-gray-900'}`}>
                        {formatTime(timeRemaining)}
                      </div>
                      <Button onClick={handleSubmitTest} variant="primary" size="lg">
                        Submit Test
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-4">
                  {currentTest.questions.map((question, index) => (
                    <Card key={index} className={`border-2 transition-all hover:shadow-lg ${answers[index] ? 'border-green-300 bg-green-50/50 dark:bg-green-900/10' : 'border-red-100'
                      }`}>
                      <CardContent className="p-6">
                        <div className="mb-4">
                          <div className="flex flex-wrap gap-2 mb-3">
                            <Badge variant="secondary" className="text-xs">
                              Q{index + 1}
                            </Badge>
                            {question.subject && (
                              <Badge variant="secondary" className="text-xs">{question.subject}</Badge>
                            )}
                            {question.difficulty && (
                              <Badge variant={question.difficulty === 'hard' ? 'primary' : 'secondary'} className="text-xs capitalize">
                                {question.difficulty}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <h3 className="font-semibold text-lg text-gray-900 dark:text-white leading-relaxed flex-1">
                              {translatedQuestions[index] || question.question}
                            </h3>
                            {selectedLanguage !== 'en' && !translatedQuestions[index] && (
                              <button
                                onClick={async () => {
                                  setTranslating(true);
                                  try {
                                    const translated = await translateText(question.question, selectedLanguage);
                                    setTranslatedQuestions(prev => ({ ...prev, [index]: translated }));
                                  } catch (error) {
                                    console.error('Translation error:', error);
                                  } finally {
                                    setTranslating(false);
                                  }
                                }}
                                className="flex-shrink-0 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Translate question"
                                disabled={translating}
                              >
                                <Languages className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {question.questionType === 'subjective' ? (
                          <div className="space-y-3">
                            {question.wordLimit && (
                              <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                                <span>Word Limit: <strong>{question.wordLimit} words</strong></span>
                                <span>Marks: <strong>{question.marks || 10}</strong></span>
                              </div>
                            )}
                            <textarea
                              name={`question-${index}`}
                              value={answers[index] || ''}
                              onChange={(e) => {
                                const text = e.target.value;
                                setAnswers(prev => ({ ...prev, [index]: text }));
                              }}
                              placeholder="Type your answer here..."
                              className="w-full min-h-[200px] px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white resize-y transition-all"
                              rows={question.wordLimit === 250 ? 12 : 8}
                            />
                            <div className="text-xs text-gray-500 text-right">
                              {answers[index] ? answers[index].split(/\s+/).filter(word => word.length > 0).length : 0} words
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {question.options && question.options.map((option, optIndex) => {
                              const isSelected = answers[index] === option;
                              return (
                                <label
                                  key={optIndex}
                                  className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${isSelected
                                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20 shadow-md'
                                    : 'border-gray-200 hover:border-red-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                                    }`}
                                >
                                  <input
                                    type="radio"
                                    name={`question-${index}`}
                                    value={option}
                                    checked={isSelected}
                                    onChange={() => handleOptionToggle(index, option)}
                                    onClick={(event) => {
                                      if (isSelected) {
                                        event.preventDefault();
                                        handleOptionToggle(index, null);
                                      }
                                    }}
                                    className="mr-3 w-5 h-5 text-red-600"
                                  />
                                  <span className="text-gray-700 dark:text-gray-300 flex-1">{option}</span>
                                  {isSelected && (
                                    <CheckCircle2 className="h-5 w-5 text-red-600" />
                                  )}
                                </label>
                              )
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div>
                  <Card className="border-2 border-red-100 sticky top-24 shadow-lg">
                    <CardHeader>
                      <CardTitle className="text-lg">Progress</CardTitle>
                      <CardDescription>
                        {Object.keys(answers).length} of {currentTest.totalQuestions} answered
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-5 gap-2 max-h-[400px] overflow-y-auto">
                        {Array.from({ length: currentTest.totalQuestions }).map((_, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              const element = document.querySelector(`[name="question-${i}"]`);
                              if (element) {
                                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }
                            }}
                            className={`w-10 h-10 rounded-lg text-sm font-semibold transition-all ${answers[i]
                              ? 'bg-green-500 text-white hover:bg-green-600 shadow-md'
                              : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                              }`}
                          >
                            {i + 1}
                          </button>
                        ))}
                      </div>
                      <div className="mt-4 pt-4 border-t">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Answered:</span>
                          <span className="font-semibold text-green-600">{Object.keys(answers).length}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm mt-2">
                          <span className="text-gray-600">Remaining:</span>
                          <span className="font-semibold text-orange-600">{currentTest.totalQuestions - Object.keys(answers).length}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {view === 'results' && testResult && (
            <div className="space-y-6 pb-8">
              <Card className="border-2 border-red-100 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-6 w-6 text-red-600" />
                    Test Results
                  </CardTitle>
                  <CardDescription>Detailed performance analysis</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border-2 border-green-200">
                      <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-3" />
                      <div className="text-3xl font-bold text-gray-900 dark:text-white">{testResult.correctAnswers}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Correct</div>
                    </div>
                    <div className="text-center p-6 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 rounded-lg border-2 border-red-200">
                      <XCircle className="w-10 h-10 text-red-600 mx-auto mb-3" />
                      <div className="text-3xl font-bold text-gray-900 dark:text-white">{testResult.wrongAnswers}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Wrong</div>
                    </div>
                    <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border-2 border-blue-200">
                      <BarChart3 className="w-10 h-10 text-blue-600 mx-auto mb-3" />
                      <div className="text-3xl font-bold text-gray-900 dark:text-white">{testResult.marksObtained.toFixed(2)}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Marks</div>
                    </div>
                    <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border-2 border-purple-200">
                      <TrendingUp className="w-10 h-10 text-purple-600 mx-auto mb-3" />
                      <div className="text-3xl font-bold text-gray-900 dark:text-white">{testResult.percentage.toFixed(1)}%</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Percentage</div>
                    </div>
                  </div>

                  {(difficultyInsights || topicInsights) && (
                    <div className="grid md:grid-cols-2 gap-4 mb-6">
                      {difficultyInsights && (
                        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 shadow-sm">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Difficulty mix</h3>
                            <span className="text-xs uppercase text-gray-500">Total {difficultyInsights.total}</span>
                          </div>
                          <div className="space-y-3">
                            {difficultyInsights.breakdown.map((item) => (
                              <div key={item.level}>
                                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300 capitalize mb-1">
                                  <span>{item.level}</span>
                                  <span>{item.percentage}% · {item.count}</span>
                                </div>
                                <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                                  <div
                                    className={`h-2 rounded-full ${item.level === 'easy'
                                      ? 'bg-emerald-500'
                                      : item.level === 'medium'
                                        ? 'bg-amber-500'
                                        : 'bg-rose-500'
                                      }`}
                                    style={{ width: `${item.percentage}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {topicInsights && (
                        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 shadow-sm">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Top topic coverage</h3>
                            <span className="text-xs uppercase text-gray-500">Last test</span>
                          </div>
                          <div className="space-y-3">
                            {topicInsights.breakdown.map((topic) => (
                              <div key={topic.label}>
                                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300 mb-1">
                                  <span className="font-semibold text-gray-800 dark:text-gray-100">{topic.label}</span>
                                  <span>{topic.correctRate}% accuracy</span>
                                </div>
                                <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                                  <div
                                    className="h-2 rounded-full bg-blue-500"
                                    style={{ width: `${topic.percentage}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {testResult.subjectWisePerformance && testResult.subjectWisePerformance.length > 0 && (
                    <div className="mb-4">
                      <h3 className="font-semibold text-lg mb-4 text-gray-900 dark:text-white">Subject-wise Performance</h3>
                      <div className="space-y-3">
                        {testResult.subjectWisePerformance.map((subj, idx) => {
                          const percentage = (subj.correct / subj.total) * 100;
                          return (
                            <div key={idx} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200">
                              <div className="flex justify-between items-center mb-2">
                                <span className="font-semibold text-gray-900 dark:text-white">{subj.subject}</span>
                                <Badge variant={percentage >= 70 ? 'primary' : percentage >= 50 ? 'secondary' : 'secondary'} className="text-xs">
                                  {percentage.toFixed(1)}%
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                <span>{subj.correct} correct</span>
                                <span>•</span>
                                <span>{subj.wrong} wrong</span>
                                <span>•</span>
                                <span>{subj.total} total</span>
                              </div>
                              <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full transition-all ${percentage >= 70 ? 'bg-green-500' : percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                    }`}
                                  style={{ width: `${percentage}%` }}
                                ></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {comparison && (
                <Card className="border-2 border-red-100 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-6 h-6 text-red-600" />
                      Comparison with Previous Attempts
                    </CardTitle>
                    <CardDescription>See how you've improved over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border border-green-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-gray-700 dark:text-gray-300">Marks Improvement</span>
                            <span className={`text-2xl font-bold ${comparison.improvement.marks >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {comparison.improvement.marks >= 0 ? '+' : ''}{comparison.improvement.marks.toFixed(2)}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Previous: {comparison.previous[0]?.marks?.toFixed(2) || 'N/A'}
                          </div>
                        </div>
                        <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-gray-700 dark:text-gray-300">Percentage Improvement</span>
                            <span className={`text-2xl font-bold ${comparison.improvement.percentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {comparison.improvement.percentage >= 0 ? '+' : ''}{comparison.improvement.percentage.toFixed(1)}%
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Previous: {comparison.previous[0]?.percentage?.toFixed(1) || 'N/A'}%
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Question-wise review with correct answers */}
              {currentTest && testResult.answers && (
                <Card className="border-2 border-red-100 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-red-600" />
                      Question-wise Review
                    </CardTitle>
                    <CardDescription>
                      Your answer vs correct answer for each question. Use this to identify exact gaps.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {currentTest.questions.map((question, index) => {
                      const answerDetail = testResult.answers[index];
                      const isSubjective = question.questionType === 'subjective';
                      const userAnswer = answerDetail?.selectedAnswer || answerDetail?.textAnswer || null;
                      const correctAnswer = isSubjective ? null : question.correctAnswer;
                      const isCorrect = isSubjective ? null : answerDetail?.isCorrect;

                      return (
                        <div
                          key={index}
                          className={`p-4 rounded-lg border-2 transition-all ${isSubjective
                            ? 'border-blue-100 bg-blue-50/40'
                            : isCorrect === true
                              ? 'border-green-200 bg-green-50/40'
                              : isCorrect === false
                                ? 'border-red-200 bg-red-50/40'
                                : 'border-gray-200 bg-white'
                            }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">Q{index + 1}</Badge>
                              {question.subject && (
                                <Badge variant="secondary" className="text-xs">
                                  {question.subject}
                                </Badge>
                              )}
                            </div>
                            {!isSubjective && (
                              <div className="flex items-center gap-2 text-sm">
                                {isCorrect === true && (
                                  <span className="flex items-center text-green-600 font-semibold">
                                    <CheckCircle2 className="w-4 h-4 mr-1" />
                                    Correct
                                  </span>
                                )}
                                {isCorrect === false && (
                                  <span className="flex items-center text-red-600 font-semibold">
                                    <XCircle className="w-4 h-4 mr-1" />
                                    Wrong
                                  </span>
                                )}
                                {(isCorrect === null || isCorrect === undefined) && (
                                  <span className="text-gray-500 text-xs">Not auto-evaluated</span>
                                )}
                              </div>
                            )}
                          </div>

                          <p className="font-semibold text-gray-900 mb-2">
                            {question.question}
                          </p>

                          <div className="space-y-1 text-sm">
                            <p className="text-gray-700">
                              <span className="font-semibold">Your answer:</span>{' '}
                              {userAnswer ? (
                                <span
                                  className={
                                    isSubjective
                                      ? 'whitespace-pre-wrap'
                                      : isCorrect
                                        ? 'text-green-700 font-medium'
                                        : 'text-red-700 font-medium'
                                  }
                                >
                                  {userAnswer}
                                </span>
                              ) : (
                                <span className="text-gray-500 italic">Not attempted</span>
                              )}
                            </p>
                            {!isSubjective && (
                              <p className="text-gray-700">
                                <span className="font-semibold">Correct answer:</span>{' '}
                                <span className="text-green-700 font-medium">
                                  {correctAnswer || 'Not available'}
                                </span>
                              </p>
                            )}
                            {question.explanation && (
                              <p className="text-gray-600 text-xs mt-1">
                                <span className="font-semibold">Explanation:</span>{' '}
                                {question.explanation}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              <div className="flex gap-4">
                <Button onClick={() => setView('list')} variant="primary" className="flex-1 py-3 text-lg font-semibold">
                  <FileText className="mr-2 h-5 w-5" />
                  Back to Tests
                </Button>
                <Button onClick={() => {
                  if (testResult.testId) {
                    handleStartTest(testResult.testId);
                  } else {
                    setView('list');
                  }
                }} variant="secondary" className="flex-1 py-3 text-lg font-semibold">
                  <Play className="mr-2 h-5 w-5" />
                  Retake Test
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

