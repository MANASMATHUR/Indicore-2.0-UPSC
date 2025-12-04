'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import VocabularyBuilder from '@/components/VocabularyBuilder';
import EssayEnhancement from '@/components/EssayEnhancement';
import {
    ArrowLeft,
    BookMarked,
    FileText,
    Sparkles,
    Brain,
    TrendingUp,
    CheckCircle2
} from 'lucide-react';
import LanguageSelector from '@/components/LanguageSelector';
import { getLanguagePreference, saveLanguagePreference } from '@/lib/translationUtils';
import LoadingSpinner from '@/components/LoadingSpinner';

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

export default function WritingToolsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();

    // Tab management
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'essay');

    // Shared state
    const [selectedLanguage, setSelectedLanguage] = useState(getLanguagePreference());

    // Vocabulary Builder state
    const [isBuilderOpen, setIsBuilderOpen] = useState(false);

    // Essay Builder state
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
                body: JSON.stringify({
                    topic,
                    letter,
                    language: selectedLanguage
                })
            });

            if (!response.ok) {
                throw new Error('Failed to fetch essay');
            }

            const data = await response.json();
            setPreloadedEssay(data.essay);
        } catch (error) {
            console.error('Error fetching essay:', error);
            setPreloadedEssay(null);
        } finally {
            setIsLoadingEssay(false);
            setIsEnhancementOpen(true);
        }
    };

    useEffect(() => {
        if (status !== 'loading' && !session) {
            const currentPath =
                typeof window !== 'undefined'
                    ? window.location.pathname + window.location.search
                    : '/writing-tools';
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
                            <FileText className="h-6 w-6 text-red-600" />
                            <span className="text-xl font-bold text-gray-900">Writing Tools</span>
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
                        <span className="text-sm font-medium text-red-700">AI-Powered Writing Enhancement</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                        Writing Tools
                    </h1>
                    <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
                        Master exam writing with AI-powered essay building and vocabulary enhancement. Build your language skills and craft compelling essays for competitive exams.
                    </p>
                </div>

                <div className="max-w-7xl mx-auto">
                    {/* Tab Navigation */}
                    <div className="flex justify-center mb-12">
                        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
                            <button
                                onClick={() => setActiveTab('essay')}
                                className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'essay'
                                    ? 'bg-red-600 text-white shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                                    }`}
                            >
                                <FileText className="inline-block h-4 w-4 mr-2" />
                                Essay Builder
                            </button>
                            <button
                                onClick={() => setActiveTab('vocabulary')}
                                className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'vocabulary'
                                    ? 'bg-red-600 text-white shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                                    }`}
                            >
                                <BookMarked className="inline-block h-4 w-4 mr-2" />
                                Vocabulary Builder
                            </button>
                        </div>
                    </div>

                    {/* Essay Builder Tab */}
                    {activeTab === 'essay' && (
                        <div className="space-y-8">
                            <div className="text-center mb-8">
                                <h2 className="text-3xl font-bold text-gray-900 mb-3">Essay Builder</h2>
                                <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                                    Comprehensive essay topics organized alphabetically for UPSC, PCS, and SSC Mains preparation. Select a topic to begin writing with AI-powered enhancement.
                                </p>
                            </div>

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
                            <Card className="max-w-2xl mx-auto text-center border border-gray-200 hover:border-red-200 hover:shadow-lg transition-all">
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
                    )}

                    {/* Vocabulary Builder Tab */}
                    {activeTab === 'vocabulary' && (
                        <div className="space-y-8">
                            <div className="text-center mb-8">
                                <h2 className="text-3xl font-bold text-gray-900 mb-3">Vocabulary Builder</h2>
                                <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                                    Enhance your vocabulary with exam-specific words, bilingual flashcards, interactive quizzes, and contextual usage examples. Designed for competitive exam essay writing and language proficiency.
                                </p>
                                <Button
                                    variant="primary"
                                    size="lg"
                                    onClick={() => setIsBuilderOpen(true)}
                                    className="text-lg px-8 py-6 mt-6"
                                >
                                    <Brain className="mr-2 h-5 w-5" />
                                    Start Building Vocabulary
                                </Button>
                            </div>

                            {/* Features */}
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
                    )}
                </div>
            </section>

            {/* Vocabulary Builder Modal */}
            <VocabularyBuilder
                isOpen={isBuilderOpen}
                onClose={() => setIsBuilderOpen(false)}
                onAddToChat={(word, meaning) => {
                    router.push(`/chat?message=${encodeURIComponent(word)}`);
                }}
            />

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
                }}
                preloadedEssay={preloadedEssay}
                selectedTopic={selectedTopic}
                isLoadingEssay={isLoadingEssay}
            />
        </div>
    );
}
