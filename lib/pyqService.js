import connectToDatabase from './mongodb';
import PYQ from '@/models/PYQ';

class PyqService {
  constructor() {
    this.queryCache = new Map();
    this.cacheTTL = 5 * 60 * 1000;
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
    
    // Pattern 3: Theme before PYQ keywords - "eco pyqs", "history questions", "economics pyq"
    const themeBeforeMatch = userMsg.match(/\b([a-zA-Z][a-zA-Z\s]{1,40}?)\s+(?:pyq|pyqs|previous year|past year|questions|question|qs)\b/i);
    if (themeBeforeMatch) {
      let theme = themeBeforeMatch[1].trim();
      // Remove common verbs and exam names
      theme = theme.replace(/\b(give|show|get|find|search|fetch|list|bring|tell|need|want|bring|can|could|would|please|kindly|i|me|my|the|a|an)\b/gi, '').trim();
      // Remove exam codes
      theme = theme.replace(/\b(upsc|pcs|ssc|exam|exams)\b/gi, '').trim();
      if (theme.length > 0) {
        return this._processTheme(theme, fromYear, toYear, userMsg, language);
      }
    }
    
    // Pattern 4: Verb-based - "give eco", "show economics", "get history questions"
    const verbMatch = cleanMsg.match(/(?:give|show|get|find|search|fetch|list|bring|tell|need|want)\s+(?:me\s+)?([a-zA-Z][^.,;\n]+?)(?:\s+(?:pyq|pyqs|question|from|to|\d{4})|$)/i);
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
        // Escape special regex characters
        const escapedTheme = theme.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Split theme into words for better matching
        const themeWords = theme.split(/\s+/).filter(w => w.length > 0);
        
        // Build multiple search patterns for better matching
        const searchPatterns = [];
        
        // 1. Exact phrase match (highest priority)
        searchPatterns.push(escapedTheme);
        
        // 2. Individual word matches with word boundaries
        themeWords.forEach(word => {
          if (word.length >= 3) {
            // For words 3+ chars, use word boundary matching
            searchPatterns.push(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w*`);
          } else if (word.length >= 2) {
            // For 2-char words (like "eco"), allow partial matches
            searchPatterns.push(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\w*');
          }
        });
        
        // Combine all patterns
        const combinedRegex = new RegExp(`(${searchPatterns.join('|')})`, 'i');
        
        // Build query with multiple search conditions
        const searchConditions = [
          { topicTags: { $regex: combinedRegex } },
          { question: { $regex: combinedRegex } }
        ];
        
        // Also add individual word searches for better coverage
        themeWords.forEach(word => {
          if (word.length >= 3) {
            const wordRegex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w*`, 'i');
            searchConditions.push(
              { topicTags: { $regex: wordRegex } },
              { question: { $regex: wordRegex } }
            );
          }
        });
        
        // Search in theme field if it exists
        if (theme.length > 3) {
          searchConditions.push({ theme: { $regex: new RegExp(escapedTheme, 'i') } });
        }
        
        query = PYQ.find({
          ...filter,
          $or: searchConditions
        }).sort({ year: -1 }).skip(skip).limit(limit);
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
          const simpleRegex = new RegExp(theme.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
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
    
    for (const q of sortedItems) {
      const year = q.year || 0;
      if (year < 1990 || year > new Date().getFullYear()) continue;
      
      // Filter out garbled/malformed questions
      let questionText = q.question || '';
      // Skip questions that look like formatting artifacts
      if (!questionText || questionText.trim().length < 10) continue;
      // Skip formatting artifacts and metadata entries
      if (/^###\s*📅|^📅\s*\d{4}|^Year\s+Range:|^Topic:/i.test(questionText)) continue;
      if (/^\d+\.\s*###|^\d+\.\s*📅/i.test(questionText)) continue;
      if (/^Year\s+Range:\s*\d{4}/i.test(questionText)) continue;
      if (/^Topic:\s*[A-Za-z\s]+$/i.test(questionText)) continue;
      if (/^Geography\s+from\s+\d{4}/i.test(questionText)) continue;
      if (/^history\s+for$/i.test(questionText)) continue;
      if (/^Summary|^Total:|^Verified:|^Unverified:/i.test(questionText)) continue;
      // Skip entries that are just metadata without actual question content
      if (questionText.trim().length < 20 && /^(Year|Topic|Summary|Total|Verified|Unverified)/i.test(questionText)) continue;
      
      if (!byYear.has(year)) byYear.set(year, []);
      
      const isUnverified = q.verified === false && 
        (!q.sourceLink || !q.sourceLink.includes('.gov.in'));
      const topicTags = q.topicTags && q.topicTags.length > 0 
        ? q.topicTags.join(', ') 
        : null;
      
      // Keep full question text for better readability, but limit to 250 chars
      if (questionText.length > 250) {
        questionText = questionText.substring(0, 247) + '...';
      }
      
      // Format: number. [Paper] Question Text
      const paperName = q.paper || 'General';
      let label = `[${paperName}] ${questionText}`;
      
      // Add topic tags if they provide additional context
      if (topicTags && !questionText.toLowerCase().includes(topicTags.toLowerCase().substring(0, 20))) {
        label += ` (${topicTags})`;
      }
      
      // Add verification status
      if (isUnverified) {
        label += ' ⚠️';
      } else if (q.sourceLink && q.sourceLink.includes('.gov.in')) {
        label += ' ✅';
      }
      
      byYear.get(year).push(label);
    }
    
    const lines = [];
    lines.push(`Previous Year Questions (${examCode})`);
    
    if (theme) {
      lines.push(`Topic: ${theme}`);
    }
    if (fromYear || toYear) {
      lines.push(`Year Range: ${fromYear || 'All'} to ${toYear || 'Present'}`);
    }
    lines.push('');
    
    const sortedYears = Array.from(byYear.keys()).sort((a, b) => b - a);
    
    for (const year of sortedYears) {
      const yearQuestions = byYear.get(year);
      if (yearQuestions.length === 0) continue;
      
      lines.push(`Year ${year} (${yearQuestions.length} question${yearQuestions.length > 1 ? 's' : ''})`);
      lines.push('');
      yearQuestions.forEach((q, idx) => {
        lines.push(`${idx + 1}. ${q}`);
      });
      lines.push('');
    }
    
    lines.push('---');
    lines.push('');
    
    if (verifiedCount > 0 && unverifiedCount > 0) {
      lines.push(`Summary`);
      lines.push(`Total: ${sortedItems.length} questions`);
      lines.push(`Verified: ${verifiedCount} (from official sources)`);
      lines.push(`Unverified: ${unverifiedCount} (please verify before use)`);
    } else if (verifiedCount > 0) {
      lines.push(`Summary`);
      lines.push(`Total: ${sortedItems.length} questions`);
      lines.push(`All verified from official sources`);
    } else {
      lines.push(`Summary`);
      lines.push(`Total: ${sortedItems.length} questions`);
      lines.push(`All unverified - please verify before use`);
    }
    lines.push('');
    
    if (sortedItems.length >= limit) {
      lines.push('Tips for Better Results:');
      lines.push('- Try: "PYQ on [specific topic]" for focused questions');
      lines.push('- Try: "PYQ from 2020 to 2024" for year-specific queries');
      lines.push('- Try: "PYQ about [subject]" for subject-wise questions');
      lines.push('- Combine filters: "PYQ on Geography from 2020 to 2024"');
      lines.push('');
    }
    
    return lines.join('\n');
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
      
      const items = await this.queryDatabase(filter, params.theme, { skip, limit });
      
      if (!items || items.length === 0) {
        return null;
      }
      
      return this.formatResults(items, params, { limit });
      
    } catch (error) {
      console.error('PYQ service error:', error.message);
      return null;
    }
  }
}

const pyqService = new PyqService();
export default pyqService;

