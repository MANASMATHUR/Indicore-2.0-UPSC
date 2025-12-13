'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { supportedLanguages } from '@/lib/messageUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import SpeakButton from '@/components/ui/SpeakButton';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Grid3x3,
  List,
  Bookmark,
  BookmarkCheck,
  Shuffle,
  X,
  Loader2,
  Settings,
  PlayCircle,
  TrendingUp,
  Globe,
  Award,
  FileText
} from 'lucide-react';

const examCategories = [
  { code: 'general', name: 'General Studies', icon: BookOpen, gradient: 'from-blue-600 to-blue-700', selectedBg: 'from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30', selectedBorder: 'border-blue-500' },
  { code: 'history', name: 'History', icon: FileText, gradient: 'from-amber-600 to-amber-700', selectedBg: 'from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/30', selectedBorder: 'border-amber-500' },
  { code: 'geography', name: 'Geography', icon: Globe, gradient: 'from-green-600 to-green-700', selectedBg: 'from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/30', selectedBorder: 'border-green-500' },
  { code: 'polity', name: 'Polity', icon: Award, gradient: 'from-purple-600 to-purple-700', selectedBg: 'from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/30', selectedBorder: 'border-purple-500' },
  { code: 'economics', name: 'Economics', icon: TrendingUp, gradient: 'from-emerald-600 to-emerald-700', selectedBg: 'from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/30', selectedBorder: 'border-emerald-500' },
  { code: 'science', name: 'Science', icon: FileText, gradient: 'from-cyan-600 to-cyan-700', selectedBg: 'from-cyan-50 to-cyan-100 dark:from-cyan-950/30 dark:to-cyan-900/30', selectedBorder: 'border-cyan-500' },
  { code: 'environment', name: 'Environment', icon: Globe, gradient: 'from-teal-600 to-teal-700', selectedBg: 'from-teal-50 to-teal-100 dark:from-teal-950/30 dark:to-teal-900/30', selectedBorder: 'border-teal-500' },
  { code: 'current_affairs', name: 'Current Affairs', icon: FileText, gradient: 'from-orange-600 to-orange-700', selectedBg: 'from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/30', selectedBorder: 'border-orange-500' },
  { code: 'ethics', name: 'Ethics', icon: Award, gradient: 'from-indigo-600 to-indigo-700', selectedBg: 'from-indigo-50 to-indigo-100 dark:from-indigo-950/30 dark:to-indigo-900/30', selectedBorder: 'border-indigo-500' },
  { code: 'international', name: 'International', icon: Globe, gradient: 'from-red-600 to-red-700', selectedBg: 'from-red-50 to-red-100 dark:from-red-950/30 dark:to-red-900/30', selectedBorder: 'border-red-500' }
];

const categoryPreviews = {
  general: {
    term: 'Governance',
    definition: 'Framework of institutions and processes through which public affairs are conducted.',
    example: 'Good governance ensures transparent and accountable administration at every level.'
  },
  history: {
    term: 'Harappa',
    definition: 'An Indus Valley civilisation site known for urban planning and drainage systems.',
    example: 'Archaeologists discovered standardized bricks at Harappa, indicating advanced civic planning.'
  },
  geography: {
    term: 'Monsoon',
    definition: 'A seasonal reversal in wind direction that brings heavy rainfall to the Indian subcontinent.',
    example: 'The southwest monsoon is vital for Indian agriculture and water reservoirs.'
  },
  polity: {
    term: 'Separation of Powers',
    definition: 'Distribution of legislative, executive, and judicial authority to prevent concentration of power.',
    example: 'The Indian Constitution separates powers but allows checks and balances for accountability.'
  },
  economics: {
    term: 'Fiscal Deficit',
    definition: 'Excess of government expenditure over revenue excluding borrowings.',
    example: 'Containing fiscal deficit helps maintain macroeconomic stability and investor confidence.'
  },
  science: {
    term: 'Photosynthesis',
    definition: 'Process by which green plants convert light energy into chemical energy.',
    example: 'Chlorophyll captures sunlight to transform carbon dioxide and water into glucose.'
  },
  environment: {
    term: 'Carbon Sequestration',
    definition: 'Long-term capture and storage of atmospheric carbon dioxide.',
    example: 'Mangrove forests act as natural carbon sinks by sequestering significant CO₂.'
  },
  current_affairs: {
    term: 'Digital Public Infrastructure',
    definition: 'Interoperable technology platforms enabling inclusive delivery of public services.',
    example: 'India Stack is a DPI that powers Aadhaar, UPI, and other citizen services.'
  },
  ethics: {
    term: 'Integrity',
    definition: 'Consistency between personal values and ethical actions across situations.',
    example: 'Civil servants must demonstrate integrity while handling sensitive public resources.'
  },
  international: {
    term: 'Multipolarity',
    definition: 'Global order characterised by multiple centres of power.',
    example: 'Emerging economies are reshaping global governance towards multipolarity.'
  }
};

