import connectToDatabase from './mongodb';
import PYQ from '@/models/PYQ';
import { pyqQueryCache } from './cacheLayer';
import axios from 'axios';

const THEME_SYNONYMS = {
  economics: ['economy', 'economic', 'econom'],
  economy: ['economics', 'economic', 'econom'],
  economic: ['economics', 'economy', 'econom'],
  geo: ['geography', 'geographical'],
  geography: ['geographical', 'geo'],
  history: ['historical', 'hist'],
  historiography: ['history'],
  polity: ['political', 'politics', 'political science', 'constitution', 'constitutional'],
  politics: ['polity', 'political science'],
  environment: ['environmental', 'ecology', 'env'],
  environmental: ['environment', 'ecology'],
  ecology: ['environment'],
  technology: ['tech', 'technological'],
  technological: ['technology', 'tech'],
  science: ['scientific', 'sci'],
  scientific: ['science'],
  culture: ['art and culture', 'art'],
  art: ['culture', 'art and culture'],
  sociology: ['society', 'social'],
  society: ['sociology', 'social'],
  agriculture: ['agri', 'farming'],
  agri: ['agriculture'],
  governance: ['administration', 'policy'],
  administration: ['governance'],
};

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does',
  'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that',
  'these', 'those', 'what', 'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how',
  'about', 'related', 'regarding', 'including', 'into', 'per', 'vs', 'vs.', 'etc', 'general'
]);

const LEVEL_SINGLE_WORD_REGEX = /\b(?:mains|prelims?|preliminaries|preliminary)\b/gi;
const LEVEL_PHRASE_REGEX = /\b(?:main|prelim)\s+(?:exam|examination|paper|papers|pyqs?|questions?)\b/gi;

