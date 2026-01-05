'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ShieldCheck,
    Users,
    AlertCircle,
    Send,
    ChevronRight,
    ChevronLeft,
    Award,
    BookOpen,
    Scale,
    Zap,
    CheckCircle2,
    RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

const CASE_STUDIES = [
    {
        id: 1,
        title: "The Industrial Leak Crisis",
        description: "You are the District Magistrate of a sensitive area. A major chemical leak has occurred in a local factory at 2 AM. The factory belongs to a prominent politician. Panic is spreading. Evacuation is needed, but the politician is pressuring you to delay the public announcement to avoid negative PR for his upcoming rally.",
        stakeholders: ["Local Residents", "Politician/Factory Owner", "District Administration", "Emergency Services", "Environment Agency"],
        dilemmas: ["Professional Duty vs. Political Pressure", "Public Safety vs. Economic Stability", "Transparency vs. Panic Control"]
    },
    {
        id: 2,
        title: "Corruption in Infrastructure",
        description: "As a senior engineer, you discover that the materials used for a new bridge construction are sub-standard. Your superior, who is close to the contractor, tells you to sign off on the project anyway, saying 'it's close enough and we have a deadline'. Rejecting it will delay the project by 6 months and might cost you your promotion.",
        stakeholders: ["Public (Future Users)", "Self (Engineer)", "Superior Officer", "Contractor", "Taxpayers"],
        dilemmas: ["Integrity vs. Career Growth", "Safety vs. Project Deadlines", "Accountability vs. Compliance with Authority"]
    }
];

