'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Award, Lock } from 'lucide-react';

export default function AchievementWall({ achievements }) {
    // Define some placeholders to fill the grid if user has few achievements
    const totalSlots = 4;
    const placeholders = Array(Math.max(0, totalSlots - (achievements?.length || 0))).fill({ locked: true });

    const displayItems = [...(achievements || []), ...placeholders];

    return (
        <Card className="border border-purple-100 dark:border-purple-900/30 bg-white dark:bg-gray-900 shadow-xl shadow-purple-500/5 h-full">
            <CardHeader className="pb-3 border-b border-purple-50 dark:border-purple-900/20 bg-purple-50/20 dark:bg-purple-900/5">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Award className="w-4 h-4 text-purple-600" />
                        Hall of Fame
                    </CardTitle>
                    <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
                        {achievements?.length || 0} Unlocked
                    </span>
                </div>
            </CardHeader>
            <CardContent className="pt-4">
                <div className="grid grid-cols-4 gap-3">
                    {displayItems.map((item, i) => (
                        <div key={i} className="flex flex-col items-center group relative">
                            <div className={`
                                w-12 h-12 rounded-full flex items-center justify-center text-xl mb-2 transition-all duration-300
                                ${item.locked
                                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-300 border border-dashed border-gray-300 dark:border-gray-700'
                                    : `bg-${item.color || 'blue'}-50 text-${item.color || 'blue'}-600 border border-${item.color || 'blue'}-200 shadow-sm group-hover:scale-110`
                                }
                            `}>
                                {item.locked ? <Lock className="w-4 h-4" /> : item.icon}
                            </div>

                            {!item.locked && (
                                <div className="absolute -bottom-12 opacity-0 group-hover:opacity-100 transition-opacity z-50 bg-gray-900 text-white text-[10px] p-2 rounded shadow-lg w-24 text-center pointer-events-none">
                                    <p className="font-bold mb-0.5">{item.title}</p>
                                    <p className="text-gray-300 leading-tight">{item.description}</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                {(!achievements || achievements.length === 0) && (
                    <p className="text-center text-xs text-gray-500 mt-4">
                        Keep studying to unlock your first badge!
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
