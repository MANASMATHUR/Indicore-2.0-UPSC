'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import VocabularyBuilder from '@/components/VocabularyBuilder';
import { 
  ArrowLeft, 
  BookMarked,
  Sparkles,
  Brain,
  TrendingUp,
  Languages
} from 'lucide-react';
import LanguageSelector from '@/components/LanguageSelector';
import { getLanguagePreference, saveLanguagePreference } from '@/lib/translationUtils';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function VocabularyBuilderPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(getLanguagePreference());

  useEffect(() => {
    if (status !== 'loading' && !session) {
      const currentPath =
        typeof window !== 'undefined'
          ? window.location.pathname + window.location.search
          : '/vocabulary-builder';
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
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2">
              <ArrowLeft className="h-5 w-5 text-gray-600" />
              <span className="text-lg font-medium text-gray-700">Back to Home</span>
            </Link>
            <div className="flex items-center space-x-2">
              <BookMarked className="h-6 w-6 text-red-600" />
              <span className="text-xl font-bold text-gray-900">Vocabulary Builder</span>
            </div>
            <div className="flex items-center gap-3">
              <LanguageSelector
                selectedLanguage={selectedLanguage}
                onLanguageChange={(lang) => {
                  setSelectedLanguage(lang);
                  saveLanguagePreference(lang);
                }}
                showLabel={false}
                size="sm"
                variant="primary"
              />
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
            <span className="text-sm font-medium text-red-700">AI-Powered Vocabulary Learning</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Master Exam Vocabulary
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Enhance your vocabulary with exam-specific words, bilingual flashcards, interactive quizzes, and contextual usage examples. Designed for competitive exam essay writing and language proficiency.
          </p>
          <Button 
            variant="primary" 
            size="lg"
            onClick={() => setIsBuilderOpen(true)}
            className="text-lg px-8 py-6"
          >
            <Brain className="mr-2 h-5 w-5" />
            Start Building Vocabulary
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Card className="p-6 text-center border-2 border-blue-100">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <BookMarked className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Interactive Flashcards</h3>
              <p className="text-gray-600 text-sm">
                Flip through beautifully designed flashcards with definitions, translations, and examples
              </p>
            </Card>

            <Card className="p-6 text-center border-2 border-green-100">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Track Progress</h3>
              <p className="text-gray-600 text-sm">
                Mark words as known, bookmark favorites, and track your learning progress
              </p>
            </Card>

            <Card className="p-6 text-center border-2 border-purple-100">
              <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Brain className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Smart Learning</h3>
              <p className="text-gray-600 text-sm">
                AI-generated vocabulary tailored to your exam category and difficulty level
              </p>
            </Card>
          </div>

          {/* Info Cards */}
          <Card className="p-6 bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-100">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Key Features</h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-700">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-red-600 rounded-full mt-2"></div>
                <div>
                  <strong>10 Subject Categories:</strong> General Studies, History, Geography, Polity, Economics, Science, Environment, Current Affairs, Ethics, International Relations
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-red-600 rounded-full mt-2"></div>
                <div>
                  <strong>Bilingual Support:</strong> Learn vocabulary in 11 languages with accurate translations
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-red-600 rounded-full mt-2"></div>
                <div>
                  <strong>Customizable:</strong> Choose word count (10, 20, 30, 50) and difficulty level
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-red-600 rounded-full mt-2"></div>
                <div>
                  <strong>Multiple Views:</strong> Switch between flashcard and list view for different study styles
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-red-600 rounded-full mt-2"></div>
                <div>
                  <strong>Search & Filter:</strong> Quickly find words and filter out known vocabulary
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-red-600 rounded-full mt-2"></div>
                <div>
                  <strong>Bookmark System:</strong> Save important words for later review
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Vocabulary Builder Modal */}
      <VocabularyBuilder
        isOpen={isBuilderOpen}
        onClose={() => setIsBuilderOpen(false)}
        onAddToChat={(word, meaning) => {
          // Handle adding to chat if needed
          router.push(`/chat?message=${encodeURIComponent(word)}`);
        }}
      />
    </div>
  );
}
