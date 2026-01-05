'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Highlighter, X, Trash2 } from 'lucide-react';

const COLORS = [
    { name: 'yellow', hex: 'rgba(250, 204, 21, 0.4)', bg: 'bg-yellow-400' },
    { name: 'green', hex: 'rgba(74, 222, 128, 0.4)', bg: 'bg-green-400' },
    { name: 'pink', hex: 'rgba(251, 113, 133, 0.4)', bg: 'bg-pink-400' },
    { name: 'blue', hex: 'rgba(96, 165, 250, 0.4)', bg: 'bg-blue-400' },
    { name: 'orange', hex: 'rgba(251, 146, 60, 0.4)', bg: 'bg-orange-400' }
];

import { createPortal } from 'react-dom';

export default function HighlightToolbar({ position, onSelectColor, onRemove, isExisting }) {
    if (!position) return null;

    // Prevent mousedown from clearing the selection
    const handleMouseDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    return createPortal(
        <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="fixed z-[9999] px-2 py-1.5 bg-white dark:bg-slate-800 rounded-full shadow-2xl border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 backdrop-blur-md"
            style={{
                top: position.top - 50,
                left: position.left,
                transform: 'translateX(-50%)'
            }}
            onMouseDown={handleMouseDown}
        >
            {isExisting ? (
                <button
                    onClick={onRemove}
                    className="p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 transition-colors flex items-center gap-1 text-xs font-semibold pr-3"
                >
                    <Trash2 className="w-4 h-4" />
                    Remove
                </button>
            ) : (
                <>
                    <div className="flex items-center gap-1 border-r border-slate-200 dark:border-slate-700 pr-2 mr-0.5">
                        <Highlighter className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <div className="flex items-center gap-1">
                        {COLORS.map((color) => (
                            <button
                                key={color.name}
                                onClick={() => onSelectColor(color.name)}
                                className={`w-5 h-5 rounded-full ${color.bg} border-2 border-transparent hover:border-slate-400 dark:hover:border-slate-200 transition-all hover:scale-110 shadow-sm`}
                                title={`Highlight ${color.name}`}
                            />
                        ))}
                    </div>
                </>
            )}
        </motion.div>,
        document.body
    );
}
