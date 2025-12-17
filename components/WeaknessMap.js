'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'; // Assuming these exist per PersonalizedDashboard.js
import { Button } from '@/components/ui/Button'; // Assuming existing
import {
    Target,
    Zap,
    PenTool,
    TrendingUp,
    AlertCircle,
    CheckCircle2,
    ArrowRight,
    Map as MapIcon
} from 'lucide-react';

export default function WeaknessMap({ data }) {
    if (!data || data.length === 0) return null;

    // Helper to get icon component
    const getIcon = (iconName) => {
        switch (iconName) {
            case 'target': return <Target className="w-4 h-4" />;
            case 'zap': return <Zap className="w-4 h-4" />;
            case 'pen': return <PenTool className="w-4 h-4" />;
            default: return <Target className="w-4 h-4" />;
        }
    };

    // Helper for status colors
    const getStatusColor = (status) => {
        switch (status) {
            case 'critical': return 'text-red-500 bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-900/50 dark:text-red-400';
            case 'moderate': return 'text-yellow-600 bg-yellow-50 border-yellow-100 dark:bg-yellow-900/20 dark:border-yellow-900/50 dark:text-yellow-400';
            case 'improving': return 'text-green-600 bg-green-50 border-green-100 dark:bg-green-900/20 dark:border-green-900/50 dark:text-green-400';
            default: return 'text-gray-500 bg-gray-50';
        }
    };

    const getProgressBarColor = (status) => {
        switch (status) {
            case 'critical': return 'bg-red-500';
            case 'moderate': return 'bg-yellow-500';
            case 'improving': return 'bg-green-500';
            default: return 'bg-gray-300';
        }
    };

    return (
        <Card className="border border-indigo-100 dark:border-indigo-900/30 bg-white dark:bg-gray-900 shadow-xl shadow-indigo-500/5 overflow-hidden">
            <CardHeader className="pb-4 border-b border-indigo-50 dark:border-indigo-900/20 bg-indigo-50/30 dark:bg-indigo-900/10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg text-indigo-600 dark:text-indigo-400">
                            <MapIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <CardTitle className="text-lg text-gray-900 dark:text-gray-100">Strategic Knowledge Map</CardTitle>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Targeted actions to improve your weak areas</p>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {data.map((item, index) => (
                        <div key={index} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                            <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center mb-3">
                                <div>
                                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                        {item.topic}
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full border border-current capitalize font-medium ${getStatusColor(item.status)}`}>
                                            {item.status}
                                        </span>
                                    </h4>
                                    <div className="flex items-center gap-4 mt-1">
                                        <div className="text-xs text-gray-500">
                                            Accuracy: <span className="font-medium text-gray-900 dark:text-gray-200">{item.accuracy}%</span>
                                        </div>
                                        {item.metrics && (
                                            <div className="text-xs text-gray-500">
                                                Questions: <span className="font-medium text-gray-900 dark:text-gray-200">{item.metrics.questionsAttemped || 0}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Progress Bar Visual */}
                                <div className="w-full sm:w-32 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${getProgressBarColor(item.status)}`}
                                        style={{ width: `${Math.max(5, item.accuracy)}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-wrap gap-2 mt-3">
                                {item.actions.map((action, i) => (
                                    <Link key={i} href={action.url} className="flex-1 min-w-[120px]">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full justify-between text-xs h-8 border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400"
                                        >
                                            <span className="flex items-center gap-1.5">
                                                {getIcon(action.icon)}
                                                {action.label}
                                            </span>
                                            <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </Button>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-3 bg-gray-50 dark:bg-gray-800/30 text-center border-t border-gray-100 dark:border-gray-800">
                    <p className="text-xs text-gray-500">
                        Consistent practice on these topics will improve your overall score significantly.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
