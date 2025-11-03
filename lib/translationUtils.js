/**
 * Shared utilities for translation sanitization
 * Used on both client and server side to ensure consistency
 */

export function sanitizeTranslationOutput(raw) {
  if (!raw || typeof raw !== 'string') return raw;
  let out = raw.trim();

  // Strip common heading labels (including language-specific)
  const headingPatterns = [
    /^\s*[*_\-\s]*translated\s*(text)?\s*:?\s*/i,
    /^\s*[*_\-\s]*translation\s*:?\s*/i,
    /^\s*[*_\-\s]*malayalam\s*translation\s*:?\s*/i,
    /^\s*[*_\-\s]*hindi\s*translation\s*:?\s*/i,
    /^\s*[*_\-\s]*marathi\s*translation\s*:?\s*/i,
    /^\s*[*_\-\s]*tamil\s*translation\s*:?\s*/i,
    /^\s*[*_\-\s]*telugu\s*translation\s*:?\s*/i,
    /^\s*[*_\-\s]*kannada\s*translation\s*:?\s*/i,
    /^\s*[*_\-\s]*bengali\s*translation\s*:?\s*/i
  ];
  out = out.replace(new RegExp(`^(?:${headingPatterns.map(r => r.source).join('|')})`, 'i'), '');

  // Remove bold/markdown labels like **Malayalam Translation:** at the start
  out = out.replace(/^\s*\*\*[^:]+:\*\*\s*/i, '');

  // Unwrap code fences or quotes
  out = out.replace(/^```[\s\S]*?\n([\s\S]*?)\n```\s*$/m, '$1').trim();
  out = out.replace(/^"([\s\S]*?)"\s*$/m, '$1').trim();

  // Remove "Notes on Translation" sections
  const notesIdx = out.search(/\bnotes\s+on\s+translation\b/i);
  if (notesIdx !== -1) {
    out = out.slice(0, notesIdx).trim();
  }

  // Remove "Key Features" sections
  const keyIdx = out.search(/\bkey\s+features\b[\s\S]*?:/i);
  if (keyIdx !== -1) {
    out = out.slice(0, keyIdx).trim();
  }
  out = out.replace(/\n?\*\*\s*key\s+features[\s\S]*?:\s*\*\*[\s\S]*$/i, '').trim();

  // Non-English explanation/notes headings
  const explanationHeadings = [
    /\bexplanation\b\s*:/i,
    /\bnote[s]?\b\s*:/i,
    /\bexplicación\b\s*:/i,
    /\bnota\b\s*:/i,
    /\bexplicacao\b\s*:/i,
    /\bexplication\b\s*:/i,
    /\berklarung\b\s*:/i,
    /\bشرح\b\s*:/,
    /\bتوضیح\b\s*:/,
    /\bव्याख्या\b\s*:/,
    /\bनोट\b\s*:/,
    /\bस्पष्टीकरण\b\s*:/,
    /\bटीप\b\s*:/,
    /\bनोंद\b\s*:/,
    /\bوضاحت\b\s*:/,
    /\bব্যাখ্যা\b\s*:/,
    /\bনোট\b\s*:/,
    /\bவிளக்கம்\b\s*:/,
    /\bகுறிப்பு\b\s*:/,
    /\bవివరణ\b\s*:/,
    /\bగమనిక\b\s*:/,
    /\bವಿವರಣೆ\b\s*:/,
    /\bಸೂಚನೆ\b\s*:/,
    /\bവ്യാഖ്യാനം\b\s*:/,
    /\bശ്രദ്ധിക്കുക\b\s*:/,
    /\bകുറിപ്പ്\b\s*:/,
    /\bਨੋਟ\b\s*:/,
    /\bਟਿੱਪਣੀ\b\s*:/,
    /\bનોંધ\b\s*:/,
    /\bટિપ્પણી\b\s*:/
  ];

  for (const rx of explanationHeadings) {
    const idx = out.search(new RegExp(`^\n?\s*(?:[*#\-\s]*)?(?:${rx.source})`, rx.flags || ''));
    if (idx !== -1) {
      out = out.slice(0, idx).trim();
      break;
    }
  }

  // Remove trailing parenthetical notes like (Note: ...), localized variants
  const noteWords = ['note', 'nota', 'नोट', 'नोट्स', 'নোট', 'குறிப்பு', 'గమనిక', 'ಸೂಚನೆ', 'ശ്രദ്ധിക്കുക', 'കുറിപ്പ്', 'نوٹ'];
  const notePattern = new RegExp(`\n?\(\s*(?:${noteWords.join('|')})\s*:[\s\S]*?\)\s*$`, 'i');
  out = out.replace(notePattern, '').trim();
  out = out.replace(/^\(\s*(?:note|nota)\b[\s\S]*?\)\s*$/gim, '').trim();

  // Remove separators
  out = out.replace(/^\s*[-–—]{3,}\s*$/gm, '');

  // Clean up whitespace
  out = out.replace(/[\t ]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();

  return out;
}

