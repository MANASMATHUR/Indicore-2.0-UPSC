'use client';

class ExamKnowledge {
  constructor() {
    this.examStructures = this.initializeExamStructures();
    this.subjectTopics = this.initializeSubjectTopics();
    this.answerFrameworks = this.initializeAnswerFrameworks();
    this.currentAffairsCategories = this.initializeCurrentAffairs();
    this.previousYearPatterns = this.initializePreviousYearPatterns();
    this.multilingualTerms = this.initializeMultilingualTerms();
  }

  initializeExamStructures() {
    return {
      upsc: {
        name: 'Union Public Service Commission',
        stages: ['Prelims', 'Mains', 'Interview'],
        prelims: {
          papers: 2,
          duration: '2 hours each',
          type: 'Objective (MCQ)',
          subjects: ['General Studies Paper I', 'General Studies Paper II (CSAT)'],
          totalMarks: 400,
          qualifyingMarks: '33%',
          negativeMarking: '1/3rd mark deducted for wrong answer'
        },
        mains: {
          papers: 9,
          duration: '3 hours each',
          type: 'Descriptive',
          subjects: [
            'Paper A: Indian Language (300 marks)',
            'Paper B: English (300 marks)',
            'Paper I: Essay (250 marks)',
            'Paper II: General Studies I (250 marks)',
            'Paper III: General Studies II (250 marks)',
            'Paper IV: General Studies III (250 marks)',
            'Paper V: General Studies IV (250 marks)',
            'Paper VI: Optional Subject Paper I (250 marks)',
            'Paper VII: Optional Subject Paper II (250 marks)'
          ],
          totalMarks: 1750,
          qualifyingMarks: '25% in each paper'
        },
        interview: {
          duration: '30-45 minutes',
          marks: 275,
          type: 'Personality Test'
        }
      },
      pcs: {
        name: 'Provincial Civil Service',
        stages: ['Prelims', 'Mains', 'Interview'],
        prelims: {
          papers: 2,
          duration: '2 hours each',
          type: 'Objective (MCQ)',
          subjects: ['General Studies', 'General Studies II (CSAT)'],
          totalMarks: 400,
          stateSpecific: true
        },
        mains: {
          papers: 6,
          duration: '3 hours each',
          type: 'Descriptive',
          subjects: [
            'Paper I: General Studies I',
            'Paper II: General Studies II',
            'Paper III: General Studies III',
            'Paper IV: General Studies IV',
            'Paper V: Optional Subject Paper I',
            'Paper VI: Optional Subject Paper II'
          ],
          totalMarks: 1000,
          stateSpecific: true
        }
      },
      ssc: {
        name: 'Staff Selection Commission',
        exams: ['CGL', 'CHSL', 'MTS', 'CPO', 'JE'],
        cgl: {
          tiers: 4,
          type: 'Computer Based Test',
          subjects: ['General Intelligence', 'General Awareness', 'Quantitative Aptitude', 'English Comprehension']
        },
        chsl: {
          tiers: 3,
          type: 'Computer Based Test + Skill Test',
          subjects: ['General Intelligence', 'General Awareness', 'Quantitative Aptitude', 'English Language']
        }
      }
    };
  }

