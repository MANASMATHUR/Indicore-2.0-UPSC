'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import EssayEnhancement from '@/components/EssayEnhancement';
import { 
  BookOpen, 
  ArrowLeft, 
  FileText, 
  Sparkles,
  CheckCircle2,
  Loader2
} from 'lucide-react';

const essayTopics = [
  { letter: 'A', topics: ['Agriculture & Rural Development', 'Administrative Reforms', 'Arts & Culture', 'Awards & Honours', 'Accountability in Governance'] },
  { letter: 'B', topics: ['Banking & Finance', 'Biotechnology', 'Budget & Fiscal Policy', 'Biodiversity Conservation', 'Basic Rights & Duties'] },
  { letter: 'C', topics: ['Climate Change & Global Warming', 'Constitutional Values', 'Current Affairs Analysis', 'Cyber Security', 'Cooperative Federalism'] },
  { letter: 'D', topics: ['Democracy & Democratic Values', 'Development & Growth', 'Digital India Initiative', 'Disaster Management', 'Defense & National Security'] },
  { letter: 'E', topics: ['Economic Development', 'Education System Reforms', 'Environmental Conservation', 'Ethics in Public Life', 'Energy Security'] },
  { letter: 'F', topics: ['Federalism in India', 'Financial Inclusion', 'Foreign Policy & Diplomacy', 'Fundamental Rights', 'Food Security'] },
  { letter: 'G', topics: ['Good Governance', 'Globalization & Its Impact', 'Gender Equality & Women Empowerment', 'Geographical Diversity', 'Green Energy Transition'] },
  { letter: 'H', topics: ['Healthcare System', 'Historical Perspectives', 'Human Rights', 'Hunger & Malnutrition', 'Housing for All'] },
  { letter: 'I', topics: ['Indian Society & Social Change', 'International Relations', 'Innovation & Technology', 'Infrastructure Development', 'Industrial Policy'] },
  { letter: 'J', topics: ['Judicial Reforms', 'Justice & Equality', 'Job Creation & Employment', 'Journalism & Media Ethics'] },
  { letter: 'K', topics: ['Knowledge Economy', 'Kisan Welfare', 'Knowledge Society'] },
  { letter: 'L', topics: ['Legal Reforms', 'Literacy & Education', 'Local Self-Governance', 'Land Reforms & Agriculture'] },
  { letter: 'M', topics: ['Migration & Urbanization', 'Media & Democracy', 'Modernization vs Tradition', 'Monetary Policy', 'Multiculturalism in India'] },
  { letter: 'N', topics: ['National Integration', 'National Security', 'Natural Resource Management', 'Nuclear Energy Policy'] },
  { letter: 'O', topics: ['Opportunity & Equality', 'Organizational Structure', 'Oil & Energy Security', 'Outer Space Exploration'] },
  { letter: 'P', topics: ['Political System', 'Poverty Alleviation', 'Population Policy', 'Public Health System', 'Parliamentary Democracy'] },
  { letter: 'Q', topics: ['Quality in Education', 'Quantum Technology', 'Quality of Life'] },
  { letter: 'R', topics: ['Reforms & Modernization', 'Rural Development', 'Regionalism & Nationalism', 'Religious Harmony', 'Research & Development'] },
  { letter: 'S', topics: ['Science & Technology Development', 'Social Justice & Equality', 'Sustainable Development Goals', 'Sports & National Pride', 'Security Challenges'] },
  { letter: 'T', topics: ['Technology & Society', 'Trade & Commerce', 'Transport Infrastructure', 'Tourism Development', 'Terrorism & Security'] },
  { letter: 'U', topics: ['Urban Development', 'Unemployment & Skill Development', 'Universal Basic Income', 'United Nations & Global Governance'] },
  { letter: 'V', topics: ['Values & Ethics', 'Voting & Democracy', 'Village Economy', 'Vaccination & Public Health'] },
  { letter: 'W', topics: ['Women Empowerment', 'Water Resource Management', 'Welfare Schemes', 'World Peace & Cooperation'] },
  { letter: 'X', topics: ['Xenophobia & Inclusivity'] },
  { letter: 'Y', topics: ['Youth & Nation Building', 'Yoga & Wellness', 'Yearly Development Goals'] },
  { letter: 'Z', topics: ['Zero Tolerance Policy', 'Zonal Development'] }
];

export default function EssayBuilderPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isEnhancementOpen, setIsEnhancementOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedLetter, setSelectedLetter] = useState(null);
  const [isLoadingEssay, setIsLoadingEssay] = useState(false);
  const [preloadedEssay, setPreloadedEssay] = useState(null);

  const handleTopicSelect = async (topic, letter) => {
    setSelectedTopic(topic);
    setSelectedLetter(letter);
    setIsLoadingEssay(true);
    setPreloadedEssay(null);
    
    try {
      const response = await fetch('/api/essay/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, letter })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch essay');
      }

      const data = await response.json();
      setPreloadedEssay(data.essay);
    } catch (error) {
      console.error('Error fetching essay:', error);
      // Still open the modal even if essay generation fails
      setPreloadedEssay(null);
    } finally {
      setIsLoadingEssay(false);
      setIsEnhancementOpen(true);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center px-4">
        <Card className="max-w-md text-center">
          <CardContent className="p-8">
            <BookOpen className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Login Required</h2>
            <p className="text-gray-600 mb-6">Please login to access the Essay Builder tool.</p>
            <Button variant="primary" onClick={() => router.push('/chat')}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
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
              <FileText className="h-6 w-6 text-red-600" />
              <span className="text-xl font-bold text-gray-900">Essay Builder</span>
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
        <div className="max-w-7xl mx-auto text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            Essay Builder
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Comprehensive essay topics organized alphabetically for UPSC, PCS, and SSC Mains preparation. Select a topic to begin writing with AI-powered enhancement.
          </p>
        </div>
      </section>

      {/* Topics Grid */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {essayTopics.map((section) => (
              <Card key={section.letter} className="border-2 border-red-100 hover:border-red-300 hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 text-white rounded-lg flex items-center justify-center text-2xl font-bold mb-4 shadow-md">
                      {section.letter}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3">Topics</h3>
                  </div>
                  <div className="space-y-2">
                    {section.topics.map((topic) => (
                      <button
                        key={topic}
                        onClick={() => handleTopicSelect(topic, section.letter)}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center justify-between group"
                      >
                        <span>{topic}</span>
                        <FileText className="h-4 w-4 text-gray-400 group-hover:text-red-600 transition-colors" />
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Quick Start */}
          <Card className="mt-12 max-w-2xl mx-auto text-center border border-gray-200 hover:border-red-200 hover:shadow-lg transition-all">
            <CardContent className="p-8">
              <FileText className="h-10 w-10 text-red-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">Custom Essay Topic</h3>
              <p className="text-gray-600 mb-6 text-sm">
                Have a specific essay topic? Start writing and receive AI-powered enhancement with exam-specific feedback.
              </p>
              <Button variant="primary" size="md" onClick={() => setIsEnhancementOpen(true)}>
                Start Writing
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Essay Enhancement Modal */}
      <EssayEnhancement
        isOpen={isEnhancementOpen}
        onClose={() => {
          setIsEnhancementOpen(false);
          setSelectedTopic(null);
          setSelectedLetter(null);
          setPreloadedEssay(null);
        }}
        onEnhance={(enhancedText) => {
          // Handle enhanced essay
          console.log('Enhanced essay:', enhancedText);
        }}
        preloadedEssay={preloadedEssay}
        selectedTopic={selectedTopic}
        isLoadingEssay={isLoadingEssay}
      />
    </div>
  );
}

