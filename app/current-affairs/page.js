'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/Badge';
import { 
  ArrowLeft, 
  Newspaper,
  Calendar,
  Filter,
  ExternalLink,
  Loader2,
  TrendingUp,
  Clock,
  Tag
} from 'lucide-react';
import { Skeleton, SkeletonLine } from '@/components/ui/Skeleton';
import LoadingSpinner from '@/components/LoadingSpinner';

const categories = [
  'National Affairs',
  'International Affairs',
  'Science & Technology',
  'Environment & Ecology',
  'Economy & Finance',
  'Sports & Culture',
  'Awards & Honours',
  'Government Schemes',
  'Judicial Developments',
  'Defense & Security'
];

const examTypes = ['UPSC', 'PCS', 'MPSC', 'TNPSC', 'BPSC', 'UPPSC', 'SSC'];

export default function CurrentAffairsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedExam, setSelectedExam] = useState('UPSC');
  const [dateRange, setDateRange] = useState('7');
  const [loading, setLoading] = useState(false);
  const [news, setNews] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [insights, setInsights] = useState(null);
  const [trendingSummary, setTrendingSummary] = useState(null);
  const [trendingLoading, setTrendingLoading] = useState(true);

  const categoryInsights = useMemo(() => {
    if (insights?.categories?.length) return insights.categories;
    if (trendingSummary?.categories?.length) return trendingSummary.categories;
    return [];
  }, [insights, trendingSummary]);

  const tagHighlights = useMemo(() => {
    if (insights?.tags?.length) return insights.tags;
    if (trendingSummary?.tags?.length) return trendingSummary.tags;
    return [];
  }, [insights, trendingSummary]);

  const relevanceInsights = useMemo(() => {
    if (insights?.relevance?.length) return insights.relevance;
    if (trendingSummary?.relevance?.length) return trendingSummary.relevance;
    return [];
  }, [insights, trendingSummary]);

  const hasInsights = categoryInsights.length > 0 || tagHighlights.length > 0 || relevanceInsights.length > 0;

  const computeInsights = useCallback((items = []) => {
    if (!Array.isArray(items) || items.length === 0) return null;
    const categoryCounts = new Map();
    const tagCounts = new Map();
    const relevanceCounts = new Map();

    items.forEach((item) => {
      const category = item.category || 'General';
      categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
      const relevance = item.relevance || 'Medium';
      relevanceCounts.set(relevance, (relevanceCounts.get(relevance) || 0) + 1);
      if (Array.isArray(item.tags)) {
        item.tags.forEach((tag) => {
          if (!tag) return;
          const normalized = typeof tag === 'string' ? tag.trim() : tag;
          if (!normalized) return;
          tagCounts.set(normalized, (tagCounts.get(normalized) || 0) + 1);
        });
      }
    });

    const toList = (map, limit = 6) =>
      Array.from(map.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([label, count]) => ({ label, count }));

    return {
      categories: toList(categoryCounts),
      tags: toList(tagCounts, 10),
      relevance: toList(relevanceCounts, 3),
      totalItems: items.length
    };
  }, []);

  const loadTrending = useCallback(async () => {
    try {
      setTrendingLoading(true);
      const response = await fetch('/api/news/trending');
      if (!response.ok) return;
      const data = await response.json();
      setTrendingSummary(data);
    } catch (error) {
      console.error('Error fetching trending topics:', error);
    } finally {
      setTrendingLoading(false);
    }
  }, []);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/news/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examType: selectedExam,
          category: selectedCategory,
          dateRange: dateRange,
          searchQuery: searchQuery
        })
      });

      if (response.ok) {
        const data = await response.json();
        setNews(data.news || []);
        setInsights(data.trending || computeInsights(data.news));
        if (data.trending) {
          setTrendingSummary(data.trending);
        }
      } else {
        const errorData = await response.json();
        console.error('Error fetching news:', errorData.error);
        setNews([]);
      }
    } catch (error) {
      console.error('Error fetching news:', error);
      setNews([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      handleSearch();
    }
  }, [session, computeInsights]);

  useEffect(() => {
    loadTrending();
  }, [loadTrending]);

  useEffect(() => {
    if (status !== 'loading' && !session) {
      const currentPath =
        typeof window !== 'undefined'
          ? window.location.pathname + window.location.search
          : '/current-affairs';
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
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2">
              <ArrowLeft className="h-5 w-5 text-gray-600" />
              <span className="text-lg font-medium text-gray-700">Back to Home</span>
            </Link>
            <div className="flex items-center space-x-2">
              <Newspaper className="h-6 w-6 text-red-600" />
              <span className="text-xl font-bold text-gray-900">Current Affairs</span>
            </div>
            <Link href="/chat">
              <Button variant="secondary" size="sm">
                Go to Chat
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              Current Affairs
            </h1>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Stay updated with exam-relevant current affairs. Filter by category, exam type, and time period to focus on what matters for your preparation.
            </p>
          </div>

          <Card className="mb-8 border-2 border-red-100 hover:border-red-200 transition-all duration-300 animate-fade-in-scale hover-lift">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Exam Type</label>
                  <Select
                    value={selectedExam}
                    onChange={(e) => setSelectedExam(e.target.value)}
                    className="w-full"
                  >
                    {examTypes.map(exam => (
                      <option key={exam} value={exam}>{exam}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Category</label>
                  <Select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full"
                  >
                    <option value="">All Categories</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Time Period</label>
                  <Select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                    className="w-full"
                  >
                    <option value="1">Last 24 Hours</option>
                    <option value="7">Last 7 Days</option>
                    <option value="30">Last 30 Days</option>
                    <option value="90">Last 3 Months</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Search</label>
                  <Input
                    type="text"
                    placeholder="Search topics..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>
            <Button variant="primary" onClick={handleSearch} disabled={loading} className="w-full md:w-auto">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Newspaper className="mr-2 h-4 w-4" />
                  Get Latest News
                </>
              )}
            </Button>
            </CardContent>
          </Card>

          {trendingLoading && !hasInsights ? (
            <Card className="mb-8 border border-gray-200">
              <CardContent className="p-6 space-y-3">
                <SkeletonLine className="h-4 w-1/3" />
                <SkeletonLine className="h-3 w-full" />
                <SkeletonLine className="h-3 w-5/6" />
                <SkeletonLine className="h-3 w-2/3" />
              </CardContent>
            </Card>
          ) : hasInsights ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <Card className="border border-gray-200 dark:border-gray-700 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Focus mix (current search)
                  </CardTitle>
                  <CardDescription>
                    Top categories identified by the AI for your filters
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {categoryInsights.slice(0, 5).map((cat) => (
                    <div key={cat.label}>
                      <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300 mb-1">
                        <span>{cat.label}</span>
                        <span>{cat.count} topics</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                        <div
                          className="h-2 rounded-full bg-red-500"
                          style={{ width: `${Math.min((cat.count / (categoryInsights[0]?.count || 1)) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card className="border border-gray-200 dark:border-gray-700 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Trending tags & relevance
                  </CardTitle>
                  <CardDescription>
                    Hot GS topics + exam weightage trends
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {tagHighlights.slice(0, 8).map((tag) => (
                      <Badge key={tag.label} variant="outline" className="text-xs border-red-200 text-red-600">
                        {tag.label}
                      </Badge>
                    ))}
                    {tagHighlights.length === 0 && (
                      <span className="text-sm text-gray-500">No tags yet — run a search to populate insights.</span>
                    )}
                  </div>
                  <div className="space-y-3">
                    {relevanceInsights.map((rel) => (
                      <div key={rel.label}>
                        <div className="flex justify-between text-xs uppercase text-gray-500 mb-1">
                          <span>{rel.label} relevance</span>
                          <span>{rel.count}</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                          <div
                            className="h-2 rounded-full bg-blue-500"
                            style={{ width: `${Math.min((rel.count / (relevanceInsights[0]?.count || 1)) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}

          <div className="space-y-6">
            {loading ? (
              <div className="space-y-4">
                {[0, 1, 2].map((idx) => (
                  <Card key={`news-skeleton-${idx}`} className="border-l-4 border-l-red-200">
                    <CardContent className="p-6 space-y-3">
                      <SkeletonLine className="h-4 w-1/5" />
                      <SkeletonLine className="h-6 w-3/4" />
                      <SkeletonLine className="h-3 w-full" />
                      <SkeletonLine className="h-3 w-5/6" />
                      <SkeletonLine className="h-3 w-2/3" />
                      <div className="flex gap-2">
                        <Skeleton className="h-8 w-24" />
                        <Skeleton className="h-8 w-24" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : news.length > 0 ? (
              news.map((item, index) => (
                <Card 
                  key={item.id} 
                  className="border-l-4 border-l-red-600 hover:shadow-lg transition-all duration-300 animate-fade-in-scale hover-lift"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge variant="primary" className="text-xs">
                        {item.category}
                      </Badge>
                      <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                        <Clock className="h-4 w-4 mr-1" />
                        {item.date}
                      </div>
                      {item.relevance === 'High' && (
                        <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">
                          {item.relevance} Relevance
                        </Badge>
                      )}
                    </div>
                    <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                      {item.exam}
                    </Badge>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{item.title}</h3>
                  <p className="text-gray-600 mb-4 leading-relaxed">{item.summary}</p>
                  
                  {item.keyPoints && item.keyPoints.length > 0 && (
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">Key Points:</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                        {item.keyPoints.slice(0, 3).map((point, idx) => (
                          <li key={idx}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {item.tags.map((tag, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          <Tag className="h-3 w-3 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="mt-4">
                    <div className="flex justify-between text-xs uppercase text-gray-500 dark:text-gray-400 mb-1">
                      <span>Exam focus</span>
                      <span>{item.relevance || 'Medium'}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                      <div
                        className="h-2 rounded-full bg-red-500"
                        style={{ width: `${item.relevance === 'High' ? 90 : item.relevance === 'Low' ? 45 : 65}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => router.push(`/chat?topic=${encodeURIComponent(item.title)}`)}
                    >
                      Discuss in Chat
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSearch()}
                    >
                      Get More Details
                    </Button>
                  </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="text-center">
                <CardContent className="p-8">
                  <Newspaper className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No news found. Try adjusting your filters or check back later.</p>
                  <p className="text-sm text-gray-500 mt-2">
                    You can also ask about current affairs in the chat interface.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          <Card className="mt-8 bg-gray-50 border border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-start">
                <TrendingUp className="h-5 w-5 text-gray-600 mr-3 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Usage Guidelines</h3>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• Filter by exam type, category, and time period for targeted preparation</li>
                    <li>• Use "Discuss in Chat" for detailed analysis and exam-relevant insights</li>
                    <li>• Search by specific topics or keywords to find relevant news</li>
                    <li>• All content is curated specifically for competitive exam preparation</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

