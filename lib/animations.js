/**
 * Animation Utilities - GSAP & Framer Motion Configuration
 * Award-winning UX animations for Indicore
 */

import gsap from 'gsap';
import ScrollTrigger from 'gsap/dist/ScrollTrigger';

// Register ScrollTrigger plugin
if (typeof window !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
}

// ======================
// GSAP Animations
// ======================

/**
 * Animate number counting up (for scores, statistics)
 * @param {HTMLElement} element - Target element
 * @param {number} endValue - Final number
 * @param {number} duration - Animation duration in seconds
 * @param {string} suffix - Optional suffix (%, pts, etc.)
 */
export const animateCounter = (element, endValue, duration = 2, suffix = '') => {
    if (!element) return;

    const obj = { value: 0 };

    gsap.to(obj, {
        value: endValue,
        duration,
        ease: 'power2.out',
        onUpdate: () => {
            element.textContent = Math.round(obj.value) + suffix;
        }
    });
};

/**
 * Fade in and slide up animation
 * @param {string|HTMLElement} target - Element selector or element
 * @param {object} options - Animation options
 */
export const fadeInUp = (target, options = {}) => {
    const defaults = {
        duration: 0.8,
        y: 30,
        opacity: 0,
        ease: 'power3.out',
        stagger: 0.1
    };

    return gsap.from(target, { ...defaults, ...options });
};

/**
 * Fade in from left
 */
export const fadeInLeft = (target, options = {}) => {
    const defaults = {
        duration: 0.8,
        x: -50,
        opacity: 0,
        ease: 'power3.out'
    };

    return gsap.from(target, { ...defaults, ...options });
};

/**
 * Fade in from right
 */
export const fadeInRight = (target, options = {}) => {
    const defaults = {
        duration: 0.8,
        x: 50,
        opacity: 0,
        ease: 'power3.out'
    };

    return gsap.from(target, { ...defaults, ...options });
};

/**
 * Scale up animation (for cards, modals)
 */
export const scaleUp = (target, options = {}) => {
    const defaults = {
        duration: 0.5,
        scale: 0.9,
        opacity: 0,
        ease: 'back.out(1.7)'
    };

    return gsap.from(target, { ...defaults, ...options });
};

/**
 * Stagger children animation
 */
export const staggerChildren = (parent, childSelector, options = {}) => {
    const defaults = {
        duration: 0.6,
        y: 20,
        opacity: 0,
        stagger: 0.1,
        ease: 'power2.out'
    };

    return gsap.from(`${parent} ${childSelector}`, { ...defaults, ...options });
};

/**
 * Reveal animation with ScrollTrigger
 */
export const revealOnScroll = (target, options = {}) => {
    const defaults = {
        duration: 0.8,
        y: 50,
        opacity: 0,
        ease: 'power3.out',
        scrollTrigger: {
            trigger: target,
            start: 'top 85%',
            toggleActions: 'play none none reverse'
        }
    };

    return gsap.from(target, { ...defaults, ...options });
};

/**
 * Progress bar fill animation
 */
export const animateProgressBar = (element, percentage, duration = 1.5) => {
    if (!element) return;

    gsap.fromTo(element,
        { width: '0%' },
        {
            width: `${percentage}%`,
            duration,
            ease: 'power2.out'
        }
    );
};

/**
 * Create a timeline for complex animations
 */
export const createTimeline = (options = {}) => {
    return gsap.timeline(options);
};

/**
 * Shake animation (for errors)
 */
export const shake = (target) => {
    return gsap.to(target, {
        x: [-10, 10, -10, 10, 0],
        duration: 0.5,
        ease: 'power1.inOut'
    });
};

/**
 * Pulse animation (for notifications, badges)
 */
export const pulse = (target, options = {}) => {
    const defaults = {
        scale: 1.1,
        duration: 0.3,
        yoyo: true,
        repeat: 2,
        ease: 'power1.inOut'
    };

    return gsap.to(target, { ...defaults, ...options });
};

// ======================
// Framer Motion Variants
// ======================

/**
 * Page transition variants
 */