function stripLevelKeywords(value) {
  if (!value || typeof value !== 'string') return '';
  return value
    .replace(LEVEL_PHRASE_REGEX, '')
    .replace(LEVEL_SINGLE_WORD_REGEX, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const PYQ_FORMAT_MODEL = process.env.OPENAI_PYQ_FORMAT_MODEL || 'gpt-4o';

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeWord(word) {
  return word ? word.toLowerCase().trim() : '';
}

function stemWord(word) {
  const lower = normalizeWord(word);
  if (lower.length <= 4) return null;

  const suffixRules = [
    { suffix: 'ics', replacement: '' },
    { suffix: 'ies', replacement: 'y' },
    { suffix: 'ing', replacement: '' },
    { suffix: 'tion', replacement: '' },
    { suffix: 'sion', replacement: '' },
    { suffix: 'ment', replacement: '' },
    { suffix: 'ness', replacement: '' },
    { suffix: 'ology', replacement: '' },
    { suffix: 'ally', replacement: '' },
    { suffix: 'ity', replacement: '' },
    { suffix: 'al', replacement: '' },
    { suffix: 'ous', replacement: '' },
    { suffix: 'ive', replacement: '' },
    { suffix: 'y', replacement: '' }
  ];

  for (const rule of suffixRules) {
    if (lower.endsWith(rule.suffix)) {
      const base = lower.slice(0, -rule.suffix.length) + (rule.replacement || '');
      if (base.length >= 3 && base !== lower) {
        return base;
      }
    }
  }

  return null;
}

function buildWordPatterns(word) {
  const patterns = [];
  const normalized = normalizeWord(word);
  if (!normalized || normalized.length < 2 || STOP_WORDS.has(normalized)) {
    return patterns;
  }

  patterns.push(`\\b${escapeRegex(normalized)}\\w*`);

  const root = stemWord(normalized);
  if (root && root.length >= 3) {
    patterns.push(`\\b${escapeRegex(root)}\\w*`);
  }

  return patterns;
}

function expandThemeWords(words) {
  const expanded = new Set();
  words.forEach(word => {
    const normalized = normalizeWord(word);
    if (normalized && !STOP_WORDS.has(normalized)) {
      expanded.add(normalized);
    }
  });

  const currentWords = Array.from(expanded);
  for (const word of currentWords) {
    const synonyms = THEME_SYNONYMS[word];
    if (synonyms) {
      synonyms.forEach(syn => {
        syn.split(/\s+/).forEach(part => {
          const normalized = normalizeWord(part);
          if (normalized && !STOP_WORDS.has(normalized)) {
            expanded.add(normalized);
          }
        });
      });
    }
  }

  return Array.from(expanded);
}

class PyqService {
  constructor() {
    this.formatCache = new Map();
    this.formatCacheTTL = 10 * 60 * 1000;
  }

  calculateSimilarity(str1, str2) {
    // Check for identical strings first (including both being empty strings)
    if (str1 === str2) return 1;

    // If either is falsy (but not both, since we already checked for equality above)
    if (!str1 || !str2) return 0;

    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1;

    // Calculate Levenshtein distance
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    // Initialize matrix with proper dimensions: [str2.length+1][str1.length+1]
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [];
      // Initialize first column: cost of transforming empty string to str2[0..i-1]
      matrix[i][0] = i;
    }
    // Initialize first row: cost of transforming empty string to str1[0..j-1]
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    // Fill in the rest of the matrix
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  }

  detectExamCode(userMsg, language) {
    const patterns = [
      // UPSC should be checked FIRST (highest priority)
      { test: /\bupsc\b/i, code: 'UPSC' },

      // State PSCs with word boundaries to prevent false matches
      { test: /\btnpsc\b|tamil nadu psc/i, lang: 'ta', code: 'TNPSC' },
      { test: /\bmpsc\b|maharashtra psc/i, lang: 'mr', code: 'MPSC' },
      { test: /\bbpsc\b|bihar psc/i, code: 'BPSC' },
      { test: /\buppsc\b|uttar pradesh psc/i, code: 'UPPSC' },
      { test: /\bmppsc\b|madhya pradesh psc/i, code: 'MPPSC' },
      { test: /\bras\b|rajasthan psc/i, code: 'RAS' },
      { test: /\brpsc\b|rajasthan psc/i, code: 'RPSC' },
      { test: /\bgpsc\b|gujarat psc/i, lang: 'gu', code: 'GPSC' },
      { test: /\b(karnataka\s*psc|kpsc)\b/i, lang: 'kn', code: 'KPSC' },
      { test: /\bwbpsc\b|west bengal psc|wb psc/i, lang: 'bn', code: 'WBPSC' },
      { test: /\bppsc\b|punjab psc/i, lang: 'pa', code: 'PPSC' },
      { test: /\bopsc\b|odisha psc/i, code: 'OPSC' },
      { test: /\bapsc\b|assam psc/i, code: 'APSC' },
      { test: /\bappsc\b|andhra pradesh psc/i, code: 'APPSC' },
      { test: /\btspsc\b|telangana psc/i, lang: 'te', code: 'TSPSC' },
      { test: /(kerala\s*psc)/i, lang: 'ml', code: 'Kerala PSC' },
      { test: /\bhpsc\b|haryana psc/i, code: 'HPSC' },
      { test: /\bjkpsc\b|j\&k psc|jammu.*kashmir.*psc/i, code: 'JKPSC' },
      { test: /gpsc goa|goa psc/i, code: 'Goa PSC' },
      { test: /\bssc\b/i, code: 'SSC' },
      { test: /\bpcs\b/i, code: 'PCS' }
    ];

    for (const pattern of patterns) {
      if (pattern.test.test(userMsg) || (pattern.lang && language === pattern.lang)) {
        return pattern.code;
      }
    }

    // Default to UPSC if no exam is explicitly mentioned
    return 'UPSC';
  }

  detectLevel(userMsg) {
    if (!userMsg || typeof userMsg !== 'string') return '';
    const lowerMsg = userMsg.toLowerCase();
    const hasPrelimWord = /\bprelims?\b/.test(lowerMsg) || /\bprelim\b/.test(lowerMsg) || /\bpreliminary\b/.test(lowerMsg) || /\bpreliminaries\b/.test(lowerMsg);
    const hasPrelimPhrase = /\bprelim(?:s)?\s+(?:pyqs?|questions?|papers?|exam|examination)\b/.test(lowerMsg);
    const hasMainWord = /\bmains\b/.test(lowerMsg);
    const hasMainPhrase = /\bmain\s+(?:pyqs?|questions?|papers?|exam|examination)\b/.test(lowerMsg);
    const hasPrelim = hasPrelimWord || hasPrelimPhrase;
    const hasMains = hasMainWord || hasMainPhrase;
    if (hasPrelim && !hasMains) return 'Prelims';
    if (hasMains && !hasPrelim) return 'Mains';
    return '';
  }

  parseQuery(userMsg, language) {
    const originalMsg = userMsg;
    const lowerMsg = userMsg.toLowerCase();
    const level = this.detectLevel(userMsg);

    // Normalize "qs" to "questions" for easier matching
    userMsg = userMsg.replace(/\bqs\b/gi, 'questions');

    // Extract years first (before cleaning, as we need them from original message)
    const rangeMatch = userMsg.match(/from\s+(\d{4})(?:s)?\s*(?:to|\-|–|—)\s*(present|\d{4})/i);
    const decadeMatch = userMsg.match(/(\d{4})s\b/i);
    const singleYearMatch = userMsg.match(/\b(19|20)\d{2}\b/);

    let fromYear = null;
    let toYear = null;

    if (rangeMatch) {
      fromYear = parseInt(rangeMatch[1], 10);
      toYear = rangeMatch[2].toLowerCase() === 'present'
        ? new Date().getFullYear()
        : parseInt(rangeMatch[2], 10);
    } else if (decadeMatch) {
      fromYear = parseInt(decadeMatch[1], 10);
      toYear = fromYear + 9;
    } else if (singleYearMatch && !fromYear) {
      // If a single year is mentioned, use it as a starting point
      const year = parseInt(singleYearMatch[0], 10);
      if (year >= 1990 && year <= new Date().getFullYear()) {
        fromYear = year;
        toYear = new Date().getFullYear();
      }
    }

    // Remove common polite phrases and connectors (including command verbs and new instructions)
    let cleanMsg = userMsg.replace(/\b(can you|could you|would you|please|kindly|i need|i want|i'd like|solve|answer|explain|provide|critical|insights|insight)\b/gi, '');
    cleanMsg = cleanMsg.replace(/\b(show|give|get|find|search|fetch|list|bring|tell|need|want|bring|solve|answer|explain|provide)\s+(?:me|this|the|us|additional|more)\b/gi, '');
    cleanMsg = cleanMsg.replace(/and\s+provide\s+critical\s+insights:?/gi, '');
    cleanMsg = cleanMsg.replace(/provide\s+critical\s+insights:?/gi, '');

    // Pattern 1: Preposition-based (highest priority) - "on economics", "about history", "for geography"
    const prepMatch = cleanMsg.match(/(?:on|about|of|for|related to|regarding)\s+([^.,;\n]+?)(?:\s+(?:from|to|in|\d{4})|$)/i);
    if (prepMatch) {
      let theme = prepMatch[1].trim();
      // Remove year mentions from theme
      theme = theme.replace(/\s*\b(from|to|\d{4})\b.*$/i, '').trim();
      if (theme.length > 0) {
        return this._processTheme(theme, fromYear, toYear, userMsg, language, level);
      }
    }

    // Pattern 2: PYQ keywords before theme - "pyqs on economics", "questions about history"
    const pyqBeforeMatch = userMsg.match(/(?:pyq|pyqs|previous year|past year|questions|question)\s+(?:on|about|of|for|related to)?\s*([a-zA-Z][^.,;\n]+?)(?:\s+(?:from|to|\d{4})|$)/i);
    if (pyqBeforeMatch) {
      let theme = pyqBeforeMatch[1].trim();
      theme = theme.replace(/\s*\b(from|to|\d{4})\b.*$/i, '').trim();
      // Remove common stop words
      theme = theme.replace(/\b(the|a|an|all|some|any)\b/gi, '').trim();
      if (theme.length > 0 && !/^(give|show|get|find|search|fetch|list|bring|tell|me|need|want)$/i.test(theme)) {
        return this._processTheme(theme, fromYear, toYear, userMsg, language, level);
      }
    }

    // Pattern 3: Theme before PYQ keywords - "eco pyqs", "history questions", "economics pyq", "Give history pyqs"
    // This pattern should match even when there's a verb before the theme
    const themeBeforeMatch = userMsg.match(/(?:give|show|get|find|search|fetch|list|bring|tell|need|want|me\s+)?\b([a-zA-Z][a-zA-Z\s]{1,40}?)\s+(?:pyq|pyqs|previous year|past year|questions|question|qs)\b/i);
    if (themeBeforeMatch) {
      let theme = themeBeforeMatch[1].trim();
      // Remove common verbs and exam names (but keep the actual theme)
      theme = theme.replace(/\b(give|show|get|find|search|fetch|list|bring|tell|need|want|bring|can|could|would|please|kindly|i|me|my|the|a|an)\b/gi, '').trim();
      // Remove exam codes
      theme = theme.replace(/\b(upsc|pcs|ssc|exam|exams)\b/gi, '').trim();
      if (theme.length > 0) {
        return this._processTheme(theme, fromYear, toYear, userMsg, language, level);
      }
    }

    // Pattern 4: Verb-based - "give eco", "show economics", "get history questions", "Give history pyqs"
    // Improved to handle "Give history pyqs" pattern
    const verbMatch = cleanMsg.match(/(?:give|show|get|find|search|fetch|list|bring|tell|need|want)\s+(?:me\s+)?([a-zA-Z][^.,;\n]+?)(?:\s+(?:pyq|pyqs|question|questions|from|to|\d{4})|$)/i);
    if (verbMatch) {
      let theme = verbMatch[1].trim();
      // Remove PYQ keywords and years from theme
      theme = theme.replace(/\s*\b(pyq|pyqs|question|questions|from|to|\d{4})\b.*$/i, '').trim();
      // Remove exam codes
      theme = theme.replace(/\b(upsc|pcs|ssc|exam|exams)\b/gi, '').trim();
      if (theme.length > 0 && !/^(the|a|an|all|some|any)$/i.test(theme)) {
        return this._processTheme(theme, fromYear, toYear, userMsg, language, level);
      }
    }

    // Pattern 5: Theme/Topic wise patterns - "theme wise pyqs of history", "topic wise pyqs on economics"
    // First try with explicit preposition (more specific)
    const wiseMatchWithPrep = userMsg.match(/(?:theme|topic|subject)\s+wise\s+(?:pyq|pyqs|questions?|qs)\s+(?:of|on|about|for|related\s+to)\s+([a-zA-Z][^.,;\n]+?)(?:\s+(?:from|to|\d{4})|$)/i);
    if (wiseMatchWithPrep) {
      let theme = wiseMatchWithPrep[1].trim();
      // Remove year mentions from theme
      theme = theme.replace(/\s*\b(from|to|\d{4})\b.*$/i, '').trim();
      // Remove common stop words
      theme = theme.replace(/\b(the|a|an|all|some|any)\b/gi, '').trim();
      if (theme.length > 0) {
        return this._processTheme(theme, fromYear, toYear, userMsg, language, level);
      }
    }

    // Then try without explicit preposition (theme/topic wise pyqs [subject])
    const wiseMatch = userMsg.match(/(?:theme|topic|subject)\s+wise\s+(?:pyq|pyqs|questions?|qs)\s+([a-zA-Z][^.,;\n]+?)(?:\s+(?:from|to|\d{4})|$)/i);
    if (wiseMatch) {
      let theme = wiseMatch[1].trim();
      // Remove year mentions from theme
      theme = theme.replace(/\s*\b(from|to|\d{4})\b.*$/i, '').trim();
      // Remove common stop words
      theme = theme.replace(/\b(the|a|an|all|some|any)\b/gi, '').trim();
      if (theme.length > 0) {
        return this._processTheme(theme, fromYear, toYear, userMsg, language, level);
      }
    }

    // Pattern 6: Just a subject/topic word (fallback) - "economics", "eco", "history"
    // Remove all PYQ and exam-related keywords
    cleanMsg = userMsg.replace(/\b(upsc|pcs|ssc|exam|exams|pyq|pyqs|previous year|past year|questions|question|papers|paper|give|show|get|find|search|fetch|list|bring|tell|me|the|a|an|all|some|any|from|to|in|on|at|for|of|about|can|could|would|please|kindly|need|want|i|theme|topic|subject|wise)\b/gi, '');
    const words = cleanMsg.trim().split(/\s+/).filter(w => w.length > 1 && !/^\d+$/.test(w));
    if (words.length > 0) {
      // Take first 1-3 significant words
      const theme = words.slice(0, 3).join(' ').trim();
      if (theme.length > 0) {
        return this._processTheme(theme, fromYear, toYear, userMsg, language, level);
      }
    }

    // If no theme found, return empty theme
    const examCode = this.detectExamCode(userMsg, language);
    return { theme: '', fromYear, toYear, examCode, level };
  }

  _processTheme(theme, fromYear, toYear, userMsg, language, levelHint = '') {
    // Clean up theme: remove trailing punctuation and extra whitespace
    theme = theme.replace(/[.,;:!?]+$/, '').trim();
    theme = theme.replace(/\s+/g, ' ');

    // Remove common stop words that might have been missed (including command verbs)
    theme = theme.replace(/\b(give|show|get|find|search|fetch|list|bring|tell|me|the|a|an|all|some|any|need|want|bring|can|could|would|please|kindly|i|my|more|other|another|solve|answer|explain)\b/gi, '').trim();
    theme = stripLevelKeywords(theme);

    // Expand common abbreviations
    const abbreviations = {
      'eco': 'economics',
      'economic': 'economics',
      'geo': 'geography',
      'geographical': 'geography',
      'hist': 'history',
      'historical': 'history',
      'pol': 'polity',
      'political': 'polity',
      'political science': 'polity',
      'sci': 'science',
      'tech': 'technology',
      'technological': 'technology',
      'env': 'environment',
      'environmental': 'environment',
      'art': 'art and culture',
      'culture': 'art and culture',
      'ethics': 'ethics',
      'ethical': 'ethics'
    };

    const lowerTheme = theme.toLowerCase();
    for (const [abbr, full] of Object.entries(abbreviations)) {
      // Check if theme starts with abbreviation or is exactly the abbreviation
      if (lowerTheme === abbr || lowerTheme.startsWith(abbr + ' ') || lowerTheme === abbr.replace(/\s+.*$/, '')) {
        theme = full;
        break;
      }
      // Also check for partial matches in multi-word themes
      if (lowerTheme.includes(abbr) && abbr.length > 3) {
        theme = theme.replace(new RegExp(`\\b${abbr}\\b`, 'i'), full);
        break;
      }
    }

    const examCode = this.detectExamCode(userMsg, language);
    const resolvedLevel = levelHint || this.detectLevel(userMsg);
    return { theme: theme.trim(), fromYear, toYear, examCode, level: resolvedLevel };
  }

  buildFilter(params) {
    const { examCode, fromYear, toYear, level } = params;

    const filter = {
      exam: new RegExp(`^${examCode}$`, 'i'),
      year: {
        $gte: fromYear || 1990,
        $lte: toYear || new Date().getFullYear()
      },
      // Exclude questions marked as invalid during cleanup
      _invalid: { $ne: true }
    };

    if (level) {
      filter.level = new RegExp(`^${level}$`, 'i');
    }

    return filter;
  }

  async queryDatabase(filter, theme, options = {}) {
    const { skip = 0, limit = 50 } = options;

    try {
      await connectToDatabase();

      let query;

      if (theme) {
        const escapedTheme = escapeRegex(theme.trim());

        // Split theme into words for better matching
        const rawWords = theme.split(/\s+/).filter(Boolean);
        const themeWords = expandThemeWords(rawWords);

        // Build multiple search patterns for better matching
        const searchPatterns = [];

        // 1. Exact phrase match (highest priority)
        if (escapedTheme) {
          searchPatterns.push(escapedTheme);
        }

        // 2. Individual word matches with simple stemming
        themeWords.forEach(word => {
          const wordPatterns = buildWordPatterns(word);
          wordPatterns.forEach(pattern => searchPatterns.push(pattern));
        });

        const combinedRegex = searchPatterns.length > 0
          ? new RegExp(`(${searchPatterns.join('|')})`, 'i')
          : null;

        const searchConditions = [];

        // PRIORITY 1: Search in topicTags (most reliable field)
        if (combinedRegex) {
          searchConditions.push({ topicTags: { $regex: combinedRegex } });
        }

        // PRIORITY 2: Search in keywords field (often populated)
        if (combinedRegex) {
          searchConditions.push({ keywords: { $regex: combinedRegex } });
        }

        // PRIORITY 3: Search in question text
        if (combinedRegex) {
          searchConditions.push({ question: { $regex: combinedRegex } });
        }

        // PRIORITY 4: Search in theme field (mostly null, but check anyway)
        if (theme.length > 3) {
          searchConditions.push({
            theme: {
              $regex: new RegExp(escapedTheme, 'i'),
              $ne: null,
              $ne: ''
            }
          });
        }

        // Add individual word-level searches for better coverage
        themeWords.forEach(word => {
          const wordPatterns = buildWordPatterns(word);
          wordPatterns.forEach(pattern => {
            const wordRegex = new RegExp(pattern, 'i');
            searchConditions.push(
              { topicTags: { $regex: wordRegex } },
              { keywords: { $regex: wordRegex } },
              { question: { $regex: wordRegex } }
            );
          });
        });

        const queryFilter = { ...filter };
        if (searchConditions.length > 0) {
          queryFilter.$or = searchConditions;
        }

        query = PYQ.find(queryFilter).sort({ year: -1 }).skip(skip).limit(limit);
      } else {
        query = PYQ.find(filter).sort({ year: -1 }).skip(skip).limit(limit);
      }

      const items = await query.lean().exec();
      return items;

    } catch (error) {
      console.error('PYQ query error:', error.message);

      if (theme) {
        try {
          // Fallback: simpler regex search with escaped theme
          const simpleRegex = new RegExp(escapeRegex(theme), 'i');
          const fallbackQuery = PYQ.find({
            ...filter,
            $or: [
              { topicTags: { $regex: simpleRegex } },
              { keywords: { $regex: simpleRegex } },
              { question: { $regex: simpleRegex } },
              { theme: { $regex: simpleRegex, $ne: null, $ne: '' } }
            ]
          }).sort({ year: -1 }).skip(skip).limit(limit);

          return await fallbackQuery.lean().exec();
        } catch (fallbackError) {
          console.error('PYQ fallback query error:', fallbackError.message);
          return [];
        }
      }

      return [];
    }
  }

  async processRawDBResultsWithLLM(rawItems, params) {
    if (!rawItems || rawItems.length === 0) return rawItems;

    // Skip LLM processing if disabled or if we have very few items that look okay
    if (process.env.ENABLE_PYQ_LLM_PROCESSING === 'false') return rawItems;

    // Performance optimization: If items are already verified or look clean, skip LLM for small sets
    if (rawItems.length <= 3 && rawItems.every(item => item.verified || (item.question && item.question.length > 50 && !item.question.includes('<')))) {
      console.log('[PYQ Service] Skipping LLM cleaning: results look clean');
      return rawItems;
    }

    const openAIKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY;
    if (!openAIKey) return rawItems;

    const BATCH_SIZE = 5;
    const PROCESSING_TIMEOUT = 10000; // Reduced from 15s to 10s
    const MAX_BATCHES_TO_PROCESS = 3; // Reduced from 4 to 3
    const processedItems = [];
    const maxItemsToProcess = Math.min(rawItems.length, MAX_BATCHES_TO_PROCESS * BATCH_SIZE);

    console.log(`[PYQ Service] LLM cleaning for ${maxItemsToProcess}/${rawItems.length} items in ${Math.ceil(maxItemsToProcess / BATCH_SIZE)} batches`);
    const startTime = Date.now();

    for (let i = 0; i < maxItemsToProcess; i += BATCH_SIZE) {
      const batch = rawItems.slice(i, i + BATCH_SIZE);
      const batchStartTime = Date.now();

      try {
        const processingPromise = (async () => {
          const batchData = batch.map((item, idx) => ({
            index: i + idx,
            question: item.question || '',
            year: item.year || null,
            paper: item.paper || 'General',
            exam: item.exam || params.examCode || 'UPSC',
            topicTags: item.topicTags || [],
            keywords: item.keywords || [],
            verified: item.verified || false
          }));

          const systemPrompt = `Clean and analyze PYQ database items. Remove scraper artifacts, HTML, UI elements. Preserve original question text exactly. Return JSON array with cleaned items.`;
          const userPrompt = `Process ${batch.length} PYQ items:\n${JSON.stringify(batchData, null, 2)}\n\nReturn JSON array with cleaned questions, topicTags, keywords, isComplete, needsReview.`;

          const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
              model: 'gpt-4o-mini', // Use faster model for cleaning if possible
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
              ],
              max_tokens: 2000,
              temperature: 0.2,
              response_format: { type: 'json_object' } // Ensure JSON
            },
            {
              headers: {
                'Authorization': `Bearer ${openAIKey}`,
                'Content-Type': 'application/json'
              },
              timeout: PROCESSING_TIMEOUT
            }
          );

          const aiContent = response.data?.choices?.[0]?.message?.content;
          if (!aiContent) {
            processedItems.push(...batch);
            return;
          }

          try {
            const data = JSON.parse(aiContent);
            const parsed = data.items || data.questions || data.cleaned_items || Object.values(data).find(v => Array.isArray(v)) || (Array.isArray(data) ? data : null);

            if (Array.isArray(parsed) && parsed.length > 0) {
              parsed.forEach((processed) => {
                const original = batch[processed.index - i];
                if (original) {
                  processedItems.push({
                    ...original,
                    question: processed.question || original.question,
                    topicTags: processed.topicTags?.length > 0 ? processed.topicTags : original.topicTags,
                    keywords: processed.keywords?.length > 0 ? processed.keywords : original.keywords,
                    _processed: true,
                    _isComplete: processed.isComplete !== false,
                    _needsReview: processed.needsReview === true
                  });
                }
              });
              return;
            }
          } catch (parseError) {
            console.warn('[PYQ Service] JSON parse error in batch cleaning:', parseError.message);
          }
          processedItems.push(...batch);
        })();

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), PROCESSING_TIMEOUT)
        );

        await Promise.race([processingPromise, timeoutPromise]);
        console.log(`[PYQ Service] Batch ${i / BATCH_SIZE + 1} took ${Date.now() - batchStartTime}ms`);

      } catch (error) {
        console.warn(`[PYQ Service] LLM cleaning error/timeout for batch ${i / BATCH_SIZE + 1}:`, error.message);
        processedItems.push(...batch);
      }
    }

    if (maxItemsToProcess < rawItems.length) {
      processedItems.push(...rawItems.slice(maxItemsToProcess));
    }

    console.log(`[PYQ Service] Total LLM cleaning took ${Date.now() - startTime}ms`);
    return processedItems;
  }

  formatResults(items, params, options = {}) {
    if (!items || items.length === 0) return null;

    const { theme, fromYear, toYear, examCode, level } = params;
    const { limit = 50 } = options;

    const sortedItems = items.sort((a, b) => {
      const aVerified = a.verified === true || (a.sourceLink && a.sourceLink.includes('.gov.in'));
      const bVerified = b.verified === true || (b.sourceLink && b.sourceLink.includes('.gov.in'));
      if (aVerified !== bVerified) return bVerified ? 1 : -1;
      return (b.year || 0) - (a.year || 0);
    });

    const byYear = new Map();
    const seenQuestions = new Set();
    // Track actually displayed questions for accurate count calculation
    const displayedQuestions = [];
    const sanitizeQuestionText = (text) => {
      if (!text) return '';

      let cleaned = text;

      // Step 1: Remove HTML tags and entities
      cleaned = cleaned.replace(/<[^>]+>/g, '');
      cleaned = cleaned.replace(/&nbsp;/g, ' ');
      cleaned = cleaned.replace(/&amp;/g, '&');
      cleaned = cleaned.replace(/&lt;/g, '<');
      cleaned = cleaned.replace(/&gt;/g, '>');
      cleaned = cleaned.replace(/&quot;/g, '"');
      cleaned = cleaned.replace(/&#\d+;/g, '');

      // Step 2: Remove scraper artifacts and metadata
      cleaned = cleaned.replace(/\[INST\].*?\[\/INST\]/gi, '');
      cleaned = cleaned.replace(/\[SYS\].*?\[\/SYS\]/gi, '');
      cleaned = cleaned.replace(/Source:|Retrieved from:|Scraped from:/gi, '');
      cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, ''); // Remove URLs
      cleaned = cleaned.replace(/www\.[^\s]+/g, '');

      // Step 3: Remove duplicate question numbers and prefixes
      cleaned = cleaned.replace(/^Q\d+[:\.\)]\s*/i, '');
      cleaned = cleaned.replace(/^Question\s+\d+[:\.\)]\s*/i, '');
      cleaned = cleaned.replace(/^[\dA-Za-z]+\s*[\)\.\\-\]]\s+/, '');
      cleaned = cleaned.replace(/^\[[^\]]+\]\s*/, '');

      // Step 4: Fix spacing issues
      cleaned = cleaned.replace(/\s+/g, ' '); // Multiple spaces to single
      cleaned = cleaned.replace(/\t+/g, ' '); // Tabs to spaces
      cleaned = cleaned.replace(/\n+/g, ' '); // Newlines to spaces
      cleaned = cleaned.replace(/\s*\|\s*/g, ' | '); // Fix pipe spacing

      // Step 5: Remove garbled text patterns
      cleaned = cleaned.replace(/[^\x20-\x7E\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F]/g, ''); // Remove non-printable chars
      cleaned = cleaned.replace(/[▪•●○■□◆◇★☆]/g, ''); // Remove bullet points
      cleaned = cleaned.replace(/[→←↑↓⇒⇐]/g, ''); // Remove arrows

      // Step 6: Fix common OCR errors
      cleaned = cleaned.replace(/\bl\b/g, 'I'); // lowercase L to uppercase I in standalone
      cleaned = cleaned.replace(/\b0\b/g, 'O'); // zero to O in standalone
      cleaned = cleaned.replace(/(\d)\s+(\d)/g, '$1$2'); // Fix split numbers

      // Step 7: Clean up punctuation
      cleaned = cleaned.replace(/\s+([,\.;:!?])/g, '$1'); // Remove space before punctuation
      cleaned = cleaned.replace(/([,\.;:!?])([^\s])/g, '$1 $2'); // Add space after punctuation
      cleaned = cleaned.replace(/\.{2,}/g, '.'); // Multiple periods to single
      cleaned = cleaned.replace(/\?{2,}/g, '?'); // Multiple question marks to single

      // Step 8: Remove incomplete sentences at the end
      if (cleaned.endsWith('...')) {
        // Keep it, it's intentional truncation
      } else if (cleaned.length > 50 && !cleaned.match(/[.!?]$/)) {
        // If long text doesn't end with punctuation, it might be incomplete
        // But don't modify it - let it be
      }

      // Step 9: Capitalize first letter
      cleaned = cleaned.trim();
      if (cleaned.length > 0) {
        cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      }

      // Step 10: Remove common garbage patterns
      cleaned = cleaned.replace(/^(and solve them|subject and solve them|history subject and solve them)$/i, '');
      cleaned = cleaned.replace(/^\d+\.\s*$/, ''); // Just a number with period

      return cleaned.trim();
    };

    for (const q of sortedItems) {
      const year = q.year || 0;
      if (year < 1990 || year > new Date().getFullYear()) continue;

      let questionText = q.question || '';
      if (!questionText || questionText.trim().length < 10) continue;
      if (/^###\s*📅|^📅\s*\d{4}|^Year\s+Range:|^Topic:/i.test(questionText)) continue;
      if (/^\d+\.\s*###|^\d+\.\s*📅/i.test(questionText)) continue;
      if (/^Year\s+Range:\s*\d{4}/i.test(questionText)) continue;
      if (/^Topic:\s*[A-Za-z\s]+$/i.test(questionText)) continue;
      if (/^Geography\s+from\s+\d{4}/i.test(questionText)) continue;
      if (/^history\s+for$/i.test(questionText)) continue;
      if (/^Summary|^Total:|^Verified:|^Unverified:/i.test(questionText)) continue;
      if (questionText.trim().length < 20 && /^(Year|Topic|Summary|Total|Verified|Unverified)/i.test(questionText)) continue;

      if (!byYear.has(year)) byYear.set(year, []);

      const hasGovSource = q.sourceLink && q.sourceLink.includes('.gov.in');
      const isVerified = q.verified === true || hasGovSource;
      const isUnverified = !isVerified;
      const topicTags = q.topicTags && q.topicTags.length > 0
        ? q.topicTags.join(', ')
        : null;
      const hasAnalysis = q.analysis && q.analysis.trim().length > 0;
      const hasKeywords = q.keywords && q.keywords.length > 0;

      // Truncate very long questions but preserve important content
      if (questionText.length > 2000) {
        // Try to truncate at sentence boundary if possible
        const truncated = questionText.substring(0, 1997);
        // Find last occurrence of sentence-ending punctuation AFTER position 1800
        // Only use sentence boundary truncation if punctuation exists at or after 1800
        const searchStart = 1800; // Only look for punctuation from this position onwards
        const lastPeriod = truncated.lastIndexOf('.', truncated.length);
        const lastQuestion = truncated.lastIndexOf('?', truncated.length);
        const lastExclamation = truncated.lastIndexOf('!', truncated.length);

        // Find the latest punctuation that occurs at or after position 1800
        let lastSentence = -1;
        if (lastPeriod >= searchStart) lastSentence = Math.max(lastSentence, lastPeriod);
        if (lastQuestion >= searchStart) lastSentence = Math.max(lastSentence, lastQuestion);
        if (lastExclamation >= searchStart) lastSentence = Math.max(lastSentence, lastExclamation);

        // Only use sentence boundary truncation if we found punctuation at or after 1800
        if (lastSentence >= searchStart) {
          questionText = truncated.substring(0, lastSentence + 1) + '...';
        } else {
          // No sentence boundary found at or after 1800, use simple truncation
          questionText = truncated + '...';
        }
      }

      // Clean and normalize question text BEFORE duplicate detection
      const normalizedQuestionText = sanitizeQuestionText(questionText) || questionText.trim();

      // ===== QUALITY VALIDATION - Filter out garbage questions =====
      // Only filter TRULY broken questions

      // Skip if starts with ONLY an MCQ option (no question text)
      if (/^[()[]]\s*[a-d]\s*[)]]\s*$/i.test(normalizedQuestionText)) continue;

      // REMOVED: LaTeX filter - allow math notation in valid questions

      // Skip if starts with incomplete option pattern AND is very short
      if (/^\([a-d]\)\s+[A-Z]/.test(normalizedQuestionText) && normalizedQuestionText.length < 50) continue;

      // Skip if ends with incomplete phrase (but allow if question is long)
      if (normalizedQuestionText.length < 80 && /\s+(and|or|the|a|an|of|in|on|at|to|for|with)$/i.test(normalizedQuestionText)) continue;

      // Skip if excessive numbers without context
      const numberCount = (normalizedQuestionText.match(/\d+/g) || []).length;
      const wordCount = normalizedQuestionText.split(/\s+/).length;
      if (numberCount > 15 && wordCount < 10) continue; // 15+ numbers in <10 words

      // Skip if no meaningful content
      const hasVerb = /\b(is|are|was|were|do|does|did|can|could|will|would|should|has|have|had|explain|discuss|describe|analyze|compare|evaluate)\b/i.test(normalizedQuestionText);
      const hasQuestionWord = /\b(what|which|who|where|when|why|how)\b/i.test(normalizedQuestionText);
      const hasQuestionMark = normalizedQuestionText.includes('?');
      if (!hasVerb && !hasQuestionWord && !hasQuestionMark && normalizedQuestionText.length < 100) continue;

      // Skip if too short after cleaning (reduced threshold)
      if (normalizedQuestionText.length < 25) continue;

      // ===== RELEVANCE FILTERING - Filter out misclassified questions =====
      // Only apply if we have a specific theme/subject
      if (theme && theme.length > 2) {
        const themeLower = theme.toLowerCase();
        const questionLower = normalizedQuestionText.toLowerCase();

        // Define subject-specific negative filters (questions that DON'T belong)
        const subjectFilters = {
          geography: /\b(robot|robotic|arm\s+architecture|scara|gantry|cnc|machine\s+tool|cutting\s+tool|hss|carbide|turritella|metamorphic\s+reactions|geothermometry)\b/i,
          history: /\b(railway\s+service\s+conduct|ccs\s+conduct\s+rules|sexual\s+harassment\s+of\s+working|internal\s+committee|complaint\s+committee|aggrieved\s+female|government\s+servant.*leave|encashment.*leave|ltc|geological\s+history|geological\s+timescale)\b/i,
          economics: /\b(robot|robotic|lichen|bryophyte|geological|metamorphic|turritella|arm\s+architecture)\b/i,
          polity: /\b(robot|robotic|geological|lichen|turritella|metamorphic\s+reactions)\b/i
        };

        // Check if theme matches a subject with filters
        for (const [subject, filterRegex] of Object.entries(subjectFilters)) {
          if (themeLower.includes(subject) ||
            (subject === 'geography' && /\b(geo)\b/i.test(themeLower)) ||
            (subject === 'history' && /\b(hist)\b/i.test(themeLower)) ||
            (subject === 'economics' && /\b(eco|economy)\b/i.test(themeLower)) ||
            (subject === 'polity' && /\b(pol|politic)\b/i.test(themeLower))) {
            // Apply negative filter - skip if question matches the irrelevant pattern
            if (filterRegex.test(normalizedQuestionText)) {
              continue; // Skip this question - it's misclassified
            }
          }
        }
      }

      // Normalize question for duplicate detection (more robust)
      const normalizedQuestion = normalizedQuestionText.toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s]/g, '')
        .trim()
        .substring(0, 150); // Increased from 100 to 150 for better duplicate detection

      // Skip if we've seen this exact question (or very similar)
      if (seenQuestions.has(normalizedQuestion)) {
        continue;
      }

      // Also check for near-duplicates (90% similarity)
      // Optimize: Use early termination and limit comparisons to avoid O(n²) complexity
      let isDuplicate = false;
      const currentLength = normalizedQuestion.length;
      const seenArray = Array.from(seenQuestions);

      // Limit comparisons to most recent questions (last 30) to reduce complexity
      // Most duplicates appear close together in the result set
      const recentSeen = seenArray.slice(-30);

      for (const seen of recentSeen) {
        // Quick length-based filter: if lengths differ by >10%, can't be 90% similar
        const seenLength = seen.length;
        const lengthDiff = Math.abs(currentLength - seenLength);
        const maxLength = Math.max(currentLength, seenLength);

        // Skip if length difference is too large (>10% of max length)
        if (maxLength > 0 && lengthDiff / maxLength > 0.1) {
          continue;
        }

        // Quick prefix/substring check before expensive Levenshtein
        // If first 20 chars don't match at all, unlikely to be 90% similar
        const prefix1 = normalizedQuestion.substring(0, Math.min(20, currentLength));
        const prefix2 = seen.substring(0, Math.min(20, seenLength));
        if (prefix1 !== prefix2 && this.calculateSimilarity(prefix1, prefix2) < 0.5) {
          continue;
        }

        // Only perform expensive similarity check if quick checks pass
        const similarity = this.calculateSimilarity(normalizedQuestion, seen);
        if (similarity > 0.9) {
          isDuplicate = true;
          break;
        }
      }

      if (isDuplicate) {
        continue;
      }

      seenQuestions.add(normalizedQuestion);

      // Track this question as displayed (for accurate count calculation)
      displayedQuestions.push(q);

      // Use normalized text for final display
      questionText = normalizedQuestionText;

      // Clean paper name
      const paperName = (q.paper || 'General').trim();

      // Format topic tags - limit length and clean
      let topicTagsFormatted = null;
      if (topicTags) {
        const tags = topicTags.split(',').map(t => t.trim()).filter(t => t.length > 0);
        if (tags.length > 0) {
          // Limit total topic tags length to 60 chars
          let tagsStr = tags.join(', ');
          if (tagsStr.length > 60) {
            tagsStr = tags.slice(0, 2).join(', ') + '...';
          }
          // Only add if not already in question text
          if (!questionText.toLowerCase().includes(tagsStr.toLowerCase().substring(0, 30))) {
            topicTagsFormatted = tagsStr;
          }
        }
      }

      const statusParts = [];
      if (isUnverified) {
        statusParts.push('Needs verification');
      } else if (isVerified) {
        statusParts.push('Verified');
      }
      if (hasAnalysis || hasKeywords) {
        statusParts.push('Analysis available');
      }

      byYear.get(year).push({
        question: questionText,
        paperName,
        topicTags: topicTagsFormatted,
        statusParts
      });
    }

    // Calculate verification counts BEFORE using them
    const verifiedCount = displayedQuestions.filter(q =>
      q.verified === true || (q.sourceLink && q.sourceLink.includes('.gov.in'))
    ).length;
    const unverifiedCount = displayedQuestions.length - verifiedCount;

    // Calculate sorted years
    const sortedYears = Array.from(byYear.keys()).sort((a, b) => b - a);

    const lines = [];

    // ===== HEADER SECTION =====
    const levelLabel = level ? ` ${level}` : '';
    lines.push(`🎓 ${examCode}${levelLabel} Previous Year Questions`);
    lines.push('');

    // ===== STATISTICS SECTION =====
    lines.push(`📊 **Search Results**`);
    lines.push('');
    lines.push(`Total Questions Found: **${displayedQuestions.length}**`);

    // Verification breakdown
    const verificationPercent = displayedQuestions.length > 0
      ? Math.round((verifiedCount / displayedQuestions.length) * 100)
      : 0;
    lines.push(`Verification Status: ✅ ${verifiedCount} verified (${verificationPercent}%) | ⚠️ ${unverifiedCount} unverified`);
    lines.push('');

    // Year distribution visualization
    const yearCounts = {};
    sortedYears.forEach(year => {
      yearCounts[year] = byYear.get(year).length;
    });

    if (sortedYears.length > 0) {
      lines.push(`📅 **Year Distribution**`);
      lines.push('');
      const maxCount = Math.max(...Object.values(yearCounts));
      sortedYears.slice(0, 5).forEach(year => { // Show top 5 years
        const count = yearCounts[year];
        const barLength = Math.ceil((count / maxCount) * 20);
        const bar = '█'.repeat(barLength);
        lines.push(`${year}: ${bar} ${count} question${count > 1 ? 's' : ''}`);
      });
      if (sortedYears.length > 5) {
        lines.push(`... and ${sortedYears.length - 5} more years`);
      }
      lines.push('');
    }

    // ===== METADATA SECTION =====
    const metadataLines = [];
    if (theme) {
      metadataLines.push(`📚 Topic: **${theme}**`);
    }
    if (fromYear || toYear) {
      metadataLines.push(`📆 Year Range: ${fromYear || 'All'} – ${toYear || 'Present'}`);
    }
    if (metadataLines.length > 0) {
      lines.push(...metadataLines);
      lines.push('');
    }

    lines.push('---');
    lines.push('');

    // ===== QUESTIONS SECTION =====
    for (const year of sortedYears) {
      const yearQuestions = byYear.get(year);
      if (yearQuestions.length === 0) continue;

      // Year header with badge
      lines.push(`### 📅 Year ${year} (${yearQuestions.length} question${yearQuestions.length > 1 ? 's' : ''})`);
      lines.push('');

      // Questions with enhanced formatting
      yearQuestions.forEach((entry, idx) => {
        // Question number and text
        lines.push(`**${idx + 1}.** ${entry.question}`);

        // Metadata line with badges
        const badges = [];

        // Paper badge
        if (entry.paperName && entry.paperName !== 'General') {
          badges.push(`📄 ${entry.paperName}`);
        }

        // Topic tags
        if (entry.topicTags) {
          badges.push(`🏷️ ${entry.topicTags}`);
        }

        // Status badges
        if (entry.statusParts && entry.statusParts.length > 0) {
          entry.statusParts.forEach(status => {
            if (status.includes('Verified')) {
              badges.push(`✅ Verified`);
            } else if (status.includes('verification')) {
              badges.push(`⚠️ Unverified`);
            } else if (status.includes('Analysis')) {
              badges.push(`📊 Analysis Available`);
            }
          });
        }

        if (badges.length > 0) {
          lines.push(`   ${badges.join(' • ')}`);
        }

        lines.push('');
      });
    }

    // ===== SUMMARY SECTION =====
    lines.push('---');
    lines.push('');
    lines.push('### 💡 Quick Actions');
    lines.push('');
    lines.push('• **Solve a question**: Say "solve question [number]" or paste the question');
    lines.push('• **Get more questions**: Say "more" or "load more questions"');
    lines.push('• **Refine search**: Try "PYQ on [topic] from [year]"');
    lines.push('• **Analysis**: Say "analyze question [number]" for detailed breakdown');
    lines.push('');

    // Tips for better results (only if many results)
    if (sortedItems.length >= limit) {
      lines.push('### 🎯 Search Tips');
      lines.push('');
      lines.push('• Be specific: "Prelims PYQ on Indian Economy from 2020"');
      lines.push('• Use year ranges: "PYQ from 2018 to 2024"');
      lines.push('• Specify papers: "GS-2 questions on Polity"');
      lines.push('');
    }

    // Verification notice
    if (unverifiedCount > 0) {
      lines.push('> ⚠️ **Note**: Unverified questions should be cross-checked with official sources before use.');
      lines.push('');
    }

    // CRITICAL: Join with newlines - this MUST preserve newlines
    // Use explicit newline character to ensure it works
    const NEWLINE = '\n';
    let result = lines.join(NEWLINE);

    // ABSOLUTE VALIDATION: Check if newlines exist
    if (!result.includes(NEWLINE)) {
      console.error('CRITICAL: lines.join(\\n) failed! Lines:', lines.length, 'First 3:', lines.slice(0, 3).join('\n'));
      // Force reconstruction with explicit newlines
      result = lines.map((line, idx) => idx === 0 ? line : NEWLINE + line).join('');
    }

    // Count newlines to verify
    const newlineCount = (result.match(/\n/g) || []).length;
    if (newlineCount === 0 && lines.length > 1) {
      console.error('ABSOLUTE CRITICAL: Zero newlines detected! Forcing newlines...');
      // Nuclear option: manually insert newlines
      result = '';
      for (let i = 0; i < lines.length; i++) {
        result += lines[i];
        if (i < lines.length - 1) {
          result += NEWLINE;
        }
      }
    }

    // Only normalize excessive blank lines (4+ to 2), don't remove structure
    result = result.replace(/\n{4,}/g, '\n\n');

    // Don't remove trailing newlines - they're part of the format
    // Just ensure we don't have more than 2 trailing newlines
    result = result.replace(/\n{3,}$/, '\n\n');

    // FINAL ABSOLUTE CHECK: If still no newlines, something is catastrophically wrong
    if (!result.includes('\n') && lines.length > 1) {
      console.error('CATASTROPHIC: No newlines after all fixes. Emergency reconstruction...');
      // Emergency: manually build string with newlines
      // Don't add extra empty strings - the lines array already has the correct structure
      // Empty strings in lines array represent blank lines, adding more would create triple newlines
      result = '';
      for (let i = 0; i < lines.length; i++) {
        result += lines[i];
        if (i < lines.length - 1) {
          result += '\n';
        }
      }
    }

    return result;
  }

  async enhanceWithAIFormatting(content, params) {
    if (!content || !content.trim()) {
      return content;
    }

    if (process.env.DISABLE_PYQ_AI_FORMATTING === 'true') {
      return content;
    }

    // Skip AI formatting if the content is small (< 500 chars) as our raw formatter is already quite good
    if (content.length < 500) {
      console.log('[PYQ Service] Skipping AI formatting: content too small');
      return content;
    }

    const openAIKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY;
    if (!openAIKey) {
      return content;
    }

    const cacheKey = `${content.substring(0, 200)}-${JSON.stringify(params)}`;
    const cached = this.formatCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.formatCacheTTL) {
      return cached.formatted;
    }

    const { theme, fromYear, toYear, examCode, level } = params || {};
    const metadataSummary = [
      examCode ? `Exam: ${examCode}` : null,
      level ? `Level: ${level}` : null,
      theme ? `Topic: ${theme}` : null,
      fromYear || toYear ? `Years: ${fromYear || 'All'} – ${toYear || 'Present'}` : null
    ].filter(Boolean).join(' • ');

    const systemPrompt = `You are an expert formatter for UPSC PYQs. Clean and restructure the following raw data into a polished, skimmable study digest. Plain text only. Mandatory blank lines between blocks. Newest years first.`;

    const userPrompt = `Reformat this PYQ data into a beautiful, structured list. Use high contrast, clear separation, and bullet points for metadata. Keep question text intact.\n\n${metadataSummary ? `Context: ${metadataSummary}\n\n` : ''}Raw Data:\n${content}`;

    const startTime = Date.now();
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini', // Use faster model
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 4000,
          temperature: 0.1
        },
        {
          headers: {
            'Authorization': `Bearer ${openAIKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 20000 // Reduced from 30s to 20s
        }
      );

      const aiContent = response.data?.choices?.[0]?.message?.content;
      console.log(`[PYQ Service] AI Formatting took ${Date.now() - startTime}ms`);

      if (aiContent && aiContent.trim().length >= 100) {
        let cleaned = aiContent.trim();
        // ... (preserving clean logic but removing redundant complexity if needed)
        // For brevity, keeping the cleaning logic but ensure it's robust
        const finalFormatted = cleaned.replace(/\*\*/g, '').replace(/###/g, '').trim();

        if (finalFormatted.includes('\n') && finalFormatted.length > content.length * 0.5) {
          this.formatCache.set(cacheKey, {
            formatted: finalFormatted,
            timestamp: Date.now()
          });
          return finalFormatted;
        }
      }
    } catch (error) {
      console.warn('[PYQ Service] AI formatting failed or timed out:', error.message);
    }

    return content;
  }

  calculateLimit(theme, fromYear, toYear) {
    if (!theme && !fromYear && !toYear) return 20;
    if (theme && !fromYear && !toYear) return 30;
    if (fromYear || toYear) return 50;
    return 50;
  }

  async search(userMsg, context = null, language = 'en') {
    try {
      let params;

      if (context) {
        params = {
          theme: context.theme || '',
          fromYear: context.fromYear,
          toYear: context.toYear,
          examCode: context.examCode || 'UPSC',
          level: context.level || ''
        };
      } else {
        params = this.parseQuery(userMsg, language);
      }

      const filter = this.buildFilter(params);
      const limit = this.calculateLimit(params.theme, params.fromYear, params.toYear);
      const skip = (context && context.offset) || 0;
      const cacheKey = JSON.stringify({
        theme: params.theme || '',
        fromYear: params.fromYear || '',
        toYear: params.toYear || '',
        examCode: params.examCode || '',
        level: params.level || '',
        skip,
        limit,
        version: '1'
      });
      const cachedResult = await pyqQueryCache.get(cacheKey);
      if (cachedResult) {
        return {
          ...cachedResult,
          cached: true
        };
      }

      const rawItems = await this.queryDatabase(filter, params.theme, { skip, limit });

      if (!rawItems || rawItems.length === 0) {
        return null;
      }

      const processedItems = await this.processRawDBResultsWithLLM(rawItems, params);

      if (!processedItems || processedItems.length === 0) {
        return null;
      }

      const formatted = this.formatResults(processedItems, params, { limit });
      if (!formatted) {
        return null;
      }

      // CRITICAL: Validate formatted content has newlines
      const formattedHasNewlines = formatted.includes('\n');
      if (!formattedHasNewlines) {
        console.error('CRITICAL ERROR: formatResults produced content without newlines!');
        // Emergency reconstruction
        const emergencyFixed = formatted
          .replace(/(UPSC|PCS|SSC)\s+PYQ\s+Archive/i, '$1 PYQ Archive\n')
          .replace(/Topic:\s*([^\n]+)/i, 'Topic: $1\n')
          .replace(/Years:\s*([^\n]+)/i, 'Years: $1\n')
          .replace(/Total Questions:\s*(\d+)/i, 'Total Questions: $1\n')
          .replace(/(\d+)(Year\s+\d{4})/g, '$1\n\n$2')
          .replace(/(Year\s+\d{4}[^\n]+)(\d+\.)/g, '$1\n\n$2');

        if (emergencyFixed.includes('\n')) {
          return {
            content: emergencyFixed,
            context: {
              theme: params.theme,
              fromYear: params.fromYear,
              toYear: params.toYear,
              examCode: params.examCode,
              offset: skip + processedItems.length,
              limit,
              hasMore: processedItems.length === limit,
              originalQuery: (context && context.originalQuery) || userMsg
            },
            count: processedItems.length
          };
        }
      }

      let polishedContent = formatted;
      const aiFormattingAllowed = process.env.ENABLE_PYQ_AI_FORMATTING === 'true';

      if (aiFormattingAllowed && formattedHasNewlines) {
        try {
          const aiFormatted = await this.enhanceWithAIFormatting(formatted, params);

          // CRITICAL: Only use AI output if it preserves newlines
          if (aiFormatted && aiFormatted.includes('\n')) {
            const originalNewlineCount = (formatted.match(/\n/g) || []).length;
            const aiNewlineCount = (aiFormatted.match(/\n/g) || []).length;

            // Only use if AI preserved at least 80% of newlines
            if (aiNewlineCount >= originalNewlineCount * 0.8) {
              polishedContent = aiFormatted;
            } else {
              console.warn(`AI formatting removed too many newlines (${originalNewlineCount} -> ${aiNewlineCount}), using original`);
            }
          } else {
            console.warn('AI formatting removed all newlines, using original formatted content');
          }
        } catch (error) {
          console.warn('AI formatting failed, using original:', error.message);
        }
      }
      // FINAL VALIDATION: Ensure content has newlines before returning
      const finalContent = polishedContent || formatted;
      if (!finalContent.includes('\n') && formatted.includes('\n')) {
        console.error('CRITICAL: Final content lost newlines! Using formatted directly.');
        polishedContent = formatted;
      }

      // Log newline count for debugging
      const finalNewlineCount = (finalContent.match(/\n/g) || []).length;
      if (finalNewlineCount === 0) {
        console.error('ABSOLUTE CRITICAL: Final content has ZERO newlines! Content length:', finalContent.length);
      }

      const payload = {
        content: polishedContent || formatted,
        context: {
          theme: params.theme,
          fromYear: params.fromYear,
          toYear: params.toYear,
          examCode: params.examCode,
          level: params.level || '',
          offset: skip + processedItems.length,
          limit,
          hasMore: processedItems.length === limit,
          originalQuery: (context && context.originalQuery) || userMsg
        },
        count: processedItems.length,
        // NEW: Include displayable questions for "solve these" feature
        displayableQuestions: processedItems.slice(0, 10).map(q => ({
          question: q.question,
          year: q.year,
          paper: q.paper || 'General',
          topicTags: q.topicTags || []
        }))
      };

      await pyqQueryCache.set(cacheKey, payload);
      return payload;

    } catch (error) {
      console.error('PYQ service error:', error.message);
      return null;
    }
  }
}

const pyqService = new PyqService();
export default pyqService;

