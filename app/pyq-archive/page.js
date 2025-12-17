'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import {
  Database,
  ArrowLeft,
  Search,
  Filter,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  BookOpen,
  Layers,
  Sparkles,
  ChevronRight,
  FileText,
  GraduationCap,
  Target,
  X,
  Sparkles as SparklesIcon,
  MessageSquare
} from 'lucide-react';
import PersonalizationIndicator from '@/components/PersonalizationIndicator';

const examTypes = ['UPSC', 'PCS', 'MPSC', 'TNPSC', 'BPSC', 'UPPSC', 'MPPSC', 'RAS', 'GPSC', 'KPSC', 'WBPSC', 'SSC'];
const examLevels = ['Prelims', 'Mains', 'Interview'];

const subjects = [
  { value: 'polity', label: 'Polity & Governance', color: 'bg-purple-100 text-purple-700' },
  { value: 'history', label: 'History', color: 'bg-green-100 text-green-700' },
  { value: 'geography', label: 'Geography', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'economics', label: 'Economics', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'science', label: 'Science & Technology', color: 'bg-pink-100 text-pink-700' },
  { value: 'environment', label: 'Environment & Ecology', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'current_affairs', label: 'Current Affairs', color: 'bg-orange-100 text-orange-700' },
  { value: 'ethics', label: 'Ethics & Philosophy', color: 'bg-rose-100 text-rose-700' }
];

const EXAM_LEVELS = [
  { id: 'Mains', name: 'Mains', description: 'GS, Essay, and Optional papers', icon: '📝' },
  { id: 'Prelims', name: 'Prelims', description: 'GS and CSAT papers', icon: '✏️' }
];

function PYQArchiveContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  // View mode: 'archive' or 'subject-wise'
  // Check URL query parameter for initial view mode
  const [viewMode, setViewMode] = useState(() => {
    const view = searchParams?.get('view');
    return view === 'subject-wise' ? 'subject-wise' : 'archive';
  });

  // Archive view state
  const [selectedExam, setSelectedExam] = useState('UPSC');
  const [selectedLevel, setSelectedLevel] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [fromYear, setFromYear] = useState('');
  const [toYear, setToYear] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [stats, setStats] = useState(null);
  const [archiveViewMode, setArchiveViewMode] = useState('subject'); // 'subject' or 'year'

  // Subject-wise view state
  const [selectedExamSW, setSelectedExamSW] = useState('UPSC');
  const [selectedLevelSW, setSelectedLevelSW] = useState('Mains');
  const [availablePapers, setAvailablePapers] = useState([]);
  const [selectedPaper, setSelectedPaper] = useState('');
  const [themes, setThemes] = useState([]);
  const [loadingPapers, setLoadingPapers] = useState(false);
  const [expandedTheme, setExpandedTheme] = useState(null);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [questionAnalysis, setQuestionAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [mostProbableQuestions, setMostProbableQuestions] = useState([]);
  const [loadingProbable, setLoadingProbable] = useState(false);
  const [showMostProbable, setShowMostProbable] = useState(false);

  // Personalization state
  const [recommendations, setRecommendations] = useState([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);

  // Generate year options
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1990 + 1 }, (_, i) => currentYear - i);

  // Archive view effects
  useEffect(() => {
    if (viewMode === 'archive') {
      loadStats();
    }
  }, [selectedExam, viewMode]);

  useEffect(() => {
    if (viewMode === 'archive' && (selectedExam || selectedLevel || selectedSubject || fromYear || toYear || searchQuery)) {
      handleSearch();
    }
  }, [selectedExam, selectedLevel, selectedSubject, viewMode]);

  // Subject-wise view effects
  useEffect(() => {
    if (viewMode === 'subject-wise' && selectedExamSW && selectedLevelSW) {
      loadAvailablePapers();
    }
  }, [selectedExamSW, selectedLevelSW, viewMode]);

  useEffect(() => {
    if (viewMode === 'subject-wise' && selectedPaper && selectedLevelSW) {
      loadThemes();
    }
  }, [selectedPaper, selectedLevelSW, selectedExamSW, viewMode]);

  const loadStats = async () => {
    try {
      const response = await fetch(`/api/pyq/search?exam=${selectedExam}&limit=1`);
      if (response.ok) {
        const data = await response.json();
        const yearSet = new Set();
        data.items?.forEach(item => {
          if (item.year) yearSet.add(item.year);
        });
        setStats({
          totalQuestions: data.count,
          totalYears: yearSet.size,
          years: Array.from(yearSet).sort((a, b) => b - a)
        });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadRecommendations = async () => {
    if (!session?.user) return;

    setLoadingRecommendations(true);
    try {
      const response = await fetch('/api/personalization/recommendations?type=pyq');
      const data = await response.json();

      if (data.success && data.recommendations?.pyq) {
        setRecommendations(data.recommendations.pyq);
      }
    } catch (error) {
      console.error('Error loading recommendations:', error);
    } finally {
      setLoadingRecommendations(false);
    }
  };

  useEffect(() => {
    if (session?.user && viewMode === 'archive') {
      loadRecommendations();
    }
  }, [session, viewMode]);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        exam: selectedExam || 'UPSC',
        limit: '500'
      });
      if (selectedLevel && selectedLevel.trim()) {
        params.append('level', selectedLevel.trim());
      }
      if (fromYear && parseInt(fromYear) >= 1990) {
        params.append('fromYear', fromYear);
      }
      if (toYear && parseInt(toYear) <= new Date().getFullYear() + 1) {
        params.append('toYear', toYear);
      }
      if (selectedSubject && selectedSubject.trim()) {
        params.append('theme', selectedSubject.trim());
      } else if (searchQuery && searchQuery.trim()) {
        params.append('theme', searchQuery.trim());
      }

      const response = await fetch(`/api/pyq/search?${params.toString()}`);
      const data = await response.json();

      if (data.ok) {
        // Filter out any invalid items on frontend as well
        const validResults = (data.items || []).filter(item =>
          item &&
          item.question &&
          item.question.trim().length >= 10 &&
          item.year &&
          item.year >= 1990 &&
          item.year <= new Date().getFullYear() + 1
        );
        setResults(validResults);
      } else {
        setResults([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleYearFilter = (year) => {
    setFromYear(year);
    setToYear(year);
    handleSearch();
  };

  const handleSubjectFilter = (subject) => {
    setSelectedSubject(subject);
    setSearchQuery('');
  };

  const loadAvailablePapers = async () => {
    if (!selectedExamSW) return;

    setLoadingPapers(true);
    try {
      const params = new URLSearchParams({
        exam: selectedExamSW || 'UPSC'
      });
      if (selectedLevelSW && selectedLevelSW.trim()) {
        params.append('level', selectedLevelSW.trim());
      }

      const response = await fetch(`/api/pyq/papers?${params.toString()}`);
      const data = await response.json();

      if (data.ok) {
        const papers = (data.papers || []).filter(p => p && p.paper && p.paper.trim() && p.count > 0);
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
    if (!selectedPaper || !selectedExamSW || !selectedLevelSW) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        exam: selectedExamSW || 'UPSC',
        level: selectedLevelSW || 'Mains'
      });
      if (selectedPaper && selectedPaper.trim()) {
        params.append('paper', selectedPaper.trim());
      }

      const response = await fetch(`/api/pyq/themes?${params.toString()}`);
      const data = await response.json();

      if (data.ok) {
        const validThemes = (data.themes || []).filter(theme =>
          theme &&
          theme.theme &&
          theme.questions &&
          Array.isArray(theme.questions) &&
          theme.questions.length > 0
        );
        setThemes(validThemes);
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

  const handleSolve = (e, questionText) => {
    e.stopPropagation();
    router.push(`/chat?question=${encodeURIComponent(questionText)}`);
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
      // Get comprehensive analysis using new service
      const analysisResponse = await fetch('/api/pyq/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: question._id
        })
      });

      const analysisData = await analysisResponse.json();

      // Also get answer structure analysis
      const structureResponse = await fetch('/api/ai/analyze-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.question,
          theme: theme,
          paper: selectedPaper,
          relatedQuestions: relatedQuestions
        })
      });

      const structureData = await structureResponse.json();

      // Combine both analyses
      setQuestionAnalysis({
        ...analysisData,
        answerStructure: structureData.ok ? structureData.analysis : null
      });
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

  // Group by subject and year
  const groupBySubjectAndYear = () => {
    const grouped = {};
    results.forEach(item => {
      let subject = 'General';
      if (item.topicTags && item.topicTags.length > 0) {
        const tags = item.topicTags.join(' ').toLowerCase();
        if (tags.includes('polity') || tags.includes('constitution') || tags.includes('governance')) subject = 'polity';
        else if (tags.includes('history') || tags.includes('ancient') || tags.includes('medieval') || tags.includes('modern')) subject = 'history';
        else if (tags.includes('geography') || tags.includes('geographical') || tags.includes('climate')) subject = 'geography';
        else if (tags.includes('economy') || tags.includes('economic') || tags.includes('finance') || tags.includes('banking')) subject = 'economics';
        else if (tags.includes('science') || tags.includes('technology') || tags.includes('physics') || tags.includes('chemistry') || tags.includes('biology')) subject = 'science';
        else if (tags.includes('environment') || tags.includes('ecology') || tags.includes('biodiversity')) subject = 'environment';
        else if (tags.includes('current') || tags.includes('affairs') || tags.includes('news')) subject = 'current_affairs';
        else subject = item.topicTags[0] || 'General';
      } else if (item.paper) {
        const paper = item.paper.toLowerCase();
        if (paper.includes('gs-2') || paper.includes('gs-3')) subject = 'polity';
        else if (paper.includes('gs-1')) subject = 'history';
        else if (paper.includes('gs-3')) subject = 'economics';
      }

      if (!grouped[subject]) grouped[subject] = {};
      const year = item.year || 'Unknown';
      if (!grouped[subject][year]) grouped[subject][year] = [];
      grouped[subject][year].push(item);
    });
    return grouped;
  };

  // Group by year and subject
  const groupByYearAndSubject = () => {
    const grouped = {};
    results.forEach(item => {
      const year = item.year || 'Unknown';
      if (!grouped[year]) grouped[year] = {};

      let subject = 'General';
      if (item.topicTags && item.topicTags.length > 0) {
        const tags = item.topicTags.join(' ').toLowerCase();
        if (tags.includes('polity') || tags.includes('constitution')) subject = 'polity';
        else if (tags.includes('history')) subject = 'history';
        else if (tags.includes('geography')) subject = 'geography';
        else if (tags.includes('economy') || tags.includes('economic')) subject = 'economics';
        else if (tags.includes('science') || tags.includes('technology')) subject = 'science';
        else if (tags.includes('environment')) subject = 'environment';
        else subject = item.topicTags[0] || 'General';
      }

      if (!grouped[year][subject]) grouped[year][subject] = [];
      grouped[year][subject].push(item);
    });
    return grouped;
  };

  const getSubjectLabel = (subject) => {
    return subjects.find(s => s.value === subject)?.label || subject;
  };

  const getSubjectColor = (subject) => {
    return subjects.find(s => s.value === subject)?.color || 'bg-gray-100 text-gray-700';
  };

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

  const groupedData = archiveViewMode === 'subject' ? groupBySubjectAndYear() : groupByYearAndSubject();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2 text-gray-700 hover:text-gray-900">
              <ArrowLeft className="h-5 w-5" />
              <span className="text-sm font-medium">Home</span>
            </Link>
            <div className="flex items-center space-x-2">
              <Database className="h-6 w-6 text-red-600" />
              <span className="text-xl font-bold text-gray-900">Previous Year Questions</span>
            </div>
            <Link href="/chat">
              <Button variant="secondary" size="sm">
                Chat Interface
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* View Mode Tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('archive')}
              className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${viewMode === 'archive'
                ? 'border-red-600 text-red-600 bg-red-50'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
            >
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Archive View
              </div>
            </button>
            <button
              onClick={() => setViewMode('subject-wise')}
              className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${viewMode === 'subject-wise'
                ? 'border-red-600 text-red-600 bg-red-50'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
            >
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Subject-wise PYQs
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Archive View */}
      {viewMode === 'archive' && (
        <>
          {/* Hero Section */}
          <section className="py-10 px-4 sm:px-6 lg:px-8 bg-white border-b border-gray-200">
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-8">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
                  Previous Year Questions Archive
                </h1>
                <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                  Comprehensive database of verified previous year questions organized by subject and year for systematic preparation.
                </p>

                {/* Personalized Recommendations */}
                {recommendations.length > 0 && (
                  <div className="mt-8 mb-4 max-w-4xl mx-auto">
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <PersonalizationIndicator
                        visible={true}
                        type="PYQ"
                        reason="Based on your performance analysis"
                        size="md"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {recommendations.map((rec, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setSearchQuery(rec.topic);
                            handleSearch();
                          }}
                          className="text-left p-3 rounded-lg border border-red-100 bg-red-50/50 hover:bg-red-50 hover:border-red-300 transition-all group"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-red-900 line-clamp-1">{rec.topic}</span>
                            <ChevronRight className="h-4 w-4 text-red-400 group-hover:text-red-600" />
                          </div>
                          {rec.reason && (
                            <p className="text-xs text-red-600/80 mt-1 capitalize">
                              {rec.reason.replace(/_/g, ' ')}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Stats */}
              {stats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <Card className="p-4 text-center border border-gray-200">
                    <div className="text-2xl font-bold text-gray-900">{stats.totalQuestions?.toLocaleString() || 0}</div>
                    <div className="text-sm text-gray-600 mt-1">Total Questions</div>
                  </Card>
                  <Card className="p-4 text-center border border-gray-200">
                    <div className="text-2xl font-bold text-gray-900">{stats.totalYears || 0}</div>
                    <div className="text-sm text-gray-600 mt-1">Years Covered</div>
                  </Card>
                  <Card className="p-4 text-center border border-gray-200">
                    <div className="text-2xl font-bold text-gray-900">{selectedExam}</div>
                    <div className="text-sm text-gray-600 mt-1">Exam Type</div>
                  </Card>
                </div>
              )}

              {/* Filters */}
              <Card className="p-6 border border-gray-200 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Exam Type</label>
                    <select
                      value={selectedExam}
                      onChange={(e) => setSelectedExam(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                    >
                      {examTypes.map(exam => (
                        <option key={exam} value={exam}>{exam}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Level</label>
                    <select
                      value={selectedLevel}
                      onChange={(e) => setSelectedLevel(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                    >
                      <option value="">All Levels</option>
                      {examLevels.map(level => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">From Year</label>
                    <select
                      value={fromYear}
                      onChange={(e) => setFromYear(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                    >
                      <option value="">All Years</option>
                      {years.map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">To Year</label>
                    <select
                      value={toYear}
                      onChange={(e) => setToYear(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                    >
                      <option value="">All Years</option>
                      {years.map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">View Mode</label>
                    <select
                      value={archiveViewMode}
                      onChange={(e) => setArchiveViewMode(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                    >
                      <option value="subject">By Subject → Year</option>
                      <option value="year">By Year → Subject</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Search by topic or keyword..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                    />
                  </div>
                  <Button variant="primary" onClick={handleSearch} disabled={loading} size="md">
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Search className="mr-2 h-4 w-4" />
                        Search
                      </>
                    )}
                  </Button>
                </div>
              </Card>

              {/* Subject Quick Filters */}
              <div className="mt-6">
                <div className="flex items-center gap-2 mb-3">
                  <Layers className="h-5 w-5 text-gray-600" />
                  <h3 className="text-sm font-semibold text-gray-700">Filter by Subject:</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleSubjectFilter('')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${!selectedSubject
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    All Subjects
                  </button>
                  {subjects.map(subject => (
                    <button
                      key={subject.value}
                      onClick={() => handleSubjectFilter(subject.value)}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${selectedSubject === subject.value
                        ? 'bg-red-600 text-white'
                        : `${subject.color} hover:opacity-80`
                        }`}
                    >
                      {subject.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Most Probable Questions Section */}
          {showMostProbable && mostProbableQuestions.length > 0 && (
            <section className="py-8 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-red-50 to-orange-50 border-y border-red-200">
              <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                      <Target className="h-6 w-6 text-red-600" />
                      Most Probable Questions
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Based on recent trends, topic frequency, and keyword analysis
                    </p>
                  </div>
                  <button
                    onClick={() => setShowMostProbable(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {mostProbableQuestions.map((q, idx) => (
                    <Card key={idx} className="p-4 border border-red-200 hover:border-red-300 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                              {q.year}
                            </span>
                            {q.paper && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                                {q.paper}
                              </span>
                            )}
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                              Score: {q.relevanceScore}
                            </span>
                          </div>
                          <p className="text-sm text-gray-900 leading-relaxed mb-2">{q.question}</p>
                          {q.trendReasons && q.trendReasons.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {q.trendReasons.slice(0, 2).map((reason, rIdx) => (
                                <span
                                  key={rIdx}
                                  className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded"
                                >
                                  {reason}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Results */}
          <section className="py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
              {loading ? (
                <Card className="p-6 text-center border border-gray-200">
                  <Loader2 className="h-8 w-8 animate-spin text-red-600 mx-auto mb-4" />
                  <p className="text-gray-600">Loading questions...</p>
                </Card>
              ) : results.length > 0 ? (
                archiveViewMode === 'subject' ? (
                  // Grouped by Subject → Year
                  <div className="space-y-8">
                    {Object.keys(groupedData).sort().map(subject => {
                      const years = Object.keys(groupedData[subject]).sort((a, b) => {
                        if (a === 'Unknown') return 1;
                        if (b === 'Unknown') return -1;
                        return parseInt(b) - parseInt(a);
                      });
                      const totalQuestions = years.reduce((sum, year) => sum + groupedData[subject][year].length, 0);

                      return (
                        <Card key={subject} className="p-6 border border-gray-200">
                          <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                              <div className={`px-3 py-1 rounded-md text-sm font-semibold ${getSubjectColor(subject)}`}>
                                {getSubjectLabel(subject)}
                              </div>
                              <span className="text-sm text-gray-600">({totalQuestions} questions)</span>
                            </div>
                          </div>

                          <div className="space-y-6">
                            {years.map(year => (
                              <div key={year} className="border-l-4 border-red-200 pl-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <Calendar className="h-4 w-4 text-gray-500" />
                                  <h4 className="font-semibold text-gray-900">{year}</h4>
                                  <span className="text-sm text-gray-500">
                                    ({groupedData[subject][year].length} questions)
                                  </span>
                                </div>
                                <div className="space-y-2">
                                  {groupedData[subject][year].slice(0, 10).map((item, idx) => (
                                    <div
                                      key={idx}
                                      className="p-3 bg-gray-50 rounded-md border border-gray-200 hover:border-red-300 transition-colors"
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-2">
                                            {item.paper && (
                                              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                                                {item.paper}
                                              </span>
                                            )}
                                            {item.level && (
                                              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                                                {item.level}
                                              </span>
                                            )}
                                            {item.verified === true || (item.sourceLink && item.sourceLink.includes('.gov.in')) ? (
                                              <CheckCircle2 className="h-4 w-4 text-green-600" title="Verified" />
                                            ) : (
                                              <AlertCircle className="h-4 w-4 text-yellow-600" title="Unverified" />
                                            )}
                                          </div>
                                          <p className="text-sm text-gray-900 leading-relaxed">{item.question}</p>
                                          {(item.topicTags && item.topicTags.length > 0) || (item.keywords && item.keywords.length > 0) ? (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                              {item.topicTags && item.topicTags.slice(0, 3).map((tag, tagIdx) => (
                                                <span
                                                  key={`tag-${tagIdx}`}
                                                  className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded font-medium"
                                                  title="Topic Tag"
                                                >
                                                  {tag}
                                                </span>
                                              ))}
                                              {item.keywords && item.keywords.slice(0, 3).map((keyword, kwIdx) => (
                                                <span
                                                  key={`kw-${kwIdx}`}
                                                  className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded"
                                                  title="Important Keyword"
                                                >
                                                  {keyword}
                                                </span>
                                              ))}
                                              {(item.analysis && item.analysis.length > 0) && (
                                                <span
                                                  className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded font-medium"
                                                  title="Has detailed analysis"
                                                >
                                                  Analysis
                                                </span>
                                              )}
                                            </div>
                                          ) : null}
                                        </div>
                                        <button
                                          onClick={(e) => handleSolve(e, item.question)}
                                          className="flex-shrink-0 p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors mr-2"
                                          title="Solve with AI"
                                        >
                                          <MessageSquare className="h-4 w-4" />
                                        </button>
                                        {item.sourceLink && (
                                          <a
                                            href={item.sourceLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex-shrink-0 p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                            title="View source"
                                          >
                                            <ExternalLink className="h-4 w-4" />
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                  {groupedData[subject][year].length > 10 && (
                                    <p className="text-xs text-gray-500 mt-2">
                                      +{groupedData[subject][year].length - 10} more questions
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  // Grouped by Year → Subject
                  <div className="space-y-8">
                    {Object.keys(groupedData).sort((a, b) => {
                      if (a === 'Unknown') return 1;
                      if (b === 'Unknown') return -1;
                      return parseInt(b) - parseInt(a);
                    }).map(year => {
                      const subjects = Object.keys(groupedData[year]);
                      const totalQuestions = subjects.reduce((sum, subj) => sum + groupedData[year][subj].length, 0);

                      return (
                        <Card key={year} className="p-6 border border-gray-200">
                          <div className="flex items-center gap-3 mb-6">
                            <Calendar className="h-6 w-6 text-red-600" />
                            <h3 className="text-2xl font-bold text-gray-900">{year}</h3>
                            <span className="text-sm text-gray-600">({totalQuestions} questions)</span>
                          </div>

                          <div className="space-y-6">
                            {subjects.map(subject => (
                              <div key={subject} className="border-l-4 border-red-200 pl-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <div className={`px-3 py-1 rounded-md text-sm font-semibold ${getSubjectColor(subject)}`}>
                                    {getSubjectLabel(subject)}
                                  </div>
                                  <span className="text-sm text-gray-600">
                                    ({groupedData[year][subject].length} questions)
                                  </span>
                                </div>
                                <div className="space-y-2">
                                  {groupedData[year][subject].slice(0, 10).map((item, idx) => (
                                    <div
                                      key={idx}
                                      className="p-3 bg-gray-50 rounded-md border border-gray-200 hover:border-red-300 transition-colors"
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-2">
                                            {item.paper && (
                                              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                                                {item.paper}
                                              </span>
                                            )}
                                            {item.level && (
                                              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                                                {item.level}
                                              </span>
                                            )}
                                            {item.verified === true || (item.sourceLink && item.sourceLink.includes('.gov.in')) ? (
                                              <CheckCircle2 className="h-4 w-4 text-green-600" title="Verified" />
                                            ) : (
                                              <AlertCircle className="h-4 w-4 text-yellow-600" title="Unverified" />
                                            )}
                                          </div>
                                          <p className="text-sm text-gray-900 leading-relaxed">{item.question}</p>
                                          {(item.topicTags && item.topicTags.length > 0) || (item.keywords && item.keywords.length > 0) ? (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                              {item.topicTags && item.topicTags.slice(0, 3).map((tag, tagIdx) => (
                                                <span
                                                  key={`tag-${tagIdx}`}
                                                  className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded font-medium"
                                                  title="Topic Tag"
                                                >
                                                  {tag}
                                                </span>
                                              ))}
                                              {item.keywords && item.keywords.slice(0, 3).map((keyword, kwIdx) => (
                                                <span
                                                  key={`kw-${kwIdx}`}
                                                  className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded"
                                                  title="Important Keyword"
                                                >
                                                  {keyword}
                                                </span>
                                              ))}
                                              {(item.analysis && item.analysis.length > 0) && (
                                                <span
                                                  className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded font-medium"
                                                  title="Has detailed analysis"
                                                >
                                                  Analysis
                                                </span>
                                              )}
                                            </div>
                                          ) : null}
                                        </div>
                                        <button
                                          onClick={(e) => handleSolve(e, item.question)}
                                          className="flex-shrink-0 p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors mr-2"
                                          title="Solve with AI"
                                        >
                                          <MessageSquare className="h-4 w-4" />
                                        </button>
                                        {item.sourceLink && (
                                          <a
                                            href={item.sourceLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex-shrink-0 p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                            title="View source"
                                          >
                                            <ExternalLink className="h-4 w-4" />
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                  {groupedData[year][subject].length > 10 && (
                                    <p className="text-xs text-gray-500 mt-2">
                                      +{groupedData[year][subject].length - 10} more questions
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )
              ) : !loading && (
                <Card className="p-6 text-center border border-gray-200">
                  <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No questions found. Please adjust your filters.</p>
                </Card>
              )}
            </div>
          </section>
        </>
      )}

      {/* Subject-wise View */}
      {viewMode === 'subject-wise' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Select Exam and Level</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Exam Type</label>
                <select
                  value={selectedExamSW}
                  onChange={(e) => {
                    setSelectedExamSW(e.target.value);
                    setSelectedPaper('');
                    setThemes([]);
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                >
                  {examTypes.map(exam => (
                    <option key={exam} value={exam}>{exam}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Exam Level</label>
                <div className="grid grid-cols-2 gap-3">
                  {EXAM_LEVELS.map(level => (
                    <button
                      key={level.id}
                      onClick={() => {
                        setSelectedLevelSW(level.id);
                        setSelectedPaper('');
                        setThemes([]);
                      }}
                      className={`p-4 rounded-lg border-2 transition-all duration-300 text-left hover-lift ${selectedLevelSW === level.id
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

                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedPaper(paper)}
                      className={`p-4 rounded-lg border-2 transition-all duration-300 text-left hover-lift ${isSelected
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
              <p className="text-gray-600">No papers found for {selectedExamSW} {selectedLevelSW}. Try selecting a different exam or level.</p>
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
                      className={`h-5 w-5 text-gray-400 transition-transform ${expandedTheme === idx ? 'rotate-90' : ''
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
                              {(question.topicTags && question.topicTags.length > 0) || (question.keywords && question.keywords.length > 0) ? (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {question.topicTags && question.topicTags.slice(0, 3).map((tag, tagIdx) => (
                                    <span
                                      key={`tag-${tagIdx}`}
                                      className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded font-medium"
                                      title="Topic Tag"
                                    >
                                      📌 {tag}
                                    </span>
                                  ))}
                                  {question.keywords && question.keywords.slice(0, 3).map((keyword, kwIdx) => (
                                    <span
                                      key={`kw-${kwIdx}`}
                                      className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded"
                                      title="Important Keyword"
                                    >
                                      🔑 {keyword}
                                    </span>
                                  ))}
                                  {(question.analysis && question.analysis.length > 0) && (
                                    <span
                                      className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded font-medium"
                                      title="Has detailed analysis"
                                    >
                                      📊 Analysis
                                    </span>
                                  )}
                                </div>
                              ) : null}
                            </div>
                            <button
                              onClick={(e) => handleSolve(e, question.question)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              title="Solve with AI"
                            >
                              <MessageSquare className="h-5 w-5" />
                            </button>
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
      )}

      {/* Question Analysis Modal */}
      {selectedQuestion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Question Analysis</h2>
              <button
                onClick={closeQuestionDetail}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
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
                  {/* New Analysis Section - Keywords, Topics, Analysis */}
                  {questionAnalysis.topicTags && questionAnalysis.topicTags.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Layers className="h-5 w-5 text-red-600" />
                        Topic Tags
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {questionAnalysis.topicTags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-purple-100 text-purple-700 text-sm rounded font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {questionAnalysis.keywords && questionAnalysis.keywords.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Target className="h-5 w-5 text-red-600" />
                        Important Keywords
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {questionAnalysis.keywords.map((keyword, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {questionAnalysis.analysis && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <FileText className="h-5 w-5 text-red-600" />
                        In-depth Analysis
                      </h3>
                      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                          {questionAnalysis.analysis}
                        </p>
                      </div>
                    </div>
                  )}

                  {questionAnalysis.similarQuestions && questionAnalysis.similarQuestions.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-red-600" />
                        Similar Questions
                      </h3>
                      <div className="space-y-2">
                        {questionAnalysis.similarQuestions.map((sq, idx) => (
                          <div
                            key={idx}
                            className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-red-300 transition-colors cursor-pointer"
                            onClick={() => {
                              const q = themes.flatMap(t => t.questions).find(q => q._id === sq.id);
                              if (q) handleQuestionClick(q, theme);
                            }}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                                {sq.year}
                              </span>
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                                {sq.exam}
                              </span>
                            </div>
                            <p className="text-sm text-gray-900">{sq.question}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Existing Answer Structure Analysis */}
                  {questionAnalysis.answerStructure && questionAnalysis.answerStructure.subParts && questionAnalysis.answerStructure.subParts.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <FileText className="h-5 w-5 text-red-600" />
                        Sub-parts Breakdown
                      </h3>
                      <div className="space-y-2">
                        {questionAnalysis.answerStructure.subParts.map((part, idx) => (
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

                  {questionAnalysis.answerStructure && questionAnalysis.answerStructure.structure && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Layers className="h-5 w-5 text-red-600" />
                        Answer Structure
                      </h3>
                      <div className="space-y-4">
                        {questionAnalysis.answerStructure.structure.introduction && (
                          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                            <div className="font-medium text-green-900 mb-2">Introduction</div>
                            <div className="text-sm text-green-800">
                              {typeof questionAnalysis.answerStructure.structure.introduction === 'string'
                                ? questionAnalysis.answerStructure.structure.introduction
                                : JSON.stringify(questionAnalysis.answerStructure.structure.introduction)}
                            </div>
                          </div>
                        )}
                        {questionAnalysis.answerStructure.structure.mainBody && (
                          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="font-medium text-blue-900 mb-2">Main Body</div>
                            {Array.isArray(questionAnalysis.answerStructure.structure.mainBody) ? (
                              <div className="space-y-3">
                                {questionAnalysis.answerStructure.structure.mainBody.map((section, idx) => (
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
                                {typeof questionAnalysis.answerStructure.structure.mainBody === 'string'
                                  ? questionAnalysis.answerStructure.structure.mainBody
                                  : JSON.stringify(questionAnalysis.answerStructure.structure.mainBody)}
                              </div>
                            )}
                          </div>
                        )}
                        {questionAnalysis.answerStructure.structure.conclusion && (
                          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                            <div className="font-medium text-purple-900 mb-2">Conclusion</div>
                            <div className="text-sm text-purple-800">
                              {typeof questionAnalysis.answerStructure.structure.conclusion === 'string'
                                ? questionAnalysis.answerStructure.structure.conclusion
                                : JSON.stringify(questionAnalysis.answerStructure.structure.conclusion)}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {questionAnalysis.answerStructure && questionAnalysis.answerStructure.reusableExamples && questionAnalysis.answerStructure.reusableExamples.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-red-600" />
                        Reusable Examples (Across Theme Questions)
                      </h3>
                      <div className="space-y-3">
                        {questionAnalysis.answerStructure.reusableExamples.map((example, idx) => (
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

                  {questionAnalysis.answerStructure && questionAnalysis.answerStructure.reusableArguments && questionAnalysis.answerStructure.reusableArguments.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-red-600" />
                        Reusable Arguments (Across Theme Questions)
                      </h3>
                      <div className="space-y-3">
                        {questionAnalysis.answerStructure.reusableArguments.map((argument, idx) => (
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

                  {questionAnalysis.answerStructure && questionAnalysis.answerStructure.keyPoints && questionAnalysis.answerStructure.keyPoints.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Key Points</h3>
                      <ul className="list-disc list-inside space-y-1 text-gray-700">
                        {questionAnalysis.answerStructure.keyPoints.map((point, idx) => (
                          <li key={idx}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {questionAnalysis.answerStructure && (questionAnalysis.answerStructure.wordCount || questionAnalysis.answerStructure.timeAllocation) && (
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-4 text-sm">
                        {questionAnalysis.answerStructure.wordCount && (
                          <div>
                            <span className="font-medium text-gray-700">Word Count: </span>
                            <span className="text-gray-600">{questionAnalysis.answerStructure.wordCount}</span>
                          </div>
                        )}
                        {questionAnalysis.answerStructure.timeAllocation && (
                          <div>
                            <span className="font-medium text-gray-700">Time Allocation: </span>
                            <span className="text-gray-600">{questionAnalysis.answerStructure.timeAllocation}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {questionAnalysis.answerStructure && questionAnalysis.answerStructure.rawResponse && (
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Answer Structure Analysis</h3>
                      <div className="text-sm text-gray-700 whitespace-pre-wrap">{questionAnalysis.answerStructure.rawResponse}</div>
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

export default function PYQArchivePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-red-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <PYQArchiveContent />
    </Suspense>
  );
}