  initializeSubjectTopics() {
    return {
      polity: {
        weightage: 'High (15-20 questions in Prelims)',
        keyTopics: [
          'Constitutional Framework',
          'Fundamental Rights and Duties',
          'Directive Principles of State Policy',
          'Union and State Executive',
          'Parliament and State Legislature',
          'Judiciary System',
          'Constitutional Bodies',
          'Non-Constitutional Bodies',
          'Local Government (Panchayati Raj)',
          'Emergency Provisions',
          'Constitutional Amendments',
          'Election Commission',
          'Finance Commission',
          'Public Administration'
        ],
        importantActs: [
          'Constitution of India (1950)',
          'Right to Information Act (2005)',
          'Right to Education Act (2009)',
          'Goods and Services Tax Act (2017)',
          'Citizenship Amendment Act (2019)',
          'Farm Laws (2020)'
        ]
      },
      history: {
        weightage: 'High (15-20 questions in Prelims)',
        ancient: [
          'Indus Valley Civilization',
          'Vedic Period',
          'Mauryan Empire',
          'Gupta Empire',
          'South Indian Kingdoms'
        ],
        medieval: [
          'Delhi Sultanate',
          'Mughal Empire',
          'Vijayanagara Empire',
          'Maratha Empire',
          'Bhakti and Sufi Movements'
        ],
        modern: [
          'British Rule in India',
          'Freedom Struggle (1857-1947)',
          'Gandhi and National Movement',
          'Partition of India',
          'Constitutional Development'
        ]
      },
      geography: {
        weightage: 'High (15-20 questions in Prelims)',
        physical: [
          'Physical Features of India',
          'Climate and Weather',
          'Natural Vegetation',
          'Soils and Agriculture',
          'Water Resources',
          'Natural Disasters'
        ],
        human: [
          'Population and Demographics',
          'Urbanization',
          'Migration Patterns',
          'Economic Geography',
          'Transport and Communication'
        ],
        world: [
          'World Geography',
          'International Relations',
          'Global Organizations',
          'Climate Change'
        ]
      },
      economics: {
        weightage: 'High (15-20 questions in Prelims)',
        microeconomics: [
          'Demand and Supply',
          'Market Structures',
          'Consumer Behavior',
          'Production and Cost'
        ],
        macroeconomics: [
          'National Income',
          'Inflation and Deflation',
          'Monetary Policy',
          'Fiscal Policy',
          'International Trade'
        ],
        indianEconomy: [
          'Economic Planning',
          'Agriculture and Industry',
          'Banking and Finance',
          'Public Finance',
          'Economic Reforms',
          'Poverty and Unemployment'
        ]
      },
      science: {
        weightage: 'Medium (10-15 questions in Prelims)',
        physics: [
          'Mechanics',
          'Thermodynamics',
          'Optics',
          'Electricity and Magnetism',
          'Modern Physics'
        ],
        chemistry: [
          'Atomic Structure',
          'Chemical Bonding',
          'Organic Chemistry',
          'Inorganic Chemistry',
          'Physical Chemistry'
        ],
        biology: [
          'Cell Biology',
          'Genetics',
          'Evolution',
          'Ecology',
          'Human Physiology',
          'Plant Physiology'
        ],
        technology: [
          'Information Technology',
          'Space Technology',
          'Nuclear Technology',
          'Biotechnology',
          'Nanotechnology'
        ]
      },
      environment: {
        weightage: 'High (10-15 questions in Prelims)',
        keyTopics: [
          'Ecosystem and Biodiversity',
          'Climate Change',
          'Pollution and Control',
          'Conservation Strategies',
          'Environmental Laws',
          'Sustainable Development',
          'Renewable Energy',
          'Wildlife Conservation'
        ]
      }
    };
  }

  initializeAnswerFrameworks() {
    return {
      mains: {
        '150_words': {
          structure: 'Introduction (20-30 words) → Main Body (100-120 words) → Conclusion (20-30 words)',
          timeLimit: '7-8 minutes',
          tips: [
            'Start with definition or brief context',
            'Use bullet points or short paragraphs',
            'Include examples and data',
            'End with significance or way forward'
          ]
        },
        '250_words': {
          structure: 'Introduction (40-50 words) → Main Body (150-180 words) → Conclusion (40-50 words)',
          timeLimit: '12-15 minutes',
          tips: [
            'Provide comprehensive coverage',
            'Use sub-headings if needed',
            'Include multiple perspectives',
            'Support with facts and figures'
          ]
        },
        essay: {
          structure: 'Introduction → Body (3-4 paragraphs) → Conclusion',
          timeLimit: '60-90 minutes',
          tips: [
            'Choose balanced approach',
            'Use examples from history, current affairs',
            'Maintain flow and coherence',
            'End with optimistic note'
          ]
        }
      },
      prelims: {
        strategy: [
          'Read question carefully',
          'Eliminate obviously wrong options',
          'Use elimination technique',
          'Don\'t guess unless 50% sure',
          'Manage time effectively'
        ]
      }
    };
  }

