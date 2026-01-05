'use client';

import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

// Initialize mermaid with high-quality rendering defaults
mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    themeVariables: {
        primaryColor: '#ff4d4d',
        primaryTextColor: '#fff',
        primaryBorderColor: '#e60000',
        lineColor: '#ff8080',
        secondaryColor: '#fdf2f2',
        tertiaryColor: '#fff',
        fontSize: '16px',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        nodePadding: 15,
        nodeTextColor: '#333',
    },
    flowchart: {
        curve: 'basis',
        padding: 20,
        nodeSpacing: 50,
        rankSpacing: 60,
        useMaxWidth: false,
        htmlLabels: true,
    },
    mindmap: {
        padding: 20,
        useMaxWidth: false,
    },
    securityLevel: 'loose',
    logLevel: 'error'
});

/**
 * Sanitize flowchart syntax for Mermaid v11.12.2 compatibility
 * Removes HTML tags like <br/> and parentheses which cause syntax errors
 */
function sanitizeFlowchart(chart) {
    if (!chart.trim().startsWith('flowchart') && !chart.trim().startsWith('graph')) {
        return chart; // Only process flowcharts/graphs
    }

    // Process line by line to preserve structure
    return chart
        .split('\n')
        .map(line => {
            // Match node definitions with square brackets like A[Label]
            let processedLine = line.replace(/\[([^\]]+)\]/g, (match, label) => {
                // Clean the label
                const cleanLabel = label
                    .replace(/<br\s*\/?>/gi, ' ')     // Replace <br/> with space
                    .replace(/<[^>]+>/g, '')          // Remove any HTML tags
                    .replace(/\(/g, ' - ')            // Replace ( with dash
                    .replace(/\)/g, '')               // Remove )
                    .replace(/\s+/g, ' ')             // Normalize whitespace
                    .trim();
                return `[${cleanLabel}]`;
            });

            // Also match node definitions with parentheses like A(Label) or A((Label))
            processedLine = processedLine.replace(/\(\(([^)]+)\)\)/g, (match, label) => {
                const cleanLabel = label
                    .replace(/<br\s*\/?>/gi, ' ')
                    .replace(/<[^>]+>/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                return `((${cleanLabel}))`;
            });

            return processedLine;
        })
        .join('\n');
}


/**
 * Sanitize mindmap syntax for Mermaid v11.12.2 compatibility
 * Fixes common issues like quoted strings, special characters, and incorrect brackets
 */
