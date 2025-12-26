'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

const IntelligenceLab = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');

    useEffect(() => {
        fetch('/api/intelligence/stats')
            .then(res => res.json())
            .then(data => {
                setStats(data);
                setLoading(false);
            })
            .catch(err => console.error(err));
    }, []);

    if (loading) return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center">
            <div className="relative">
                <div className="animate-spin rounded-full h-16 w-16 border-t-3 border-b-3 border-blue-600"></div>
                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-blue-600">Loading</div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
            {/* Header with Navigation */}
            <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center font-black text-white text-lg italic shadow-lg">i</div>
                        <span className="text-xl font-black text-slate-900">Indicore</span>
                    </div>
                    <Link href="/chat">
                        <button className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 hover:shadow-xl hover:scale-105">
                            Sign In
                        </button>
                    </Link>
                </div>
            </header>

            {/* Hero Section */}
            <section className="relative overflow-hidden py-20 lg:py-32">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        {/* Left Content */}
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                        >
                            <div className="inline-block px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-xs font-bold uppercase tracking-wider mb-6">
                                Intelligence Lab
                            </div>
                            <h1 className="text-5xl lg:text-7xl font-black text-slate-900 leading-tight mb-6">
                                Let's Master<br />
                                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Civil Services</span>
                            </h1>
                            <p className="text-lg lg:text-xl text-slate-600 leading-relaxed mb-8 max-w-lg">
                                Your UPSC Prep is Stuck in Yesterday's Books — Set It Free Today. Ditch endless notes, generic apps, and lonely grinding.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4">
                                <Link href="/chat">
                                    <button className="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-2xl font-bold text-base hover:shadow-2xl hover:scale-105 transition-all shadow-lg">
                                        Get Started For Free
                                    </button>
                                </Link>
                                <button className="px-8 py-4 text-slate-700 font-semibold hover:text-blue-600 transition-colors">
                                    Learn More →
                                </button>
                            </div>
                        </motion.div>

                        {/* Right Illustration/Stats Card */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="relative"
                        >
                            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl p-8 border border-amber-200 shadow-2xl">
                                <div className="mb-6">
                                    <div className="text-sm font-bold text-orange-600 mb-2">Your UPSC Prep is Stuck in Yesterday's Books —</div>
                                    <div className="text-blue-600 font-bold text-lg">Set It Free Today.</div>
                                </div>
                                <p className="text-slate-700 leading-relaxed text-sm mb-6">
                                    Ditch endless notes, generic apps, and lonely grinding. You share your doubts and answers, Indicore's AI learns, evaluates like a top mentor, and delivers personalized insights, PYQs, and feedback — instantly.
                                </p>
                                <div className="space-y-3">
                                    <div className="flex items-start gap-3">
                                        <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                        <p className="text-sm text-slate-700">Indicore evaluates like a senior examiner</p>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                        <p className="text-sm text-slate-700">Instantly personalized PYQs and feedback</p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Problem Statement Section */}
            <section className="py-20 bg-white">
                <div className="max-w-4xl mx-auto px-6 text-center">
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-4xl lg:text-5xl font-black text-transparent bg-gradient-to-r from-pink-500 to-red-500 bg-clip-text mb-8"
                    >
                        The problem isn't effort, it's clarity.
                    </motion.h2>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 }}
                        className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-3xl p-8 border border-slate-200 shadow-xl max-w-3xl mx-auto"
                    >
                        <p className="text-slate-700 leading-relaxed text-lg mb-4">
                            Not another content dump. Indicore won't  drown you in generic prep — fixing the biggest gap first: feedback that actually explains your mistakes. No vague scores. No later reasoning, structure, and relevance.
                        </p>
                        <p className="text-base text-slate-600 leading-relaxed">
                            <span className="font-bold text-slate-800">Your effort stays constant. Your clarity multiplies.</span><br />
                            <span className="text-green-600 font-semibold">Indicore evaluates like a senior examiner: words.</span>
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Tabbed Features Section */}
            <section className="py-20 bg-gradient-to-b from-white to-slate-50">
                <div className="max-w-7xl mx-auto px-6">
                    {/* Tab Navigation */}
                    <div className="flex flex-wrap justify-center gap-2 mb-12 border-b border-slate-200 pb-6">
                        {[
                            { id: 'overview', label: 'Intelligence Overview' },
                            { id: 'pyq', label: 'Past Year Questions' },
                            { id: 'framework', label: 'Structured Framework' },
                            { id: 'comparison', label: 'Why Indicore Works' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-6 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === tab.id
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                                        : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <AnimatePresence mode="wait">
                        {activeTab === 'overview' && (
                            <motion.div
                                key="overview"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                            >
                                <div className="grid md:grid-cols-3 gap-6 mb-12">
                                    {/* Verified Facts Card */}
                                    <motion.div
                                        whileHover={{ y: -5, shadow: "0 20px 40px rgba(0,0,0,0.1)" }}
                                        className="bg-white rounded-3xl p-8 border-2 border-blue-200 shadow-xl relative overflow-hidden group"
                                    >
                                        <div className="absolute -right-8 -top-8 w-32 h-32 bg-blue-100 rounded-full opacity-50 group-hover:opacity-100 transition-all"></div>
                                        <div className="relative">
                                            <div className="text-blue-600 text-xs font-black uppercase tracking-wider mb-4">Integrity Level</div>
                                            <div className="text-5xl font-black text-slate-900 mb-2">{stats.verifiedFacts.toLocaleString()}</div>
                                            <div className="text-slate-600 text-sm font-semibold">Verified Fact-Units</div>
                                            <div className="mt-6 inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                                                ✓ 100% Truth-Anchored
                                            </div>
                                        </div>
                                    </motion.div>

                                    {/* Maturity Card */}
                                    <motion.div
                                        whileHover={{ y: -5 }}
                                        className="bg-white rounded-3xl p-8 border-2 border-purple-200 shadow-xl"
                                    >
                                        <div className="text-purple-600 text-xs font-black uppercase tracking-wider mb-4">Cognitive Maturity</div>
                                        <div className="text-5xl font-black text-slate-900 mb-2">84%</div>
                                        <div className="text-slate-600 text-sm font-semibold mb-6">Syllabus Coverage</div>
                                        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: '84%' }}
                                                transition={{ duration: 1.5, ease: "easeOut" }}
                                                className="h-full bg-gradient-to-r from-purple-600 to-pink-600 rounded-full"
                                            />
                                        </div>
                                    </motion.div>

                                    {/* Total Knowledge Card */}
                                    <motion.div
                                        whileHover={{ y: -5 }}
                                        className="bg-white rounded-3xl p-8 border-2 border-orange-200 shadow-xl"
                                    >
                                        <div className="text-orange-600 text-xs font-black uppercase tracking-wider mb-4">Knowledge Base</div>
                                        <div className="text-5xl font-black text-slate-900 mb-2">{stats.totalFacts.toLocaleString()}</div>
                                        <div className="text-slate-600 text-sm font-semibold mb-6">Total Logic Units</div>
                                        <div className="flex flex-wrap gap-2">
                                            {['PYQ', 'PIB', 'DAF', 'NEWS'].map(tag => (
                                                <div key={tag} className="px-3 py-1 bg-orange-100 text-orange-700 rounded-lg text-xs font-bold">{tag}</div>
                                            ))}
                                        </div>
                                    </motion.div>
                                </div>

                                {/* GS Coverage Grid */}
                                <div className="bg-white rounded-3xl p-12 border-2 border-slate-200 shadow-xl">
                                    <div className="text-center mb-10">
                                        <h3 className="text-3xl font-black text-slate-900 mb-3">Knowledge Neural Map</h3>
                                        <p className="text-slate-600 max-w-2xl mx-auto">
                                            Our proprietary algorithm maps every fact to 48 dimensional vectors including GS Paper, Year, Relevance, and Historical Lineage.
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                                        {[
                                            { l: 'GS1', v: '92%', color: 'blue' },
                                            { l: 'GS2', v: '88%', color: 'purple' },
                                            { l: 'GS3', v: '71%', color: 'green' },
                                            { l: 'GS4', v: '85%', color: 'orange' }
                                        ].map(item => (
                                            <div key={item.l} className={`p-6 rounded-2xl bg-${item.color}-50 border-2 border-${item.color}-200`}>
                                                <div className={`text-${item.color}-600 text-xs font-black uppercase mb-2`}>{item.l} Coverage</div>
                                                <div className="text-3xl font-black text-slate-900">{item.v}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'pyq' && (
                            <motion.div
                                key="pyq"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl p-12 border-2 border-amber-200 shadow-2xl"
                            >
                                <div className="max-w-4xl">
                                    <h3 className="text-3xl font-black text-slate-900 mb-4">
                                        No guessing what matters —<br />just what's been asked.
                                    </h3>
                                    <p className="text-slate-700 text-lg leading-relaxed mb-8">
                                        Every question, organized by year, paper, subject, and theme. See patterns, not piles of PDFs. Focus shifts automatically. You practice what actually repeats — and what examiners really test.
                                    </p>
                                    <div className="bg-white rounded-2xl p-6 border-2 border-amber-300">
                                        <div className="text-sm font-bold text-amber-700 mb-3">📚 PYQ Intelligence Engine</div>
                                        <p className="text-slate-600 text-sm">
                                            Questions organized by theme, syllabus line, and exam trend — patterns emerge naturally.
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'framework' && (
                            <motion.div
                                key="framework"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="bg-white rounded-3xl p-12 border-2 border-slate-200 shadow-2xl"
                            >
                                <div className="text-center mb-10">
                                    <h3 className="text-3xl font-black text-slate-900 mb-4">One Coherent Preparation Framework</h3>
                                    <p className="text-slate-600 text-lg max-w-2xl mx-auto">
                                        Fully structured by theme, year, and syllabus. Multilingual and state-specific by design. Adapts to your weaknesses and improvements.
                                    </p>
                                </div>
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-8 border-2 border-blue-200">
                                        <div className="text-blue-700 font-black mb-3">📖 Structured by Design</div>
                                        <p className="text-slate-700 text-sm">One coherent preparation framework organized by theme, year, and syllabus.</p>
                                    </div>
                                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-8 border-2 border-purple-200">
                                        <div className="text-purple-700 font-black mb-3">🎯 Personalized Insights</div>
                                        <p className="text-slate-700 text-sm">Adapts to your weaknesses and improvements with AI-driven analysis.</p>
                                    </div>
                                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-8 border-2 border-green-200">
                                        <div className="text-green-700 font-black mb-3">🌐 Multilingual Support</div>
                                        <p className="text-slate-700 text-sm">State-specific and multilingual by design for comprehensive coverage.</p>
                                    </div>
                                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-8 border-2 border-orange-200">
                                        <div className="text-orange-700 font-black mb-3">⚡ Instant Feedback</div>
                                        <p className="text-slate-700 text-sm">Consistent, criteria-based feedback that improves as you improve.</p>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'comparison' && (
                            <motion.div
                                key="comparison"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                            >
                                <div className="text-center mb-12">
                                    <h2 className="text-4xl font-black mb-4">
                                        <span className="text-green-600">Why Indicore Works</span> —<br />
                                        <span className="text-slate-700">and Beats the Alternatives</span>
                                    </h2>
                                    <p className="text-slate-600 text-lg max-w-2xl mx-auto">
                                        Traditional coaching locks you into fixed paths for months. Generic AI makes you figure out the right questions — but who teaches the exam? Indicore gives instant agent-like feedback built from past questions.
                                    </p>
                                </div>

                                {/* Comparison Table */}
                                <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border-2 border-slate-200">
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b-2 border-slate-200">
                                                    <th className="text-left p-6 font-black text-slate-700 text-sm uppercase tracking-wider bg-slate-50">Feature</th>
                                                    <th className="text-center p-6 font-black text-white text-sm uppercase tracking-wider bg-gradient-to-br from-orange-500 to-red-500">
                                                        Indicore<br />
                                                        <span className="text-xs font-normal">Big Box MAINS/UPSC</span>
                                                    </th>
                                                    <th className="text-center p-6 font-bold text-slate-700 text-sm bg-slate-50">Generic AI Tools</th>
                                                    <th className="text-center p-6 font-bold text-slate-700 text-sm bg-slate-50">Traditional Coaching</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {[
                                                    {
                                                        feature: 'What guides you next',
                                                        indicore: 'Clear next step based on answers and progress',
                                                        generic: 'You decide what to ask every time',
                                                        traditional: 'Fixed schedule for everyone'
                                                    },
                                                    {
                                                        feature: 'Past Year Question usage',
                                                        indicore: 'Fully structured by theme, year, and syllabus',
                                                        generic: 'Scattered, prompt-dependent',
                                                        traditional: 'Limited selection, often repeated'
                                                    },
                                                    {
                                                        feature: 'Study structure',
                                                        indicore: 'One coherent preparation framework',
                                                        generic: 'No structure unless you build it',
                                                        traditional: 'Predefined, inflexible structure'
                                                    },
                                                    {
                                                        feature: 'Personalization',
                                                        indicore: 'Adapts to your weaknesses and improvements',
                                                        generic: 'Same response for similar prompts',
                                                        traditional: 'One-size-fits-all batches'
                                                    },
                                                    {
                                                        feature: 'Answer evaluation',
                                                        indicore: 'Consistent, criteria-based feedback',
                                                        generic: 'Varies with prompts and context',
                                                        traditional: 'Delayed, subjective, capacity limited'
                                                    },
                                                    {
                                                        feature: 'Time to get started',
                                                        indicore: '~15 minutes',
                                                        generic: 'Hours of trial-and-error',
                                                        traditional: 'Weeks of onboarding'
                                                    },
                                                    {
                                                        feature: 'Availability',
                                                        indicore: 'Anytime, on-demand',
                                                        generic: 'Anytime, but unguided',
                                                        traditional: 'Fixed class timings'
                                                    }
                                                ].map((row, idx) => (
                                                    <tr key={idx} className={`border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                                        <td className="p-6 font-bold text-slate-800 text-sm">{row.feature}</td>
                                                        <td className="p-6 text-center text-sm font-semibold text-slate-900 bg-orange-50 border-l-4 border-orange-500">{row.indicore}</td>
                                                        <td className="p-6 text-center text-sm text-slate-600">{row.generic}</td>
                                                        <td className="p-6 text-center text-sm text-slate-600">{row.traditional}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </section>

            {/* Final CTA Section */}
            <section className="py-24 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]"></div>
                <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-4xl lg:text-6xl font-black text-white mb-10 leading-tight"
                    >
                        Ready to Get The Marks<br />You Deserve?
                    </motion.h2>
                    <Link href="/chat">
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="px-12 py-5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-2xl font-black text-lg shadow-2xl shadow-green-600/40 hover:shadow-green-600/60 transition-all"
                        >
                            Get Started For Free
                        </motion.button>
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-white border-t border-slate-200 py-12">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center font-black text-white text-xl italic shadow-lg">i</div>
                            <div>
                                <div className="font-black text-slate-900">Indicore Intelligence Lab</div>
                                <div className="text-xs text-slate-600">Verified Knowledge System v1.4</div>
                            </div>
                        </div>
                        <div className="flex gap-8 text-sm font-semibold text-slate-600">
                            <Link href="/chat" className="hover:text-blue-600 transition-colors">Neural Portal</Link>
                            <a href="#" className="hover:text-blue-600 transition-colors">Documentation</a>
                            <div className="flex items-center gap-2 text-green-600">
                                <span className="w-2 h-2 rounded-full bg-green-600 animate-pulse"></span>
                                Active
                            </div>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default IntelligenceLab;
