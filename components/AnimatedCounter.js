/**
 * Animated Counter Component
 * Beautiful number counting animations using GSAP
 */

import { useEffect, useRef } from 'react';
import { animateCounter } from '@/lib/animations';

export default function AnimatedCounter({
    value,
    duration = 2,
    suffix = '',
    prefix = '',
    decimals = 0,
    className = ''
}) {
    const counterRef = useRef(null);

    useEffect(() => {
        if (counterRef.current && value !== undefined && value !== null) {
            animateCounter(counterRef.current, value, duration, suffix);
        }
    }, [value, duration, suffix]);

    return (
        <span ref={counterRef} className={className}>
            {prefix}0{suffix}
        </span>
    );
}
