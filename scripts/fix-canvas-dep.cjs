const fs = require('fs');
const path = require('path');

// Fix for pdfjs-dist dependency on canvas
// This script creates a dummy 'canvas' package in node_modules
// so that webpack can resolve 'canvas' to an empty object.

const canvasDir = path.join(__dirname, '..', 'node_modules', 'canvas');

console.log('Running fix-canvas-dep.js...');

try {
    if (!fs.existsSync(canvasDir)) {
        console.log('Creating dummy canvas package directory...');
        fs.mkdirSync(canvasDir, { recursive: true });
    }

    // Create package.json
    const packageJsonPath = path.join(canvasDir, 'package.json');
    const packageJsonContent = JSON.stringify({
        name: "canvas",
        version: "0.0.0",
        main: "index.js"
    }, null, 2);

    fs.writeFileSync(packageJsonPath, packageJsonContent);
    console.log('Created node_modules/canvas/package.json');

    // Create index.js
    const indexJsPath = path.join(canvasDir, 'index.js');
    fs.writeFileSync(indexJsPath, 'module.exports = {};');
    console.log('Created node_modules/canvas/index.js');

    console.log('✅ Canvas dependency fix applied successfully.');
} catch (error) {
    console.error('❌ Failed to apply canvas dependency fix:', error);
    // Don't exit with error to not break the build if it's not critical
    process.exit(0);
}