  initializeCurrentAffairs() {
    return {
      categories: [
        'National Affairs',
        'International Affairs',
        'Science and Technology',
        'Environment and Ecology',
        'Economy and Finance',
        'Sports and Culture',
        'Awards and Honours',
        'Government Schemes',
        'Judicial Developments',
        'Defense and Security'
      ],
      sources: [
        'The Hindu',
        'Indian Express',
        'Business Standard',
        'PIB (Press Information Bureau)',
        'Yojana Magazine',
        'Kurukshetra Magazine',
        'Economic Survey',
        'Union Budget'
      ],
      importantEvents: [
        'Union Budget',
        'Economic Survey',
        'Monetary Policy',
        'International Summits',
        'National Awards',
        'Sports Achievements',
        'Scientific Discoveries'
      ]
    };
  }

  initializePreviousYearPatterns() {
    return {
      upsc: {
        prelims: {
          '2023': {
            totalQuestions: 100,
            polity: 18,
            history: 16,
            geography: 15,
            economics: 14,
            science: 12,
            environment: 10,
            currentAffairs: 15
          },
          '2022': {
            totalQuestions: 100,
            polity: 17,
            history: 15,
            geography: 16,
            economics: 13,
            science: 11,
            environment: 12,
            currentAffairs: 16
          }
        },
        mains: {
          commonTopics: [
            'Indian Heritage and Culture',
            'Governance and Social Justice',
            'Technology and Economic Development',
            'Ethics and Human Interface',
            'International Relations',
            'Disaster Management'
          ]
        }
      }
    };
  }

  initializeMultilingualTerms() {
    return {
      hindi: {
        'Union Public Service Commission': 'संघ लोक सेवा आयोग',
        'Provincial Civil Service': 'प्रांतीय सिविल सेवा',
        'Staff Selection Commission': 'कर्मचारी चयन आयोग',
        'General Studies': 'सामान्य अध्ययन',
        'Current Affairs': 'समसामयिक घटनाक्रम',
        'Constitution': 'संविधान',
        'Fundamental Rights': 'मौलिक अधिकार',
        'Parliament': 'संसद',
        'Supreme Court': 'सुप्रीम कोर्ट',
        'Election Commission': 'चुनाव आयोग'
      },
      tamil: {
        'Union Public Service Commission': 'ஒன்றிய பொது சேவை ஆணையம்',
        'General Studies': 'பொது ஆய்வு',
        'Current Affairs': 'நடப்பு நிகழ்வுகள்',
        'Constitution': 'அரசியலமைப்பு',
        'Parliament': 'நாடாளுமன்றம்'
      },
      bengali: {
        'Union Public Service Commission': 'কেন্দ্রীয় জনসেবা কমিশন',
        'General Studies': 'সাধারণ অধ্যয়ন',
        'Current Affairs': 'সমসাময়িক ঘটনা',
        'Constitution': 'সংবিধান',
        'Parliament': 'সংসদ'
      }
    };
  }

  getExamStructure(examType) {
    return this.examStructures[examType] || null;
  }

  getSubjectTopics(subject) {
    return this.subjectTopics[subject] || null;
  }

  getAnswerFramework(type) {
    return this.answerFrameworks[type] || null;
  }

  getCurrentAffairsCategories() {
    return this.currentAffairsCategories;
  }

  getPreviousYearPatterns(examType, year) {
    return this.previousYearPatterns[examType]?.[year] || null;
  }

  getMultilingualTerm(term, language) {
    return this.multilingualTerms[language]?.[term] || term;
  }

  detectSubjectFromQuery(query) {
    const lowerQuery = query.toLowerCase();
    const subjectKeywords = {
      polity: ['constitution', 'parliament', 'fundamental rights', 'governance', 'democracy', 'election', 'judiciary'],
      history: ['history', 'ancient', 'medieval', 'modern', 'freedom struggle', 'independence', 'british rule'],
      geography: ['geography', 'climate', 'physical features', 'population', 'agriculture', 'natural resources'],
      economics: ['economy', 'economics', 'gdp', 'inflation', 'banking', 'finance', 'trade', 'development'],
      science: ['science', 'technology', 'physics', 'chemistry', 'biology', 'space', 'nuclear', 'biotechnology'],
      environment: ['environment', 'ecology', 'biodiversity', 'climate change', 'pollution', 'conservation']
    };

    for (const [subject, keywords] of Object.entries(subjectKeywords)) {
      if (keywords.some(keyword => lowerQuery.includes(keyword))) {
        return subject;
      }
    }
    return null;
  }