const wordCounts = [10, 20, 30, 50];
const difficulties = [
  { code: 'beginner', name: 'Beginner', description: 'Basic vocabulary' },
  { code: 'intermediate', name: 'Intermediate', description: 'Moderate complexity' },
  { code: 'advanced', name: 'Advanced', description: 'Expert level' }
];

export default function VocabularyBuilder({ isOpen, onClose, onAddToChat }) {
  const { showToast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState('general');
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const [targetLanguage, setTargetLanguage] = useState('hi');
  const [difficulty, setDifficulty] = useState('intermediate');
  const [wordCount, setWordCount] = useState(20);
  const [isGenerating, setIsGenerating] = useState(false);
  const [flashcards, setFlashcards] = useState([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [viewMode, setViewMode] = useState('flashcards');
  const [knownWords, setKnownWords] = useState(new Set());
  const [bookmarkedWords, setBookmarkedWords] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterKnown, setFilterKnown] = useState(false);

  const sourceLanguageName = supportedLanguages.find(l => l.code === sourceLanguage)?.name || 'English';
  const targetLanguageName = supportedLanguages.find(l => l.code === targetLanguage)?.name || 'Hindi';
  const difficultyLabel = difficulties.find(d => d.code === difficulty)?.name || 'Intermediate';

  useEffect(() => {
    try {
      const saved = localStorage.getItem('vocabBookmarks');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setBookmarkedWords(new Set(parsed));
        }
      }
    } catch (error) {
      console.error('Error loading bookmarks from localStorage:', error);
    }
  }, []);

  useEffect(() => {
    try {
      if (bookmarkedWords.size > 0) {
        localStorage.setItem('vocabBookmarks', JSON.stringify([...bookmarkedWords]));
      } else {
        localStorage.removeItem('vocabBookmarks');
      }
    } catch (error) {
      console.error('Error saving bookmarks to localStorage:', error);
    }
  }, [bookmarkedWords]);


  const generateFlashcards = async () => {
    try {
      setIsGenerating(true);
      setShowAnswer(false);

      const response = await fetch('/api/ai/generate-vocabulary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: selectedCategory,
          sourceLanguage,
          targetLanguage,
          difficulty,
          count: wordCount
        }),
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }
        throw new Error(errorData.error || 'Generation failed');
      }

      let data;
      try {
        data = await response.json();
      } catch (e) {
        throw new Error('Invalid response format from server');
      }

      if (!data.flashcards || !Array.isArray(data.flashcards) || data.flashcards.length === 0) {
        throw new Error('No flashcards generated');
      }

      setFlashcards(data.flashcards);
      setCurrentCardIndex(0);
      setShowAnswer(false);
      setKnownWords(new Set());
      setViewMode('flashcards');
      showToast(`Generated ${data.flashcards.length} vocabulary words!`, { type: 'success' });
    } catch (error) {
      console.error('Error generating vocabulary:', error);
      showToast(error.message || 'Failed to generate vocabulary. Please try again.', { type: 'error' });
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleKnown = (index) => {
    if (typeof index !== 'number' || index < 0 || !flashcards.length || index >= flashcards.length) return;
    const newKnown = new Set(knownWords);
    if (newKnown.has(index)) {
      newKnown.delete(index);
    } else {
      newKnown.add(index);
    }
    setKnownWords(newKnown);
  };

  const toggleBookmark = (index) => {
    if (typeof index !== 'number' || index < 0 || !flashcards.length || index >= flashcards.length) return;
    const newBookmarks = new Set(bookmarkedWords);
    if (newBookmarks.has(index)) {
      newBookmarks.delete(index);
      showToast('Removed from bookmarks', { type: 'info' });
    } else {
      newBookmarks.add(index);
      showToast('Bookmarked!', { type: 'success' });
    }
    setBookmarkedWords(newBookmarks);
  };

  const nextCard = () => {
    if (flashcards.length > 0 && currentCardIndex >= 0 && currentCardIndex < flashcards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
      setShowAnswer(false);
    }
  };

  const previousCard = () => {
    if (flashcards.length > 0 && currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1);
      setShowAnswer(false);
    }
  };

  const shuffleCards = () => {
    if (!flashcards || !Array.isArray(flashcards) || flashcards.length === 0) return;
    const shuffled = [...flashcards].sort(() => Math.random() - 0.5);
    setFlashcards(shuffled);
    setCurrentCardIndex(0);
    setShowAnswer(false);
    showToast('Cards shuffled!', { type: 'success' });
  };

  const resetStudy = () => {
    setFlashcards([]);
    setCurrentCardIndex(0);
    setShowAnswer(false);
    setKnownWords(new Set());
  };

  const filteredFlashcards = flashcards.filter((card, index) => {
    if (!card || typeof card !== 'object') return false;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const term = card.term?.toLowerCase() || '';
      const definition = card.definition?.toLowerCase() || '';
      if (!term.includes(query) && !definition.includes(query)) {
        return false;
      }
    }
    if (filterKnown && knownWords.has(index)) {
      return false;
    }
    return true;
  });

  const currentCard = flashcards.length > 0 && currentCardIndex >= 0 && currentCardIndex < flashcards.length
    ? flashcards[currentCardIndex]
    : null;
  const progress = flashcards.length > 0 && currentCardIndex >= 0
    ? Math.min(100, Math.max(0, ((currentCardIndex + 1) / flashcards.length) * 100))
    : 0;
  const knownCount = knownWords.size;
  const currentCategory = examCategories.find(c => c.code === selectedCategory);
  const CategoryIcon = currentCategory?.icon || BookOpen;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="relative w-[98vw] max-w-[98vw] h-[95vh] max-h-[95vh] p-0 overflow-hidden flex flex-col rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${currentCategory?.gradient || 'from-blue-600 to-blue-700'} flex items-center justify-center shadow-lg`}>
                <CategoryIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-white">
                  Vocabulary Builder
                </DialogTitle>
                <DialogDescription className="text-gray-600 dark:text-gray-400 mt-1">
                  Master exam-relevant vocabulary with AI-powered flashcards
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-10 w-10 rounded-lg"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {flashcards.length > 0 && (
            <div className="flex items-center gap-3 mt-4 flex-wrap">
              <Badge variant="default" className="px-3 py-1">
                <BookOpen className="h-3 w-3 mr-1.5" />
                {flashcards.length} words
              </Badge>
              <Badge variant="default" className="px-3 py-1">
                <CheckCircle2 className="h-3 w-3 mr-1.5" />
                {knownCount} known
              </Badge>
              <Badge variant="default" className="px-3 py-1">
                <TrendingUp className="h-3 w-3 mr-1.5" />
                {flashcards.length > 0 ? Math.round((knownCount / flashcards.length) * 100) : 0}% mastery
              </Badge>
              <Badge variant="default" className="px-3 py-1">
                <BookmarkCheck className="h-3 w-3 mr-1.5" />
                {bookmarkedWords.size} bookmarked
              </Badge>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950">
          {flashcards.length === 0 ? (
            <div className="max-w-[1800px] mx-auto p-6 lg:p-8 pb-40">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
                <div className="lg:col-span-3 space-y-4">
                  <div className="mb-4">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Tap to focus</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Select a subject category</p>
                  </div>
                  <div className="space-y-2.5 max-h-[calc(95vh-280px)] overflow-y-auto pr-2 custom-scrollbar">
                    {examCategories.map((category) => {
                      const Icon = category.icon;
                      const isSelected = selectedCategory === category.code;
                      return (
                        <Card
                          key={category.code}
                          className={`group relative cursor-pointer transition-all duration-200 border-2 rounded-xl overflow-hidden ${isSelected
                            ? `${category.selectedBorder} shadow-md bg-gradient-to-br ${category.selectedBg}`
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900 hover:shadow-sm'
                            }`}
                          onClick={() => setSelectedCategory(category.code)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedCategory(category.code);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          aria-pressed={isSelected}
                        >
                          <div className="p-4 flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${category.gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                              <Icon className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                {category.name}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {isSelected ? 'Selected' : 'Tap to focus'}
                              </div>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                {/* Middle Columns - Languages and Settings */}
                <div className="lg:col-span-6 space-y-5">
                  {/* Language Selection */}
                  <Card className="border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900 shadow-sm">
                    <div className="p-5 space-y-4">
                      <div>
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1.5">Languages</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                          Pick the source and target languages for your flashcards.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">
                            Source Language
                          </label>
                          <select
                            value={sourceLanguage}
                            onChange={(e) => setSourceLanguage(e.target.value)}
                            className="w-full h-11 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            {supportedLanguages.map((lang) => (
                              <option key={lang.code} value={lang.code}>
                                {lang.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">
                            Target Language
                          </label>
                          <select
                            value={targetLanguage}
                            onChange={(e) => setTargetLanguage(e.target.value)}
                            className="w-full h-11 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            {supportedLanguages.map((lang) => (
                              <option key={lang.code} value={lang.code}>
                                {lang.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Settings */}
                  <Card className="border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900 shadow-sm">
                    <div className="p-5 space-y-5">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <Settings className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Settings</h3>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                          Fine-tune the size and complexity of your deck.
                        </p>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2.5">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">
                            Number of Words
                          </label>
                          <div className="flex gap-2.5">
                            {wordCounts.map((count) => {
                              const isActive = wordCount === count;
                              return (
                                <button
                                  key={count}
                                  onClick={() => setWordCount(count)}
                                  className={`flex-1 h-11 rounded-lg border-2 text-base font-semibold transition-all ${isActive
                                    ? 'border-blue-500 bg-blue-500 text-white shadow-sm'
                                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                                    }`}
                                  type="button"
                                >
                                  {count}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="space-y-2.5">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">
                            Difficulty Level
                          </label>
                          <div className="grid grid-cols-3 gap-2.5">
                            {difficulties.map((level) => {
                              const isActive = difficulty === level.code;
                              return (
                                <button
                                  key={level.code}
                                  onClick={() => setDifficulty(level.code)}
                                  type="button"
                                  className={`p-2.5 rounded-lg border-2 transition-all text-center ${isActive
                                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200 shadow-sm'
                                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-900/10'
                                    }`}
                                >
                                  <div className="font-semibold text-sm">{level.name}</div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Right Column - Study Summary */}
                <div className="lg:col-span-3">
                  <Card className="border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900 shadow-sm sticky top-6">
                    <div className="p-5 space-y-4">
                      <div>
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white">Study Summary</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          A quick snapshot of your current setup.
                        </p>
                      </div>
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Category</span>
                          <Badge variant="primary" className="px-2.5 py-0.5 text-xs font-semibold">
                            {currentCategory?.name || 'General Studies'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Languages</span>
                          <Badge variant="default" className="px-2.5 py-0.5 text-xs font-semibold">
                            {sourceLanguageName} → {targetLanguageName}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Word Count</span>
                          <Badge variant="default" className="px-2.5 py-0.5 text-xs font-semibold">
                            {wordCount} words
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between py-2">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Difficulty</span>
                          <Badge variant="default" className="px-2.5 py-0.5 text-xs font-semibold">
                            {difficultyLabel}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto p-6 space-y-6">
              <div className="flex items-center justify-between gap-4 flex-wrap bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <Button
                    variant={viewMode === 'flashcards' ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setViewMode('flashcards')}
                  >
                    <Grid3x3 className="h-4 w-4 mr-2" />
                    Cards
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                  >
                    <List className="h-4 w-4 mr-2" />
                    List
                  </Button>
                </div>

                <div className="flex-1 max-w-md">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <Input
                      placeholder="Search words..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant={filterKnown ? 'primary' : 'secondary'}
                    size="icon"
                    onClick={() => setFilterKnown(!filterKnown)}
                    title="Hide known words"
                  >
                    <Filter className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={shuffleCards}
                    title="Shuffle cards"
                  >
                    <Shuffle className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={resetStudy}
                    title="Reset"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Progress */}
              <div className="space-y-2 bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400 font-medium">Progress</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{currentCardIndex + 1} / {flashcards.length}</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              {/* Content Area */}
              {viewMode === 'flashcards' ? (
                <div className="space-y-6">
                  {/* Flashcard */}
                  <Card
                    className={`relative bg-gradient-to-br ${currentCategory?.gradient || 'from-blue-600 to-blue-700'} border-0 shadow-2xl cursor-pointer transition-all hover:shadow-3xl min-h-[500px] flex items-center justify-center`}
                    onClick={() => setShowAnswer(!showAnswer)}
                  >
                    <div className="p-8 text-center w-full">
                      {!showAnswer ? (
                        <>
                          <div className="flex justify-between items-start mb-6">
                            <Badge variant="default" className="bg-white/20 backdrop-blur-sm text-white border border-white/30">
                              {currentCategory?.name}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleBookmark(currentCardIndex);
                              }}
                              className="text-white hover:bg-white/20 h-8 w-8 rounded-lg"
                            >
                              {bookmarkedWords.has(currentCardIndex) ? (
                                <BookmarkCheck className="h-4 w-4 fill-white" />
                              ) : (
                                <Bookmark className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          <div className="flex items-center justify-center gap-4 mb-6">
                            <h4 className="text-6xl font-bold text-white">
                              {currentCard?.term}
                            </h4>
                            <SpeakButton
                              text={currentCard?.term}
                              language={sourceLanguage}
                              variant="icon"
                              className="bg-white/20 hover:bg-white/30 text-white p-3 rounded-full backdrop-blur-sm"
                            />
                          </div>
                          {currentCard?.pronunciation && (
                            <p className="text-2xl text-white/80 italic mb-8">
                              {currentCard.pronunciation}
                            </p>
                          )}
                          <p className="text-white/70 text-sm mt-12">
                            Click to reveal answer
                          </p>
                        </>
                      ) : (
                        <div className="space-y-4 text-left max-w-3xl mx-auto">
                          <div className="bg-white/95 dark:bg-slate-950/95 rounded-xl p-6 shadow-lg">
                            <div className="flex items-center justify-between mb-3">
                              <h5 className="font-semibold text-lg flex items-center gap-2 text-gray-900 dark:text-white">
                                <Award className="h-5 w-5 text-blue-600" />
                                Definition
                              </h5>
                              <SpeakButton
                                text={currentCard?.definition}
                                language={sourceLanguage}
                                variant="icon"
                                className="text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                              />
                            </div>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-lg">
                              {currentCard?.definition}
                            </p>
                          </div>

                          <div className="bg-white/95 dark:bg-slate-950/95 rounded-xl p-6 shadow-lg">
                            <div className="flex items-center justify-between mb-3">
                              <h5 className="font-semibold text-lg flex items-center gap-2 text-gray-900 dark:text-white">
                                <Globe className="h-5 w-5 text-green-600" />
                                Translation
                              </h5>
                              <SpeakButton
                                text={currentCard?.translation}
                                language={targetLanguage}
                                variant="icon"
                                className="text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                              />
                            </div>
                            <p className="text-gray-700 dark:text-gray-300 text-2xl font-medium">
                              {currentCard?.translation}
                            </p>
                          </div>

                          {currentCard?.example && (
                            <div className="bg-white/95 dark:bg-slate-950/95 rounded-xl p-6 shadow-lg">
                              <div className="flex items-center justify-between mb-3">
                                <h5 className="font-semibold text-lg flex items-center gap-2 text-gray-900 dark:text-white">
                                  <PlayCircle className="h-5 w-5 text-purple-600" />
                                  Example
                                </h5>
                                <SpeakButton
                                  text={currentCard.example}
                                  language={sourceLanguage}
                                  variant="icon"
                                  className="text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                                />
                              </div>
                              <p className="text-gray-700 dark:text-gray-300 italic leading-relaxed">
                                "{currentCard.example}"
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>

                  {/* Navigation */}
                  <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <Button
                      onClick={previousCard}
                      disabled={currentCardIndex === 0}
                      variant="secondary"
                      className="flex items-center gap-2"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>

                    <div className="flex gap-2">
                      <Button
                        variant={knownWords.has(currentCardIndex) ? "primary" : "secondary"}
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleKnown(currentCardIndex);
                        }}
                        className={knownWords.has(currentCardIndex) ? "bg-green-600 hover:bg-green-700" : ""}
                        title="Mark as known"
                      >
                        {knownWords.has(currentCardIndex) ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <XCircle className="h-5 w-5" />
                        )}
                      </Button>
                      <Button
                        onClick={() => setShowAnswer(!showAnswer)}
                        variant="primary"
                        size="icon"
                        title="Flip card"
                      >
                        {showAnswer ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </Button>
                    </div>

                    <Button
                      onClick={nextCard}
                      disabled={currentCardIndex === flashcards.length - 1}
                      variant="primary"
                      className="flex items-center gap-2"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                // List View
                <div className="space-y-3">
                  {filteredFlashcards.map((card, index) => {
                    const actualIndex = card && flashcards.length > 0 ? flashcards.indexOf(card) : -1;
                    if (actualIndex === -1) return null;
                    return (
                      <Card key={actualIndex} className="hover:shadow-lg transition-all border border-gray-200 dark:border-gray-700">
                        <div className="p-6">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h4 className="text-2xl font-bold text-gray-900 dark:text-white">
                                  {card.term}
                                </h4>
                                <SpeakButton
                                  text={card.term}
                                  language={sourceLanguage}
                                  variant="icon"
                                  className="text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                                />
                                {knownWords.has(actualIndex) && (
                                  <Badge variant="default" className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300">
                                    Known
                                  </Badge>
                                )}
                                {bookmarkedWords.has(actualIndex) && (
                                  <Badge variant="default" className="bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300">
                                    Bookmarked
                                  </Badge>
                                )}
                              </div>
                              {card.pronunciation && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 italic mb-3">
                                  {card.pronunciation}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => toggleKnown(actualIndex)}
                                className={knownWords.has(actualIndex) ? "text-green-600 hover:bg-green-50" : ""}
                              >
                                {knownWords.has(actualIndex) ? (
                                  <CheckCircle2 className="h-4 w-4" />
                                ) : (
                                  <XCircle className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => toggleBookmark(actualIndex)}
                                className={bookmarkedWords.has(actualIndex) ? "text-purple-600 hover:bg-purple-50" : ""}
                              >
                                {bookmarkedWords.has(actualIndex) ? (
                                  <BookmarkCheck className="h-4 w-4 fill-current" />
                                ) : (
                                  <Bookmark className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-3 text-sm">
                            <div className="flex items-start gap-2">
                              <div className="flex-1">
                                <span className="font-semibold text-gray-700 dark:text-gray-300">Definition: </span>
                                <span className="text-gray-600 dark:text-gray-400">{card.definition}</span>
                              </div>
                              <SpeakButton
                                text={card.definition}
                                language={sourceLanguage}
                                variant="icon"
                                className="flex-shrink-0 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                              />
                            </div>
                            <div className="flex items-start gap-2">
                              <div className="flex-1">
                                <span className="font-semibold text-gray-700 dark:text-gray-300">Translation: </span>
                                <span className="text-gray-600 dark:text-gray-400 font-medium">{card.translation}</span>
                              </div>
                              <SpeakButton
                                text={card.translation}
                                language={targetLanguage}
                                variant="icon"
                                className="flex-shrink-0 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                              />
                            </div>
                            {card.example && (
                              <div className="flex items-start gap-2">
                                <div className="flex-1">
                                  <span className="font-semibold text-gray-700 dark:text-gray-300">Example: </span>
                                  <span className="text-gray-600 dark:text-gray-400 italic">"{card.example}"</span>
                                </div>
                                <SpeakButton
                                  text={card.example}
                                  language={sourceLanguage}
                                  variant="icon"
                                  className="flex-shrink-0 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                  {filteredFlashcards.length === 0 && (
                    <Card className="p-12 text-center border border-gray-200 dark:border-gray-700">
                      <p className="text-gray-500 dark:text-gray-400">
                        No words found matching your search.
                      </p>
                    </Card>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Fixed Bottom Action Bar - Only show when no flashcards */}
        {flashcards.length === 0 && (
          <div className="flex-shrink-0 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-t border-green-200/60 dark:border-green-800/30 px-6 py-4 shadow-lg">
            <div className="max-w-[1800px] mx-auto flex flex-col sm:flex-row gap-4 sm:items-center">
              <div className="text-sm text-gray-700 dark:text-gray-200 text-center sm:text-left sm:flex-1 font-medium">
                Ready to learn {wordCount} words in {targetLanguageName} ({difficultyLabel})?
              </div>
              <div className="flex gap-3 sm:flex-none">
                <Button
                  onClick={onClose}
                  variant="outline"
                  className="flex-1 sm:flex-none sm:min-w-[110px] h-10 text-sm font-medium bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-300 dark:border-gray-600"
                >
                  Cancel
                </Button>
                <Button
                  onClick={generateFlashcards}
                  disabled={isGenerating}
                  variant="primary"
                  className="flex-1 sm:flex-none sm:min-w-[180px] h-10 text-sm font-semibold shadow-md hover:shadow-lg transition-all"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <BookOpen className="mr-2 h-4 w-4" />
                      Generate Vocabulary
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
