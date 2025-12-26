'use client';

import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { User, Clock, Zap, Book } from 'lucide-react';

export default function StudyPersona({ persona, userName }) {
    if (!persona) return null;

    // Determine primary archetype for the main badge
    const primary = persona.time || { label: 'Explorer', icon: '🚀' };

    return (
        <Card className="border border-rose-100 dark:border-rose-900/30 bg-gradient-to-br from-rose-50 to-white dark:from-rose-950/40 dark:to-gray-900 shadow-md mb-6 overflow-hidden relative">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none" />

            <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-6">

                {/* Avatar / Main Identity */}
                <div className="flex-shrink-0 text-center relative z-10">
                    <div className="w-20 h-20 mx-auto bg-white dark:bg-gray-800 rounded-full shadow-lg border-2 border-rose-100 dark:border-rose-500/30 flex items-center justify-center text-4xl mb-2">
                        {primary.icon}
                    </div>
                    <Badge variant="secondary" className="bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300 border-rose-200">
                        {primary.label}
                    </Badge>
                </div>

                {/* Persona Details */}
                <div className="flex-grow text-center sm:text-left z-10">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                        Hi, {userName || 'Scholar'}!
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 max-w-md">
                        Your study history reveals your unique learning style.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {persona.time && (
                            <div className="flex items-center gap-2 p-2 bg-white/60 dark:bg-gray-800/60 rounded-lg border border-rose-50 dark:border-rose-500/10 backdrop-blur-sm">
                                <Clock className="w-4 h-4 text-rose-500" />
                                <div className="text-left">
                                    <p className="text-[10px] text-gray-500 uppercase font-bold">Time</p>
                                    <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{persona.time.label}</p>
                                </div>
                            </div>
                        )}

                        {persona.focus && (
                            <div className="flex items-center gap-2 p-2 bg-white/60 dark:bg-gray-800/60 rounded-lg border border-rose-50 dark:border-rose-500/10 backdrop-blur-sm">
                                <Zap className="w-4 h-4 text-orange-500" />
                                <div className="text-left">
                                    <p className="text-[10px] text-gray-500 uppercase font-bold">Focus</p>
                                    <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{persona.focus.label}</p>
                                </div>
                            </div>
                        )}

                        {persona.learnerType && (
                            <div className="flex items-center gap-2 p-2 bg-white/60 dark:bg-gray-800/60 rounded-lg border border-rose-50 dark:border-rose-500/10 backdrop-blur-sm">
                                <Book className="w-4 h-4 text-red-500" />
                                <div className="text-left">
                                    <p className="text-[10px] text-gray-500 uppercase font-bold">Style</p>
                                    <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{persona.learnerType.label}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