export const pageVariants = {
    initial: {
        opacity: 0,
        y: 20
    },
    animate: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.5,
            ease: [0.6, -0.05, 0.01, 0.99]
        }
    },
    exit: {
        opacity: 0,
        y: -20,
        transition: {
            duration: 0.3
        }
    }
};

/**
 * Modal/Dialog variants
 */
export const modalVariants = {
    hidden: {
        opacity: 0,
        scale: 0.8,
        y: 50
    },
    visible: {
        opacity: 1,
        scale: 1,
        y: 0,
        transition: {
            type: 'spring',
            damping: 25,
            stiffness: 300
        }
    },
    exit: {
        opacity: 0,
        scale: 0.8,
        transition: {
            duration: 0.2
        }
    }
};

/**
 * Card hover variants
 */
export const cardVariants = {
    rest: {
        scale: 1,
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
    },
    hover: {
        scale: 1.02,
        boxShadow: '0 10px 20px rgba(0, 0, 0, 0.15)',
        transition: {
            duration: 0.3,
            ease: 'easeOut'
        }
    },
    tap: {
        scale: 0.98
    }
};

/**
 * List item stagger variants
 */
export const listVariants = {
    hidden: {
        opacity: 0
    },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.1
        }
    }
};

export const listItemVariants = {
    hidden: {
        opacity: 0,
        x: -20
    },
    visible: {
        opacity: 1,
        x: 0,
        transition: {
            duration: 0.5,
            ease: [0.6, -0.05, 0.01, 0.99]
        }
    }
};

/**
 * Button tap variants
 */
export const buttonVariants = {
    rest: { scale: 1 },
    hover: {
        scale: 1.05,
        transition: {
            duration: 0.2,
            ease: 'easeOut'
        }
    },
    tap: { scale: 0.95 }
};

/**
 * Notification toast variants
 */
export const toastVariants = {
    initial: {
        opacity: 0,
        y: -50,
        scale: 0.3
    },
    animate: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
            type: 'spring',
            damping: 20,
            stiffness: 300
        }
    },
    exit: {
        opacity: 0,
        y: -20,
        scale: 0.5,
        transition: {
            duration: 0.2
        }
    }
};

/**
 * Fade variants (simple)
 */
export const fadeVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { duration: 0.5 }
    },
    exit: {
        opacity: 0,
        transition: { duration: 0.3 }
    }
};

/**
 * Slide in from bottom variants
 */
export const slideUpVariants = {
    hidden: {
        y: '100%',
        opacity: 0
    },
    visible: {
        y: 0,
        opacity: 1,
        transition: {
            type: 'spring',
            damping: 25,
            stiffness: 200
        }
    },
    exit: {
        y: '100%',
        opacity: 0,
        transition: {
            duration: 0.3
        }
    }
};

// ======================
// Utility Functions
// ======================

/**
 * Kill all GSAP animations
 */
export const killAllAnimations = () => {
    gsap.killTweensOf('*');
};

/**
 * Refresh ScrollTrigger (call after content changes)
 */
export const refreshScrollTrigger = () => {
    if (typeof window !== 'undefined') {
        ScrollTrigger.refresh();
    }
};

/**
 * Disable all animations (for accessibility)
 */
export const disableAnimations = () => {
    gsap.globalTimeline.clear();
    ScrollTrigger.getAll().forEach(trigger => trigger.kill());
};

/**
 * Get reduced motion preference
 */
export const prefersReducedMotion = () => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * Safe animation wrapper that respects reduced motion
 */
export const safeAnimate = (animationFn) => {
    if (prefersReducedMotion()) {
        return null; // Skip animation
    }
    return animationFn();
};

export default {
    // GSAP
    animateCounter,
    fadeInUp,
    fadeInLeft,
    fadeInRight,
    scaleUp,
    staggerChildren,
    revealOnScroll,
    animateProgressBar,
    createTimeline,
    shake,
    pulse,

    // Framer Motion Variants
    pageVariants,
    modalVariants,
    cardVariants,
    listVariants,
    listItemVariants,
    buttonVariants,
    toastVariants,
    fadeVariants,
    slideUpVariants,

    // Utilities
    killAllAnimations,
    refreshScrollTrigger,
    disableAnimations,
    prefersReducedMotion,
    safeAnimate
};