  getContextForQuery(query) {
    const subject = this.detectSubjectFromQuery(query);
    const context = {
      subject: subject,
      subjectTopics: subject ? this.getSubjectTopics(subject) : null,
      examType: this.detectExamType(query),
      answerFramework: this.detectAnswerType(query)
    };
    return context;
  }

  detectExamType(query) {
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('upsc')) return 'upsc';
    if (lowerQuery.includes('pcs')) return 'pcs';
    if (lowerQuery.includes('ssc')) return 'ssc';
    return null;
  }

  detectAnswerType(query) {
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('150 words') || lowerQuery.includes('150-word')) return '150_words';
    if (lowerQuery.includes('250 words') || lowerQuery.includes('250-word')) return '250_words';
    if (lowerQuery.includes('essay')) return 'essay';
    return null;
  }

  generateContextualPrompt(query) {
    const context = this.getContextForQuery(query);
    let contextualPrompt = '';

    // Add reliability and accuracy emphasis
    contextualPrompt += '\n\nRELIABILITY REQUIREMENTS:\n';
    contextualPrompt += '- Always prioritize accuracy over speed\n';
    contextualPrompt += '- Cross-reference with official sources\n';
    contextualPrompt += '- State confidence levels when uncertain\n';
    contextualPrompt += '- Include specific constitutional articles and acts\n';
    contextualPrompt += '- Mention relevant committees and reports\n';
    contextualPrompt += '- Provide exam-specific insights and patterns\n';

    if (context.subject && context.subjectTopics) {
      contextualPrompt += `\n\nRELEVANT SUBJECT CONTEXT (${context.subject.toUpperCase()}):\n`;
      
      // Add subject-specific reliability requirements
      if (context.subject === 'polity') {
        contextualPrompt += 'CONSTITUTIONAL ACCURACY REQUIREMENTS:\n';
        contextualPrompt += '- Always cite specific articles (e.g., Article 14, Article 21)\n';
        contextualPrompt += '- Mention relevant schedules and parts\n';
        contextualPrompt += '- Include constitutional amendments when relevant\n';
        contextualPrompt += '- Reference landmark judgments and their implications\n';
        contextualPrompt += '- Connect to current constitutional debates\n';
      }
      
      if (context.subject === 'current affairs') {
        contextualPrompt += 'CURRENT AFFAIRS RELIABILITY:\n';
        contextualPrompt += '- Mention specific dates and timeframes\n';
        contextualPrompt += '- Include official government announcements\n';
        contextualPrompt += '- Reference recent policy changes and their impact\n';
        contextualPrompt += '- Connect to exam-relevant themes\n';
        contextualPrompt += '- Highlight implications for governance\n';
      }
      
      if (context.subject === 'history') {
        contextualPrompt += 'HISTORICAL ACCURACY REQUIREMENTS:\n';
        contextualPrompt += '- Provide specific dates and periods\n';
        contextualPrompt += '- Include relevant personalities and their contributions\n';
        contextualPrompt += '- Mention historical sources and evidence\n';
        contextualPrompt += '- Connect historical events to contemporary relevance\n';
        contextualPrompt += '- Highlight exam-frequently asked aspects\n';
      }
      
      if (context.subject === 'geography') {
        contextualPrompt += 'GEOGRAPHICAL ACCURACY REQUIREMENTS:\n';
        contextualPrompt += '- Include specific locations and coordinates\n';
        contextualPrompt += '- Mention relevant geographical features\n';
        contextualPrompt += '- Provide statistical data when available\n';
        contextualPrompt += '- Connect to environmental and economic implications\n';
        contextualPrompt += '- Highlight regional variations and patterns\n';
      }
      
      if (context.subject === 'economics') {
        contextualPrompt += 'ECONOMIC ACCURACY REQUIREMENTS:\n';
        contextualPrompt += '- Include specific economic indicators and data\n';
        contextualPrompt += '- Mention relevant economic policies and schemes\n';
        contextualPrompt += '- Reference official economic reports and surveys\n';
        contextualPrompt += '- Connect to development and welfare implications\n';
        contextualPrompt += '- Highlight exam-relevant economic concepts\n';
      }
      
      // Handle different subject structures
      if (context.subjectTopics.keyTopics && Array.isArray(context.subjectTopics.keyTopics)) {
        contextualPrompt += `Key Topics: ${context.subjectTopics.keyTopics.slice(0, 5).join(', ')}\n`;
      } else if (context.subjectTopics.ancient || context.subjectTopics.medieval || context.subjectTopics.modern) {
        // Handle history structure
        const topics = [];
        if (context.subjectTopics.ancient) topics.push(...context.subjectTopics.ancient.slice(0, 2));
        if (context.subjectTopics.medieval) topics.push(...context.subjectTopics.medieval.slice(0, 2));
        if (context.subjectTopics.modern) topics.push(...context.subjectTopics.modern.slice(0, 2));
        contextualPrompt += `Key Topics: ${topics.slice(0, 5).join(', ')}\n`;
      } else if (context.subjectTopics.physical || context.subjectTopics.human || context.subjectTopics.world) {
        // Handle geography structure
        const topics = [];
        if (context.subjectTopics.physical) topics.push(...context.subjectTopics.physical.slice(0, 2));
        if (context.subjectTopics.human) topics.push(...context.subjectTopics.human.slice(0, 2));
        if (context.subjectTopics.world) topics.push(...context.subjectTopics.world.slice(0, 2));
        contextualPrompt += `Key Topics: ${topics.slice(0, 5).join(', ')}\n`;
      } else if (context.subjectTopics.microeconomics || context.subjectTopics.macroeconomics || context.subjectTopics.indianEconomy) {
        // Handle economics structure
        const topics = [];
        if (context.subjectTopics.microeconomics) topics.push(...context.subjectTopics.microeconomics.slice(0, 2));
        if (context.subjectTopics.macroeconomics) topics.push(...context.subjectTopics.macroeconomics.slice(0, 2));
        if (context.subjectTopics.indianEconomy) topics.push(...context.subjectTopics.indianEconomy.slice(0, 2));
        contextualPrompt += `Key Topics: ${topics.slice(0, 5).join(', ')}\n`;
      } else if (context.subjectTopics.physics || context.subjectTopics.chemistry || context.subjectTopics.biology || context.subjectTopics.technology) {
        // Handle science structure
        const topics = [];
        if (context.subjectTopics.physics) topics.push(...context.subjectTopics.physics.slice(0, 2));
        if (context.subjectTopics.chemistry) topics.push(...context.subjectTopics.chemistry.slice(0, 2));
        if (context.subjectTopics.biology) topics.push(...context.subjectTopics.biology.slice(0, 2));
        if (context.subjectTopics.technology) topics.push(...context.subjectTopics.technology.slice(0, 2));
        contextualPrompt += `Key Topics: ${topics.slice(0, 5).join(', ')}\n`;
      }
      
      if (context.subjectTopics.importantActs && Array.isArray(context.subjectTopics.importantActs)) {
        contextualPrompt += `Important Acts: ${context.subjectTopics.importantActs.slice(0, 3).join(', ')}\n`;
      }
    }

    if (context.examType) {
      const examStructure = this.getExamStructure(context.examType);
      if (examStructure) {
        contextualPrompt += `\n\nEXAM CONTEXT (${context.examType.toUpperCase()}):\n`;
        contextualPrompt += `Stages: ${examStructure.stages.join(' → ')}\n`;
        if (examStructure.prelims) {
          contextualPrompt += `Prelims: ${examStructure.prelims.subjects.join(', ')}\n`;
        }
      }
    }

    if (context.answerFramework) {
      const framework = this.getAnswerFramework('mains')[context.answerFramework];
      if (framework) {
        contextualPrompt += `\n\nANSWER WRITING FRAMEWORK:\n`;
        contextualPrompt += `Structure: ${framework.structure}\n`;
        contextualPrompt += `Time Limit: ${framework.timeLimit}\n`;
        if (framework.tips && Array.isArray(framework.tips)) {
          contextualPrompt += `Tips: ${framework.tips.slice(0, 2).join('; ')}\n`;
        }
      }
    }

    return contextualPrompt;
  }
}

const examKnowledge = new ExamKnowledge();
export default examKnowledge;