function sanitizeMindmap(chart) {
    if (!chart.trim().startsWith('mindmap')) {
        return chart; // Only process mindmaps
    }

    let lines = chart.split('\n');
    let result = [];

    for (let line of lines) {
        let processed = line;

        // Skip the 'mindmap' declaration line
        if (processed.trim() === 'mindmap') {
            result.push(processed);
            continue;
        }

        // Preserve leading whitespace for indentation
        const leadingWhitespace = processed.match(/^(\s*)/)[1];
        let content = processed.trim();

        if (!content) {
            result.push(processed);
            continue;
        }

        // Fix root node: keep root((...)) syntax but clean the label
        if (content.startsWith('root')) {
            // Extract and clean root label
            const rootMatch = content.match(/root\s*\(\s*\(\s*["']?(.+?)["']?\s*\)\s*\)/);
            if (rootMatch) {
                const cleanLabel = sanitizeLabel(rootMatch[1]);
                processed = `${leadingWhitespace}root((${cleanLabel}))`;
            } else {
                // Handle root(["..."]) format (incorrect but common)
                const altMatch = content.match(/root\s*\(\s*\[\s*["']?(.+?)["']?\s*\]\s*\)/);
                if (altMatch) {
                    const cleanLabel = sanitizeLabel(altMatch[1]);
                    processed = `${leadingWhitespace}root((${cleanLabel}))`;
                }
            }
            result.push(processed);
            continue;
        }

        // Fix child nodes: remove quotes, brackets, and special characters
        // Pattern: ["..."] or [...]
        const bracketMatch = content.match(/^\[["']?(.+?)["']?\]$/);
        if (bracketMatch) {
            content = sanitizeLabel(bracketMatch[1]);
            processed = `${leadingWhitespace}${content}`;
            result.push(processed);
            continue;
        }

        // Pattern: "..." or '...'
        const quoteMatch = content.match(/^["'](.+?)["']$/);
        if (quoteMatch) {
            content = sanitizeLabel(quoteMatch[1]);
            processed = `${leadingWhitespace}${content}`;
            result.push(processed);
            continue;
        }

        // Just sanitize the label for special characters
        processed = `${leadingWhitespace}${sanitizeLabel(content)}`;
        result.push(processed);
    }

    return result.join('\n');
}

/**
 * Clean a label by removing/replacing problematic characters
 */
function sanitizeLabel(label) {
    return label
        .replace(/&/g, 'and')           // Replace & with "and"
        .replace(/\//g, ' or ')          // Replace / with "or"
        .replace(/[()[\]{}]/g, '')       // Remove brackets and parentheses
        .replace(/["']/g, '')            // Remove quotes
        .replace(/[<>]/g, '')            // Remove angle brackets
        .replace(/\s+/g, ' ')            // Normalize whitespace
        .trim();
}

export default function MermaidRenderer({ chart, id = 'mermaid-chart' }) {
    const containerRef = useRef(null);
    const [svg, setSvg] = useState('');
    const [error, setError] = useState(null);
    const [retryCount, setRetryCount] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        if (!chart) return;

        const renderChart = async () => {
            try {
                setError(null);

                // Sanitize the chart for Mermaid v11 compatibility
                let processedChart = chart.trim();
                processedChart = sanitizeFlowchart(processedChart);
                processedChart = sanitizeMindmap(processedChart);

                // Ensure unique ID for render
                const uniqueId = `${id}-${Math.random().toString(36).substr(2, 9)}`.replace(/[^a-zA-Z0-9-]/g, '');

                // Clear container before render to prevent issues
                if (containerRef.current) containerRef.current.innerHTML = '';

                const { svg: renderedSvg } = await mermaid.render(uniqueId, processedChart);

                // Post-process SVG for higher quality rendering
                let enhancedSvg = renderedSvg;

                // Add rendering quality attributes to the SVG element
                enhancedSvg = enhancedSvg.replace(
                    /<svg([^>]*)>/,
                    '<svg$1 shape-rendering="geometricPrecision" text-rendering="optimizeLegibility">'
                );

                setSvg(enhancedSvg);
            } catch (err) {
                console.error('Mermaid Render Error:', err);
                setError('Failed to render visualization. The syntax might be invalid for this layout.');
            }
        };

        renderChart();
    }, [chart, id, retryCount]);

    const handleRetry = () => {
        setRetryCount(prev => prev + 1);
    };

    const toggleFullscreen = () => {
        setIsFullscreen(prev => !prev);
    };

    const downloadImage = () => {
        if (!containerRef.current) return;
        const svgElement = containerRef.current.querySelector('svg');
        if (!svgElement) return;

        try {
            // Clone SVG and add explicit dimensions for high-quality rendering
            const clonedSvg = svgElement.cloneNode(true);
            const bbox = svgElement.getBoundingClientRect();

            // Set explicit dimensions if not present
            if (!clonedSvg.getAttribute('width')) {
                clonedSvg.setAttribute('width', bbox.width);
            }
            if (!clonedSvg.getAttribute('height')) {
                clonedSvg.setAttribute('height', bbox.height);
            }

            // Add high-quality rendering hints
            clonedSvg.setAttribute('shape-rendering', 'geometricPrecision');
            clonedSvg.setAttribute('text-rendering', 'optimizeLegibility');

            const svgData = new XMLSerializer().serializeToString(clonedSvg);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            // Use base64 Data URL instead of Blob URL to avoid "Tainted Canvas" error
            const encodedData = window.btoa(unescape(encodeURIComponent(svgData)));
            const url = `data:image/svg+xml;base64,${encodedData}`;

            img.onload = () => {
                const scale = 4; // 4x scale for ultra-high DPI / crisp output
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;

                // Enable high-quality image scaling
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';

                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // Use higher quality PNG export
                const pngUrl = canvas.toDataURL('image/png', 1.0);
                const downloadLink = document.createElement('a');
                downloadLink.href = pngUrl;
                downloadLink.download = `indicore-visual-${Date.now()}.png`;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
            };

            img.src = url;
        } catch (err) {
            console.error('Download failed:', err);
        }
    };

    // Handle ESC key to exit fullscreen
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape' && isFullscreen) {
                setIsFullscreen(false);
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isFullscreen]);

    if (error) {
        return (
            <div className="p-5 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                <div className="flex items-center justify-between mb-3 underline decoration-red-200 underline-offset-4">
                    <span className="font-bold flex items-center gap-2">
                        <span className="text-lg">⚠️</span> Visualization Render Failed
                    </span>
                    <button
                        onClick={handleRetry}
                        className="px-3 py-1 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 rounded-lg transition-colors font-bold text-xs flex items-center gap-1.5"
                    >
                        <span>🔄 Retry Render</span>
                    </button>
                </div>
                <p className="mb-3 leading-relaxed opacity-90">{error}</p>
                <div className="relative">
                    <div className="absolute top-0 right-0 px-2 py-0.5 bg-red-100 dark:bg-red-900/40 rounded-bl text-[8px] font-black uppercase">RAW SOURCE</div>
                    <code className="text-[10px] block p-3 bg-white dark:bg-black/40 rounded-lg border border-red-100 dark:border-red-900/40 overflow-x-auto whitespace-pre font-mono max-h-40">
                        {chart}
                    </code>
                </div>
            </div>
        );
    }

    // Fullscreen Modal
    if (isFullscreen) {
        return (
            <div className="fixed inset-0 z-[9999] bg-white dark:bg-slate-900 flex flex-col">
                {/* Fullscreen Header */}
                <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <span className="text-2xl">🗺️</span> Mindmap View
                    </h3>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={downloadImage}
                            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-bold text-sm flex items-center gap-2 shadow-lg"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download PNG
                        </button>
                        <button
                            onClick={toggleFullscreen}
                            className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors font-bold text-sm flex items-center gap-2 shadow-lg"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Close (ESC)
                        </button>
                    </div>
                </div>

                {/* Fullscreen Content - Scrollable/Zoomable */}
                <div className="flex-1 overflow-auto p-8 flex items-center justify-center">
                    <style jsx global>{`
                        .fullscreen-mermaid svg {
                            transform: translateZ(0);
                            -webkit-font-smoothing: antialiased;
                            -moz-osx-font-smoothing: grayscale;
                            max-width: none !important;
                            width: auto !important;
                            height: auto !important;
                            min-width: 800px;
                            min-height: 600px;
                        }
                        .fullscreen-mermaid svg text {
                            font-weight: 500;
                            font-size: 18px !important;
                        }
                        .fullscreen-mermaid svg .node rect,
                        .fullscreen-mermaid svg .node circle,
                        .fullscreen-mermaid svg .node ellipse,
                        .fullscreen-mermaid svg .node polygon,
                        .fullscreen-mermaid svg path {
                            vector-effect: non-scaling-stroke;
                        }
                    `}</style>
                    <div
                        ref={containerRef}
                        className="fullscreen-mermaid"
                        style={{
                            imageRendering: 'auto',
                            WebkitFontSmoothing: 'antialiased',
                            transform: 'scale(1.5)',
                            transformOrigin: 'center center',
                        }}
                        dangerouslySetInnerHTML={{ __html: svg }}
                    />
                </div>

                {/* Hint */}
                <div className="flex-shrink-0 text-center py-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                    💡 Press <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[10px] font-mono">ESC</kbd> or click Close to exit fullscreen
                </div>
            </div>
        );
    }

    return (
        <div className="relative group">
            <style jsx global>{`
                .mermaid-container svg {
                    transform: translateZ(0);
                    -webkit-font-smoothing: antialiased;
                    -moz-osx-font-smoothing: grayscale;
                }
                .mermaid-container svg text {
                    font-weight: 500;
                }
                .mermaid-container svg .node rect,
                .mermaid-container svg .node circle,
                .mermaid-container svg .node ellipse,
                .mermaid-container svg .node polygon,
                .mermaid-container svg path {
                    vector-effect: non-scaling-stroke;
                }
            `}</style>
            <div
                ref={containerRef}
                className="mermaid-container w-full flex justify-center items-center bg-white dark:bg-slate-900 rounded-xl p-8 overflow-x-auto min-h-[350px] border border-slate-100 dark:border-slate-800 shadow-inner"
                style={{
                    imageRendering: 'auto',
                    WebkitFontSmoothing: 'antialiased',
                }}
                dangerouslySetInnerHTML={{ __html: svg }}
            />
            {svg && (
                <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {/* Fullscreen Button */}
                    <button
                        onClick={toggleFullscreen}
                        className="p-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 flex items-center gap-1.5"
                        title="View Fullscreen"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                        <span>Fullscreen</span>
                    </button>
                    {/* Download Button */}
                    <button
                        onClick={downloadImage}
                        className="p-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 flex items-center gap-1.5"
                        title="Download as PNG"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <span>Download PNG</span>
                    </button>
                </div>
            )}
        </div>
    );
}
