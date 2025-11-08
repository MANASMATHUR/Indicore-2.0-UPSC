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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
  RefreshCw,
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
  FileText,
  Languages
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

  useEffect(() => {
    const saved = localStorage.getItem('vocabBookmarks');
    if (saved) {
      setBookmarkedWords(new Set(JSON.parse(saved)));
    }
  }, []);

  useEffect(() => {
    if (bookmarkedWords.size > 0) {
      localStorage.setItem('vocabBookmarks', JSON.stringify([...bookmarkedWords]));
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
        const errorData = await response.json();
        throw new Error(errorData.error || 'Generation failed');
      }
      
      const data = await response.json();
      
      if (!data.flashcards || data.flashcards.length === 0) {
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
    const newKnown = new Set(knownWords);
    if (newKnown.has(index)) {
      newKnown.delete(index);
    } else {
      newKnown.add(index);
    }
    setKnownWords(newKnown);
  };

  const toggleBookmark = (index) => {
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
    if (currentCardIndex < flashcards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
      setShowAnswer(false);
    }
  };

  const previousCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1);
      setShowAnswer(false);
    }
  };

  const shuffleCards = () => {
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
    if (searchQuery && !card.term.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !card.definition.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filterKnown && knownWords.has(index)) {
      return false;
    }
    return true;
  });

  const currentCard = flashcards.length > 0 ? flashcards[currentCardIndex] : null;
  const progress = flashcards.length > 0 ? ((currentCardIndex + 1) / flashcards.length) * 100 : 0;
  const knownCount = knownWords.size;
  const currentCategory = examCategories.find(c => c.code === selectedCategory);
  const CategoryIcon = currentCategory?.icon || BookOpen;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-7xl h-[95vh] max-h-[95vh] p-0 overflow-hidden flex flex-col bg-white dark:bg-gray-900">
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
                {Math.round((knownCount / flashcards.length) * 100)}% mastery
              </Badge>
              <Badge variant="default" className="px-3 py-1">
                <BookmarkCheck className="h-3 w-3 mr-1.5" />
                {bookmarkedWords.size} bookmarked
              </Badge>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-950">
          {flashcards.length === 0 ? (
            // Configuration Screen
            <div className="max-w-5xl mx-auto space-y-6">
              <Tabs defaultValue="category" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-8 bg-white dark:bg-gray-800 p-1">
                  <TabsTrigger value="category" className="gap-2">
                    <BookOpen className="h-4 w-4" />
                    Category
                  </TabsTrigger>
                  <TabsTrigger value="settings" className="gap-2">
                    <Settings className="h-4 w-4" />
                    Settings
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="gap-2">
                    <FileText className="h-4 w-4" />
                    Preview
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="category" className="space-y-6 mt-6">
                  <div>
                    <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Select Subject Category</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Choose the subject area for your vocabulary study</p>
                    <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
                      {examCategories.map((category) => {
                        const Icon = category.icon;
                        return (
                          <Card
                            key={category.code}
                            className={`group cursor-pointer transition-all duration-200 hover:shadow-lg border-2 h-full ${
                              selectedCategory === category.code
                                ? `${category.selectedBorder} shadow-xl bg-gradient-to-br ${category.selectedBg}`
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                            onClick={() => setSelectedCategory(category.code)}
                          >
                            <div className="p-6 text-center flex flex-col items-center justify-between h-full min-h-[180px] rounded-2xl">
                              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${category.gradient} flex items-center justify-center mb-5 shadow-md transition-transform group-hover:-translate-y-1`}>
                                <Icon className="h-7 w-7 text-white" />
                              </div>
                              <div className="text-base font-semibold text-gray-900 dark:text-white leading-tight">
                                {category.name}
                              </div>
                              {selectedCategory === category.code && (
                                <Badge variant="primary" className="mt-4 text-xs">
                                  Selected
                                </Badge>
                              )}
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="settings" className="space-y-6 mt-6">
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <Card className="border border-gray-200 dark:border-gray-700 h-full">
                      <div className="p-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-t-2xl">
                        <div className="flex items-center gap-2 mb-1">
                          <Languages className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Languages</h3>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Select source and target languages</p>
                      </div>
                      <div className="p-6 space-y-5">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Source Language</label>
                          <select
                            value={sourceLanguage}
                            onChange={(e) => setSourceLanguage(e.target.value)}
                            className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            {supportedLanguages.map((lang) => (
                              <option key={lang.code} value={lang.code}>
                                {lang.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Target Language</label>
                          <select
                            value={targetLanguage}
                            onChange={(e) => setTargetLanguage(e.target.value)}
                            className="flex h-11 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            {supportedLanguages.map((lang) => (
                              <option key={lang.code} value={lang.code}>
                                {lang.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex items-center justify-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {supportedLanguages.find(l => l.code === sourceLanguage)?.name} → {supportedLanguages.find(l => l.code === targetLanguage)?.name}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Card>

                    <Card className="border border-gray-200 dark:border-gray-700">
                      <div className="p-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-t-2xl">
                        <div className="flex items-center gap-2 mb-1">
                          <Settings className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Study Settings</h3>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Customize your learning experience</p>
                      </div>
                      <div className="p-6 space-y-6">
                        <div className="space-y-3">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Number of Words</label>
                          <div className="grid grid-cols-4 gap-3">
                            {wordCounts.map((count) => (
                              <Button
                                key={count}
                                variant={wordCount === count ? "primary" : "outline"}
                                onClick={() => setWordCount(count)}
                                className="w-full h-12 text-base font-semibold"
                              >
                                {count}
                              </Button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-3">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Difficulty Level</label>
                          <div className="grid grid-cols-3 gap-3">
                            {difficulties.map((level) => (
                              <Card
                                key={level.code}
                                className={`cursor-pointer transition-all border-2 ${
                                  difficulty === level.code
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 shadow-md'
                                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                }`}
                                onClick={() => setDifficulty(level.code)}
                              >
                                <div className="p-4 text-center">
                                  <div className="font-semibold text-sm text-gray-900 dark:text-white mb-1">{level.name}</div>
                                  <div className="text-xs text-gray-600 dark:text-gray-400">{level.description}</div>
                                </div>
                              </Card>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="preview" className="space-y-6 mt-6">
                  <Card className="border border-gray-200 dark:border-gray-700">
                    <div className="p-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Configuration Summary</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Review your settings before generating</p>
                    </div>
                    <div className="p-6">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Category</span>
                          <Badge variant="primary">{currentCategory?.name}</Badge>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Languages</span>
                          <Badge variant="default">
                            {supportedLanguages.find(l => l.code === sourceLanguage)?.name} → {supportedLanguages.find(l => l.code === targetLanguage)?.name}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Word Count</span>
                          <Badge variant="default">{wordCount} words</Badge>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Difficulty</span>
                          <Badge variant="default">{difficulties.find(d => d.code === difficulty)?.name}</Badge>
                        </div>
                      </div>
                    </div>
                  </Card>
                </TabsContent>
              </Tabs>

              <div className="sticky bottom-0 left-0 right-0 z-10 bg-gray-50 dark:bg-gray-950 pt-4 pb-6 border-t border-gray-200 dark:border-gray-700 -mx-6 px-6">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={onClose}
                    variant="outline"
                    className="flex-1 min-w-[140px] h-12 text-base font-medium"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={generateFlashcards}
                    disabled={isGenerating}
                    variant="primary"
                    className="flex-1 min-w-[200px] h-12 text-base font-semibold shadow-lg shadow-blue-500/10"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <BookOpen className="mr-2 h-5 w-5" />
                        Generate Vocabulary
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            // Study Mode
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Controls Bar */}
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
                          <h4 className="text-6xl font-bold text-white mb-6">
                            {currentCard?.term}
                          </h4>
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
                            <h5 className="font-semibold mb-3 text-lg flex items-center gap-2 text-gray-900 dark:text-white">
                              <Award className="h-5 w-5 text-blue-600" />
                              Definition
                            </h5>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-lg">
                              {currentCard?.definition}
                            </p>
                          </div>
                          
                          <div className="bg-white/95 dark:bg-slate-950/95 rounded-xl p-6 shadow-lg">
                            <h5 className="font-semibold mb-3 text-lg flex items-center gap-2 text-gray-900 dark:text-white">
                              <Globe className="h-5 w-5 text-green-600" />
                              Translation
                            </h5>
                            <p className="text-gray-700 dark:text-gray-300 text-2xl font-medium">
                              {currentCard?.translation}
                            </p>
                          </div>
                          
                          {currentCard?.example && (
                            <div className="bg-white/95 dark:bg-slate-950/95 rounded-xl p-6 shadow-lg">
                              <h5 className="font-semibold mb-3 text-lg flex items-center gap-2 text-gray-900 dark:text-white">
                                <PlayCircle className="h-5 w-5 text-purple-600" />
                                Example
                              </h5>
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
                    const actualIndex = flashcards.indexOf(card);
                    return (
                      <Card key={actualIndex} className="hover:shadow-lg transition-all border border-gray-200 dark:border-gray-700">
                        <div className="p-6">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h4 className="text-2xl font-bold text-gray-900 dark:text-white">
                                  {card.term}
                                </h4>
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
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="font-semibold text-gray-700 dark:text-gray-300">Definition: </span>
                              <span className="text-gray-600 dark:text-gray-400">{card.definition}</span>
                            </div>
                            <div>
                              <span className="font-semibold text-gray-700 dark:text-gray-300">Translation: </span>
                              <span className="text-gray-600 dark:text-gray-400 font-medium">{card.translation}</span>
                            </div>
                            {card.example && (
                              <div>
                                <span className="font-semibold text-gray-700 dark:text-gray-300">Example: </span>
                                <span className="text-gray-600 dark:text-gray-400 italic">"{card.example}"</span>
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
      </DialogContent>
    </Dialog>
  );
}
