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
    const cleanMsg = userMsg.replace(/\b(upsc|pcs|ssc|exam|exams|pyq|previous year|past year)\b/ig, '');
    
    const themeMatch = cleanMsg.match(/(?:on|about|of|for)\s+([^.,;\n]+)/i);
    const theme = themeMatch ? themeMatch[1].trim() : '';
    
    const rangeMatch = cleanMsg.match(/from\s+(\d{4})(?:s)?\s*(?:to|\-|–|—)\s*(present|\d{4})/i);
    const decadeMatch = cleanMsg.match(/(\d{4})s/i);
    
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
    }
    
    const examCode = this.detectExamCode(userMsg, language);
    
    return { theme, fromYear, toYear, examCode };
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
        const themeRegex = new RegExp(theme.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        
        query = PYQ.find({
          ...filter,
          $or: [
            { topicTags: { $regex: themeRegex } },
            { question: { $regex: themeRegex } }
          ]
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
          const fallbackQuery = PYQ.find({
            ...filter,
            $or: [
              { question: { $regex: theme, $options: 'i' } }
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

  formatResults(items, params) {
    if (!items || items.length === 0) return null;
    
    const { theme, fromYear, toYear, examCode } = params;
    
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
      
      if (!byYear.has(year)) byYear.set(year, []);
      
      const isUnverified = q.verified === false && 
        (!q.sourceLink || !q.sourceLink.includes('.gov.in'));
      const topicTags = q.topicTags && q.topicTags.length > 0 
        ? q.topicTags.join(', ') 
        : null;
      
      let questionText = q.question || '';
      if (questionText.length > 150) {
        questionText = questionText.substring(0, 147) + '...';
      }
      
      let label = `[${q.paper || 'General'}] ${questionText}`;
      
      if (topicTags && !questionText.toLowerCase().includes(topicTags.toLowerCase().substring(0, 20))) {
        label += ` (${topicTags})`;
      }
      
      if (isUnverified) {
        label += ' ⚠️';
      } else if (q.sourceLink && q.sourceLink.includes('.gov.in')) {
        label += ' ✅';
      }
      
      byYear.get(year).push(label);
    }
    
    const lines = [];
    lines.push(`## 📚 Previous Year Questions (${examCode})`);
    
    if (theme) {
      lines.push(`**Topic:** ${theme}`);
    }
    if (fromYear || toYear) {
      lines.push(`**Year Range:** ${fromYear || 'All'} to ${toYear || 'Present'}`);
    }
    lines.push('');
    
    const sortedYears = Array.from(byYear.keys()).sort((a, b) => b - a);
    
    for (const year of sortedYears) {
      const yearQuestions = byYear.get(year);
      if (yearQuestions.length === 0) continue;
      
      lines.push(`### 📅 ${year} (${yearQuestions.length} question${yearQuestions.length > 1 ? 's' : ''})`);
      lines.push('');
      yearQuestions.forEach((q, idx) => {
        lines.push(`${idx + 1}. ${q}`);
      });
      lines.push('');
    }
    
    lines.push('---');
    lines.push('');
    
    if (verifiedCount > 0 && unverifiedCount > 0) {
      lines.push(`### 📊 Summary`);
      lines.push(`**Total:** ${sortedItems.length} questions`);
      lines.push(`- ✅ Verified: ${verifiedCount} (from official sources)`);
      lines.push(`- ⚠️ Unverified: ${unverifiedCount} (please verify before use)`);
    } else if (verifiedCount > 0) {
      lines.push(`### 📊 Summary`);
      lines.push(`**Total:** ${sortedItems.length} questions`);
      lines.push(`✅ All verified from official sources`);
    } else {
      lines.push(`### 📊 Summary`);
      lines.push(`**Total:** ${sortedItems.length} questions`);
      lines.push(`⚠️ All unverified - please verify before use`);
    }
    lines.push('');
    
    if (sortedItems.length >= options.limit) {
      lines.push('💡 **Tips for Better Results:**');
      lines.push('- Try: `"PYQ on [specific topic]"` for focused questions');
      lines.push('- Try: `"PYQ from 2020 to 2024"` for year-specific queries');
      lines.push('- Try: `"PYQ about [subject]"` for subject-wise questions');
      lines.push('- Combine filters: `"PYQ on Geography from 2020 to 2024"`');
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
      
      return this.formatResults(items, params);
      
    } catch (error) {
      console.error('PYQ service error:', error.message);
      return null;
    }
  }
}

const pyqService = new PyqService();
export default pyqService;

