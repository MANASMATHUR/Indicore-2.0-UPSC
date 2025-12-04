'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Mic, MicOff, CheckCircle2, XCircle, MessageSquare, ArrowLeft, Sparkles, Loader2, TrendingUp, Award, AlertCircle, Volume2, VolumeX, Languages, Upload } from 'lucide-react';
import DAFUploadModal from '@/components/DAFUploadModal';
// Dynamic import for azureSpeechRecognition - loaded client-side only
import speechService from '@/lib/speechService';
import LanguageSelector from '@/components/LanguageSelector';
import { getLanguagePreference, saveLanguagePreference, translateText } from '@/lib/translationUtils';

export default function InterviewPrepPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [examType, setExamType] = useState('UPSC');
  const [questionType, setQuestionType] = useState('personality');
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [evaluations, setEvaluations] = useState({});
  const [isListening, setIsListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [personalityAnswers, setPersonalityAnswers] = useState([]);
  const [personalityResult, setPersonalityResult] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [recognitionError, setRecognitionError] = useState('');
  const audioLevelIntervalRef = useRef(null);
  const recognitionInitialized = useRef(false);
  const mediaStreamRef = useRef(null);
  const [selectedLanguage, setSelectedLanguage] = useState(getLanguagePreference());
  const [translatedQuestions, setTranslatedQuestions] = useState({});
  const [showDAFUpload, setShowDAFUpload] = useState(false);

  useEffect(() => {
    // Initialize Azure Speech Recognition
    const initRecognition = async () => {
      if (!recognitionInitialized.current) {
        await azureSpeechRecognition.initialize();
        recognitionInitialized.current = true;
      }

      // Set up callbacks (update on question change)
      azureSpeechRecognition.onTranscriptUpdate = (fullTranscript, interimTranscript) => {
        setAnswers(prev => ({
          ...prev,
          [currentQuestionIndex]: fullTranscript
        }));
      };

      azureSpeechRecognition.onError = (error) => {
        setRecognitionError(error.message);
        setIsListening(false);
      };

      azureSpeechRecognition.onListeningStateChange = (listening) => {
        setIsListening(listening);
      };
    };

    initRecognition();

    // Update audio level for visualization
    if (isListening) {
      audioLevelIntervalRef.current = setInterval(() => {
        setAudioLevel(azureSpeechRecognition.getAudioLevel());
      }, 50);
    } else {
      if (audioLevelIntervalRef.current) {
        clearInterval(audioLevelIntervalRef.current);
        audioLevelIntervalRef.current = null;
      }
      setAudioLevel(0);
    }

    return () => {
      if (audioLevelIntervalRef.current) {
        clearInterval(audioLevelIntervalRef.current);
        audioLevelIntervalRef.current = null;
      }
      // Stop recognition when component unmounts or question changes
      // Check the service's internal state rather than React state to avoid stale closures
      if (azureSpeechRecognition.isListening) {
        azureSpeechRecognition.stopRecognition();
      }
      // Clean up media stream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, [currentQuestionIndex, isListening]);

  const startListening = async () => {
    try {
      setRecognitionError('');
      // Start recognition (it will handle microphone permission internally)
      await azureSpeechRecognition.startRecognition(selectedLanguage);
      // Get the stream reference from the service for cleanup
      if (azureSpeechRecognition.mediaStream) {
        mediaStreamRef.current = azureSpeechRecognition.mediaStream;
      }
    } catch (error) {
      console.error('Error starting recognition:', error);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setRecognitionError('Microphone access denied. Please allow microphone access in your browser settings.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setRecognitionError('No microphone found. Please connect a microphone and try again.');
      } else {
        setRecognitionError(error.message || 'Failed to start voice recording. Please check your microphone permissions.');
      }
      setIsListening(false);
    }
  };

  const stopListening = () => {
    azureSpeechRecognition.stopRecognition();
    setIsListening(false);
    setAudioLevel(0);

    // Stop media stream tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const readQuestionAloud = async () => {
    if (!questions[currentQuestionIndex]?.question) return;

    try {
      setIsSpeaking(true);
      speechService.stop(); // Stop any ongoing speech
      const questionToSpeak = translatedQuestions[currentQuestionIndex] || questions[currentQuestionIndex].question;
      await speechService.speak(questionToSpeak, selectedLanguage);
    } catch (error) {
      console.error('Error reading question:', error);
    } finally {
      setIsSpeaking(false);
    }
  };

  const handleGenerateQuestions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/interview/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examType,
          questionType,
          count: 5,
          language: selectedLanguage
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setQuestions(data.questions);
      setCurrentQuestionIndex(0);
      setAnswers({});
      setEvaluations({});
      setRecognitionError('');

      // Auto-read first question
      if (data.questions && data.questions.length > 0) {
        setTimeout(() => {
          readQuestionAloud();
        }, 500);
      }
    } catch (error) {
      console.error('Error generating questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluateAnswer = async (questionIndex) => {
    const question = questions[questionIndex];
    const answer = answers[questionIndex];

    if (!answer) return;

    setLoading(true);
    try {
      const response = await fetch('/api/interview/evaluate-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.question,
          answer,
          questionType: question.questionType
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setEvaluations(prev => ({
        ...prev,
        [questionIndex]: data.evaluation
      }));
    } catch (error) {
      console.error('Error evaluating answer:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePersonalityTest = async () => {
    if (personalityAnswers.length === 0) return;

    setLoading(true);
    try {
      const response = await fetch('/api/interview/personality-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: personalityAnswers })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setPersonalityResult(data.assessment);
    } catch (error) {
      console.error('Error in personality test:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSession = async () => {
    try {
      await fetch('/api/interview/save-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examType,
          questions: questions.map((q, idx) => ({
            question: q.question,
            answer: answers[idx] || '',
            questionType: q.questionType,
            feedback: evaluations[idx] || {}
          })),
          personalityTest: {
            answers: personalityAnswers,
            traits: personalityResult?.traits || []
          }
        })
      });
    } catch (error) {
      console.error('Error saving session:', error);
    }
  };

  useEffect(() => {
    if (status !== 'loading' && !session) {
      const currentPath =
        typeof window !== 'undefined'
          ? window.location.pathname + window.location.search
          : '/interview-prep';
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
              <MessageSquare className="h-6 w-6 text-red-600" />
              <span className="text-xl font-bold text-gray-900">Interview Preparation</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowDAFUpload(true)}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload DAF
              </Button>
              <Link href="/chat">
                <Button variant="secondary" size="sm">
                  Go to Chat
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center mb-8">
          <div className="inline-flex items-center px-4 py-2 bg-red-50 rounded-full mb-6">
            <Sparkles className="h-4 w-4 text-red-600 mr-2" />
            <span className="text-sm font-medium text-red-700">AI-Powered Interview Practice</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Interview Preparation
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Practice mock interviews with voice-based questions and receive AI-powered feedback to excel in your competitive exam interviews.
          </p>
        </div>

        <div className="max-w-6xl mx-auto">

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <Card className="border-2 border-red-100 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-red-600" />
                  Mock Interview
                </CardTitle>
                <CardDescription>Practice with AI-generated interview questions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Exam Type</label>
                  <select
                    value={examType}
                    onChange={(e) => setExamType(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-800 transition-all"
                  >
                    <option value="UPSC">UPSC</option>
                    <option value="PCS">PCS</option>
                    <option value="SSC">SSC</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Question Type</label>
                  <select
                    value={questionType}
                    onChange={(e) => setQuestionType(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-800 transition-all"
                  >
                    <option value="personality">Personality Assessment</option>
                    <option value="current_affairs">Current Affairs</option>
                    <option value="situational">Situational</option>
                    <option value="technical">Technical</option>
                  </select>
                </div>

                <LanguageSelector
                  selectedLanguage={selectedLanguage}
                  onLanguageChange={(lang) => {
                    setSelectedLanguage(lang);
                    saveLanguagePreference(lang);
                    setTranslatedQuestions({});
                  }}
                  showLabel={true}
                  size="md"
                />

                <Button onClick={handleGenerateQuestions} disabled={loading} className="w-full py-3 font-semibold" variant="primary">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-5 w-5" />
                      Generate Questions
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-2 border-red-100 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-red-600" />
                  Personality Test
                </CardTitle>
                <CardDescription>Assess your personality traits and strengths</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  Answer personality assessment questions to understand your traits, strengths, and areas for development.
                </p>
                <Button onClick={handlePersonalityTest} disabled={loading || personalityAnswers.length === 0} className="w-full py-3 font-semibold" variant="primary">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Assessing...
                    </>
                  ) : (
                    <>
                      <Award className="mr-2 h-5 w-5" />
                      Assess Personality
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {loading && <LoadingSpinner />}

          {questions.length > 0 && (
            <Card className="mb-6 border-2 border-red-100 shadow-lg">
              <CardHeader>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <CardTitle>Question {currentQuestionIndex + 1} of {questions.length}</CardTitle>
                      <LanguageSelector
                        selectedLanguage={selectedLanguage}
                        onLanguageChange={(lang) => {
                          setSelectedLanguage(lang);
                          saveLanguagePreference(lang);
                          setTranslatedQuestions({});
                        }}
                        showLabel={false}
                        size="sm"
                        variant="primary"
                      />
                    </div>
                    <CardDescription>Answer the question using voice or text input</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                      disabled={currentQuestionIndex === 0}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setCurrentQuestionIndex(Math.min(questions.length - 1, currentQuestionIndex + 1))}
                      disabled={currentQuestionIndex === questions.length - 1}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-lg border border-red-200 mb-4">
                  <div className="flex items-start justify-between mb-3">
                    <Badge variant="primary" className="capitalize">{questions[currentQuestionIndex]?.questionType?.replace('_', ' ')}</Badge>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={readQuestionAloud}
                        disabled={isSpeaking}
                        className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50"
                        title="Read question aloud"
                      >
                        {isSpeaking ? (
                          <VolumeX className="w-4 h-4 text-red-600 animate-pulse" />
                        ) : (
                          <Volume2 className="w-4 h-4 text-red-600" />
                        )}
                      </button>
                      <div className={`w-3 h-3 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`}></div>
                    </div>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-semibold text-lg text-gray-900 dark:text-white leading-relaxed flex-1">
                      {translatedQuestions[currentQuestionIndex] || questions[currentQuestionIndex]?.question}
                    </h3>
                    {selectedLanguage !== 'en' && !translatedQuestions[currentQuestionIndex] && (
                      <button
                        onClick={async () => {
                          const question = questions[currentQuestionIndex]?.question;
                          if (question) {
                            try {
                              const translated = await translateText(question, selectedLanguage);
                              setTranslatedQuestions(prev => ({ ...prev, [currentQuestionIndex]: translated }));
                            } catch (error) {
                              console.error('Translation error:', error);
                            }
                          }
                        }}
                        className="flex-shrink-0 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Translate question"
                      >
                        <Languages className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Audio Visualization */}
                {isListening && (
                  <div className="mb-4 flex items-center justify-center gap-1 h-12">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="w-2 bg-gray-200 dark:bg-gray-700 rounded-full transition-all duration-100"
                        style={{
                          height: `${Math.max(20, audioLevel * (0.5 + i * 0.2))}%`,
                          minHeight: '8px',
                          maxHeight: '48px',
                          background: `linear-gradient(to top, rgb(239 68 68), rgb(220 38 38))`
                        }}
                      />
                    ))}
                  </div>
                )}

                {recognitionError && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-300">{recognitionError}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={isListening ? stopListening : startListening}
                    variant={isListening ? 'primary' : 'secondary'}
                    size="md"
                    className={`flex-1 transition-all ${isListening ? 'animate-pulse' : ''}`}
                  >
                    {isListening ? (
                      <>
                        <MicOff className="w-4 h-4 mr-2" />
                        Stop Recording
                      </>
                    ) : (
                      <>
                        <Mic className="w-4 h-4 mr-2" />
                        Voice Answer
                      </>
                    )}
                  </Button>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Your Answer
                    {isListening && (
                      <span className="ml-2 text-xs text-red-600 font-normal flex items-center gap-1">
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                        Listening...
                      </span>
                    )}
                  </label>
                  <textarea
                    value={answers[currentQuestionIndex] || ''}
                    onChange={(e) => setAnswers(prev => ({ ...prev, [currentQuestionIndex]: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-800 min-h-[150px] transition-all"
                    placeholder={isListening ? "Speak your answer... (or type to edit)" : "Type or speak your answer here..."}
                  />
                  {isListening && (
                    <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                      <Mic className="w-3 h-3" />
                      Voice input is active. Your speech will appear here in real-time.
                    </p>
                  )}
                </div>

                <Button
                  onClick={() => handleEvaluateAnswer(currentQuestionIndex)}
                  disabled={!answers[currentQuestionIndex] || loading}
                  className="w-full py-3 font-semibold"
                  variant="primary"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Evaluating...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-5 w-5" />
                      Evaluate Answer
                    </>
                  )}
                </Button>

                {evaluations[currentQuestionIndex] && (
                  <div className="mt-4 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border-2 border-blue-200">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-bold text-lg text-gray-900 dark:text-white">Evaluation Result</h4>
                      <Badge variant="primary" className="text-base px-3 py-1">
                        Score: {evaluations[currentQuestionIndex].score}/10
                      </Badge>
                    </div>
                    {evaluations[currentQuestionIndex].strengths && evaluations[currentQuestionIndex].strengths.length > 0 && (
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          <p className="font-semibold text-sm text-gray-900 dark:text-white">Strengths:</p>
                        </div>
                        <ul className="space-y-2">
                          {evaluations[currentQuestionIndex].strengths.map((s, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-green-700 dark:text-green-400">
                              <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {evaluations[currentQuestionIndex].improvements && evaluations[currentQuestionIndex].improvements.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="h-4 w-4 text-orange-600" />
                          <p className="font-semibold text-sm text-gray-900 dark:text-white">Areas for Improvement:</p>
                        </div>
                        <ul className="space-y-2">
                          {evaluations[currentQuestionIndex].improvements.map((i, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-orange-700 dark:text-orange-400">
                              <span className="text-orange-600 mt-1">•</span>
                              <span>{i}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {evaluations[currentQuestionIndex].feedback && (
                      <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded border border-gray-200">
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                          {evaluations[currentQuestionIndex].feedback}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {questions.length > 0 && (
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
              <Button onClick={saveSession} variant="primary" className="w-full py-3 text-lg font-semibold">
                <CheckCircle2 className="mr-2 h-5 w-5" />
                Save Session
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* DAF Upload Modal */}
      <DAFUploadModal
        isOpen={showDAFUpload}
        onClose={() => setShowDAFUpload(false)}
      />
    </div>
  );
}

