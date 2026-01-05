'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Clock, Zap, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

export default function ResumeSession() {
    const { data: session } = useSession();
    const [resumableChat, setResumableChat] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Simulated fetch for unfinished chat
        setTimeout(() => {
            setResumableChat({
                conversation: {
                    chatId: "last-session-123",
                    lastMessage: "How does the Directive Principles of State Policy overlap with Fundamental Rights?",
                    timeSince: "45 mins ago"
                },
                recommendedAction: {
                    suggestion: "Continue exploring the Kesavananda Bharati case context."
                }
            });
            setLoading(false);
        }, 800);
    }, []);

    if (loading || !resumableChat) return null;

    return (
        <Card className="border-rose-500/10 dark:border-rose-400/10 bg-gradient-to-br from-rose-50/50 to-red-50/50 dark:from-rose-950/20 dark:to-red-950/20 shadow-lg shadow-rose-500/5 relative overflow-hidden group">
            {/* Background Decor */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl group-hover:bg-rose-500/20 transition-all pointer-events-none" />

            <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-rose-600 text-white shadow-md shadow-rose-500/20">
                        <MessageSquare className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest">Unfinished Session</span>
                        <CardTitle className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {resumableChat.conversation.timeSince}
                        </CardTitle>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
                <div className="space-y-3">
                    <div className="relative">
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight line-clamp-2 italic">
                            "{resumableChat.conversation.lastMessage}"
                        </p>
                    </div>
                    <div className="p-2 rounded-lg bg-white/60 dark:bg-gray-900/40 border border-rose-100/50 dark:border-rose-900/30">
                        <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed font-medium">
                            <span className="text-rose-600 font-bold">Smart Resume:</span> {resumableChat.recommendedAction.suggestion}
                        </p>
                    </div>
                    <Link href={`/chat?id=${resumableChat.conversation.chatId}`}>
                        <Button className="w-full h-9 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-500/20 group-hover:scale-[1.02] transition-all">
                            RESUME DISCUSSION <Zap className="w-3.5 h-3.5 ml-2 fill-current" />
                        </Button>
                    </Link>
                </div>
            </CardContent>
        </Card>
    );
}
