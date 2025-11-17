import connectToDatabase from '@/lib/mongodb';
import PYQ from '@/models/PYQ';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await connectToDatabase();

    const {
      exam = 'UPSC',
      paper = '', // e.g., 'GS-1', 'GS-2', 'GS-3', 'GS-4'
      level = 'Mains', // Default to Mains for GS papers
      limit = 1000
    } = req.query;

    // Normalize filters
    const filter = {
      exam: exam.toUpperCase().trim(),
      level: new RegExp(`^${level}$`, 'i'),
      question: { $exists: true, $ne: '', $regex: /.{10,}/ } // Only valid questions
    };

    if (paper && paper.trim()) {
      const paperClean = paper.trim();
      const paperRegex = new RegExp(paperClean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.paper = paperRegex;
    }

    const items = await PYQ.find(filter)
      .sort({ verified: -1, year: -1 }) // Verified first, then newest
      .limit(Math.min(parseInt(limit, 10) || 1000, 5000)) // Cap at 5000
      .lean();

    const themeMap = new Map();

    items.forEach(item => {
      let theme = item.theme;
      
      if (!theme && item.topicTags && item.topicTags.length > 0) {
        theme = item.topicTags[0];
      }
      
      if (!theme) {
        theme = inferThemeFromQuestion(item.question, paper);
      }
      
      theme = normalizeThemeName(theme || 'General');
      
      if (!themeMap.has(theme)) {
        themeMap.set(theme, []);
      }
      
      themeMap.get(theme).push(item);
    });

    const themes = Array.from(themeMap.entries())
      .map(([theme, questions]) => ({
        theme,
        questions: questions.sort((a, b) => (b.year || 0) - (a.year || 0)),
        count: questions.length
      }))
      .sort((a, b) => b.count - a.count);

    return res.status(200).json({
      ok: true,
      paper: paper || 'All',
      exam,
      level,
      themes,
      totalQuestions: items.length,
      totalThemes: themes.length
    });
  } catch (err) {
    console.error('PYQ themes error', err);
    return res.status(500).json({ ok: false, error: 'Failed to fetch theme-wise PYQs' });
  }
}

