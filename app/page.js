'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import Logo from '@/components/Logo';
import ContactUsModal from '@/components/ContactUsModal';
import {
  BookOpen,
  Languages,
  FileText,
  Brain,
  CheckCircle2,
  Database,
  MessageSquare,
  Target,
  ArrowRight,
  BarChart3,
  FileCheck,
  MapPin,
  Newspaper,
  Sparkles,
  Zap,
  XCircle,
  Check,
  Users
} from 'lucide-react';
import PersonalizedDashboard from '@/components/PersonalizedDashboard';
import UnifiedDashboard from '@/components/UnifiedDashboard';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [showContactModal, setShowContactModal] = useState(false);

  const handleGetStarted = () => {
    if (status === 'loading') return;
    if (status === 'authenticated' && session) {
      router.push('/chat');
      return;
    }
    router.push(`/login?redirect=${encodeURIComponent('/chat')}`);
  };

  return (
    <div className="min-h-screen relative overflow-hidden font-sans selection:bg-rose-500/30">
      {/* Background Elements */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px] animate-pulse-slow mix-blend-multiply dark:mix-blend-screen" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-orange-500/10 blur-[100px] animate-pulse-slow mix-blend-multiply dark:mix-blend-screen" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-[40%] left-[20%] w-[300px] h-[300px] rounded-full bg-rose-400/10 blur-[80px] animate-float" />
      </div>

      <nav className="sticky top-0 z-50 bg-white/70 dark:bg-gray-950/70 backdrop-blur-xl border-b border-white/20 dark:border-gray-800/50 shadow-sm transition-all duration-300 supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link href="/" className="hover:opacity-80 transition-opacity relative group">
              <Logo variant="light" showText={true} size="default" />
              <div className="absolute -inset-2 bg-primary/20 rounded-lg blur opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </Link>
            <div className="flex items-center space-x-6">
              <div className="hidden md:flex items-center space-x-6 text-sm font-medium text-gray-600 dark:text-gray-300">
                <Link href="#features" className="hover:text-primary transition-colors">Features</Link>
                <Link href="#comparison" className="hover:text-primary transition-colors">Why Us</Link>
                <Link href="#tools" className="hover:text-primary transition-colors">Tools</Link>
                <button onClick={() => setShowContactModal(true)} className="hover:text-primary transition-colors">Contact</button>
              </div>
              <UnifiedDashboard />
              <Button
                variant="primary"
                size="md"
                onClick={handleGetStarted}
                disabled={status === 'loading'}
                className="shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300 hover:-translate-y-0.5"
              >
                {status === 'authenticated' ? 'Go to Chat' : 'Get Started'}
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <section className="relative pt-32 pb-40 px-4 sm:px-6 lg:px-8 z-10">
        <div className="max-w-7xl mx-auto text-center">
          <Badge variant="outline" className="mb-8 px-6 py-2 text-sm font-medium border-primary/20 text-primary bg-primary/5 backdrop-blur-md animate-fade-in-scale shadow-sm hover:bg-primary/10 transition-colors cursor-default">
            <Sparkles className="w-4 h-4 mr-2 inline-block text-orange-500 animate-pulse" />
            AI-Powered Exam Preparation
          </Badge>

          <h1 className="text-6xl md:text-8xl font-bold text-gray-900 dark:text-white mb-8 leading-[1.1] tracking-tight animate-slide-in-up font-heading">
            Your Intelligent
            <span className="block mt-2 bg-gradient-to-r from-primary via-orange-500 to-rose-600 bg-clip-text text-transparent animate-gradient-shift bg-[length:200%_auto] pb-4">
              Exam Companion
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed animate-slide-in-up font-light" style={{ animationDelay: '0.1s' }}>
            Master your competitive exams with <span className="font-semibold text-gray-900 dark:text-white">AI-driven insights</span>, comprehensive PYQs, and personalized evaluation.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center animate-slide-in-up" style={{ animationDelay: '0.2s' }}>
            <Button
              variant="primary"
              size="lg"
              onClick={handleGetStarted}
              disabled={status === 'loading'}
              className="text-lg px-10 py-7 rounded-2xl shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/50 hover:-translate-y-1 transition-all duration-300 font-semibold tracking-wide"
            >
              Start Preparing Now
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Link href="#features">
              <Button variant="outline" size="lg" className="text-lg px-10 py-7 rounded-2xl border-2 hover:bg-gray-50 dark:hover:bg-gray-900 transition-all duration-300 font-medium text-gray-600 dark:text-gray-300">
                Learn More
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Personalized Dashboard (Only shown when logged in) */}
      <PersonalizedDashboard />

      <section id="features" className="py-32 px-4 sm:px-6 lg:px-8 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-24">
            <h2 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6 font-heading tracking-tight">
              Built for <span className="text-primary">Exam Success</span>
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto font-light">
              Purpose-built tools and knowledge designed specifically for competitive exam preparation.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Database,
                title: "Comprehensive PYQ Database",
                desc: "Access thousands of verified previous year questions from UPSC, PCS, and SSC exams.",
                color: "text-rose-600",
                bg: "bg-rose-50 dark:bg-rose-900/20",
                gradient: "from-rose-500/20 to-orange-500/20"
              },
              {
                icon: Target,
                title: "Structured Frameworks",
                desc: "Get answers formatted for UPSC Mains, essay structures, and exam evaluation criteria.",
                color: "text-orange-600",
                bg: "bg-orange-50 dark:bg-orange-900/20",
                gradient: "from-orange-500/20 to-amber-500/20"
              },
              {
                icon: Languages,
                title: "Multilingual Support",
                desc: "Full support for 11 languages with native speech synthesis and context-aware translation.",
                color: "text-pink-600",
                bg: "bg-pink-50 dark:bg-pink-900/20",
                gradient: "from-pink-500/20 to-rose-500/20"
              },
              {
                icon: FileCheck,
                title: "Smart Evaluation",
                desc: "Upload your answers and get evaluated based on official marking schemes.",
                color: "text-red-600",
                bg: "bg-red-50 dark:bg-red-900/20",
                gradient: "from-red-500/20 to-orange-500/20"
              },
              {
                icon: MapPin,
                title: "State-Specific PCS",
                desc: "Tailored content for state-level PCS exams including MPSC, TNPSC, BPSC, and more.",
                color: "text-amber-600",
                bg: "bg-amber-50 dark:bg-amber-900/20",
                gradient: "from-amber-500/20 to-yellow-500/20"
              },
              {
                icon: Brain,
                title: "Subject Expertise",
                desc: "Deep coverage of Polity, History, Geography, Economics, and all major subjects.",
                color: "text-rose-700",
                bg: "bg-rose-100 dark:bg-rose-900/30",
                gradient: "from-rose-600/20 to-pink-600/20"
              }
            ].map((feature, index) => (
              <Card key={index} className="group border-0 bg-white dark:bg-gray-800 shadow-xl shadow-gray-200/50 dark:shadow-none hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-2 transition-all duration-500 overflow-hidden rounded-[2rem] relative">
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                <CardContent className="p-10 relative z-10">
                  <div className={`w-16 h-16 ${feature.bg} rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-inner`}>
                    <feature.icon className={`h-8 w-8 ${feature.color}`} />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 group-hover:text-primary transition-colors font-heading">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-lg">
                    {feature.desc}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section id="comparison" className="py-32 px-4 sm:px-6 lg:px-8 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-gray-50/50 to-white dark:from-gray-900/50 dark:to-gray-950 -z-10" />
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <Badge variant="outline" className="mb-6 px-4 py-1.5 border-primary/20 text-primary bg-primary/5">
              Why Choose Us
            </Badge>
            <h2 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6 font-heading">
              The <span className="text-primary">Indicore</span> Advantage
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              See how we stack up against traditional coaching and generic AI tools.
            </p>
          </div>

          <div className="overflow-x-auto pb-8">
            <div className="min-w-[800px] bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                    <th className="p-8 text-xl font-bold text-gray-500 dark:text-gray-400 w-1/4">Features</th>
                    <th className="p-8 text-xl font-bold text-primary w-1/4 bg-primary/5 relative">
                      <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
                      Indicore
                    </th>
                    <th className="p-8 text-xl font-bold text-gray-900 dark:text-white w-1/4">Generic AI</th>
                    <th className="p-8 text-xl font-bold text-gray-900 dark:text-white w-1/4">Traditional Coaching</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {[
                    { feature: "Exam-Specific Context", indicore: true, generic: false, coaching: true },
                    { feature: "Real-time Feedback", indicore: true, generic: true, coaching: false },
                    { feature: "Affordable Pricing", indicore: true, generic: true, coaching: false },
                    { feature: "24/7 Availability", indicore: true, generic: true, coaching: false },
                    { feature: "Personalized Roadmap", indicore: true, generic: false, coaching: true },
                    { feature: "Multilingual Support", indicore: true, generic: true, coaching: false },
                    { feature: "Updated Current Affairs", indicore: true, generic: false, coaching: true },
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="p-6 pl-8 font-medium text-gray-700 dark:text-gray-300 text-lg">{row.feature}</td>
                      <td className="p-6 text-center bg-primary/5">
                        <div className="flex justify-center">
                          <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
                            <Check className="w-5 h-5" strokeWidth={3} />
                          </div>
                        </div>
                      </td>
                      <td className="p-6 text-center">
                        <div className="flex justify-center">
                          {row.generic ? (
                            <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400">
                              <Check className="w-5 h-5" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500">
                              <XCircle className="w-5 h-5" />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-6 text-center">
                        <div className="flex justify-center">
                          {row.coaching ? (
                            <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400">
                              <Check className="w-5 h-5" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500">
                              <XCircle className="w-5 h-5" />
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section id="tools" className="py-32 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-950">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-24">
            <h2 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6 font-heading">
              Powerful <span className="text-primary">Study Tools</span>
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Everything you need in one place
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { href: "/chat", icon: MessageSquare, title: "AI Chatbot", desc: "Exam-focused conversations", btn: "Start Chatting" },
              { href: "/writing-tools", icon: FileText, title: "Writing Tools", desc: "Essay builder & vocabulary enhancement", btn: "Start Writing" },
              { href: "/pyq-archive", icon: Database, title: "PYQ Archive", desc: "Theme-organized questions", btn: "Explore PYQs" },
              { href: "/current-affairs", icon: Newspaper, title: "Current Affairs", desc: "Browse news & generate digests", btn: "View Updates" },
              { href: "/mock-tests", icon: BarChart3, title: "Mock Tests", desc: "Performance tracking", btn: "Take Test" },
              { href: "/interview-prep", icon: Users, title: "Interview Prep", desc: "DAF upload & mock interviews", btn: "Start Practice" }
            ].map((tool, index) => (
              <Link key={index} href={tool.href} className="block h-full">
                <Card className="h-full border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-2 transition-all duration-500 group rounded-[2rem] overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <CardContent className="p-10 relative z-10 flex flex-col h-full items-center text-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-3xl flex items-center justify-center mb-8 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-inner group-hover:bg-primary/10">
                      <tool.icon className="h-10 w-10 text-gray-600 dark:text-gray-300 group-hover:text-primary transition-colors" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 group-hover:text-primary transition-colors font-heading">
                      {tool.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 text-base mb-8 flex-grow leading-relaxed">
                      {tool.desc}
                    </p>
                    <Button variant="outline" size="sm" className="w-full rounded-xl py-6 text-base group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all duration-300">
                      {tool.btn}
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-32 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary via-orange-600 to-primary animate-gradient-shift bg-[length:200%_auto]" />
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10 mix-blend-overlay" />
        <div className="absolute inset-0 bg-black/10" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-5xl md:text-7xl font-bold text-white mb-8 drop-shadow-sm font-heading">
            Start Your Preparation Today
          </h2>
          <p className="text-2xl text-white/90 mb-12 max-w-2xl mx-auto font-light">
            Join thousands of aspirants who trust Indicore for their competitive exam journey.
          </p>
          <Button
            variant="secondary"
            size="lg"
            onClick={handleGetStarted}
            className="text-xl px-12 py-8 bg-white text-primary hover:bg-gray-50 shadow-2xl hover:shadow-white/20 hover:-translate-y-1 transition-all duration-300 rounded-2xl font-bold"
          >
            Get Started Free
            <ArrowRight className="ml-2 h-6 w-6" />
          </Button>
        </div>
      </section>

      <footer className="bg-gray-950 text-gray-400 py-20 px-4 sm:px-6 lg:px-8 border-t border-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-12">
            <div className="flex flex-col items-center md:items-start">
              <Logo variant="dark" showText={true} size="sm" />
              <p className="mt-6 text-base text-gray-500 max-w-xs text-center md:text-left">
                Empowering aspirants with AI-driven tools for smarter preparation.
              </p>
            </div>
            <div className="flex gap-10 text-base font-medium">
              <Link href="#" className="hover:text-white transition-colors">Privacy Policy</Link>
              <Link href="#" className="hover:text-white transition-colors">Terms of Service</Link>
              <button
                onClick={() => setShowContactModal(true)}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Contact
              </button>
            </div>
            <p className="text-base text-gray-600">
              © {new Date().getFullYear()} Indicore. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Contact Us Modal */}
      <ContactUsModal
        isOpen={showContactModal}
        onClose={() => setShowContactModal(false)}
      />
    </div>
  );
}
