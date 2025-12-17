'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function PredictiveScore({ prediction }) {
    if (!prediction || prediction.predictedScore === null) return null;

    const { predictedScore, passingProbability, trend, confidenceRange, accuracy } = prediction;

    let trendIcon = <Minus className="w-4 h-4 text-gray-400" />;
    let trendText = "Stable";
    let trendColor = "gray";

    if (trend === 'improving') {
        trendIcon = <TrendingUp className="w-4 h-4 text-emerald-500" />;
        trendText = "Rising";
        trendColor = "emerald";
    } else if (trend === 'declining') {
        trendIcon = <TrendingDown className="w-4 h-4 text-red-500" />;
        trendText = "Dropping";
        trendColor = "red";
    }

    // Determine Gauge Color
    const isSafe = passingProbability > 75;
    const isRisky = passingProbability < 40;
    const gaugeColor = isSafe ? 'text-emerald-500' : (isRisky ? 'text-red-500' : 'text-amber-500');

    return (
        <Card className="border border-blue-100 dark:border-blue-900/30 bg-white dark:bg-gray-900 shadow-xl shadow-blue-500/5 h-full relative overflow-hidden">
            {/* Glossy overlay effect */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/5 to-transparent rounded-full -mr-20 -mt-20 pointer-events-none" />

            <CardHeader className="pb-2 border-b border-blue-50 dark:border-blue-900/10">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-md">
                            <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        AI Forecast
                    </CardTitle>
                    <Badge variant="outline" className={`text-[10px] bg-white border-${trendColor}-200 text-${trendColor}-600 flex gap-1 items-center`}>
                        {trendIcon} {trendText}
                    </Badge>
                </div>
            </CardHeader>

            <CardContent className="pt-6 relative z-10 text-center">
                {/* Score Big Display */}
                <div className="mb-6">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Predicted Prelims Score</p>
                    <div className="flex items-baseline justify-center gap-2">
                        <span className="text-5xl font-extrabold text-blue-600 dark:text-blue-400 tracking-tight">
                            {predictedScore}
                        </span>
                        <span className="text-sm text-gray-400 font-medium">/ 200</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                        Confidence Interval: {confidenceRange[0]} - {confidenceRange[1]}
                    </p>
                </div>

                {/* Probability Gauge */}
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Passing Probability</span>
                        <span className={`text-sm font-bold ${gaugeColor}`}>{passingProbability}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                        <div
                            className={`h-2.5 rounded-full transition-all duration-1000 ${isSafe ? 'bg-emerald-500' : (isRisky ? 'bg-red-500' : 'bg-amber-500')}`}
                            style={{ width: `${passingProbability}%` }}
                        ></div>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-2 text-left leading-relaxed">
                        Based on your {accuracy}% average accuracy and syllabus coverage.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
