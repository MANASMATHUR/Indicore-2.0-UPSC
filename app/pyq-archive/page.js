'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
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
  Layers
} from 'lucide-react';

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

export default function PYQArchivePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [selectedExam, setSelectedExam] = useState('UPSC');
  const [selectedLevel, setSelectedLevel] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [fromYear, setFromYear] = useState('');
  const [toYear, setToYear] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [stats, setStats] = useState(null);
  const [viewMode, setViewMode] = useState('subject'); // 'subject' or 'year'

  // Generate year options
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1990 + 1 }, (_, i) => currentYear - i);

  useEffect(() => {
    loadStats();
  }, [selectedExam]);

  useEffect(() => {
    if (selectedExam || selectedLevel || selectedSubject || fromYear || toYear || searchQuery) {
      handleSearch();
    }
  }, [selectedExam, selectedLevel, selectedSubject]);

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

  const handleSearch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        exam: selectedExam,
        limit: '500'
      });
      if (selectedLevel) params.append('level', selectedLevel);
      if (fromYear) params.append('fromYear', fromYear);
      if (toYear) params.append('toYear', toYear);
      if (selectedSubject) {
        params.append('theme', selectedSubject);
      } else if (searchQuery) {
        params.append('theme', searchQuery);
      }

      const response = await fetch(`/api/pyq/search?${params.toString()}`);
      const data = await response.json();
      
      if (data.ok) {
        setResults(data.items || []);
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

  // Group by subject and year
  const groupBySubjectAndYear = () => {
    const grouped = {};
    results.forEach(item => {
      // Extract subject from topicTags or paper
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

  const groupedData = viewMode === 'subject' ? groupBySubjectAndYear() : groupByYearAndSubject();

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
              <span className="text-xl font-bold text-gray-900">Previous Year Questions Archive</span>
            </div>
            <div className="flex items-center space-x-2">
              <Link href="/gs-papers">
                <Button variant="secondary" size="sm">
                  GS Papers
                </Button>
              </Link>
              <Link href="/chat">
                <Button variant="secondary" size="sm">
                  Chat Interface
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

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
                  value={viewMode}
                  onChange={(e) => setViewMode(e.target.value)}
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
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  !selectedSubject 
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
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedSubject === subject.value
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

      {/* Results */}
      <section className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <Card className="p-6 text-center border border-gray-200">
              <Loader2 className="h-8 w-8 animate-spin text-red-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading questions...</p>
            </Card>
          ) : results.length > 0 ? (
            viewMode === 'subject' ? (
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
                                      {item.topicTags && item.topicTags.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                          {item.topicTags.slice(0, 3).map((tag, tagIdx) => (
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
                                      {item.topicTags && item.topicTags.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                          {item.topicTags.slice(0, 3).map((tag, tagIdx) => (
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
    </div>
  );
}
