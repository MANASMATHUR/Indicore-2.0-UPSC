'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
    BookOpen,
    CheckCircle,
    Circle,
    ChevronRight,
    ChevronDown,
    TrendingUp,
    Target,
    Award,
    Sparkles,
    Lock,
    Play
} from 'lucide-react';

import { useRouter } from 'next/navigation';

/**
 * Syllabus Progress Tracker
 * Shows exam syllabus with topic-wise progress tracking
 */
export default function SyllabusProgressTracker({ exam = 'UPSC', userProgress = {} }) {
    const router = useRouter();
    const [selectedSubject, setSelectedSubject] = useState(null);
    const [expandedTopics, setExpandedTopics] = useState(new Set());

    // UPSC Syllabus Structure (can be fetched from API)
    const syllabusData = {
        'UPSC': {
            'GS-1': {
                name: 'General Studies Paper 1',
                color: 'rose',
                topics: [
                    {
                        id: 'gs1-history',
                        name: 'Indian Heritage and Culture',
                        subtopics: [
                            'Ancient India',
                            'Medieval India',
                            'Modern India',
                            'Art and Architecture',
                            'Literature'
                        ]
                    },
                    {
                        id: 'gs1-geography',
                        name: 'Geography',
                        subtopics: [
                            'Physical Geography',
                            'Indian Geography',
                            'World Geography',
                            'Environmental Geography'
                        ]
                    },
                    {
                        id: 'gs1-society',
                        name: 'Indian Society',
                        subtopics: [
                            'Social Issues',
                            'Diversity',
                            'Women Issues',
                            'Urbanization'
                        ]
                    }
                ]
            },
            'GS-2': {
                name: 'General Studies Paper 2',
                color: 'blue',
                topics: [
                    {
                        id: 'gs2-polity',
                        name: 'Indian Polity and Governance',
                        subtopics: [
                            'Constitution',
                            'Political System',
                            'Panchayati Raj',
                            'Public Policy',
                            'Rights Issues'
                        ]
                    },
                    {
                        id: 'gs2-ir',
                        name: 'International Relations',
                        subtopics: [
                            'India and Neighbors',
                            'Bilateral Relations',
                            'International Organizations',
                            'Global Issues'
                        ]
                    }
                ]
            },
            'GS-3': {
                name: 'General Studies Paper 3',
                color: 'green',
                topics: [
                    {
                        id: 'gs3-economy',
                        name: 'Indian Economy',
                        subtopics: [
                            'Economic Development',
                            'Agriculture',
                            'Industry',
                            'Services',
                            'Banking and Finance'
                        ]
                    },
                    {
                        id: 'gs3-environment',
                        name: 'Environment and Ecology',
                        subtopics: [
                            'Biodiversity',
                            'Climate Change',
                            'Conservation',
                            'Pollution'
                        ]
                    },
                    {
                        id: 'gs3-security',
                        name: 'Security',
                        subtopics: [
                            'Internal Security',
                            'Border Management',
                            'Cyber Security',
                            'Disaster Management'
                        ]
                    }
                ]
            },
            'GS-4': {
                name: 'General Studies Paper 4',
                color: 'purple',
                topics: [
                    {
                        id: 'gs4-ethics',
                        name: 'Ethics and Integrity',
                        subtopics: [
                            'Ethics in Public Administration',
                            'Probity',
                            'Case Studies',
                            'Emotional Intelligence'
                        ]
                    }
                ]
            }
        }
    };

    const subjects = syllabusData[exam] || {};

    // Calculate progress for a topic
    const getTopicProgress = (topicId) => {
        return userProgress[topicId] || {
            completed: 0,
            total: 0,
            percentage: 0,
            lastStudied: null,
            pyqsSolved: 0,
            mockTests: 0
        };
    };

    // Calculate subject progress
    const getSubjectProgress = (subject) => {
        const topics = subject.topics;
        let totalCompleted = 0;
        let totalTopics = 0;

        topics.forEach(topic => {
            const progress = getTopicProgress(topic.id);
            totalCompleted += progress.percentage;
            totalTopics += 100;
        });

        return totalTopics > 0 ? Math.round((totalCompleted / totalTopics) * 100) : 0;
    };

    // Toggle topic expansion
    const toggleTopic = (topicId) => {
        const newExpanded = new Set(expandedTopics);
        if (newExpanded.has(topicId)) {
            newExpanded.delete(topicId);
        } else {
            newExpanded.add(topicId);
        }
        setExpandedTopics(newExpanded);
    };

    return (
        <Card className="border-rose-100 dark:border-rose-900/30 shadow-xl">
            <CardHeader className="pb-4 border-b border-rose-50 dark:border-rose-900/20 bg-gradient-to-r from-rose-50 to-orange-50 dark:from-rose-900/20 dark:to-orange-900/20">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-rose-600" />
                        <CardTitle className="text-lg">Syllabus Progress Tracker</CardTitle>
                    </div>
                    <Badge variant="outline" className="border-rose-200 text-rose-600 bg-rose-50">
                        {exam}
                    </Badge>
                </div>
            </CardHeader>

            <CardContent className="p-6">
                {/* Subject Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {Object.entries(subjects).map(([subjectKey, subject]) => {
                        const progress = getSubjectProgress(subject);
                        const isSelected = selectedSubject === subjectKey;

                        return (
                            <motion.div
                                key={subjectKey}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <div
                                    onClick={() => setSelectedSubject(isSelected ? null : subjectKey)}
                                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${isSelected
                                        ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/20'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-rose-300 dark:hover:border-rose-700'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="font-semibold text-gray-900 dark:text-white">
                                            {subjectKey}
                                        </h3>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-2xl font-bold ${progress >= 75 ? 'text-green-600' :
                                                progress >= 50 ? 'text-orange-600' :
                                                    'text-gray-400'
                                                }`}>
                                                {progress}%
                                            </span>
                                            <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${isSelected ? 'rotate-90' : ''
                                                }`} />
                                        </div>
                                    </div>

                                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                                        {subject.name}
                                    </p>

                                    {/* Progress Bar */}
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                                        <motion.div
                                            className={`h-2.5 rounded-full bg-gradient-to-r ${progress >= 75 ? 'from-green-500 to-emerald-600' :
                                                progress >= 50 ? 'from-orange-500 to-red-600' :
                                                    'from-gray-400 to-gray-500'
                                                }`}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${progress}%` }}
                                            transition={{ duration: 1, ease: 'easeOut' }}
                                        />
                                    </div>

                                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                        <Target className="w-3 h-3" />
                                        {subject.topics.length} topics
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Selected Subject Details */}
                <AnimatePresence>
                    {selectedSubject && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="border-t border-gray-200 dark:border-gray-700 pt-6"
                        >
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-rose-600" />
                                {subjects[selectedSubject].name} - Topics
                            </h3>

                            <div className="space-y-3">
                                {subjects[selectedSubject].topics.map((topic) => {
                                    const progress = getTopicProgress(topic.id);
                                    const isExpanded = expandedTopics.has(topic.id);

                                    return (
                                        <div
                                            key={topic.id}
                                            className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                                        >
                                            {/* Topic Header */}
                                            <div
                                                onClick={() => toggleTopic(topic.id)}
                                                className="p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 cursor-pointer transition-colors"
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        {progress.percentage === 100 ? (
                                                            <CheckCircle className="w-5 h-5 text-green-600" />
                                                        ) : progress.percentage > 0 ? (
                                                            <Play className="w-5 h-5 text-orange-600" />
                                                        ) : (
                                                            <Circle className="w-5 h-5 text-gray-400" />
                                                        )}
                                                        <h4 className="font-semibold text-gray-900 dark:text-white">
                                                            {topic.name}
                                                        </h4>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className={`text-sm font-bold ${progress.percentage >= 75 ? 'text-green-600' :
                                                            progress.percentage >= 50 ? 'text-orange-600' :
                                                                'text-gray-400'
                                                            }`}>
                                                            {progress.percentage}%
                                                        </span>
                                                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''
                                                            }`} />
                                                    </div>
                                                </div>

                                                {/* Topic Progress Bar */}
                                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                                                    <motion.div
                                                        className={`h-1.5 rounded-full ${progress.percentage >= 75 ? 'bg-green-600' :
                                                            progress.percentage >= 50 ? 'bg-orange-600' :
                                                                'bg-gray-400'
                                                            }`}
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${progress.percentage}%` }}
                                                        transition={{ duration: 0.8 }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Subtopics (Expanded) */}
                                            <AnimatePresence>
                                                {isExpanded && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700"
                                                    >
                                                        <div className="space-y-2 mb-4">
                                                            {topic.subtopics.map((subtopic, idx) => (
                                                                <div key={idx} className="flex items-center gap-2 text-sm">
                                                                    <div className="w-2 h-2 rounded-full bg-rose-400" />
                                                                    <span className="text-gray-700 dark:text-gray-300">{subtopic}</span>
                                                                </div>
                                                            ))}
                                                        </div>

                                                        {/* Study Stats */}
                                                        <div className="grid grid-cols-3 gap-3 mb-4">
                                                            <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                                                <div className="text-lg font-bold text-blue-600">{progress.pyqsSolved || 0}</div>
                                                                <div className="text-xs text-gray-600 dark:text-gray-400">PYQs Solved</div>
                                                            </div>
                                                            <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                                                <div className="text-lg font-bold text-green-600">{progress.mockTests || 0}</div>
                                                                <div className="text-xs text-gray-600 dark:text-gray-400">Mock Tests</div>
                                                            </div>
                                                            <div className="text-center p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                                                                <div className="text-lg font-bold text-purple-600">
                                                                    {progress.lastStudied ? 'Recent' : 'Not Started'}
                                                                </div>
                                                                <div className="text-xs text-gray-600 dark:text-gray-400">Status</div>
                                                            </div>
                                                        </div>

                                                        {/* Action Buttons */}
                                                        <div className="flex gap-2">
                                                            <Button
                                                                size="sm"
                                                                onClick={() => router.push(`/chat?topic=${encodeURIComponent(topic.name)}`)}
                                                                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white"
                                                            >
                                                                <BookOpen className="w-4 h-4 mr-2" />
                                                                Study Now
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => router.push(`/pyq-archive?search=${encodeURIComponent(topic.name)}`)}
                                                                className="flex-1 border-rose-200 hover:bg-rose-50"
                                                            >
                                                                <Target className="w-4 h-4 mr-2" />
                                                                Practice PYQs
                                                            </Button>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Overall Progress Summary */}
                <div className="mt-6 p-4 bg-gradient-to-r from-rose-50 to-orange-50 dark:from-rose-900/20 dark:to-orange-900/20 rounded-xl border border-rose-200 dark:border-rose-800">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Award className="w-5 h-5 text-rose-600" />
                            <span className="font-semibold text-gray-900 dark:text-white">Overall Progress</span>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-bold text-rose-600">
                                {Math.round(
                                    Object.values(subjects).reduce((sum, subject) => sum + getSubjectProgress(subject), 0) /
                                    Object.keys(subjects).length
                                )}%
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">Syllabus Completed</div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