function inferThemeFromQuestion(question, paper) {
  const questionLower = question.toLowerCase();
  const paperUpper = (paper || '').toUpperCase();
  
  const themePatterns = {
    'GS-1': {
      'role of women': 'Role of Women in History',
      'women': 'Role of Women in History',
      'freedom struggle': 'Freedom Struggle',
      'indian national movement': 'Indian National Movement',
      'gandhi': 'Gandhian Phase',
      'social reform': 'Social Reform Movement',
      'british': 'British Rule in India',
      'ancient': 'Ancient India',
      'medieval': 'Medieval India',
      'modern': 'Modern India',
      'geography': 'Geography',
      'climate': 'Climate and Geography',
      'culture': 'Indian Culture and Heritage',
      'art': 'Art and Architecture',
      'literature': 'Literature',
      'heritage': 'Indian Heritage'
    },
    'GS-2': {
      'constitution': 'Constitution',
      'governance': 'Governance',
      'polity': 'Indian Polity',
      'federalism': 'Federalism',
      'judiciary': 'Judiciary',
      'parliament': 'Parliament',
      'executive': 'Executive',
      'rights': 'Fundamental Rights',
      'directive principles': 'Directive Principles',
      'international relations': 'International Relations',
      'foreign policy': 'Foreign Policy',
      'social justice': 'Social Justice',
      'welfare': 'Welfare Schemes',
      'panchayati raj': 'Local Governance',
      'election': 'Electoral System'
    },
    'GS-3': {
      'economy': 'Indian Economy',
      'economic': 'Indian Economy',
      'technology': 'Science and Technology',
      'science': 'Science and Technology',
      'security': 'Internal Security',
      'disaster': 'Disaster Management',
      'environment': 'Environment and Ecology',
      'biodiversity': 'Biodiversity',
      'agriculture': 'Agriculture',
      'industry': 'Industry',
      'infrastructure': 'Infrastructure',
      'banking': 'Banking and Finance',
      'monetary policy': 'Monetary Policy',
      'fiscal policy': 'Fiscal Policy'
    },
    'GS-4': {
      'ethics': 'Ethics',
      'integrity': 'Integrity',
      'aptitude': 'Aptitude',
      'case study': 'Case Studies',
      'values': 'Values',
      'attitude': 'Attitude',
      'emotional intelligence': 'Emotional Intelligence',
      'public service': 'Public Service',
      'moral': 'Moral Philosophy'
    },
    // Prelims
    'PRELIMS': {
      'current affairs': 'Current Affairs',
      'history': 'History',
      'geography': 'Geography',
      'polity': 'Polity',
      'economy': 'Economy',
      'science': 'Science and Technology',
      'environment': 'Environment',
      'csat': 'CSAT',
      'comprehension': 'Reading Comprehension',
      'reasoning': 'Logical Reasoning',
      'aptitude': 'Aptitude'
    },
    // Optional Subjects - Public Administration
    'PUBLIC ADMINISTRATION': {
      'administrative theory': 'Administrative Theory',
      'thinkers': 'Administrative Thinkers',
      'indian administration': 'Indian Administration',
      'public policy': 'Public Policy',
      'development administration': 'Development Administration',
      'personnel administration': 'Personnel Administration',
      'financial administration': 'Financial Administration',
      'accountability': 'Accountability and Control'
    },
    // Optional Subjects - Sociology
    'SOCIOLOGY': {
      'sociological theory': 'Sociological Theory',
      'thinkers': 'Sociological Thinkers',
      'indian society': 'Indian Society',
      'social change': 'Social Change',
      'stratification': 'Social Stratification',
      'caste': 'Caste System',
      'tribal': 'Tribal Society',
      'gender': 'Gender and Society',
      'religion': 'Religion and Society'
    },
    // Optional Subjects - Geography
    'GEOGRAPHY': {
      'physical geography': 'Physical Geography',
      'human geography': 'Human Geography',
      'geomorphology': 'Geomorphology',
      'climatology': 'Climatology',
      'oceanography': 'Oceanography',
      'biogeography': 'Biogeography',
      'economic geography': 'Economic Geography',
      'population geography': 'Population Geography',
      'settlement geography': 'Settlement Geography',
      'regional planning': 'Regional Planning'
    },
    // Optional Subjects - History
    'HISTORY': {
      'ancient history': 'Ancient History',
      'medieval history': 'Medieval History',
      'modern history': 'Modern History',
      'world history': 'World History',
      'art and culture': 'Art and Culture',
      'freedom struggle': 'Freedom Struggle',
      'colonialism': 'Colonialism',
      'nationalism': 'Nationalism'
    },
    // Optional Subjects - Political Science
    'POLITICAL SCIENCE': {
      'political theory': 'Political Theory',
      'thinkers': 'Political Thinkers',
      'indian political thought': 'Indian Political Thought',
      'western political thought': 'Western Political Thought',
      'comparative politics': 'Comparative Politics',
      'international relations': 'International Relations',
      'public administration': 'Public Administration'
    },
    // Essay
    'ESSAY': {
      'philosophy': 'Philosophy',
      'society': 'Society',
      'politics': 'Politics',
      'economy': 'Economy',
      'science': 'Science and Technology',
      'environment': 'Environment',
      'education': 'Education',
      'culture': 'Culture',
      'youth': 'Youth',
      'women': 'Women',
      'development': 'Development'
    }
  };

  let patterns = themePatterns[paperUpper] || {};
  
  if (Object.keys(patterns).length === 0) {
    if (paperUpper.includes('GS-')) {
      const gsNum = paperUpper.match(/GS-(\d)/);
      if (gsNum) {
        patterns = themePatterns[`GS-${gsNum[1]}`] || {};
      }
    }
    else if (paperUpper.includes('PRELIM') || paperUpper.includes('CSAT')) {
      patterns = themePatterns['PRELIMS'] || {};
    }
    else if (paperUpper.includes('PUBLIC ADMIN') || paperUpper.includes('PA')) {
      patterns = themePatterns['PUBLIC ADMINISTRATION'] || {};
    }
    else if (paperUpper.includes('SOCIOLOGY')) {
      patterns = themePatterns['SOCIOLOGY'] || {};
    }
    else if (paperUpper.includes('GEOGRAPHY') && !paperUpper.includes('GS')) {
      patterns = themePatterns['GEOGRAPHY'] || {};
    }
    else if (paperUpper.includes('HISTORY') && !paperUpper.includes('GS')) {
      patterns = themePatterns['HISTORY'] || {};
    }
    else if (paperUpper.includes('POLITICAL SCIENCE') || paperUpper.includes('POL SCIENCE')) {
      patterns = themePatterns['POLITICAL SCIENCE'] || {};
    }
    else if (paperUpper.includes('ESSAY')) {
      patterns = themePatterns['ESSAY'] || {};
    }
  }
  
  if (Object.keys(patterns).length === 0) {
    patterns = {
      ...themePatterns['GS-1'],
      ...themePatterns['GS-2'],
      ...themePatterns['GS-3'],
      ...themePatterns['PRELIMS']
    };
  }
  
  // Match patterns
  for (const [pattern, theme] of Object.entries(patterns)) {
    if (questionLower.includes(pattern)) {
      return theme;
    }
  }
  
  const keyTerms = extractKeyTerms(question);
  if (keyTerms.length > 0) {
    return keyTerms[0].charAt(0).toUpperCase() + keyTerms[0].slice(1);
  }
  
  return null;
}

function extractKeyTerms(question) {
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how', 'discuss', 'explain', 'analyze', 'evaluate', 'examine', 'critically', 'elaborate', 'describe', 'compare', 'contrast']);
  
  const words = question.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));
  
  return [...new Set(words)].slice(0, 3);
}

function normalizeThemeName(theme) {
  if (!theme) return 'General';
  
  return theme
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}


