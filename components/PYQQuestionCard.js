'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
    Calendar,
    FileText,
    Bookmark,
    BookmarkCheck,
    Sparkles,
    TrendingUp,
    Clock,
    Target
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

export default function PYQQuestionCard({ question, index = 0, onBookmark }) {
    const router = useRouter();
    const [isBookmarked, setIsBookmarked] = useState(false);
    const [isFlipped, setIsFlipped] = useState(false);

    const getDifficultyColor = (difficulty) => {
        switch (difficulty?.toLowerCase()) {
            case 'easy':
                return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
            case 'medium':
                return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300';
            case 'hard':
                return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
            default:
                return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
        }
    };

    const getPaperColor = (paper) => {
        const paperUpper = (paper || '').toUpperCase();
        if (paperUpper.includes('GS-1') || paperUpper.includes('GS1'))
            return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
        if (paperUpper.includes('GS-2') || paperUpper.includes('GS2'))
            return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
        if (paperUpper.includes('GS-3') || paperUpper.includes('GS3'))
            return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300';
        if (paperUpper.includes('GS-4') || paperUpper.includes('GS4'))
            return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300';
        return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300';
    };

    const handleSolve = () => {
        if (!question?.question) return;

        const params = new URLSearchParams({
            question: question.question
        });

        if (question.year) params.append('year', question.year);
        if (question.paper) params.append('paper', question.paper);
        if (question.exam) params.append('exam', question.exam);
        if (question.level) params.append('level', question.level);
        if (question.theme) params.append('theme', question.theme);

        router.push(`/chat?${params.toString()}`);
    };

    const handleBookmarkToggle = () => {
        setIsBookmarked(!isBookmarked);
        if (onBookmark && question?._id) {
            onBookmark(question._id, !isBookmarked);
        }
    };

    const estimateDifficulty = () => {
        if (!question?.question) return 'Medium';
        const wordCount = question.question.split(' ').length;
        if (wordCount < 20) return 'Easy';
        if (wordCount < 40) return 'Medium';
        return 'Hard';
    };

    const difficulty = question.difficulty || estimateDifficulty();
    const marksEstimate = difficulty === 'Easy' ? '5-10' : difficulty === 'Medium' ? '10-15' : '15-20';

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="group"
        >
            <Card className="relative overflow-hidden border-2 border-transparent hover:border-lime-300 dark:hover:border-lime-700 transition-all duration-300 hover:shadow-2xl hover:shadow-lime-500/20">
                {/* Gradient Border Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-lime-500 via-green-500 to-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-xl"></div>

                <div className="relative bg-white dark:bg-gray-900 rounded-lg p-6">
                    {/* Header Section */}
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Year Badge */}
                            <Badge className="bg-gradient-to-r from-lime-500 to-green-600 text-white border-0 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {question.year}
                            </Badge>

                            {/* Paper Badge */}
                            {question.paper && (
                                <Badge className={`${getPaperColor(question.paper)} border-0 flex items-center gap-1`}>
                                    <FileText className="w-3 h-3" />
                                    {question.paper}
                                </Badge>
                            )}

                            {/* Difficulty Badge */}
                            <Badge className={`${getDifficultyColor(difficulty)} border-0`}>
                                {difficulty}
                            </Badge>

                            {/* Marks Estimate */}
                            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-0 flex items-center gap-1">
                                <Target className="w-3 h-3" />
                                {marksEstimate} marks
                            </Badge>
                        </div>

                        {/* Bookmark Button */}
                        <button
                            onClick={handleBookmarkToggle}
                            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                            {isBookmarked ? (
                                <BookmarkCheck className="w-5 h-5 text-lime-600 fill-lime-600" />
                            ) : (
                                <Bookmark className="w-5 h-5 text-gray-400 hover:text-lime-600" />
                            )}
                        </button>
                    </div>

                    {/* Question Text */}
                    <div className="mb-4">
                        <p className="text-gray-900 dark:text-white leading-relaxed text-base">
                            {question.question}
                        </p>
                    </div>

                    {/* Topic Tags */}
                    {question.topicTags && question.topicTags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-4">
                            {question.topicTags.slice(0, 4).map((tag, idx) => (
                                <span
                                    key={idx}
                                    className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs rounded-md"
                                >
                                    {tag}
                                </span>
                            ))}
                            {question.topicTags.length > 4 && (
                                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs rounded-md">
                                    +{question.topicTags.length - 4} more
                                </span>
                            )}
                        </div>
                    )}

                    {/* Footer Section */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                            {question.level && (
                                <div className="flex items-center gap-1">
                                    <TrendingUp className="w-3 h-3" />
                                    <span>{question.level}</span>
                                </div>
                            )}
                            {question.exam && (
                                <div className="flex items-center gap-1">
                                    <FileText className="w-3 h-3 text-red-500 shadow-sm" />
                                    <span className="font-bold text-red-900/80 dark:text-red-400 uppercase tracking-tighter text-[10px]">
                                        {question.exam === 'ALL_PCS' ? 'UPSC + STATE PSC' : question.exam}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Action Button */}
                        <Button
                            onClick={handleSolve}
                            size="sm"
                            className="bg-gradient-to-r from-lime-600 to-green-600 hover:from-lime-700 hover:to-green-700 text-white shadow-lg shadow-lime-500/30 hover:shadow-lime-500/50 transition-all duration-300"
                        >
                            <Sparkles className="w-4 h-4 mr-1.5" />
                            Solve with AI
                        </Button>
                    </div>

                    {/* Hover Glow Effect */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-lime-600 via-green-600 to-emerald-600 rounded-lg opacity-0 group-hover:opacity-20 blur transition-opacity duration-300 -z-10"></div>
                </div>
            </Card>
        </motion.div>
    );
}
