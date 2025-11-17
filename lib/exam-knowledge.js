class ExamKnowledge {
  constructor() {
    this.examStructures = this.initExamStructures();
    this.subjectTopics = this.initSubjectTopics();
    this.answerFrameworks = this.initAnswerFrameworks();
    this.currentAffairs = this.initCurrentAffairs();
    this.pyqPatterns = this.initPyqPatterns();
    this.multilingualTerms = this.initMultilingualTerms();
    this.constitutionalArticles = this.initConstitutionalArticles();
    this.landmarkCases = this.initLandmarkCases();
    this.committees = this.initCommittees();
    this.governmentSchemes = this.initGovernmentSchemes();
  }

  initExamStructures() {
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

  initSubjectTopics() {
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

  initAnswerFrameworks() {
    return {
      mains: {
        '150_words': {
          structure: 'Introduction (20-30 words) → Main Body (100-120 words) → Conclusion (20-30 words)',
          timeLimit: '7-8 minutes',
          tips: [
            'Start with definition or brief context',
            'Use bullet points or short paragraphs',
            'Include examples and data',
            'End with significance or way forward',
            'Mention relevant PYQ if applicable'
          ],
          framework: {
            introduction: 'Define/contextualize the topic briefly',
            body: [
              'Key points with examples',
              'Relevant data/statistics',
              'Historical context if needed',
              'Reference to PYQ (if asked about similar topics)'
            ],
            conclusion: 'Significance/way forward/current relevance'
          }
        },
        '250_words': {
          structure: 'Introduction (40-50 words) → Main Body (150-180 words) → Conclusion (40-50 words)',
          timeLimit: '12-15 minutes',
          tips: [
            'Cover all key points',
            'Use sub-headings if needed',
            'Include multiple perspectives',
            'Support with facts and figures',
            'Integrate relevant PYQ examples',
            'Add current affairs linkage'
          ],
          framework: {
            introduction: 'Context, definition, and thesis statement',
            body: [
              'Historical background/evolution',
              'Key features/components',
              'Multiple perspectives/arguments',
              'Relevant examples and case studies',
              'PYQ context (similar questions asked)',
              'Current affairs linkage',
              'Data and statistics'
            ],
            conclusion: 'Summary, significance, and way forward'
          }
        },
        essay: {
          structure: 'Introduction → Body (3-4 paragraphs) → Conclusion',
          timeLimit: '60-90 minutes',
          tips: [
            'Choose balanced approach',
            'Use examples from history, current affairs',
            'Maintain flow and coherence',
            'End with optimistic note',
            'Reference relevant PYQ themes'
          ],
          framework: {
            introduction: 'Hook, context, and thesis statement',
            body: [
              'Paragraph 1: Historical perspective',
              'Paragraph 2: Current scenario with examples',
              'Paragraph 3: Challenges and opportunities',
              'Paragraph 4: Way forward with PYQ insights',
              'Current affairs integration'
            ],
            conclusion: 'Synthesis and forward-looking approach'
          }
        },
        'general': {
          structure: 'Introduction → Main Body → Conclusion',
          framework: {
            introduction: 'Define and contextualize',
            body: [
              'Key concepts and features',
              'Historical evolution if relevant',
              'Current status and developments',
              'Relevant PYQ context (similar questions)',
              'Examples and case studies',
              'Multiple perspectives'
            ],
            conclusion: 'Significance and implications'
          }
        }
      },
      prelims: {
        strategy: [
          'Read question carefully',
          'Eliminate obviously wrong options',
          'Use elimination technique',
          'Don\'t guess unless 50% sure',
          'Manage time effectively',
          'Recall relevant PYQ patterns',
          'Focus on accuracy and exam patterns'
        ]
      }
    };
  }
  
  getAnswerFramework(type = 'general', wordCount = null) {
    if (wordCount === 150 || type === '150_words') {
      return this.answerFrameworks.mains['150_words'];
    } else if (wordCount === 250 || type === '250_words') {
      return this.answerFrameworks.mains['250_words'];
    } else if (type === 'essay') {
      return this.answerFrameworks.mains.essay;
    }
    return this.answerFrameworks.mains.general;
  }
  
  generateAnswerFrameworkPrompt(query, wordCount = null) {
    const answerType = this.detectAnswerType(query) || 'general';
    const framework = this.getAnswerFramework(answerType, wordCount);
    const subject = this.detectSubjectFromQuery(query);
    
    let prompt = `\n\nANSWER FRAMEWORK (${answerType}):\n`;
    prompt += `Structure: ${framework.structure}\n`;
    if (framework.timeLimit) {
      prompt += `Time Limit: ${framework.timeLimit}\n`;
    }
    prompt += `\nFramework Components:\n`;
    
    if (framework.framework) {
      prompt += `1. Introduction: ${framework.framework.introduction}\n`;
      prompt += `2. Main Body:\n`;
      framework.framework.body.forEach((point, index) => {
        prompt += `   - ${point}\n`;
      });
      prompt += `3. Conclusion: ${framework.framework.conclusion}\n`;
    }
    
    prompt += `\nIMPORTANT INSTRUCTIONS:\n`;
    prompt += `- Follow this framework structure strictly\n`;
    prompt += `- Reference similar PYQ questions if applicable to show exam relevance\n`;
    prompt += `- Integrate current affairs and recent developments\n`;
    prompt += `- Use examples, data, and case studies to support your points\n`;
    
    if (subject === 'polity') {
      prompt += `- For polity topics, always mention relevant constitutional articles\n`;
    }
    
    return prompt;
  }

  initCurrentAffairs() {
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

  initPyqPatterns() {
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

  initMultilingualTerms() {
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

  getCurrentAffairsCategories() {
    return this.currentAffairs;
  }

  getPyqPatterns(examType, year) {
    return this.pyqPatterns[examType]?.[year] || null;
  }

  initConstitutionalArticles() {
    return {
      fundamentalRights: [
        { article: '14', title: 'Equality before law', desc: 'Right to equality' },
        { article: '15', title: 'Prohibition of discrimination', desc: 'On grounds of religion, race, caste, sex or place of birth' },
        { article: '16', title: 'Equality of opportunity', desc: 'In matters of public employment' },
        { article: '19', title: 'Freedom of speech', desc: 'Six freedoms including speech, assembly, movement' },
        { article: '21', title: 'Protection of life', desc: 'Right to life and personal liberty' },
        { article: '21A', title: 'Right to education', desc: 'Free and compulsory education for children 6-14 years' },
        { article: '25', title: 'Freedom of religion', desc: 'Freedom of conscience and free profession, practice and propagation' },
        { article: '32', title: 'Right to constitutional remedies', desc: 'Writ jurisdiction of Supreme Court' }
      ],
      directivePrinciples: [
        { article: '39', title: 'Equal pay for equal work', desc: 'Men and women' },
        { article: '40', title: 'Organisation of village panchayats', desc: 'Self-government' },
        { article: '44', title: 'Uniform civil code', desc: 'For citizens throughout India' },
        { article: '48A', title: 'Protection of environment', desc: 'Protection and improvement of environment' },
        { article: '51A', title: 'Fundamental duties', desc: 'Duties of citizens' }
      ],
      emergency: [
        { article: '352', title: 'National Emergency', desc: 'War, external aggression or armed rebellion' },
        { article: '356', title: 'President\'s Rule', desc: 'State emergency' },
        { article: '360', title: 'Financial Emergency', desc: 'Threat to financial stability' }
      ],
      unionExec: [
        { article: '52', title: 'President of India', desc: 'Head of state' },
        { article: '74', title: 'Council of Ministers', desc: 'To aid and advise President' },
        { article: '75', title: 'Prime Minister', desc: 'Appointment and tenure' }
      ],
      parliament: [
        { article: '79', title: 'Constitution of Parliament', desc: 'President, Rajya Sabha, Lok Sabha' },
        { article: '80', title: 'Composition of Rajya Sabha', desc: 'Maximum 250 members' },
        { article: '81', title: 'Composition of Lok Sabha', desc: 'Maximum 552 members' },
        { article: '123', title: 'Ordinance making power', desc: 'President\'s power' }
      ],
      judiciary: [
        { article: '124', title: 'Supreme Court', desc: 'Establishment and constitution' },
        { article: '214', title: 'High Courts', desc: 'For each state' },
        { article: '226', title: 'High Court writs', desc: 'Power to issue writs' }
      ]
    };
  }

  initLandmarkCases() {
    return [
      // Constitutional Law & Basic Structure
      { case: 'Kesavananda Bharati (1973)', issue: 'Basic structure doctrine', impact: 'Parliament cannot amend basic structure of Constitution', subject: 'polity', keywords: ['basic structure', 'constitution', 'amendment', 'parliament'] },
      { case: 'Minerva Mills (1980)', issue: 'Basic structure', impact: 'Reinforced basic structure doctrine, judicial review is part of basic structure', subject: 'polity', keywords: ['basic structure', 'judicial review', 'constitution'] },
      { case: 'Golaknath (1967)', issue: 'Fundamental Rights amendment', impact: 'Fundamental Rights cannot be amended (overruled by Kesavananda)', subject: 'polity', keywords: ['fundamental rights', 'amendment', 'constitution'] },
      
      // Fundamental Rights & Article 21
      { case: 'Maneka Gandhi (1978)', issue: 'Right to travel abroad', impact: 'Expanded Article 21, due process of law, procedure must be fair, just and reasonable', subject: 'polity', keywords: ['article 21', 'right to life', 'due process', 'personal liberty'] },
      { case: 'ADM Jabalpur (1976)', issue: 'Habeas corpus during Emergency', impact: 'Overruled in 2017, right to life cannot be suspended even during emergency', subject: 'polity', keywords: ['emergency', 'article 21', 'habeas corpus', 'right to life'] },
      { case: 'Francis Coralie Mullin (1981)', issue: 'Right to life', impact: 'Right to life includes right to live with human dignity', subject: 'polity', keywords: ['article 21', 'right to life', 'human dignity'] },
      { case: 'Olga Tellis (1985)', issue: 'Right to livelihood', impact: 'Right to livelihood is part of right to life under Article 21', subject: 'polity', keywords: ['article 21', 'right to livelihood', 'right to life'] },
      { case: 'PUCL (1997)', issue: 'Right to food', impact: 'Right to food is part of right to life', subject: 'polity', keywords: ['article 21', 'right to food', 'right to life'] },
      
      // Gender Rights & Social Justice
      { case: 'Vishaka (1997)', issue: 'Sexual harassment at workplace', impact: 'Guidelines until legislation enacted, led to Sexual Harassment Act 2013', subject: 'polity', keywords: ['sexual harassment', 'women rights', 'workplace', 'gender equality'] },
      { case: 'Shayara Bano (2017)', issue: 'Triple talaq', impact: 'Declared unconstitutional, led to Muslim Women Protection of Rights on Marriage Act 2019', subject: 'polity', keywords: ['triple talaq', 'muslim women', 'gender justice', 'personal law'] },
      { case: 'Navtej Johar (2018)', issue: 'Section 377', impact: 'Decriminalized consensual homosexual acts, expanded right to privacy and dignity', subject: 'polity', keywords: ['section 377', 'lgbtq rights', 'privacy', 'dignity'] },
      { case: 'Joseph Shine (2018)', issue: 'Adultery law', impact: 'Struck down Section 497 IPC, decriminalized adultery', subject: 'polity', keywords: ['adultery', 'section 497', 'gender equality', 'women rights'] },
      { case: 'Shah Bano (1985)', issue: 'Muslim women maintenance', impact: 'Muslim women entitled to maintenance under Section 125 CrPC', subject: 'polity', keywords: ['muslim women', 'maintenance', 'personal law', 'gender justice'] },
      
      // Reservation & Affirmative Action
      { case: 'Indra Sawhney (1992)', issue: 'Reservation in jobs', impact: '50% cap on reservations, creamy layer exclusion, no reservation in promotions', subject: 'polity', keywords: ['reservation', 'affirmative action', 'creamy layer', 'mandal commission'] },
      { case: 'M Nagaraj (2006)', issue: 'Reservation in promotions', impact: 'Reservation in promotions allowed with conditions: backwardness, inadequacy, efficiency', subject: 'polity', keywords: ['reservation', 'promotions', 'sc/st', 'affirmative action'] },
      { case: 'Jarnail Singh (2018)', issue: 'Creamy layer in SC/ST', impact: 'Creamy layer concept applies to SC/ST in promotions', subject: 'polity', keywords: ['creamy layer', 'sc/st', 'reservation', 'promotions'] },
      
      // Federalism & State Powers
      { case: 'SR Bommai (1994)', issue: 'Article 356 misuse', impact: 'Federalism as basic structure, limited President\'s Rule, floor test required', subject: 'polity', keywords: ['article 356', 'president rule', 'federalism', 'state emergency'] },
      { case: 'State of West Bengal v Union of India (1963)', issue: 'Federalism', impact: 'India has quasi-federal structure, center has overriding powers', subject: 'polity', keywords: ['federalism', 'center-state relations', 'constitution'] },
      
      // Right to Privacy
      { case: 'KS Puttaswamy (2017)', issue: 'Right to privacy', impact: 'Right to privacy is fundamental right under Article 21, part of right to life', subject: 'polity', keywords: ['right to privacy', 'article 21', 'fundamental right', 'aadhaar'] },
      
      // Environment & Ecology
      { case: 'MC Mehta (1987)', issue: 'Oleum gas leak', impact: 'Absolute liability for hazardous industries, polluter pays principle', subject: 'environment', keywords: ['environment', 'pollution', 'absolute liability', 'polluter pays'] },
      { case: 'Vellore Citizens Welfare Forum (1996)', issue: 'Tanneries pollution', impact: 'Precautionary principle, polluter pays principle, sustainable development', subject: 'environment', keywords: ['environment', 'pollution', 'precautionary principle', 'sustainable development'] },
      { case: 'T N Godavarman (1997)', issue: 'Forest conservation', impact: 'Forest includes any area recorded as forest, strict conservation required', subject: 'environment', keywords: ['forest', 'conservation', 'environment', 'wildlife'] },
      
      // Education & Right to Education
      { case: 'Mohini Jain (1992)', issue: 'Right to education', impact: 'Right to education is fundamental right', subject: 'polity', keywords: ['right to education', 'article 21', 'education'] },
      { case: 'Unni Krishnan (1993)', issue: 'Right to education', impact: 'Right to education up to 14 years is fundamental right', subject: 'polity', keywords: ['right to education', 'article 21', 'fundamental right'] },
      
      // Freedom of Speech & Expression
      { case: 'Romesh Thappar (1950)', issue: 'Freedom of press', impact: 'Freedom of speech includes freedom of press', subject: 'polity', keywords: ['freedom of speech', 'freedom of press', 'article 19'] },
      { case: 'Maneka Gandhi (1978)', issue: 'Passport impounding', impact: 'Procedure must be fair, just and reasonable, expanded Article 21', subject: 'polity', keywords: ['article 21', 'due process', 'passport', 'personal liberty'] },
      
      // Election & Democracy
      { case: 'Lily Thomas (2013)', issue: 'Disqualification of MPs/MLAs', impact: 'MPs/MLAs convicted and sentenced to 2+ years disqualified immediately', subject: 'polity', keywords: ['election', 'disqualification', 'mp/mla', 'conviction'] },
      { case: 'People\'s Union for Civil Liberties (2013)', issue: 'Right to reject', impact: 'Voters have right to reject all candidates (NOTA)', subject: 'polity', keywords: ['election', 'nota', 'right to reject', 'democracy'] }
    ];
  }
  
  getRelevantLandmarkCases(query, subject = null) {
    const lowerQuery = query.toLowerCase();
    const detectedSubject = subject || this.detectSubjectFromQuery(query);
    
    return this.landmarkCases.filter(caseItem => {
      // Match by subject
      if (detectedSubject && caseItem.subject === detectedSubject) return true;
      
      // Match by keywords in query
      if (caseItem.keywords) {
        return caseItem.keywords.some(keyword => lowerQuery.includes(keyword));
      }
      
      // Match by case name or issue
      const caseName = caseItem.case.toLowerCase();
      const issue = caseItem.issue.toLowerCase();
      return lowerQuery.includes(caseName) || lowerQuery.includes(issue);
    }).slice(0, 5); // Return top 5 most relevant
  }
  
  formatLandmarkCasesForPrompt(cases) {
    if (!cases || cases.length === 0) return '';
    
    let formatted = '\n\nRELEVANT LANDMARK CASES:\n';
    cases.forEach((caseItem, index) => {
      formatted += `${index + 1}. ${caseItem.case}: ${caseItem.issue} - ${caseItem.impact}\n`;
    });
    formatted += '\nWhen relevant, incorporate these landmark cases in your answer to demonstrate constitutional understanding and legal evolution.';
    
    return formatted;
  }

  initCommittees() {
    return {
      finance: [
        { name: '15th Finance Commission', chair: 'NK Singh', period: '2020-2025', key: 'Vertical and horizontal devolution' },
        { name: '14th Finance Commission', chair: 'YV Reddy', period: '2015-2020', key: 'Increased devolution to 42%' }
      ],
      economic: [
        { name: 'NITI Aayog', type: 'Policy think tank', key: 'Replaced Planning Commission, cooperative federalism' },
        { name: 'FRBM Review Committee', chair: 'NK Singh', year: '2017', key: 'Fiscal deficit target flexibility' }
      ],
      administration: [
        { name: '2nd Administrative Reforms Commission', chair: 'Veerappa Moily', period: '2005-2009', key: 'Governance reforms' },
        { name: 'K Kasturirangan Committee', year: '2019', key: 'Draft National Education Policy' }
      ],
      environment: [
        { name: 'Gadgil Committee', year: '2011', key: 'Western Ghats conservation' },
        { name: 'Kasturirangan Committee', year: '2013', key: 'Modified Western Ghats report' }
      ],
      social: [
        { name: 'Justice Verma Committee', year: '2013', key: 'Criminal law amendments post Nirbhaya' },
        { name: 'Shah Bano Case', year: '1985', key: 'Muslim women maintenance rights' }
      ]
    };
  }

  initGovernmentSchemes() {
    return {
      flagship: [
        { name: 'PM Kisan', year: '2019', key: 'Direct income support to farmers, ₹6000/year' },
        { name: 'Ayushman Bharat', year: '2018', key: 'Health insurance, ₹5 lakh coverage' },
        { name: 'Swachh Bharat', year: '2014', key: 'Open defecation free India' },
        { name: 'Digital India', year: '2015', key: 'Digital infrastructure and services' },
        { name: 'Make in India', year: '2014', key: 'Manufacturing and investment promotion' },
        { name: 'Skill India', year: '2015', key: 'Skill development and training' },
        { name: 'Startup India', year: '2016', key: 'Entrepreneurship promotion' },
        { name: 'Smart Cities', year: '2015', key: '100 smart cities development' }
      ],
      rural: [
        { name: 'MGNREGA', year: '2005', key: 'Employment guarantee, 100 days work' },
        { name: 'PM Awas Yojana', year: '2015', key: 'Housing for all by 2022' },
        { name: 'PM Gram Sadak Yojana', year: '2000', key: 'Rural road connectivity' },
        { name: 'Deen Dayal Upadhyaya Gram Jyoti Yojana', year: '2015', key: 'Rural electrification' }
      ],
      education: [
        { name: 'Samagra Shiksha', year: '2018', key: 'Integrated scheme for school education' },
        { name: 'PM Poshan', year: '2021', key: 'Mid-day meal scheme renamed' },
        { name: 'Digital India e-learning', year: '2020', key: 'Online education during pandemic' }
      ],
      health: [
        { name: 'National Health Mission', year: '2013', key: 'Healthcare access in rural areas' },
        { name: 'PM Matru Vandana Yojana', year: '2017', key: 'Maternity benefit scheme' },
        { name: 'Mission Indradhanush', year: '2014', key: 'Universal immunization program' }
      ],
      women: [
        { name: 'Beti Bachao Beti Padhao', year: '2015', key: 'Girl child education and protection' },
        { name: 'Sukanya Samriddhi Yojana', year: '2015', key: 'Girl child savings scheme' },
        { name: 'Ujjwala Yojana', year: '2016', key: 'Free LPG connections to women' }
      ]
    };
  }

  getMultilingualTerm(term, language) {
    return this.multilingualTerms[language]?.[term] || term;
  }

  detectSubjectFromQuery(query) {
    const lowerQuery = query.toLowerCase();
    const subjectKeywords = {
      polity: [
        'constitution',
        'parliament',
        'fundamental rights',
        'governance',
        'democracy',
        'election',
        'judiciary',
        'federal',
        'federalism',
        'center-state',
        'centre-state',
        'union list',
        'state list',
        'concurrent list',
        'panchayati raj'
      ],
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
    let prompt = '';

    if (context.subject) {
      prompt += `\nSubject: ${context.subject}`;
      
      if (context.subject === 'polity') {
        const articles = this.constitutionalArticles.fundamentalRights.slice(0, 2);
        if (articles.length) prompt += ` (Articles: ${articles.map(a => a.article).join(', ')})`;
      }
    }

    if (context.examType) {
      prompt += `\nExam: ${context.examType}`;
    }

    return prompt;
  }
}

const examKnowledge = new ExamKnowledge();
export default examKnowledge;
