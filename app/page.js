'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import Logo from '@/components/Logo';
// Import icons individually for better tree-shaking
import { 
  BookOpen, 
  Languages, 
  FileText, 
  Brain, 
  CheckCircle2, 
  XCircle, 
  Database,
  MessageSquare,
  Target,
  Award,
  Zap,
  ArrowRight,
  BarChart3,
  FileCheck,
  Users,
  MapPin,
  Newspaper
} from 'lucide-react';

export default function Home() {
  const { data: session } = useSession();
  const router = useRouter();

  const handleGetStarted = () => {
    if (session) {
      router.push('/chat');
    } else {
      router.push('/chat');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-orange-50/20 to-white">
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="hover:opacity-80 transition-opacity">
              <Logo variant="light" showText={true} size="default" />
            </Link>
            <div className="flex items-center space-x-4">
              {session ? (
                <Link href="/chat">
                  <Button variant="primary" size="md">
                    Go to Chat
                  </Button>
                </Link>
              ) : (
                <Link href="/chat">
                  <Button variant="primary" size="md">
                    Get Started
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden pt-20 pb-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <Badge variant="primary" className="mb-6 px-4 py-2 text-sm">
              AI-Powered Exam Preparation
            </Badge>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight animate-fade-in-scale">
              Your Intelligent
              <span className="block bg-gradient-to-r from-red-600 via-orange-600 to-red-600 bg-clip-text text-transparent animate-gradient-shift bg-[length:200%_auto]">
                Exam Companion
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
              Your all-in-one platform for competitive exam preparation. 
              From PYQs to current affairs, we've got you covered.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button 
                variant="primary" 
                size="lg" 
                onClick={handleGetStarted}
                className="text-lg px-8 py-6"
              >
                Start Preparing Now
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Link href="#features">
                <Button variant="secondary" size="lg" className="text-lg px-8 py-6">
                  Learn More
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="why-indicore" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Built for Exam Success
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Purpose-built tools and knowledge designed specifically for competitive exam preparation.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <Card className="border-2 border-red-100 hover:border-red-300 hover:shadow-lg transition-all duration-300 animate-card-hover hover-lift group">
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-red-100 to-red-200 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Database className="h-6 w-6 text-red-600" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Comprehensive PYQ Database</h3>
                    <p className="text-gray-600 leading-relaxed">
                      Access thousands of verified previous year questions from UPSC, PCS, and SSC exams. 
                      All questions are organized by year, paper, and theme with official source links.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-red-100 hover:border-red-300 hover:shadow-lg transition-all duration-300 animate-card-hover hover-lift group">
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-red-100 to-red-200 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Target className="h-6 w-6 text-red-600" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Structured Answer Frameworks</h3>
                    <p className="text-gray-600 leading-relaxed">
                      Get answers formatted for UPSC Mains (150/250 words), essay structures, and exam evaluation criteria. 
                      Every response is tailored to help you score better.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-red-100 hover:border-red-300 hover:shadow-lg transition-all">
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                      <Languages className="h-6 w-6 text-red-600" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Native Multilingual Support</h3>
                    <p className="text-gray-600 leading-relaxed">
                      Full support for 11 languages (Hindi, Tamil, Bengali, Marathi, etc.) with native speech synthesis 
                      and context-aware translation. Perfect for regional language papers and study materials.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-red-100 hover:border-red-300 hover:shadow-lg transition-all">
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                      <FileCheck className="h-6 w-6 text-red-600" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Exam-Specific Evaluation</h3>
                    <p className="text-gray-600 leading-relaxed">
                      Upload your answers and get evaluated based on UPSC/PCS marking schemes. Receive feedback on structure, 
                      content, language, and exam-specific requirements that generic AI can't provide.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-red-100 hover:border-red-300 hover:shadow-lg transition-all duration-300 animate-card-hover hover-lift group">
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-red-100 to-red-200 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <MapPin className="h-6 w-6 text-red-600" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">State-Specific PCS Support</h3>
                    <p className="text-gray-600 leading-relaxed">
                      Tailored content for state-level PCS exams including MPSC, TNPSC, BPSC, and more. 
                      Get state-specific geography, history, and current affairs coverage.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-red-100 hover:border-red-300 hover:shadow-lg transition-all duration-300 animate-card-hover hover-lift group">
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-red-100 to-red-200 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Brain className="h-6 w-6 text-red-600" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Subject Expertise</h3>
                    <p className="text-gray-600 leading-relaxed">
                      Deep coverage of Polity, History, Geography, Economics, and all major subjects. 
                      Every topic is structured to match exam requirements and marking schemes.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Our Unique Features
            </h2>
            <p className="text-xl text-gray-600">
              Specialized tools designed specifically for competitive exam preparation
            </p>
          </div>

          <div className="overflow-x-auto">
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <table className="w-full">
                <thead className="bg-gray-50 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Feature</th>
                    <th className="px-6 py-4 text-center text-sm font-bold text-gray-900">Indicore</th>
                    <th className="px-6 py-4 text-center text-sm font-medium text-gray-500">Other AI Services</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Previous Year Questions Database</td>
                    <td className="px-6 py-4 text-center"><CheckCircle2 className="h-5 w-5 text-red-600 mx-auto" /></td>
                    <td className="px-6 py-4 text-center text-sm text-gray-500">—</td>
                  </tr>
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Exam-Specific Answer Frameworks</td>
                    <td className="px-6 py-4 text-center"><CheckCircle2 className="h-5 w-5 text-red-600 mx-auto" /></td>
                    <td className="px-6 py-4 text-center text-sm text-gray-500">—</td>
                  </tr>
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">UPSC/PCS/SSC Evaluation System</td>
                    <td className="px-6 py-4 text-center"><CheckCircle2 className="h-5 w-5 text-red-600 mx-auto" /></td>
                    <td className="px-6 py-4 text-center text-sm text-gray-500">—</td>
                  </tr>
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">State-Specific PCS Knowledge</td>
                    <td className="px-6 py-4 text-center"><CheckCircle2 className="h-5 w-5 text-red-600 mx-auto" /></td>
                    <td className="px-6 py-4 text-center text-sm text-gray-500">—</td>
                  </tr>
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">11 Languages with Native Speech</td>
                    <td className="px-6 py-4 text-center"><CheckCircle2 className="h-5 w-5 text-red-600 mx-auto" /></td>
                    <td className="px-6 py-4 text-center text-sm text-gray-500">—</td>
                  </tr>
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Essay Enhancement Tool</td>
                    <td className="px-6 py-4 text-center"><CheckCircle2 className="h-5 w-5 text-red-600 mx-auto" /></td>
                    <td className="px-6 py-4 text-center text-sm text-gray-500">—</td>
                  </tr>
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Vocabulary Builder (Bilingual)</td>
                    <td className="px-6 py-4 text-center"><CheckCircle2 className="h-5 w-5 text-red-600 mx-auto" /></td>
                    <td className="px-6 py-4 text-center text-sm text-gray-500">—</td>
                  </tr>
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Constitutional Articles</td>
                    <td className="px-6 py-4 text-center"><CheckCircle2 className="h-5 w-5 text-red-600 mx-auto" /></td>
                    <td className="px-6 py-4 text-center text-sm text-gray-500">—</td>
                  </tr>
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Government Schemes Database</td>
                    <td className="px-6 py-4 text-center"><CheckCircle2 className="h-5 w-5 text-red-600 mx-auto" /></td>
                    <td className="px-6 py-4 text-center text-sm text-gray-500">—</td>
                  </tr>
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Exam Paper Upload & Analysis</td>
                    <td className="px-6 py-4 text-center"><CheckCircle2 className="h-5 w-5 text-red-600 mx-auto" /></td>
                    <td className="px-6 py-4 text-center text-sm text-gray-500">—</td>
                  </tr>
                </tbody>
              </table>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Study Tools
            </h2>
            <p className="text-xl text-gray-600">
              Everything you need in one place
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6 mb-12">
            <Link href="/chat">
              <Card className="text-center h-full border-2 border-red-100 bg-white cursor-pointer transition-all duration-300 hover:border-red-300 hover:shadow-xl hover-lift group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-red-50/0 to-orange-50/0 group-hover:from-red-50/50 group-hover:to-orange-50/30 transition-all duration-300 pointer-events-none"></div>
                <CardContent className="p-6 relative z-10">
                  <div className="w-16 h-16 bg-gradient-to-br from-red-100 to-red-200 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-sm">
                    <MessageSquare className="h-8 w-8 text-red-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-red-600 transition-colors duration-300">AI Chatbot</h3>
                  <p className="text-gray-600 text-sm mb-4 leading-relaxed min-h-[3rem]">
                    Exam-focused conversations with context-aware responses
                  </p>
                  <Button variant="primary" size="sm" className="w-full group-hover:shadow-md transition-shadow duration-300">
                    Start Chatting
                  </Button>
                </CardContent>
              </Card>
            </Link>

            <Link href="/essay-builder">
              <Card className="text-center h-full border-2 border-red-100 bg-white cursor-pointer transition-all duration-300 hover:border-red-300 hover:shadow-xl hover-lift group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-red-50/0 to-orange-50/0 group-hover:from-red-50/50 group-hover:to-orange-50/30 transition-all duration-300 pointer-events-none"></div>
                <CardContent className="p-6 relative z-10">
                  <div className="w-16 h-16 bg-gradient-to-br from-red-100 to-red-200 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-sm">
                    <FileText className="h-8 w-8 text-red-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-red-600 transition-colors duration-300">Essay Builder</h3>
                  <p className="text-gray-600 text-sm mb-4 leading-relaxed min-h-[3rem]">
                    Comprehensive essay topics with AI enhancement
                  </p>
                  <Button variant="primary" size="sm" className="w-full group-hover:shadow-md transition-shadow duration-300">
                    Build Essays
                  </Button>
                </CardContent>
              </Card>
            </Link>

            <Link href="/pyq-archive">
              <Card className="text-center h-full border-2 border-red-100 bg-white cursor-pointer transition-all duration-300 hover:border-red-300 hover:shadow-xl hover-lift group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-red-50/0 to-orange-50/0 group-hover:from-red-50/50 group-hover:to-orange-50/30 transition-all duration-300 pointer-events-none"></div>
                <CardContent className="p-6 relative z-10">
                  <div className="w-16 h-16 bg-gradient-to-br from-red-100 to-red-200 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-sm">
                    <Database className="h-8 w-8 text-red-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-red-600 transition-colors duration-300">PYQ Archive & Subject-wise PYQs</h3>
                  <p className="text-gray-600 text-sm mb-4 leading-relaxed min-h-[3rem]">
                    Comprehensive database with archive view and theme-organized questions with AI analysis
                  </p>
                  <Button variant="primary" size="sm" className="w-full group-hover:shadow-md transition-shadow duration-300">
                    Explore PYQs
                  </Button>
                </CardContent>
              </Card>
            </Link>

            <Link href="/vocabulary-builder">
              <Card className="text-center h-full border-2 border-red-100 bg-white cursor-pointer transition-all duration-300 hover:border-red-300 hover:shadow-xl hover-lift group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-red-50/0 to-orange-50/0 group-hover:from-red-50/50 group-hover:to-orange-50/30 transition-all duration-300 pointer-events-none"></div>
                <CardContent className="p-6 relative z-10">
                  <div className="w-16 h-16 bg-gradient-to-br from-red-100 to-red-200 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-sm">
                    <Brain className="h-8 w-8 text-red-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-red-600 transition-colors duration-300">Vocabulary Builder</h3>
                  <p className="text-gray-600 text-sm mb-4 leading-relaxed min-h-[3rem]">
                    Bilingual flashcards for exam vocabulary
                  </p>
                  <Button variant="primary" size="sm" className="w-full group-hover:shadow-md transition-shadow duration-300">
                    Build Vocabulary
                  </Button>
                </CardContent>
              </Card>
            </Link>

            {/* Formula Sheets Feature - Temporarily Disabled */}
            {/* 
            <Link href="/formula-sheets">
              <Card className="text-center h-full border-2 border-red-100 cursor-pointer transition-all duration-300 hover:border-red-300 hover:shadow-lg hover-lift group">
                <CardContent className="p-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-red-100 to-red-200 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                    <FileText className="h-8 w-8 text-red-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Formula Sheets</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    Auto-generated formula sheets and concept maps
                  </p>
                  <Button variant="primary" size="sm" className="w-full">
                    Generate Sheets
                  </Button>
                </CardContent>
              </Card>
            </Link>
            */}

            <Link href="/current-affairs-digest">
              <Card className="text-center h-full border-2 border-red-100 bg-white cursor-pointer transition-all duration-300 hover:border-red-300 hover:shadow-xl hover-lift group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-red-50/0 to-orange-50/0 group-hover:from-red-50/50 group-hover:to-orange-50/30 transition-all duration-300 pointer-events-none"></div>
                <CardContent className="p-6 relative z-10">
                  <div className="w-16 h-16 bg-gradient-to-br from-red-100 to-red-200 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-sm">
                    <Newspaper className="h-8 w-8 text-red-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-red-600 transition-colors duration-300">Current Affairs Digest</h3>
                  <p className="text-gray-600 text-sm mb-4 leading-relaxed min-h-[3rem]">
                    Daily/weekly summaries with PDF export
                  </p>
                  <Button variant="primary" size="sm" className="w-full group-hover:shadow-md transition-shadow duration-300">
                    View Digest
                  </Button>
                </CardContent>
              </Card>
            </Link>

            <Link href="/interview-prep">
              <Card className="text-center h-full border-2 border-red-100 bg-white cursor-pointer transition-all duration-300 hover:border-red-300 hover:shadow-xl hover-lift group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-red-50/0 to-orange-50/0 group-hover:from-red-50/50 group-hover:to-orange-50/30 transition-all duration-300 pointer-events-none"></div>
                <CardContent className="p-6 relative z-10">
                  <div className="w-16 h-16 bg-gradient-to-br from-red-100 to-red-200 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-sm">
                    <MessageSquare className="h-8 w-8 text-red-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-red-600 transition-colors duration-300">Interview Prep</h3>
                  <p className="text-gray-600 text-sm mb-4 leading-relaxed min-h-[3rem]">
                    Voice-based mock interviews and practice
                  </p>
                  <Button variant="primary" size="sm" className="w-full group-hover:shadow-md transition-shadow duration-300">
                    Start Practice
                  </Button>
                </CardContent>
              </Card>
            </Link>

            <Link href="/mock-tests">
              <Card className="text-center h-full border-2 border-red-100 bg-white cursor-pointer transition-all duration-300 hover:border-red-300 hover:shadow-xl hover-lift group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-red-50/0 to-orange-50/0 group-hover:from-red-50/50 group-hover:to-orange-50/30 transition-all duration-300 pointer-events-none"></div>
                <CardContent className="p-6 relative z-10">
                  <div className="w-16 h-16 bg-gradient-to-br from-red-100 to-red-200 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-sm">
                    <BarChart3 className="h-8 w-8 text-red-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-red-600 transition-colors duration-300">Mock Tests</h3>
                  <p className="text-gray-600 text-sm mb-4 leading-relaxed min-h-[3rem]">
                    Full-length tests with performance tracking
                  </p>
                  <Button variant="primary" size="sm" className="w-full group-hover:shadow-md transition-shadow duration-300">
                    Take Test
                  </Button>
                </CardContent>
              </Card>
            </Link>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Link href="/current-affairs">
              <Card className="border-2 border-red-100 cursor-pointer transition-all duration-300 hover:border-red-300 hover:shadow-lg hover-lift group">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-red-100 to-orange-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                      <Newspaper className="h-6 w-6 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 mb-1">Current Affairs</h3>
                      <p className="text-sm text-gray-600">Exam-relevant news and updates</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-red-600 group-hover:translate-x-1 transition-all duration-300" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Card className="border-2 border-red-100 hover:border-red-300 hover:shadow-lg transition-all duration-300 hover-lift group">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-red-100 to-orange-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                    <BarChart3 className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Mock Evaluation</h3>
                    <p className="text-sm text-gray-600">AI-powered answer evaluation</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-red-100 hover:border-red-300 hover:shadow-lg transition-all duration-300 hover-lift group">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-red-100 to-orange-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                    <Languages className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">11 Languages</h3>
                    <p className="text-sm text-gray-600">Native language support</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-red-600 via-orange-600 to-red-600 animate-gradient-shift bg-[length:200%_auto]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Start Your Preparation Today
          </h2>
          <p className="text-xl text-red-50 mb-8">
            Join thousands of aspirants who trust Indicore for their competitive exam journey
          </p>
          <Button 
            variant="secondary" 
            size="lg" 
            onClick={handleGetStarted}
            className="text-lg px-8 py-6 bg-white text-red-600 hover:bg-gray-50"
          >
            Get Started Free
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      <footer className="bg-black text-gray-300 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <Logo variant="dark" showText={true} size="sm" />
            </div>
            <p className="text-sm text-gray-400">
              © {new Date().getFullYear()} Indicore. Built for exam aspirants.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