export default function EthicsLabPage() {
    const [step, setStep] = useState(1);
    const [selectedCase, setSelectedCase] = useState(null);
    const [responses, setResponses] = useState({
        stakeholders: '',
        dilemmas: '',
        actionPlan: ''
    });
    const [evaluation, setEvaluation] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleStart = (cs) => {
        setSelectedCase(cs);
        setStep(2);
    };

    const nextStep = () => setStep(s => s + 1);
    const prevStep = () => setStep(s => s - 1);

    const handleEvaluate = async () => {
        setLoading(true);
        try {
            const resp = await fetch('/api/ai/ethics-evaluate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    caseStudy: selectedCase.description,
                    userResponse: responses
                })
            });
            const data = await resp.json();
            setEvaluation(data);
            setStep(5);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 md:p-12">
            <div className="max-w-4xl mx-auto">

                {/* Progress Stepper */}
                {step > 1 && step < 5 && (
                    <div className="flex justify-between items-center mb-8 px-4">
                        {[2, 3, 4].map((s) => (
                            <div key={s} className="flex flex-col items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= s ? 'bg-red-600 text-white shadow-lg shadow-red-600/30' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                                    }`}>
                                    {s - 1}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <AnimatePresence mode="wait">
                    {step === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            <div className="text-center mb-12">
                                <div className="w-16 h-16 bg-red-600 rounded-3xl mx-auto mb-6 flex items-center justify-center text-white shadow-xl shadow-red-600/20">
                                    <Scale size={32} />
                                </div>
                                <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-4">Ethics Case Study Simulator</h1>
                                <p className="text-slate-500 dark:text-slate-400 text-lg">Master GS-4 with AI-driven interactive ethical analysis</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {CASE_STUDIES.map(cs => (
                                    <Card key={cs.id} className="hover:border-red-500/50 transition-colors cursor-pointer dark:bg-slate-900 overflow-hidden border-2 border-transparent">
                                        <CardContent className="p-8">
                                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{cs.title}</h3>
                                            <p className="text-slate-600 dark:text-slate-400 text-sm mb-6 line-clamp-3">
                                                {cs.description}
                                            </p>
                                            <Button
                                                onClick={() => handleStart(cs)}
                                                variant="outline"
                                                className="w-full border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400"
                                            >
                                                Start Simulation
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="space-y-6"
                        >
                            <CaseHeader title={selectedCase.title} description={selectedCase.description} />
                            <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-xl shadow-slate-200/50 dark:shadow-none">
                                <div className="flex items-center gap-2 mb-6 text-red-600 font-bold">
                                    <Users size={20} />
                                    Identify Stakeholders
                                </div>
                                <textarea
                                    className="w-full h-40 p-4 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-red-500 outline-none dark:text-white transition-all"
                                    placeholder="Who are the primary and secondary stakeholders in this case?"
                                    value={responses.stakeholders}
                                    onChange={(e) => setResponses({ ...responses, stakeholders: e.target.value })}
                                />
                                <div className="flex justify-between mt-8">
                                    <Button variant="ghost" onClick={() => setStep(1)}>Cancel</Button>
                                    <Button onClick={nextStep} disabled={!responses.stakeholders}>Next Step <ChevronRight className="ml-2" size={16} /></Button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {step === 3 && (
                        <motion.div
                            key="step3"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="space-y-6"
                        >
                            <CaseHeader title={selectedCase.title} description={selectedCase.description} />
                            <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-xl shadow-slate-200/50 dark:shadow-none">
                                <div className="flex items-center gap-2 mb-6 text-red-600 font-bold">
                                    <AlertCircle size={20} />
                                    Ethical Dilemmas
                                </div>
                                <textarea
                                    className="w-full h-40 p-4 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-red-500 outline-none dark:text-white transition-all"
                                    placeholder="What are the conflicting values or difficult choices being faced?"
                                    value={responses.dilemmas}
                                    onChange={(e) => setResponses({ ...responses, dilemmas: e.target.value })}
                                />
                                <div className="flex justify-between mt-8">
                                    <Button variant="ghost" onClick={prevStep}>Back</Button>
                                    <Button onClick={nextStep} disabled={!responses.dilemmas}>Next Step <ChevronRight className="ml-2" size={16} /></Button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {step === 4 && (
                        <motion.div
                            key="step4"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="space-y-6"
                        >
                            <CaseHeader title={selectedCase.title} description={selectedCase.description} />
                            <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-xl shadow-slate-200/50 dark:shadow-none">
                                <div className="flex items-center gap-2 mb-6 text-red-600 font-bold">
                                    <Send size={20} />
                                    Final Action Plan
                                </div>
                                <textarea
                                    className="w-full h-40 p-4 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-red-500 outline-none dark:text-white transition-all"
                                    placeholder="Provide your step-by-step action plan as an administrator."
                                    value={responses.actionPlan}
                                    onChange={(e) => setResponses({ ...responses, actionPlan: e.target.value })}
                                />
                                <div className="flex justify-between mt-8">
                                    <Button variant="ghost" onClick={prevStep}>Back</Button>
                                    <Button onClick={handleEvaluate} disabled={loading || !responses.actionPlan} className="bg-red-600 hover:bg-red-700">
                                        {loading ? <><RefreshCw className="mr-2 animate-spin" size={16} /> Evaluating...</> : <><ShieldCheck className="mr-2" size={16} /> Get Expert Evaluation</>}
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {step === 5 && evaluation && (
                        <motion.div
                            key="step5"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="space-y-6 pb-12"
                        >
                            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-8 opacity-10">
                                    <Award size={120} />
                                </div>
                                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                    <div>
                                        <Badge className="bg-red-500 text-white border-none mb-3">Simulation Complete</Badge>
                                        <h2 className="text-3xl font-bold mb-2">Evaluation Report</h2>
                                        <p className="text-slate-400">Based on UPSC GS-4 Administrative Standards</p>
                                    </div>
                                    <div className="flex flex-col items-center justify-center p-6 bg-white/10 rounded-2xl backdrop-blur-md">
                                        <span className="text-5xl font-extrabold text-red-400">{evaluation.score}</span>
                                        <span className="text-xs uppercase tracking-widest font-bold opacity-60">Ethics Score</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card className="dark:bg-slate-900 border-none shadow-lg">
                                    <CardContent className="p-6">
                                        <h4 className="text-green-600 flex items-center gap-2 font-bold mb-4 uppercase text-xs tracking-widest">
                                            <CheckCircle2 size={16} /> Strengths
                                        </h4>
                                        <ul className="space-y-2">
                                            {evaluation.strengths.map((s, i) => (
                                                <li key={i} className="text-slate-700 dark:text-slate-300 text-sm flex items-start gap-2">
                                                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1.5 flex-shrink-0" /> {s}
                                                </li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                </Card>
                                <Card className="dark:bg-slate-900 border-none shadow-lg">
                                    <CardContent className="p-6">
                                        <h4 className="text-red-500 flex items-center gap-2 font-bold mb-4 uppercase text-xs tracking-widest">
                                            <AlertCircle size={16} /> Areas to Improve
                                        </h4>
                                        <ul className="space-y-2">
                                            {evaluation.weaknesses.map((w, i) => (
                                                <li key={i} className="text-slate-700 dark:text-slate-300 text-sm flex items-start gap-2">
                                                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full mt-1.5 flex-shrink-0" /> {w}
                                                </li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                </Card>
                            </div>

                            <Card className="dark:bg-slate-900 border-none shadow-lg bg-blue-50/30">
                                <CardContent className="p-8">
                                    <h4 className="text-blue-600 flex items-center gap-2 font-bold mb-6 uppercase text-xs tracking-widest">
                                        <Zap size={16} /> Expert Feedback
                                    </h4>
                                    <div className="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 text-sm leading-relaxed mb-8">
                                        {evaluation.improvement}
                                    </div>
                                    <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-xl">
                                        <h5 className="font-bold text-slate-900 dark:text-white mb-3 text-sm flex items-center gap-2">
                                            <ShieldCheck className="text-green-500" size={18} /> Model Administrative Approach
                                        </h5>
                                        <p className="text-sm text-slate-600 dark:text-slate-400 italic">
                                            {evaluation.idealApproach}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="flex justify-center pt-8">
                                <Button onClick={() => setStep(1)} size="lg" className="bg-slate-900 dark:bg-white dark:text-slate-900 px-12 rounded-full font-bold">
                                    Practice Another Case
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

function CaseHeader({ title, description }) {
    return (
        <div className="mb-8">
            <Badge className="bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 border-none mb-3">Case Study active</Badge>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">{title}</h2>
            <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-2xl text-slate-700 dark:text-slate-300 text-sm leading-relaxed border-l-4 border-red-500 shadow-inner">
                {description}
            </div>
        </div>
    );
}
