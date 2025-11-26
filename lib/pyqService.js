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

const PYQ_FORMAT_MODEL = process.env.OPENAI_PYQ_FORMAT_MODEL || 'gpt-4o-mini';

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
      { test: /tnpsc|tamil nadu psc/i, lang: 'ta', code: 'TNPSC' },
      { test: /mpsc|maharashtra psc/i, lang: 'mr', code: 'MPSC' },
      { test: /bpsc|bihar psc/i, code: 'BPSC' },
      { test: /uppsc|uttar pradesh psc/i, code: 'UPPSC' },
      { test: /mppsc|madhya pradesh psc/i, code: 'MPPSC' },
      { test: /ras|rajasthan psc/i, code: 'RAS' },
      { test: /rpsc|rajasthan psc/i, code: 'RPSC' },
      { test: /gpsc|gujarat psc/i, lang: 'gu', code: 'GPSC' },
      { test: /(karnataka\s*psc|kpsc)\b/i, lang: 'kn', code: 'KPSC' },
      { test: /wbpsc|west bengal psc|wb psc/i, lang: 'bn', code: 'WBPSC' },
      { test: /ppsc|punjab psc/i, lang: 'pa', code: 'PPSC' },
      { test: /opsc|odisha psc/i, code: 'OPSC' },
      { test: /apsc|assam psc/i, code: 'APSC' },
      { test: /appsc|andhra pradesh psc/i, code: 'APPSC' },
      { test: /tspsc|telangana psc/i, lang: 'te', code: 'TSPSC' },
      { test: /(kerala\s*psc)/i, lang: 'ml', code: 'Kerala PSC' },
      { test: /hpsc|haryana psc/i, code: 'HPSC' },
      { test: /jkpsc|j&k psc|jammu.*kashmir.*psc/i, code: 'JKPSC' },
      { test: /gpsc goa|goa psc/i, code: 'Goa PSC' },
      { test: /upsc/i, code: 'UPSC' },
      { test: /pcs/i, code: 'PCS' }
    ];

    for (const pattern of patterns) {
      if (pattern.test.test(userMsg) || (pattern.lang && language === pattern.lang)) {
        return pattern.code;
      }
    }
    return 'UPSC';
  }

  parseQuery(userMsg, language) {
    const originalMsg = userMsg;
    const lowerMsg = userMsg.toLowerCase();
    
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
    
    // Remove common polite phrases and connectors
    let cleanMsg = userMsg.replace(/\b(can you|could you|would you|please|kindly|i need|i want|i'd like)\b/gi, '');
    cleanMsg = cleanMsg.replace(/\b(show|give|get|find|search|fetch|list|bring|tell|need|want|bring)\s+me\b/gi, '');
    
    // Pattern 1: Preposition-based (highest priority) - "on economics", "about history", "for geography"
    const prepMatch = cleanMsg.match(/(?:on|about|of|for|related to|regarding)\s+([^.,;\n]+?)(?:\s+(?:from|to|in|\d{4})|$)/i);
    if (prepMatch) {
      let theme = prepMatch[1].trim();
      // Remove year mentions from theme
      theme = theme.replace(/\s*(from|to|\d{4}).*$/i, '').trim();
      if (theme.length > 0) {
        return this._processTheme(theme, fromYear, toYear, userMsg, language);
      }
    }
    
    // Pattern 2: PYQ keywords before theme - "pyqs on economics", "questions about history"
    const pyqBeforeMatch = userMsg.match(/(?:pyq|pyqs|previous year|past year|questions|question)\s+(?:on|about|of|for|related to)?\s*([a-zA-Z][^.,;\n]+?)(?:\s+(?:from|to|\d{4})|$)/i);
    if (pyqBeforeMatch) {
      let theme = pyqBeforeMatch[1].trim();
      theme = theme.replace(/\s*(from|to|\d{4}).*$/i, '').trim();
      // Remove common stop words
      theme = theme.replace(/\b(the|a|an|all|some|any)\b/gi, '').trim();
      if (theme.length > 0 && !/^(give|show|get|find|search|fetch|list|bring|tell|me|need|want)$/i.test(theme)) {
        return this._processTheme(theme, fromYear, toYear, userMsg, language);
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
        return this._processTheme(theme, fromYear, toYear, userMsg, language);
      }
    }
    
    // Pattern 4: Verb-based - "give eco", "show economics", "get history questions", "Give history pyqs"
    // Improved to handle "Give history pyqs" pattern
    const verbMatch = cleanMsg.match(/(?:give|show|get|find|search|fetch|list|bring|tell|need|want)\s+(?:me\s+)?([a-zA-Z][^.,;\n]+?)(?:\s+(?:pyq|pyqs|question|questions|from|to|\d{4})|$)/i);
    if (verbMatch) {
      let theme = verbMatch[1].trim();
      // Remove PYQ keywords and years from theme
      theme = theme.replace(/\s*(pyq|pyqs|question|questions|from|to|\d{4}).*$/i, '').trim();
      // Remove exam codes
      theme = theme.replace(/\b(upsc|pcs|ssc|exam|exams)\b/gi, '').trim();
      if (theme.length > 0 && !/^(the|a|an|all|some|any)$/i.test(theme)) {
        return this._processTheme(theme, fromYear, toYear, userMsg, language);
      }
    }
    
    // Pattern 5: Just a subject/topic word (fallback) - "economics", "eco", "history"
    // Remove all PYQ and exam-related keywords
    cleanMsg = userMsg.replace(/\b(upsc|pcs|ssc|exam|exams|pyq|pyqs|previous year|past year|questions|question|papers|paper|give|show|get|find|search|fetch|list|bring|tell|me|the|a|an|all|some|any|from|to|in|on|at|for|of|about|can|could|would|please|kindly|need|want|i)\b/gi, '');
    const words = cleanMsg.trim().split(/\s+/).filter(w => w.length > 1 && !/^\d+$/.test(w));
    if (words.length > 0) {
      // Take first 1-3 significant words
      const theme = words.slice(0, 3).join(' ').trim();
      if (theme.length > 0) {
        return this._processTheme(theme, fromYear, toYear, userMsg, language);
      }
    }
    
    // If no theme found, return empty theme
    const examCode = this.detectExamCode(userMsg, language);
    return { theme: '', fromYear, toYear, examCode };
  }

  _processTheme(theme, fromYear, toYear, userMsg, language) {
    // Clean up theme: remove trailing punctuation and extra whitespace
    theme = theme.replace(/[.,;:!?]+$/, '').trim();
    theme = theme.replace(/\s+/g, ' ');
    
    // Remove common stop words that might have been missed
    theme = theme.replace(/\b(give|show|get|find|search|fetch|list|bring|tell|me|the|a|an|all|some|any|need|want|bring|can|could|would|please|kindly|i|my)\b/gi, '').trim();
    
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
    return { theme: theme.trim(), fromYear, toYear, examCode };
  }

  buildFilter(params) {
    const { examCode, fromYear, toYear } = params;
    
    const filter = {
      exam: new RegExp(`^${examCode}$`, 'i'),
      year: {
        $gte: fromYear || 1990,
        $lte: toYear || new Date().getFullYear()
      }
    };
    
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
        if (combinedRegex) {
          searchConditions.push(
          { topicTags: { $regex: combinedRegex } },
          { question: { $regex: combinedRegex } }
          );
        }
        
        // Add individual regexes for each pattern to improve coverage
        themeWords.forEach(word => {
          const wordPatterns = buildWordPatterns(word);
          wordPatterns.forEach(pattern => {
            const wordRegex = new RegExp(pattern, 'i');
            searchConditions.push(
              { topicTags: { $regex: wordRegex } },
              { question: { $regex: wordRegex } }
            );
          });
        });
        
        // Search in theme field if it exists
        if (theme.length > 3) {
          searchConditions.push({ theme: { $regex: new RegExp(escapedTheme, 'i') } });
        }
        
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
              { question: { $regex: simpleRegex } },
              { topicTags: { $regex: simpleRegex } },
              ...(theme.length > 3 ? [{ theme: { $regex: simpleRegex } }] : [])
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

    if (process.env.ENABLE_PYQ_LLM_PROCESSING === 'false') return rawItems;

    const openAIKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY;
    if (!openAIKey) return rawItems;

    const BATCH_SIZE = 5;
    const PROCESSING_TIMEOUT = 15000;
    const MAX_BATCHES_TO_PROCESS = 4;
    const processedItems = [];
    const maxItemsToProcess = Math.min(rawItems.length, MAX_BATCHES_TO_PROCESS * BATCH_SIZE);
    
    for (let i = 0; i < maxItemsToProcess; i += BATCH_SIZE) {
      const batch = rawItems.slice(i, i + BATCH_SIZE);
      
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
            analysis: item.analysis || '',
            verified: item.verified || false,
            sourceLink: item.sourceLink || ''
          }));

          const systemPrompt = `Clean and analyze PYQ database items. Remove scraper artifacts, HTML, UI elements. Preserve original question text exactly. Extract topic tags and keywords. Add a new line after each question. Return JSON array with cleaned items.`;

          const userPrompt = `Process ${batch.length} PYQ items:\n${JSON.stringify(batchData, null, 2)}\n\nReturn JSON array with cleaned questions, topicTags, keywords, isComplete, needsReview.`;

          const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
              model: PYQ_FORMAT_MODEL,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
              ],
              max_tokens: 2000,
              temperature: 0.2
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
            let jsonStr = aiContent.trim();
            if (jsonStr.includes('```json')) {
              jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
            } else if (jsonStr.includes('```')) {
              jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
            }
            
            const parsed = JSON.parse(jsonStr);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const batchProcessed = [];
              parsed.forEach((processed) => {
                const original = batch[processed.index - i];
                if (original) {
                  batchProcessed.push({
                    ...original,
                    question: processed.question || original.question,
                    topicTags: processed.topicTags?.length > 0 ? processed.topicTags : original.topicTags,
                    keywords: processed.keywords?.length > 0 ? processed.keywords : original.keywords,
                    analysis: processed.analysis || original.analysis,
                    verified: processed.verified !== undefined ? processed.verified : original.verified,
                    _processed: true,
                    _isComplete: processed.isComplete !== false,
                    _needsReview: processed.needsReview === true
                  });
                }
              });
              processedItems.push(...batchProcessed);
              return;
            }
          } catch (parseError) {
            console.warn('JSON parse error:', parseError.message);
          }
          processedItems.push(...batch);
        })();

        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('timeout')), PROCESSING_TIMEOUT)
        );

        try {
          await Promise.race([processingPromise, timeoutPromise]);
        } catch (error) {
          if (error.message.includes('timeout')) {
            console.warn(`LLM timeout for batch ${i}-${i + BATCH_SIZE}`);
          } else {
            console.warn(`LLM error for batch ${i}-${i + BATCH_SIZE}:`, error.message);
          }
          processedItems.push(...batch);
        }
      } catch (error) {
        console.warn('LLM processing error:', error.message);
        processedItems.push(...batch);
      }
    }

    if (maxItemsToProcess < rawItems.length) {
      processedItems.push(...rawItems.slice(maxItemsToProcess));
    }

    return processedItems.filter(item => {
      if (!item._processed) return true;
      if (item._needsReview && item._isComplete === false) {
        return item.question && item.question.trim().length >= 15;
      }
      return item._isComplete !== false;
    });
  }

  formatResults(items, params, options = {}) {
    if (!items || items.length === 0) return null;
    
    const { theme, fromYear, toYear, examCode } = params;
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
      let cleaned = text
        .replace(/\s+/g, ' ')
        .replace(/\t+/g, ' ')
        .replace(/\n+/g, ' ')
        .trim();
      cleaned = cleaned.replace(/^[\dA-Za-z]+\s*[\).\-\]]\s+/, '');
      cleaned = cleaned.replace(/^\[[^\]]+\]\s*/, '');
      cleaned = cleaned.replace(/\s*\|\s*/g, ' | ');
      return cleaned;
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
    
    const lines = [];
    
    // Header
    lines.push(`${examCode} PYQ Archive`);
    lines.push('');
    
    // Metadata section
    const metadataLines = [];
    if (theme) {
      metadataLines.push(`Topic: ${theme}`);
    }
    if (fromYear || toYear) {
      metadataLines.push(`Years: ${fromYear || 'All'} – ${toYear || 'Present'}`);
    }
    if (metadataLines.length > 0) {
      lines.push(...metadataLines);
      lines.push('');
    }
    
    // Recalculate counts based on actually displayed questions (after filtering)
    const verifiedCount = displayedQuestions.filter(q => 
      q.verified === true || (q.sourceLink && q.sourceLink.includes('.gov.in'))
    ).length;
    const unverifiedCount = displayedQuestions.length - verifiedCount;
    
    lines.push(`Total Questions: ${displayedQuestions.length}`);
    lines.push('');
    
    // Questions by year
    const sortedYears = Array.from(byYear.keys()).sort((a, b) => b - a);
    
    for (const year of sortedYears) {
      const yearQuestions = byYear.get(year);
      if (yearQuestions.length === 0) continue;
      
      // Year header with consistent formatting
      lines.push(`Year ${year} · ${yearQuestions.length} question${yearQuestions.length > 1 ? 's' : ''}`);
      lines.push('');
      
      // Questions with consistent numbering
      yearQuestions.forEach((entry, idx) => {
        lines.push(`${idx + 1}. ${entry.question}`);
        lines.push(`   • Paper: ${entry.paperName || 'General'}`);
        lines.push(`   • Topic: ${entry.topicTags || 'Not specified'}`);
        if (entry.statusParts && entry.statusParts.length > 0) {
          lines.push(`   • Status: ${entry.statusParts.join(' + ')}`);
        }
        // Insert a blank line between questions for readability
        lines.push('');
      });
      
      // Single blank line between years (avoid double blank)
      if (lines[lines.length - 1] !== '') {
        lines.push('');
      }
    }
    
    // Summary section
    lines.push('---');
    lines.push('');
    lines.push('Summary');
    lines.push('');
    
    if (verifiedCount > 0 && unverifiedCount > 0) {
      lines.push(`• Verified: ${verifiedCount} (official sources)`);
      lines.push(`• Unverified: ${unverifiedCount} (please verify before use)`);
    } else if (verifiedCount > 0) {
      lines.push(`• All ${verifiedCount} questions verified from official sources`);
    } else if (unverifiedCount > 0) {
      lines.push(`• All ${unverifiedCount} questions unverified - please verify before use`);
    }
    lines.push('');
    
    // Analysis feature info
    lines.push('Analysis Feature');
    lines.push('Questions whose status indicates "Analysis available" have detailed breakdowns.');
    lines.push('• Say "analyze question [number]" for a specific question');
    lines.push('• Or paste the question text and say "analyze this question"');
    lines.push('');
    
    // Tips section (only if many results)
    if (sortedItems.length >= limit) {
      lines.push('Tips for Better Results');
      lines.push('• "PYQ on [topic]" - Focused questions by topic');
      lines.push('• "PYQ from 2020 to 2024" - Year-specific queries');
      lines.push('• "PYQ about [subject]" - Subject-wise questions');
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

    const openAIKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY;
    if (!openAIKey) {
      return content;
    }
    
    // Validate input has newlines
    const inputHasNewlines = content.includes('\n');
    if (!inputHasNewlines) {
      console.warn('Input to enhanceWithAIFormatting has no newlines, skipping AI formatting');
      return content;
    }

    // Check cache first
    const cacheKey = `${content.substring(0, 200)}-${JSON.stringify(params)}`;
    const cached = this.formatCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.formatCacheTTL) {
      return cached.formatted;
    }

    const { theme, fromYear, toYear, examCode } = params || {};
    const metadataSummary = [
      examCode ? `Exam: ${examCode}` : null,
      theme ? `Topic: ${theme}` : null,
      fromYear || toYear ? `Years: ${fromYear || 'All'} – ${toYear || 'Present'}` : null
    ].filter(Boolean).join(' • ');

    const systemPrompt = `You are an expert formatter for UPSC Previous Year Questions (PYQs). Your output must read like a polished study digest and be effortless to skim.

AGGRESSIVE FORMATTING DIRECTIVES:
1. RESTRUCTURE each question into a multi-line block:
   "1. Question text"
   "   • Paper: [GS paper / Prelims / etc.]"
   "   • Topic: tag list (or “Not specified”)"
   "   • Status: Verified / Needs verification / Analysis available"
2. INSERT a blank line between every question block so nothing touches.
3. PRESERVE the question wording but fix spacing/punctuation for clarity.
4. GROUP strictly by year (newest first) with headers: "Year 2024 · 5 questions".
5. KEEP global structure: header, topic info, total count, yearly blocks, summary, analysis tips.
6. NO markdown headings (###/##) or code fences—plain text only with bullet lines.
7. If paper/topic/status is missing, add explicit placeholders (e.g., "Paper: General").
8. KEEP math notation ($...$, $$...$$) intact. Do not add emoji markers.
9. Enforce line length discipline (~120 chars). Add commas/semicolons to break run-ons if needed without changing meaning.
10. NEVER collapse sections; blank lines are mandatory between header/topic/count/year/questions/summary/tips.

OUTPUT FRAME:
[Exam Code] PYQ Archive
Topic: ...
Years: ...

Total Questions: ...

Year YYYY · X questions
1. Question text
   • Paper: ...
   • Topic: ...
   • Status: ...

Year YYYY · Y questions
...

---
Summary
• ...

Analysis Feature
• ...

STRICT DON’TS:
- No markdown headers or code fences.
- No paragraph walls—always separate with blank lines.
- No inventing questions or metadata.
- No emoji markers or decorative icons.`;

    const userPrompt = `The students still see the following PYQ output as messy. Rewrite it aggressively so it becomes structured, skimmable, and clearly separated.

${metadataSummary ? `Context: ${metadataSummary}\n\n` : ''}Raw Data:
${content}

Transform it by:
1. Reinforcing the full structure (header, topic info, counts, yearly sections, summary, analysis tips).
2. Converting every question into the multi-line block described in the system prompt.
3. Enforcing blank lines between questions and between all major sections.
4. Preserving question wording aside from fixing spacing or punctuation glitches.
5. Highlighting verification/analysis status lines clearly (text only, no emoji).
6. Returning ONLY the cleaned text with no additional commentary.`;

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: PYQ_FORMAT_MODEL,
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
          timeout: 30000
        }
      );

      const aiContent = response.data?.choices?.[0]?.message?.content;

      if (aiContent && aiContent.trim().length >= 100) {
        let cleaned = aiContent.trim();
        
        // Preserve mathematical notation
        const mathPlaceholders = [];
        let placeholderIndex = 0;
        
        cleaned = cleaned.replace(/\$([^$\n]+?)\$/g, (match) => {
          const placeholder = `__MATH_INLINE_${placeholderIndex}__`;
          mathPlaceholders.push({ placeholder, original: match });
          placeholderIndex++;
          return placeholder;
        });
        
        cleaned = cleaned.replace(/\$\$([^$]+?)\$\$/g, (match) => {
          const placeholder = `__MATH_BLOCK_${placeholderIndex}__`;
          mathPlaceholders.push({ placeholder, original: match });
          placeholderIndex++;
          return placeholder;
        });
        
        // Remove markdown formatting but keep structure
        cleaned = cleaned.replace(/\*\*([^*\n]+?)\*\*/g, '$1');
        cleaned = cleaned.replace(/^\*\*([^*\n]+?)\*\*/gm, '$1');
        cleaned = cleaned.replace(/\*\*([^*\n]+?)\*\*$/gm, '$1');
        cleaned = cleaned.replace(/\*\*###\s+/g, '### ');
        cleaned = cleaned.replace(/###\s+\*\*/g, '### ');
        cleaned = cleaned.replace(/\*\*(\d+\.\s+)/g, '$1');
        cleaned = cleaned.replace(/(\d+\.\s+)\*\*/g, '$1');
        cleaned = cleaned.replace(/\*\*/g, '');
        cleaned = cleaned.replace(/\*([^*\n]+?)\*/g, '$1');
        
        // Remove markdown headers (###, ##) and replace with plain text
        cleaned = cleaned.replace(/^###\s+/gm, '');
        cleaned = cleaned.replace(/^##\s+/gm, '');
        cleaned = cleaned.replace(/^#\s+/gm, '');
        
        // Normalize year headers to consistent format (handle both singular and plural)
        // Use multiline flag (m) so ^ matches start of each line, not just start of string
        cleaned = cleaned.replace(/^Year\s+(\d{4})\s*[•·]\s*(\d+)\s+questions?/gim, (match, year, count) => {
          const num = parseInt(count, 10);
          return `Year ${year} · ${num} question${num > 1 ? 's' : ''}`;
        });
        cleaned = cleaned.replace(/^(\d{4})\s*[•·]\s*(\d+)\s+questions?/gim, (match, year, count) => {
          const num = parseInt(count, 10);
          return `Year ${year} · ${num} question${num > 1 ? 's' : ''}`;
        });
        
        // CRITICAL: Preserve block structure and add blank lines ONLY between question blocks
        // (before the next numbered question but not between a question and its bullet metadata)
        cleaned = cleaned.replace(/([^\n])\n(?=\d+\.\s)/g, '$1\n\n');
        
        // Ensure consistent spacing: max 2 blank lines between sections
        // This handles all cases of 3+ consecutive newlines (including 4+)
        cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
        
        // Remove trailing whitespace from each line (but keep the newline)
        cleaned = cleaned.split('\n').map(line => line.trimEnd()).join('\n');
        
        // Final check: ensure we have proper newlines between major sections
        // Add newline after header if missing
        cleaned = cleaned.replace(/^(UPSC|PCS|SSC)\s+PYQ\s+Archive([^\n])/i, '$1 PYQ Archive\n\n$2');
        // Add newline after "Topic:" if missing - use non-greedy quantifier and specific boundaries
        // Only match when followed by specific keywords to avoid splitting words
        cleaned = cleaned.replace(/Topic:\s*([^\n]+?)(?=\s*(Years?:|Total\s+Questions?:|Year\s+\d{4}))/g, 'Topic: $1\n\n');
        // Add newline after "Years:" if missing - use non-greedy quantifier
        cleaned = cleaned.replace(/Years:\s*([^\n]+?)(?=\s*(Year\s+\d{4}|Total\s+Questions?:))/g, 'Years: $1\n\n');
        // Add newline after "Total Questions:" if missing
        cleaned = cleaned.replace(/Total Questions:\s*(\d+)(?=\s+Year\s+\d{4})/g, 'Total Questions: $1\n\n');
        // Add newline before year headers if missing - match number followed by space and "Year"
        cleaned = cleaned.replace(/(\d+)\s+(Year\s+\d{4})/g, '$1\n\n$2');
        
        // Restore mathematical notation
        mathPlaceholders.forEach(({ placeholder, original }) => {
          cleaned = cleaned.replace(placeholder, original);
        });
        
        const finalFormatted = cleaned.trim();
        
        // CRITICAL: Ensure newlines are preserved - check if we have proper line breaks
        const hasNewlines = finalFormatted.includes('\n');
        const originalHasNewlines = content.includes('\n');
        
        // If original had newlines but AI output doesn't, reject it immediately
        if (originalHasNewlines && !hasNewlines) {
          console.warn('LLM removed all newlines, restoring from original format');
          return content; // Return original which has proper newlines
        }
        
        // Count newlines - if AI removed more than 50% of them, reject it
        if (originalHasNewlines) {
          const originalNewlineCount = (content.match(/\n/g) || []).length;
          const formattedNewlineCount = (finalFormatted.match(/\n/g) || []).length;
          
          if (formattedNewlineCount < originalNewlineCount * 0.5 && originalNewlineCount > 5) {
            console.warn(`LLM removed too many newlines (${originalNewlineCount} -> ${formattedNewlineCount}), using original`);
            return content;
          }
        }
        
        // Validate that the LLM actually formatted the content (not just returned raw)
        const hasStructure = /(Year|year|\d{4}|Summary|Analytical|Insights)/i.test(finalFormatted);
        const hasQuestions = /\d+\.\s/.test(finalFormatted);
        
        // Ensure we have proper section breaks - check for key patterns with newlines
        const hasProperFormatting = /(PYQ Archive|Topic:|Years:|Total Questions:|Year \d{4})/i.test(finalFormatted);
        
        // Additional check: ensure sections are separated (not all on one line)
        const sectionsOnSeparateLines = /PYQ Archive\s*\n|Topic:\s*[^\n]+\s*\n|Years:\s*[^\n]+\s*\n|Year\s+\d{4}/.test(finalFormatted);
        
        if (hasStructure && hasQuestions && hasProperFormatting && (hasNewlines || sectionsOnSeparateLines) && finalFormatted.length > content.length * 0.5) {
          this.formatCache.set(cacheKey, {
            formatted: finalFormatted,
            timestamp: Date.now()
          });
          
          if (this.formatCache.size > 50) {
            const now = Date.now();
            for (const [key, value] of this.formatCache.entries()) {
              if (now - value.timestamp > this.formatCacheTTL) {
                this.formatCache.delete(key);
              }
            }
          }
          
          return finalFormatted;
        } else {
          console.warn('LLM output appears to be invalid or too short, using original content');
        }
      } else {
        console.warn('LLM returned empty or too short content');
      }
    } catch (error) {
      console.warn('PYQ AI formatting failed, falling back to raw output:', error.message);
      if (error.response) {
        console.warn('API Error details:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
      }
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
          examCode: context.examCode || 'UPSC'
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
        skip,
        limit
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
          offset: skip + processedItems.length,
          limit,
          hasMore: processedItems.length === limit,
          originalQuery: (context && context.originalQuery) || userMsg
        },
        count: processedItems.length
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

