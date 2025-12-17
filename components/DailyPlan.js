'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
    Calendar,
    CheckCircle2,
    Circle,
    Clock,
    ArrowRight,
    Lock,
    BookOpen
} from 'lucide-react';

export default function DailyPlan({ plan }) {
    if (!plan || plan.length === 0) return null;

    const getStatusIcon = (status) => {
        switch (status) {
            case 'completed': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
            case 'locked': return <Lock className="w-4 h-4 text-gray-400" />;
            default: return <Circle className="w-4 h-4 text-blue-500" />;
        }
    };

    return (
        <Card className="border border-green-100 dark:border-green-900/30 bg-white dark:bg-gray-900 shadow-lg shadow-green-500/5 h-full">
            <CardHeader className="pb-4 border-b border-green-50 dark:border-green-900/20 bg-green-50/20 dark:bg-green-900/5">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-green-600" />
                        Daily Focus Plan
                    </CardTitle>
                    <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">Today</span>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="relative">
                    {/* Vertical Line */}
                    <div className="absolute left-6 top-4 bottom-4 w-px bg-gray-200 dark:bg-gray-800" />

                    <div className="space-y-0">
                        {plan.map((item, index) => {
                            const isLocked = item.status === 'locked';
                            const isCompleted = item.status === 'completed';

                            return (
                                <div key={index} className={`relative p-4 pl-12 transition-colors ${isCompleted ? 'bg-gray-50/50 dark:bg-gray-900/50' : 'hover:bg-gray-50 dark:hover:bg-gray-800/30'
                                    }`}>
                                    {/* Timeline Node */}
                                    <div className={`absolute left-4 top-5 w-5 h-5 -ml-0.5 rounded-full border-2 flex items-center justify-center bg-white dark:bg-gray-900 z-10 ${isCompleted ? 'border-green-500' : (isLocked ? 'border-gray-300' : 'border-blue-500')
                                        }`}>
                                        {isCompleted && <div className="w-2.5 h-2.5 rounded-full bg-green-500" />}
                                        {!isCompleted && !isLocked && <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />}
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <div className="flex justify-between items-start">
                                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1">
                                                <Clock className="w-3 h-3" /> {item.time}
                                            </span>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${item.type === 'learning' ? 'bg-blue-50 text-blue-600' :
                                                    item.type === 'practice' ? 'bg-purple-50 text-purple-600' :
                                                        'bg-orange-50 text-orange-600'
                                                }`}>
                                                {item.type}
                                            </span>
                                        </div>

                                        <h4 className={`font-medium text-sm ${isCompleted ? 'text-gray-500 line-through' : 'text-gray-900 dark:text-gray-100'}`}>
                                            {item.task}
                                        </h4>

                                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                                            {item.description}
                                        </p>

                                        {!isCompleted && !isLocked && (
                                            <div className="mt-2">
                                                <Link href={item.actionUrl}>
                                                    <Button size="sm" className="h-7 text-xs w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white border-none shadow-sm shadow-green-500/20">
                                                        Start Session <ArrowRight className="w-3 h-3 ml-1" />
                                                    </Button>
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
