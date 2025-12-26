/**
 * Fix for canvas dependency in pdfjs-dist for environments like Vercel
 * where the native 'canvas' package is not available or desired.
 */
const fs = require('fs');
const path = require('path');

console.log('[Postinstall] Running fix-canvas-dep.cjs to handle pdfjs-dist canvas dependency...');

// Path to the pdf.js file in pdfjs-dist
const possiblePaths = [
    path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'build', 'pdf.js'),
    path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.js')
];

let patched = false;

possiblePaths.forEach(pdfjsPath => {
    if (fs.existsSync(pdfjsPath)) {
        try {
            let content = fs.readFileSync(pdfjsPath, 'utf8');
            if (content.includes('require("canvas")')) {
                content = content.replace(/require\("canvas"\)/g, 'null');
                fs.writeFileSync(pdfjsPath, content);
                console.log(`[Postinstall] Successfully patched: ${pdfjsPath}`);
                patched = true;
            }
        } catch (err) {
            console.error(`[Postinstall] Failed to patch ${pdfjsPath}:`, err.message);
        }
    }
});

if (!patched) {
    console.log('[Postinstall] No canvas requirements found in pdfjs-dist or files not found. This is normal if the package is already optimized.');
}
