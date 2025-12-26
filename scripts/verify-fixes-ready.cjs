
const fs = require('fs');
const path = require('path');

const filesToVerify = [
    'lib/azureSpeechRecognition.js',
    'pages/api/mock-tests/create.js'
];

console.log('--- Verifying Fixes on Disk ---');

filesToVerify.forEach(relPath => {
    const fullPath = path.join(process.cwd(), relPath);
    if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (relPath.includes('azureSpeechRecognition')) {
            const isRefactored = content.includes('// Removed top-level dynamic import');
            console.log(`${relPath}: ${isRefactored ? '✅ Refactored' : '❌ OLD VERSION'}`);
        } else if (relPath.includes('create.js')) {
            const hasLogs = content.includes('[MockTest API]');
            console.log(`${relPath}: ${hasLogs ? '✅ Robust Logs Added' : '❌ OLD VERSION'}`);
        }
    } else {
        console.log(`${relPath}: ❌ FILE NOT FOUND at ${fullPath}`);
    }
});

console.log('\n--- Troubleshooting Instructions ---');
console.log('1. If files are ✅ Refactored but you still see old errors, RESTART your dev server (Ctrl+C and npm run dev).');
console.log('2. CLEAR BROWSER CACHE or use an Incognito tab.');
console.log('3. Refresh the page Hard Refresh (Ctrl+F5).');
