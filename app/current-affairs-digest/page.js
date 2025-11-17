'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Newspaper, Download, Calendar, Tag, ArrowLeft, Sparkles, Loader2, CheckCircle2, ExternalLink, Clock, Languages } from 'lucide-react';
import LanguageSelector from '@/components/LanguageSelector';
import { getLanguagePreference, saveLanguagePreference, translateText } from '@/lib/translationUtils';

export default function CurrentAffairsDigestPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [period, setPeriod] = useState('daily');
  const [loading, setLoading] = useState(false);
  const [digest, setDigest] = useState(null);
  const [error, setError] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState(getLanguagePreference());
  const [translatedContent, setTranslatedContent] = useState({});

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    setDigest(null);

    const startDate = new Date();
    const endDate = new Date();
    
    if (period === 'weekly') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === 'monthly') {
      startDate.setMonth(startDate.getMonth() - 1);
    }

    try {
      const response = await fetch('/api/current-affairs/digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          period, 
          startDate, 
          endDate,
          language: selectedLanguage 
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate digest');
      }

      setDigest(data.digest);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (!digest) return;

    try {
      const resolveDigestId = () => {
        if (!digest) return null;
        if (typeof digest._id === 'string') return digest._id;
        if (digest._id && typeof digest._id === 'object') {
          if (typeof digest._id.toString === 'function' && !digest._id.toString().startsWith('[object')) {
            return digest._id.toString();
          }
          if (typeof digest._id.$oid === 'string') return digest._id.$oid;
        }
        if (digest.id) return String(digest.id);
        return null;
      };

      const digestId = resolveDigestId();
      const payload = digestId ? { digestId } : { digest };
      
      const response = await fetch('/api/current-affairs/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to export PDF' }));
        throw new Error(errorData.error || 'Failed to export PDF');
      }

      const blob = await response.blob();
      
      // Check if blob is actually a PDF
      if (blob.type !== 'application/pdf' && blob.size === 0) {
        // Try to get error message from response
        const errorText = await blob.text().catch(() => '');
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || 'Invalid PDF response from server');
        } catch {
          throw new Error('Invalid PDF response from server');
        }
      }
      
      // Additional validation
      if (blob.size === 0) {
        throw new Error('PDF file is empty');
      }
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `current-affairs-${period}-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);
    } catch (err) {
      console.error('PDF export error:', err);
      setError(err.message || 'Failed to export PDF. Please try again.');
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center px-4">
        <Card className="p-6 max-w-md text-center border-2 border-red-100">
          <Newspaper className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Login Required</h2>
          <p className="text-gray-600 mb-6">Please login to access Current Affairs Digest.</p>
          <Button variant="primary" onClick={() => router.push('/chat')}>
            Go to Login
          </Button>
        </Card>
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
              <Newspaper className="h-6 w-6 text-red-600" />
              <span className="text-xl font-bold text-gray-900">Current Affairs Digest</span>
            </div>
            <Link href="/chat">
              <Button variant="secondary" size="sm">
                Go to Chat
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center mb-8">
          <div className="inline-flex items-center px-4 py-2 bg-red-50 rounded-full mb-6">
            <Sparkles className="h-4 w-4 text-red-600 mr-2" />
            <span className="text-sm font-medium text-red-700">AI-Powered News Summaries</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Current Affairs Digest
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Stay updated with daily, weekly, or monthly summaries of important current affairs curated for competitive exam preparation.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <Card className="mb-6 border-2 border-red-100 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-red-600" />
                Generate Digest
              </CardTitle>
              <CardDescription>Select a time period to generate comprehensive current affairs summary</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <LanguageSelector
                selectedLanguage={selectedLanguage}
                onLanguageChange={(lang) => {
                  setSelectedLanguage(lang);
                  saveLanguagePreference(lang);
                  setTranslatedContent({});
                }}
                showLabel={true}
                size="md"
              />
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Time Period</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {['daily', 'weekly', 'monthly'].map((p) => (
                    <button
                      key={p}
                      onClick={() => setPeriod(p)}
                      className={`p-4 rounded-lg border-2 transition-all capitalize ${
                        period === p
                          ? 'border-red-500 bg-red-50 dark:bg-red-900/20 shadow-md'
                          : 'border-gray-200 hover:border-red-300 hover:shadow-sm'
                      }`}
                    >
                      <Clock className={`h-6 w-6 mx-auto mb-2 ${period === p ? 'text-red-600' : 'text-gray-600'}`} />
                      <div className={`font-semibold ${period === p ? 'text-red-700' : 'text-gray-700'}`}>
                        {p}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 text-red-700 dark:text-red-400 rounded-lg">
                  {error}
                </div>
              )}

              <Button onClick={handleGenerate} disabled={loading} className="w-full py-3 text-lg font-semibold" variant="primary">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Generating Digest...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Generate {period.charAt(0).toUpperCase() + period.slice(1)} Digest
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {loading && (
            <Card className="border-2 border-red-100 p-12 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-red-600 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">Generating your current affairs digest...</p>
              <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
            </Card>
          )}

          {digest && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 bg-white rounded-lg border-2 border-red-100 shadow-sm">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900">{digest.title}</h2>
                    <Badge variant="primary" className="text-sm px-3 py-1 capitalize">
                      {digest.period}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span>{new Date(digest.startDate).toLocaleDateString()} - {new Date(digest.endDate).toLocaleDateString()}</span>
                  </div>
                </div>
                <Button onClick={handleExportPDF} variant="primary" className="w-full md:w-auto">
                  <Download className="w-4 h-4 mr-2" />
                  Export PDF
                </Button>
              </div>

              {digest.summary && (
                <Card className="border-2 border-red-100">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-red-600" />
                      Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{digest.summary}</p>
                  </CardContent>
                </Card>
              )}

              {digest.keyHighlights && digest.keyHighlights.length > 0 && (
                <Card className="border-2 border-red-100">
                  <CardHeader>
                    <CardTitle>Key Highlights</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {digest.keyHighlights.map((highlight, idx) => (
                        <li key={idx} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="text-gray-700 dark:text-gray-300">{highlight}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {digest.categories && digest.categories.map((category, idx) => (
                <Card key={idx} className="border-2 border-red-100 hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle className="flex items-center gap-2">
                        <Tag className="h-5 w-5 text-red-600" />
                        {category.name}
                      </CardTitle>
                      <Badge variant="secondary">{category.count || 0} items</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {category.items && category.items.map((item, i) => (
                      <div key={i} className="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-0 last:pb-0">
                        <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">{item.title}</h3>
                        {item.summary && (
                          <p className="text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">{item.summary}</p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-3">
                          {item.tags && item.tags.map((tag, t) => (
                            <Badge key={t} variant="secondary" className="text-xs">
                              <Tag className="w-3 h-3 mr-1" />
                              {tag}
                            </Badge>
                          ))}
                          {item.examRelevance && item.examRelevance.map((exam, e) => (
                            <Badge key={e} variant="primary" className="text-xs">
                              {exam}
                            </Badge>
                          ))}
                          {item.relevance && (
                            <Badge variant={item.relevance === 'high' ? 'primary' : 'secondary'} className="text-xs">
                              {item.relevance} priority
                            </Badge>
                          )}
                        </div>
                        {item.source && (
                          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                            <ExternalLink className="h-3 w-3" />
                            <span>Source: {item.source}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}

              {digest.examRelevance && (
                <Card className="border-2 border-red-100">
                  <CardHeader>
                    <CardTitle>Exam Relevance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-3 gap-4">
                      {Object.entries(digest.examRelevance).map(([exam, topics]) => (
                        topics && topics.length > 0 && (
                          <div key={exam} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">{exam.toUpperCase()}</h3>
                            <ul className="space-y-2">
                              {topics.map((topic, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                                  <span className="text-red-600 mt-1">•</span>
                                  <span>{topic}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
