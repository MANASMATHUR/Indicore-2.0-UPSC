'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { TrendingUp, TrendingDown, Minus, Flame, Target } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PYQHeatMap({ questions = [] }) {
    const [heatmapData, setHeatmapData] = useState({});
    const [selectedCell, setSelectedCell] = useState(null);
    const [topicTrends, setTopicTrends] = useState([]);

    const topics = [
        'Polity',
        'History',
        'Geography',
        'Economics',
        'Science & Tech',
        'Environment',
        'Current Affairs',
        'Ethics'
    ];

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 10 }, (_, i) => currentYear - 9 + i);

    useEffect(() => {
        if (questions.length > 0) {
            generateHeatmapData();
            calculateTrends();
        }
    }, [questions]);

    const generateHeatmapData = () => {
        const data = {};

        // Initialize data structure
        topics.forEach(topic => {
            data[topic] = {};
            years.forEach(year => {
                data[topic][year] = 0;
            });
        });

        // Count questions by topic and year
        questions.forEach(q => {
            const year = q.year;
            if (year && year >= years[0] && year <= years[years.length - 1]) {
                // Determine topic from tags or paper
                let topic = 'Current Affairs'; // default

                if (q.topicTags && q.topicTags.length > 0) {
                    const tags = q.topicTags.join(' ').toLowerCase();
                    if (tags.includes('polity') || tags.includes('constitution')) topic = 'Polity';
                    else if (tags.includes('history')) topic = 'History';
                    else if (tags.includes('geography')) topic = 'Geography';
                    else if (tags.includes('econom')) topic = 'Economics';
                    else if (tags.includes('science') || tags.includes('tech')) topic = 'Science & Tech';
                    else if (tags.includes('environment') || tags.includes('ecology')) topic = 'Environment';
                    else if (tags.includes('ethics')) topic = 'Ethics';
                }

                if (data[topic] && data[topic][year] !== undefined) {
                    data[topic][year]++;
                }
            }
        });

        setHeatmapData(data);
    };

    const calculateTrends = () => {
        const trends = [];

        topics.forEach(topic => {
            const recentYears = years.slice(-3);
            const olderYears = years.slice(0, 3);

            const recentCount = questions.filter(q => {
                const matchesTopic = q.topicTags?.join(' ').toLowerCase().includes(topic.toLowerCase().split(' ')[0]);
                return matchesTopic && recentYears.includes(q.year);
            }).length;

            const olderCount = questions.filter(q => {
                const matchesTopic = q.topicTags?.join(' ').toLowerCase().includes(topic.toLowerCase().split(' ')[0]);
                return matchesTopic && olderYears.includes(q.year);
            }).length;

            const avgRecent = recentCount / recentYears.length;
            const avgOlder = olderCount / olderYears.length;
            const change = avgOlder > 0 ? ((avgRecent - avgOlder) / avgOlder) * 100 : 0;

            trends.push({
                topic,
                change: Math.round(change),
                trend: change > 10 ? 'up' : change < -10 ? 'down' : 'stable',
                recentCount
            });
        });

        setTopicTrends(trends.sort((a, b) => Math.abs(b.change) - Math.abs(a.change)));
    };

    const getMaxCount = () => {
        let max = 0;
        Object.values(heatmapData).forEach(yearData => {
            Object.values(yearData).forEach(count => {
                if (count > max) max = count;
            });
        });
        return max;
    };

    const getHeatColor = (count) => {
        const max = getMaxCount();
        if (max === 0) return 'bg-gray-100';

        const intensity = count / max;

        if (intensity === 0) return 'bg-gray-100 hover:bg-gray-200';
        if (intensity < 0.2) return 'bg-blue-100 hover:bg-blue-200';
        if (intensity < 0.4) return 'bg-blue-300 hover:bg-blue-400';
        if (intensity < 0.6) return 'bg-orange-300 hover:bg-orange-400';
        if (intensity < 0.8) return 'bg-orange-500 hover:bg-orange-600';
        return 'bg-red-600 hover:bg-red-700';
    };

    const getTextColor = (count) => {
        const max = getMaxCount();
        const intensity = count / max;
        return intensity > 0.6 ? 'text-white' : 'text-gray-900';
    };

    return (
        <div className="space-y-6">
            {/* Heat Map */}
            <Card className="border-lime-100 dark:border-lime-900/30 shadow-xl rounded-2xl overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-lime-50 to-green-50 dark:from-lime-950/30 dark:to-green-950/30">
                    <CardTitle className="flex items-center gap-2">
                        <Target className="w-5 h-5 text-lime-600" />
                        Question Frequency Heat Map
                    </CardTitle>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Visualize question distribution across topics and years
                    </p>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="overflow-x-auto">
                        <div className="min-w-[800px]">
                            {/* Year Headers */}
                            <div className="flex mb-2">
                                <div className="w-32 flex-shrink-0"></div>
                                {years.map(year => (
                                    <div key={year} className="flex-1 text-center">
                                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                                            {year}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Heat Map Grid */}
                            <div className="space-y-1">
                                {topics.map(topic => (
                                    <div key={topic} className="flex items-center gap-2">
                                        <div className="w-32 flex-shrink-0">
                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                {topic}
                                            </span>
                                        </div>
                                        <div className="flex-1 flex gap-1">
                                            {years.map(year => {
                                                const count = heatmapData[topic]?.[year] || 0;
                                                return (
                                                    <motion.button
                                                        key={`${topic}-${year}`}
                                                        whileHover={{ scale: 1.1 }}
                                                        whileTap={{ scale: 0.95 }}
                                                        onClick={() => setSelectedCell({ topic, year, count })}
                                                        className={`flex-1 aspect-square rounded-md transition-all duration-200 flex items-center justify-center text-xs font-semibold ${getHeatColor(count)} ${getTextColor(count)}`}
                                                        title={`${topic} ${year}: ${count} questions`}
                                                    >
                                                        {count > 0 ? count : ''}
                                                    </motion.button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Legend */}
                            <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <span className="text-xs text-gray-600 dark:text-gray-400">Less</span>
                                <div className="flex gap-1">
                                    {['bg-gray-100', 'bg-blue-100', 'bg-blue-300', 'bg-orange-300', 'bg-orange-500', 'bg-red-600'].map((color, idx) => (
                                        <div key={idx} className={`w-6 h-6 rounded ${color}`}></div>
                                    ))}
                                </div>
                                <span className="text-xs text-gray-600 dark:text-gray-400">More</span>
                            </div>

                            {/* Selected Cell Info */}
                            {selectedCell && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mt-4 p-4 bg-lime-50 dark:bg-lime-950/30 rounded-lg border border-lime-200 dark:border-lime-800"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-semibold text-gray-900 dark:text-white">
                                                {selectedCell.topic} - {selectedCell.year}
                                            </p>
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                                {selectedCell.count} question{selectedCell.count !== 1 ? 's' : ''} asked
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setSelectedCell(null)}
                                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Topic Trends */}
            <Card className="border-green-100 dark:border-green-900/30 shadow-xl rounded-2xl overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-green-50 to-lime-50 dark:from-green-950/30 dark:to-lime-950/30">
                    <CardTitle className="flex items-center gap-2">
                        <Flame className="w-5 h-5 text-orange-600" />
                        Topic Trends
                    </CardTitle>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Trending topics based on recent question patterns
                    </p>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="space-y-3">
                        {topicTrends.map((trend, idx) => (
                            <motion.div
                                key={trend.topic}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                                <div className="flex items-center gap-3 flex-1">
                                    <div className="w-8 h-8 rounded-full bg-white dark:bg-gray-900 flex items-center justify-center text-sm font-bold text-gray-600 dark:text-gray-400">
                                        {idx + 1}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-semibold text-gray-900 dark:text-white">
                                            {trend.topic}
                                        </p>
                                        <p className="text-xs text-gray-600 dark:text-gray-400">
                                            {trend.recentCount} questions in last 3 years
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {trend.trend === 'up' && (
                                        <>
                                            <TrendingUp className="w-5 h-5 text-green-600" />
                                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-0">
                                                +{trend.change}%
                                            </Badge>
                                        </>
                                    )}
                                    {trend.trend === 'down' && (
                                        <>
                                            <TrendingDown className="w-5 h-5 text-red-600" />
                                            <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-0">
                                                {trend.change}%
                                            </Badge>
                                        </>
                                    )}
                                    {trend.trend === 'stable' && (
                                        <>
                                            <Minus className="w-5 h-5 text-gray-600" />
                                            <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-0">
                                                Stable
                                            </Badge>
                                        </>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
