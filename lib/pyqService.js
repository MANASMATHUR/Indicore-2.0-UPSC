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

          const systemPrompt = `Clean and analyze PYQ database items. Remove scraper artifacts, HTML, UI elements. Preserve original question text exactly. Extract topic tags and keywords.Add a new line after each question. Return JSON array with cleaned items.`;

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
    
    const verifiedCount = sortedItems.filter(q => 
      q.verified === true || (q.sourceLink && q.sourceLink.includes('.gov.in'))
    ).length;
    const unverifiedCount = sortedItems.length - verifiedCount;
    
    const byYear = new Map();
    const seenQuestions = new Set();
    
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
      
      const isUnverified = q.verified === false && 
        (!q.sourceLink || !q.sourceLink.includes('.gov.in'));
      const topicTags = q.topicTags && q.topicTags.length > 0 
        ? q.topicTags.join(', ') 
        : null;
      
      if (questionText.length > 2000) {
        questionText = questionText.substring(0, 1997) + '...';
      }
      
      const normalizedQuestion = questionText.toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s]/g, '')
        .substring(0, 100);
      
      if (seenQuestions.has(normalizedQuestion)) {
        continue;
      }
      seenQuestions.add(normalizedQuestion);
      
      const paperName = q.paper || 'General';
      let label = `[${paperName}] ${questionText}`;
      
      if (topicTags && !questionText.toLowerCase().includes(topicTags.toLowerCase().substring(0, 20))) {
        label += ` (${topicTags})`;
      }
      
      if (isUnverified) {
        label += ' ⚠️';
      } else if (q.sourceLink && q.sourceLink.includes('.gov.in')) {
        label += ' ✅';
      }
      
      const hasAnalysis = q.analysis && q.analysis.trim().length > 0;
      const hasKeywords = q.keywords && q.keywords.length > 0;
      if (hasAnalysis || hasKeywords) {
        label += ' 📊';
      }
      
      byYear.get(year).push(label);
    }
    
    const lines = [];
    lines.push(`${examCode} PYQ Archive`);
    lines.push('');
    
    if (theme) {
      lines.push(`Topic: ${theme}`);
    }
    if (fromYear || toYear) {
      lines.push(`Years Covered: ${fromYear || 'All'} – ${toYear || 'Present'}`);
    }
    
    if (theme || fromYear || toYear) {
      lines.push('');
    }
    
    lines.push(`Total Questions Pulled: ${sortedItems.length}`);
    lines.push('');
    
    const sortedYears = Array.from(byYear.keys()).sort((a, b) => b - a);
    
    for (const year of sortedYears) {
      const yearQuestions = byYear.get(year);
      if (yearQuestions.length === 0) continue;
      
      lines.push(`${year} · ${yearQuestions.length} question${yearQuestions.length > 1 ? 's' : ''}`);
      lines.push('');
      
      yearQuestions.forEach((q, idx) => {
        lines.push(`${idx + 1}. ${q}`);
        lines.push('');
      });
    }
    
    lines.push('---');
    lines.push('');
    lines.push('Summary');
    
    if (verifiedCount > 0 && unverifiedCount > 0) {
      lines.push(`• Verified: ${verifiedCount} (official sources) ✅`);
      lines.push(`• Unverified: ${unverifiedCount} (please verify before use) ⚠️`);
    } else if (verifiedCount > 0) {
      lines.push('• Status: All questions verified from official sources ✅');
    } else {
      lines.push('• Status: All questions unverified - please verify before use ⚠️');
    }
    lines.push('');
    
    lines.push('Analysis Feature');
    lines.push('Questions marked with 📊 have detailed analysis available. To view analysis:');
    lines.push('• Say "analyze question [number]" for a specific question');
    lines.push('• Or paste the question text and say "analyze this question"');
    lines.push('• Analysis includes topic tags, keywords, in-depth explanation, and similar questions');
    lines.push('');
    
    if (sortedItems.length >= limit) {
      lines.push('Tips for Better Results');
      lines.push('• Try: "PYQ on [specific topic]" for focused questions');
      lines.push('• Try: "PYQ from 2020 to 2024" for year-specific queries');
      lines.push('• Try: "PYQ about [subject]" for subject-wise questions');
      lines.push('• Combine filters: "PYQ on Geography from 2020 to 2024"');
      lines.push('');
    }
    
    return lines.join('\n');
  }

  async enhanceWithAIFormatting(content, params) {
    if (!content || !content.trim()) {
      return content;
    }

    const openAIKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY;
    if (!openAIKey) {
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

    const systemPrompt = `You are an expert formatting assistant for UPSC Previous Year Questions (PYQs). Your ONLY job is to transform messy, unorganized question data into a clean, professional, student-friendly format.

CRITICAL REQUIREMENTS - YOU MUST:
1. PRESERVE ALL ORIGINAL QUESTION TEXT EXACTLY - Never modify, summarize, or truncate any question text
2. ORGANIZE questions clearly by year (newest first), with clear year headings
3. FORMAT each question on a single line: [Paper] Question text (Topic) ✅/⚠️
4. REMOVE all duplicate questions, formatting artifacts, and metadata noise
5. ADD a concise analytical summary (2-3 sentences) at the end about key themes and patterns
6. PRESERVE mathematical notation exactly ($...$ and $$...$$)
7. USE clean, minimal formatting - readable plain text with clear structure

OUTPUT FORMAT (FOLLOW EXACTLY):
\`\`\`
[Exam Code] PYQ Archive

Topic: [Topic Name]
Years Covered: [Year Range]

Total Questions: [Count]

### Year [YYYY] · [Count] questions

1. [Paper] Question text here (Topic tags) ✅
2. [Paper] Question text here (Topic tags) ⚠️
...

### Year [YYYY] · [Count] questions

1. [Paper] Question text here ✅
...

---

Summary
• Verified: [X] (official sources) ✅
• Unverified: [Y] (please verify before use) ⚠️

### Analytical Insights
[2-3 sentences about patterns, trends, important topics covered]
\`\`\`

DO NOT:
- Modify question text in any way
- Add commentary within questions
- Use excessive markdown (no **bold**, no complex formatting)
- Create or combine questions
- Remove verification markers (✅/⚠️) or analysis markers (📊)
- Return the same messy format - YOU MUST reorganize and clean it`;

    const userPrompt = `The following PYQ data is messy and needs to be cleaned and reorganized. Transform it into a clean, professional format.\n\n${metadataSummary ? `Context: ${metadataSummary}\n\n` : ''}Raw Data:\n${content}\n\nYour task:\n1. Clean up all formatting artifacts and duplicates\n2. Organize questions by year (newest first)\n3. Format each question clearly on one line: [Paper] Question (Topic) ✅/⚠️\n4. Add a brief analytical summary at the end (2-3 sentences about themes/patterns)\n5. Keep ALL original question text intact - do not modify any questions\n6. Make the output clean, readable, and professional\n\nReturn the cleaned and organized format now:`;

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
        
        // Clean up excessive newlines
        cleaned = cleaned.replace(/\n{4,}/g, '\n\n\n');
        
        // Restore mathematical notation
        mathPlaceholders.forEach(({ placeholder, original }) => {
          cleaned = cleaned.replace(placeholder, original);
        });
        
        const finalFormatted = cleaned.trim();
        
        // Validate that the LLM actually formatted the content (not just returned raw)
        const hasStructure = /(Year|year|\d{4}|Summary|Analytical|Insights)/i.test(finalFormatted);
        const hasQuestions = /(\d+\.|\[.*\]|✅|⚠️)/.test(finalFormatted);
        
        if (hasStructure && hasQuestions && finalFormatted.length > content.length * 0.5) {
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

      const polishedContent = await this.enhanceWithAIFormatting(formatted, params);
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

