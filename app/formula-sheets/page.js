'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { BookOpen, FileText, Network, Download, ArrowLeft, Sparkles, CheckCircle2, Loader2, Copy, Share2, XCircle } from 'lucide-react';

export default function FormulaSheetsPage() {
  // Feature temporarily disabled - keeping codebase for future use
  const { data: session } = useSession();
  const router = useRouter();
  
  // Show maintenance message
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center px-4">
      <Card className="p-8 max-w-md text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Feature Under Maintenance</h2>
        <p className="text-gray-600 mb-6">
          Formula Sheets feature is currently under maintenance. Please check back later.
        </p>
        <Link href="/">
          <Button variant="primary">Return to Home</Button>
        </Link>
      </Card>
    </div>
  );

  /* COMMENTED OUT - Feature temporarily disabled
  const { data: session } = useSession();
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [type, setType] = useState('formula');
  const [loading, setLoading] = useState(false);
  const [formulaSheet, setFormulaSheet] = useState(null);
  const [error, setError] = useState('');

  const subjects = [
    'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Economics',
    'Polity', 'History', 'Geography', 'Science & Technology', 'Environment'
  ];

  const handleGenerate = async () => {
    if (!subject) {
      setError('Please select a subject');
      return;
    }

    setLoading(true);
    setError('');
    setFormulaSheet(null);

    try {
      const response = await fetch('/api/formula-sheets/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, topic, type })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate formula sheet');
      }

      setFormulaSheet(data.formulaSheet);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    if (!formulaSheet) return null;

    if (type === 'formula' && formulaSheet.content?.formulas) {
      const formulasArray = Array.isArray(formulaSheet.content.formulas) ? formulaSheet.content.formulas : [];
      return (
        <div className="space-y-6">
          {formulasArray.map((formula, idx) => (
            <Card key={idx} className="border-2 border-red-100 hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <Badge variant="secondary" className="text-xs">Formula {idx + 1}</Badge>
                  {formula.topic && (
                    <Badge variant="primary" className="text-xs">{formula.topic}</Badge>
                  )}
                </div>
                <div className="font-mono text-xl font-bold mb-4 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 p-4 rounded-lg border border-red-200">
                  {formula.formula}
                </div>
                {formula.description && (
                  <p className="text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">{formula.description}</p>
                )}
                {formula.variables && Array.isArray(formula.variables) && formula.variables.length > 0 && (
                  <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="font-semibold mb-3 text-gray-900 dark:text-gray-100">Variables:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {formula.variables.map((v, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className="font-mono font-bold text-red-600 dark:text-red-400">{v.symbol}</span>
                          <span className="text-gray-600 dark:text-gray-400">:</span>
                          <span className="text-gray-700 dark:text-gray-300">{v.meaning}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {formula.example && (
                  <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-4 w-4 text-blue-600" />
                      <p className="font-semibold text-blue-900 dark:text-blue-100">Example:</p>
                    </div>
                    <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">{formula.example}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (type === 'concept_map' && formulaSheet.content?.conceptMap) {
      const { nodes, edges } = formulaSheet.content.conceptMap;
      const nodesArray = Array.isArray(nodes) ? nodes : [];
      const edgesArray = Array.isArray(edges) ? edges : [];
      return (
        <div className="space-y-6">
          <Card className="border-2 border-red-100 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-6 w-6 text-red-600" />
                Concept Map
              </CardTitle>
              <CardDescription>Visual representation of relationships between concepts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {nodesArray.map((node, idx) => (
                  <Card key={idx} className="border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="font-bold text-lg text-gray-900 dark:text-white mb-1">{node.label}</div>
                          {node.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{node.description}</p>
                          )}
                        </div>
                        {node.type && (
                          <Badge variant="secondary" className="text-xs capitalize">{node.type}</Badge>
                        )}
                      </div>
                      {node.connections && node.connections.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <p className="text-xs font-semibold text-gray-500 mb-2">Connected to:</p>
                          <div className="flex flex-wrap gap-2">
                            {node.connections.map((conn, cIdx) => (
                              <Badge key={cIdx} variant="primary" className="text-xs">{conn}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
              {edgesArray && edgesArray.length > 0 && (
                <div className="mt-6 pt-6 border-t-2 border-gray-200 dark:border-gray-700">
                  <h4 className="font-bold text-lg mb-4 text-gray-900 dark:text-white">Relationships</h4>
                  <div className="space-y-3">
                    {edgesArray.map((edge, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <Badge variant="primary" className="text-xs">{edge.from}</Badge>
                        <span className="text-gray-400">→</span>
                        <Badge variant="primary" className="text-xs">{edge.to}</Badge>
                        {edge.label && (
                          <>
                            <span className="text-gray-400">:</span>
                            <span className="text-sm text-gray-600 dark:text-gray-400">{edge.label}</span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    if (type === 'quick_reference' && formulaSheet.content?.quickReference) {
      const sectionsArray = Array.isArray(formulaSheet.content.quickReference.sections) 
        ? formulaSheet.content.quickReference.sections 
        : [];
      return (
        <div className="space-y-6">
          {sectionsArray.map((section, idx) => (
            <Card key={idx} className="border-2 border-red-100 hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-red-600" />
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {section.content && (
                  <p className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200">
                    {section.content}
                  </p>
                )}
                {section.items && section.items.length > 0 && (
                  <div className="space-y-3">
                    {section.items.map((item, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 hover:border-red-300 transition-colors">
                        <CheckCircle2 className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{item}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    return <p className="text-gray-500">No content available</p>;
  };

  const router = useRouter();

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center px-4">
        <Card className="p-6 max-w-md text-center border-2 border-red-100">
          <BookOpen className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Login Required</h2>
          <p className="text-gray-600 mb-6">Please login to access the Formula Sheets tool.</p>
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
              <FileText className="h-6 w-6 text-red-600" />
              <span className="text-xl font-bold text-gray-900">Formula & Concept Sheets</span>
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
            <span className="text-sm font-medium text-red-700">AI-Powered Study Materials</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Formula & Concept Sheets
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Generate comprehensive formula sheets, concept maps, and quick reference guides tailored for competitive exam preparation.
          </p>
        </div>

        <div className="max-w-7xl mx-auto">
          <Card className="mb-6 border-2 border-red-100 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-red-600" />
                Generate Study Material
              </CardTitle>
              <CardDescription>Select subject and topic to create comprehensive study materials</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Material Type</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    onClick={() => setType('formula')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      type === 'formula'
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20 shadow-md'
                        : 'border-gray-200 hover:border-red-300 hover:shadow-sm'
                    }`}
                  >
                    <FileText className={`h-6 w-6 mx-auto mb-2 ${type === 'formula' ? 'text-red-600' : 'text-gray-600'}`} />
                    <div className={`font-semibold ${type === 'formula' ? 'text-red-700' : 'text-gray-700'}`}>
                      Formula Sheet
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Formulas with examples</div>
                  </button>
                  <button
                    onClick={() => setType('concept_map')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      type === 'concept_map'
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20 shadow-md'
                        : 'border-gray-200 hover:border-red-300 hover:shadow-sm'
                    }`}
                  >
                    <Network className={`h-6 w-6 mx-auto mb-2 ${type === 'concept_map' ? 'text-red-600' : 'text-gray-600'}`} />
                    <div className={`font-semibold ${type === 'concept_map' ? 'text-red-700' : 'text-gray-700'}`}>
                      Concept Map
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Visual relationships</div>
                  </button>
                  <button
                    onClick={() => setType('quick_reference')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      type === 'quick_reference'
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20 shadow-md'
                        : 'border-gray-200 hover:border-red-300 hover:shadow-sm'
                    }`}
                  >
                    <BookOpen className={`h-6 w-6 mx-auto mb-2 ${type === 'quick_reference' ? 'text-red-600' : 'text-gray-600'}`} />
                    <div className={`font-semibold ${type === 'quick_reference' ? 'text-red-700' : 'text-gray-700'}`}>
                      Quick Reference
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Key points & tips</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Subject *</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-800 dark:border-gray-700 transition-all"
                >
                  <option value="">Select Subject</option>
                  {subjects.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Topic (Optional)</label>
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., Algebra, Thermodynamics, Constitutional Law, etc."
                  className="w-full"
                />
              </div>

              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 text-red-700 dark:text-red-400 rounded-lg flex items-center gap-2">
                  <XCircle className="h-5 w-5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                onClick={handleGenerate}
                disabled={loading || !subject}
                className="w-full py-3 text-lg font-semibold"
                variant="primary"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Generate {type === 'formula' ? 'Formula Sheet' : type === 'concept_map' ? 'Concept Map' : 'Quick Reference'}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {loading && (
          <div className="max-w-7xl mx-auto mt-8">
            <Card className="border-2 border-red-100 p-12 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-red-600 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">Generating your study material...</p>
              <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
            </Card>
          </div>
        )}
      </section>

      {formulaSheet && (
        <section className="pb-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 p-4 bg-white rounded-lg border-2 border-red-100 shadow-sm">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900">{formulaSheet.title}</h2>
                  <Badge variant="primary" className="text-sm px-3 py-1">
                    {formulaSheet.type.replace('_', ' ')}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">
                  Generated on {new Date(formulaSheet.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => navigator.clipboard.writeText(JSON.stringify(formulaSheet, null, 2))}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </Button>
                <Button variant="secondary" size="sm">
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
              </div>
            </div>
            {renderContent()}
          </div>
        </section>
      )}
    </div>
  );
}

