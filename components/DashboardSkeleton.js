'use client';

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import {
    Sparkles,
    Target,
    BarChart3,
    FileText,
    TrendingUp,
    Brain,
    Award
} from 'lucide-react';

/**
 * Enhanced Dashboard Loading Skeleton
 * Matches actual dashboard layout with shimmer animations
 */
export default function DashboardSkeleton() {
    return (
        <section className="py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-rose-50/30 dark:from-gray-950 dark:to-rose-900/10 border-y border-rose-100 dark:border-rose-900/20">
            <div className="max-w-7xl mx-auto">
                {/* Header Skeleton */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-rose-500 to-red-600 rounded-lg shadow-lg shadow-rose-500/20">
                            <Sparkles className="w-5 h-5 text-white animate-pulse" />
                        </div>
                        <div>
                            <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
                            <div className="h-4 w-64 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                        </div>
                    </div>
                </div>

                {/* Persona Banner Skeleton */}
                <div className="mb-6 p-6 bg-gradient-to-r from-rose-50 to-orange-50 dark:from-rose-900/20 dark:to-orange-900/20 rounded-2xl border border-rose-200 dark:border-rose-800">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                        <div className="flex-1">
                            <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
                            <div className="h-4 w-96 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Prediction & Achievement Cards Skeleton */}
                    <SkeletonCard icon={Brain} title="Predictive Score" />
                    <SkeletonCard icon={Award} title="Achievements" />

                    {/* Weakness Map Skeleton (Full Width) */}
                    <div className="col-span-full">
                        <Card className="border-rose-100 dark:border-rose-900/30">
                            <CardHeader className="pb-4">
                                <div className="flex items-center gap-2">
                                    <Target className="w-5 h-5 text-rose-600 animate-pulse" />
                                    <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
                            </CardContent>
                        </Card>
                    </div>

                    {/* Performance Graph Skeleton */}
                    <div className="col-span-full lg:col-span-2">
                        <Card className="border-rose-100 dark:border-rose-900/30">
                            <CardHeader className="pb-4">
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-rose-600 animate-pulse" />
                                    <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="h-80 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
                            </CardContent>
                        </Card>
                    </div>

                    {/* Daily Plan Skeleton */}
                    <div className="col-span-full lg:col-span-1">
                        <SkeletonCard icon={Target} title="Daily Plan" height="h-80" />
                    </div>

                    {/* Recommendation Cards Skeleton */}
                    <SkeletonCard icon={Target} title="Practice Areas" />
                    <SkeletonCard icon={BarChart3} title="Mock Tests" />
                    <SkeletonCard icon={FileText} title="Essay Topics" />
                </div>
            </div>
        </section>
    );
}

/**
 * Reusable Skeleton Card Component
 */
function SkeletonCard({ icon: Icon, title, height = "h-64" }) {
    return (
        <Card className="border-rose-100 dark:border-rose-900/30 overflow-hidden">
            <CardHeader className="pb-3 border-b border-rose-50 dark:border-rose-900/20 bg-rose-50/30 dark:bg-rose-900/10">
                <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-rose-600 animate-pulse" />
                    <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </div>
            </CardHeader>
            <CardContent className="pt-4">
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className={`${height} bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse`}>
                            <div className="p-3 space-y-2">
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

/**
 * Shimmer Effect CSS (add to global styles or component)
 */
export const shimmerStyles = `
@keyframes shimmer {
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
}

.animate-shimmer {
  animation: shimmer 2s infinite linear;
  background: linear-gradient(
    to right,
    #f0f0f0 0%,
    #f8f8f8 20%,
    #f0f0f0 40%,
    #f0f0f0 100%
  );
  background-size: 1000px 100%;
}

.dark .animate-shimmer {
  background: linear-gradient(
    to right,
    #1f2937 0%,
    #374151 20%,
    #1f2937 40%,
    #1f2937 100%
  );
}
`;
