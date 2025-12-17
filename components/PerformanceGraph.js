'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function PerformanceGraph({ data }) {
    if (!data || data.length < 2) {
        return (
            <Card className="border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm h-full flex flex-col items-center justify-center p-6 text-center text-gray-400">
                <TrendingUp className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">Not enough data to show trends yet.</p>
                <p className="text-xs">Take at least 2 tests to see your progress.</p>
            </Card>
        );
    }

    // Process data for graph
    // We want to show accuracy trend
    const points = data.map((d, i) => ({
        x: i,
        y: d.accuracy || 0,
        date: d.date,
        score: d.score,
        total: d.total
    }));

    // Graph dimensions
    const width = 100; // viewbox units
    const height = 50; // viewbox units
    const padding = 5;

    // Scales
    const minX = 0;
    const maxX = points.length - 1;
    const minY = 0; // Always start from 0 for accuracy
    const maxY = 100;

    const getX = (i) => padding + ((i - minX) / (maxX - minX)) * (width - 2 * padding);
    const getY = (val) => height - padding - ((val - minY) / (maxY - minY)) * (height - 2 * padding);

    // Create path
    let pathD = `M ${getX(0)} ${getY(points[0].y)}`;
    points.slice(1).forEach((p, i) => {
        // Curve smoothing (simple cubic bezier)
        const prev = points[i];
        const curr = p;
        const x0 = getX(i);
        const y0 = getY(prev.y);
        const x1 = getX(i + 1);
        const y1 = getY(curr.y);

        const cpx1 = x0 + (x1 - x0) / 2;
        const cpy1 = y0;
        const cpx2 = x0 + (x1 - x0) / 2;
        const cpy2 = y1;

        pathD += ` C ${cpx1} ${cpy1}, ${cpx2} ${cpy2}, ${x1} ${y1}`;
    });

    // Fill area path
    const areaPathD = `${pathD} L ${getX(points.length - 1)} ${height - padding} L ${getX(0)} ${height - padding} Z`;

    const currentAccuracy = points[points.length - 1].y;
    const prevAccuracy = points[points.length - 2].y;
    const diff = currentAccuracy - prevAccuracy;

    return (
        <Card className="border border-blue-100 dark:border-blue-900/30 bg-white dark:bg-gray-900 shadow-lg shadow-blue-500/5 h-full overflow-hidden">
            <CardHeader className="pb-2 border-b border-blue-50 dark:border-blue-900/10 bg-blue-50/20 dark:bg-blue-900/5">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-blue-600" />
                            Performance Trajectory
                        </CardTitle>
                    </div>
                    <div className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${diff > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                            diff < 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                        }`}>
                        {diff > 0 ? <TrendingUp className="w-3 h-3" /> : diff < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                        {Math.abs(diff)}%
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-4 pt-6">
                <div className="relative w-full aspect-[2/1]">
                    {/* Graph */}
                    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
                        {/* Grid lines */}
                        <line x1={padding} y1={getY(0)} x2={width - padding} y2={getY(0)} className="stroke-gray-100 dark:stroke-gray-800" strokeWidth="0.5" />
                        <line x1={padding} y1={getY(50)} x2={width - padding} y2={getY(50)} className="stroke-gray-100 dark:stroke-gray-800" strokeWidth="0.5" strokeDasharray="2" />
                        <line x1={padding} y1={getY(100)} x2={width - padding} y2={getY(100)} className="stroke-gray-100 dark:stroke-gray-800" strokeWidth="0.5" />

                        {/* Area Fill */}
                        <defs>
                            <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="rgb(59, 130, 246)" stopOpacity="0.2" />
                                <stop offset="100%" stopColor="rgb(59, 130, 246)" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        <path d={areaPathD} fill="url(#blueGradient)" />

                        {/* Line */}
                        <path d={pathD} fill="none" className="stroke-blue-500" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

                        {/* Points */}
                        {points.map((p, i) => (
                            <g key={i} className="group">
                                <circle
                                    cx={getX(i)}
                                    cy={getY(p.y)}
                                    r="1.5"
                                    className="fill-white stroke-blue-500 stroke-2 hover:r-2 transition-all cursor-pointer"
                                />
                                {/* Tooltip on hover (SVG constraints make this tricky, relying on simple title for now) */}
                                <title>{`${p.date}: ${p.y}% Accuracy (${p.score} score)`}</title>
                            </g>
                        ))}
                    </svg>

                    {/* Labels */}
                    <div className="flex justify-between mt-2 text-[10px] text-gray-400 font-medium px-1">
                        <span>{points[0].date}</span>
                        <span>{points[points.length - 1].date}</span>
                    </div>
                </div>

                <div className="mt-4 flex justify-between items-end">
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Current Accuracy</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{currentAccuracy}%</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Tests Taken</p>
                        <p className="text-xl font-semibold text-gray-700 dark:text-gray-300">{points.length}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
