'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { History, ArrowRight } from 'lucide-react';

export default function SmartNudges({ nudges }) {
    if (!nudges || nudges.length === 0) return null;

    return (
        <Card className="border border-amber-100 dark:border-amber-900/30 bg-white dark:bg-gray-900 shadow-lg shadow-amber-500/5 h-full">
            <CardHeader className="pb-3 border-b border-amber-50 dark:border-amber-900/20 bg-amber-50/20 dark:bg-amber-900/5">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <History className="w-4 h-4 text-amber-600" />
                        Smart Reconnect
                    </CardTitle>
                </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    It's been a while. Refresh these topics to boost retention!
                </p>
                {nudges.map((nudge, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20">
                        <div>
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 line-clamp-1">
                                {nudge.topic}
                            </p>
                            <p className="text-[10px] text-amber-600/80">
                                Last seen {nudge.daysAgo} days ago
                            </p>
                        </div>
                        <Link href={nudge.actionUrl}>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-full">
                                <ArrowRight className="w-4 h-4" />
                            </Button>
                        </Link>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
