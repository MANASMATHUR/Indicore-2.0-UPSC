'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
    Send,
    Map,
    Database,
    FileText,
    CheckCircle2,
    AlertCircle,
    ArrowRight,
    TrendingUp,
    Award,
    BookOpen
} from 'lucide-react';

export default function MainsEvaluator() {
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const handleEvaluate = async () => {
        if (!question || !answer) return;
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const res = await fetch('/api/ai/evaluate-mains', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question, answer })
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setResult(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8 min-h-screen bg-transparent relative z-10">
            <div className="flex flex-col gap-4">
                <Badge variant="outline" className="w-fit border-rose-200 text-rose-600 bg-rose-50/50">
                    <BookOpen className="w-3 h-3 mr-2" />
                    Advanced AI Evaluator
                </Badge>
                <h1 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white leading-tight">
                    Mains Answer <span className="text-rose-600">Structural Lab</span>
                </h1>
                <p className="text-gray-600 dark:text-gray-400 max-w-2xl text-lg">
                    Get evaluated on the "skeleton" of your answer. Move beyond simple correction to structural mastery.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Input Section */}
                <div className="space-y-6">
                    <Card className="border-rose-100 dark:border-rose-900/30 shadow-xl overflow-hidden">
                        <CardHeader className="bg-gradient-to-r from-rose-50 to-orange-50 dark:from-rose-900/20 dark:to-orange-900/20 border-b border-rose-100 dark:border-rose-800/30">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <FileText className="w-5 h-5 text-rose-600" />
                                Input Your Answer
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Question</label>
                                <textarea
                                    placeholder="Paste the UPSC question here..."
                                    className="w-full min-h-[100px] p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-rose-500 transition-all font-serif resize-none"
                                    value={question}
                                    onChange={(e) => setQuestion(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Your Answer</label>
                                <textarea
                                    placeholder="Type or paste your detailed answer here..."
                                    className="w-full min-h-[300px] p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-rose-500 transition-all font-serif"
                                    value={answer}
                                    onChange={(e) => setAnswer(e.target.value)}
                                />
                            </div>
                            <Button
                                onClick={handleEvaluate}
                                disabled={loading || !question || !answer}
                                className="w-full py-6 text-lg rounded-xl bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-200"
                            >
                                {loading ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Analyzing Structure...
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <Send className="w-5 h-5" />
                                        Analyze Answer
                                    </div>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Results Section */}
                <div className="space-y-6">
                    <AnimatePresence mode="wait">
                        {!result && !loading && !error && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="h-full flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-[2rem] bg-gray-50/50 dark:bg-gray-900/30"
                            >
                                <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center mb-6">
                                    <Award className="w-10 h-10 text-rose-300" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-400">Analysis Waiting</h3>
                                <p className="text-gray-400 max-w-xs mt-2 text-sm italic">
                                    "The structure of an answer is as important as the content itself."
                                </p>
                            </motion.div>
                        )}

                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-6 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-2xl flex items-start gap-4"
                            >
                                <AlertCircle className="w-6 h-6 text-red-600 shrink-0" />
                                <div>
                                    <h4 className="font-bold text-red-900 dark:text-red-400">Analysis Failed</h4>
                                    <p className="text-red-700 dark:text-red-500 text-sm mt-1">{error}</p>
                                </div>
                            </motion.div>
                        )}

                        {result && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="space-y-6"
                            >
                                {/* Score Summary */}
                                <div className="grid grid-cols-2 gap-4">
                                    <Card className="border-none bg-rose-600 text-white shadow-xl">
                                        <CardContent className="p-6 text-center">
                                            <div className="text-sm opacity-80 mb-1">Overall Score</div>
                                            <div className="text-5xl font-black">{result.score.total}<span className="text-2xl opacity-50">/10</span></div>
                                        </CardContent>
                                    </Card>
                                    <Card className="border-none bg-orange-500 text-white shadow-xl">
                                        <CardContent className="p-6 text-center">
                                            <div className="text-sm opacity-80 mb-1">Visualization</div>
                                            <div className="flex justify-center mt-2">
                                                <Map className="w-10 h-10" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Score Breakdown Bars */}
                                <Card className="border-rose-100 dark:border-rose-900/30">
                                    <CardContent className="p-6 space-y-4">
                                        {[
                                            { label: 'Introduction', score: result.score.intro, max: 2, color: 'bg-blue-500' },
                                            { label: 'Body Mastery', score: result.score.body, max: 6, color: 'bg-emerald-500' },
                                            { label: 'Conclusion', score: result.score.conclusion, max: 2, color: 'bg-purple-500' }
                                        ].map((item, idx) => (
                                            <div key={idx} className="space-y-1.5">
                                                <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-gray-500">
                                                    <span>{item.label}</span>
                                                    <span>{item.score}/{item.max}</span>
                                                </div>
                                                <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${(item.score / item.max) * 100}%` }}
                                                        className={`h-full ${item.color}`}
                                                        transition={{ duration: 1, delay: idx * 0.1 }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>

                                {/* Detailed Feedback Tabs (Simple list for now) */}
                                <Card className="border-rose-100 dark:border-rose-900/30 overflow-hidden">
                                    <CardHeader className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                                        <CardTitle className="text-md flex items-center gap-2">
                                            <TrendingUp className="w-5 h-5 text-rose-600" />
                                            Structural Feedback
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-6 space-y-4 text-sm leading-relaxed">
                                        <div className="p-3 bg-blue-50/50 dark:bg-blue-900/10 border-l-4 border-blue-500 rounded-r-lg">
                                            <p className="font-bold text-blue-900 dark:text-blue-400 mb-1">Intro Analysis</p>
                                            {result.feedback.intro}
                                        </div>
                                        <div className="p-3 bg-emerald-50/50 dark:bg-emerald-900/10 border-l-4 border-emerald-500 rounded-r-lg">
                                            <p className="font-bold text-emerald-900 dark:text-emerald-400 mb-1">Body Strategy</p>
                                            {result.feedback.body}
                                        </div>
                                        <div className="p-3 bg-purple-50/50 dark:bg-purple-900/10 border-l-4 border-purple-500 rounded-r-lg">
                                            <p className="font-bold text-purple-900 dark:text-purple-400 mb-1">Closing Quality</p>
                                            {result.feedback.conclusion}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Value Addition */}
                                <Card className="border-rose-100 dark:border-rose-900/30 bg-gradient-to-br from-white to-rose-50/30 dark:from-gray-900 dark:to-rose-950/20">
                                    <CardHeader>
                                        <CardTitle className="text-md flex items-center gap-2">
                                            <Database className="w-5 h-5 text-rose-600" />
                                            Value Addition Goldmine
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-6 space-y-6">
                                        <div className="space-y-2">
                                            <p className="text-xs font-black uppercase text-rose-600">Specific Data/Reports</p>
                                            <div className="flex flex-wrap gap-2">
                                                {result.valueAddition.dataPoints.map((dp, i) => (
                                                    <Badge key={i} className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-rose-200">{dp}</Badge>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-xs font-black uppercase text-rose-600">Articles & Case Laws</p>
                                            <div className="flex flex-wrap gap-2">
                                                {result.valueAddition.articles_cases.map((ac, i) => (
                                                    <Badge key={i} className="bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border-none">{ac}</Badge>
                                                ))}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Visual Suggestion */}
                                <div className="p-6 bg-orange-50 dark:bg-orange-900/10 border-2 border-orange-200 dark:border-orange-800/30 rounded-3xl">
                                    <div className="flex items-center gap-3 mb-3">
                                        <Map className="w-6 h-6 text-orange-600" />
                                        <h4 className="font-bold text-orange-900 dark:text-orange-400">Diagram/Map Suggestion</h4>
                                    </div>
                                    <p className="text-sm text-orange-800 dark:text-orange-300 leading-relaxed italic">
                                        "{result.visualSuggestions}"
                                    </p>
                                </div>

                                <div className="flex gap-4">
                                    <Button variant="outline" className="flex-1 rounded-xl py-6 border-rose-200 hover:bg-rose-50" onClick={() => setResult(null)}>
                                        Try Another
                                    </Button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
