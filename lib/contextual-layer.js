class ContextualLayer {
  constructor() {
    this.contexts = new Map();
    this.patterns = new Map();
    this.initializePatterns();
  }

  initializePatterns() {
    this.patterns.set(/what is (pcs|upsc|ssc)/i, {
      type: 'exam_info',
      quickResponse: '**PCS (Provincial Civil Service), UPSC (Union Public Service Commission), and SSC (Staff Selection Commission)** are major competitive exams in India for government positions.\n\n- **UPSC:** All-India level civil services (IAS, IPS, IFS, etc.)\n- **PCS:** State-level civil services (varies by state)\n- **SSC:** Staff Selection Commission exams (CGL, CHSL, MTS, etc.)\n\nEach exam has different eligibility, syllabus, and selection process. Which exam are you preparing for?',
      requiresAI: false
    });

    this.patterns.set(/syllabus for (pcs|upsc|ssc)/i, {
      type: 'syllabus',
      quickResponse: 'The syllabus includes General Studies, Current Affairs, Optional Subjects, and Language papers. Would you like specific details for any particular exam?',
      requiresAI: false
    });

    this.patterns.set(/\b(pyq|previous year (?:paper|papers|question|questions)|past year (?:question|questions))\b/i, {
      type: 'pyq_request',
      quickResponse: null,
      requiresAI: true
    });

    this.patterns.set(/current affairs/i, {
      type: 'current_affairs',
      quickResponse: 'I can help you with current affairs preparation. What specific topics or time period are you interested in?',
      requiresAI: true
    });

    this.patterns.set(/essay writing/i, {
      type: 'essay',
      quickResponse: 'I can help you with essay writing techniques, structure, and practice. What type of essay are you working on?',
      requiresAI: true
    });

    this.patterns.set(/upsc prelims/i, {
      type: 'upsc_prelims',
      quickResponse: '**UPSC Prelims - Overview**\n\n**Subject Tag:** General Studies | **Relevant for:** UPSC Prelims\n\n**Paper I - General Studies (200 marks, 2 hours, 100 questions)**\n- Current Affairs, History, Geography, Polity, Economics, Environment, Science\n- Negative marking: 1/3rd mark deducted for wrong answers\n\n**Paper II - CSAT (200 marks, 2 hours, 80 questions)**\n- Comprehension, Reasoning, Decision-making, Basic numeracy\n- Qualifying paper: Minimum 33% required\n- Negative marking: 1/3rd mark deducted\n\n**Important:** Prelims is qualifying - marks don\'t count for final ranking. Only candidates clearing Prelims can appear for Mains.',
      requiresAI: false
    });

    this.patterns.set(/upsc mains/i, {
      type: 'upsc_mains',
      quickResponse: '**UPSC Mains - Overview**\n\n**Subject Tag:** General Studies | **Relevant for:** UPSC Mains\n\n**Total: 9 Papers (1750 marks)**\n\n**Compulsory Papers:**\n1. Essay (250 marks) - 2 essays, 1000-1200 words each\n2. English (Qualifying, 300 marks) - Minimum 25%\n3. Indian Language (Qualifying, 300 marks) - Minimum 25%\n\n**General Studies Papers:**\n- GS Paper I (250 marks): History, Geography, Culture\n- GS Paper II (250 marks): Polity, Governance, International Relations\n- GS Paper III (250 marks): Economy, Science, Environment, Security\n- GS Paper IV (250 marks): Ethics, Integrity, Aptitude\n\n**Optional Subject (500 marks):** 2 papers (250 marks each)\n\nAll papers are descriptive/essay-type. Answer writing practice is crucial.',
      requiresAI: false
    });

    this.patterns.set(/upsc interview/i, {
      type: 'upsc_interview',
      quickResponse: 'UPSC Interview/Personality Test is 275 marks, 30-45 minutes duration. It tests mental alertness, critical thinking, and leadership qualities.',
      requiresAI: false
    });

    this.patterns.set(/polity|constitution|governance|parliament|fundamental rights/i, {
      type: 'polity',
      quickResponse: '**Polity - High Weightage Subject**\n\n**Subject Tag:** Polity | **Relevant for:** UPSC Prelims & Mains | **GS Paper:** GS-2\n\n**Key Topics:**\n- Indian Constitution (Preamble, Fundamental Rights, DPSP, Fundamental Duties)\n- Parliament, Executive, Judiciary\n- Constitutional Bodies (Election Commission, UPSC, Finance Commission, etc.)\n- Panchayati Raj, Local Governance\n- Recent constitutional developments and amendments\n\n**Important Book:** Indian Polity by M. Laxmikanth (read 3-4 times)\n\nWould you like detailed notes on any specific topic?',
      requiresAI: true
    });

    this.patterns.set(/history|ancient|medieval|modern|freedom struggle/i, {
      type: 'history',
      quickResponse: '**History - Comprehensive Coverage**\n\n**Subject Tag:** History | **Relevant for:** UPSC Prelims & Mains | **GS Paper:** GS-1\n\n**Key Periods:**\n- **Ancient:** Indus Valley, Vedic Age, Mauryan & Gupta empires\n- **Medieval:** Delhi Sultanate, Mughal Empire, Regional kingdoms\n- **Modern:** British rule, freedom struggle, independence (1947)\n\n**Focus Areas:**\n- Freedom struggle movements and personalities\n- Constitutional development\n- Cultural and social aspects\n- Important dates, battles, and administrative features\n\n**Important Books:** R.S. Sharma (Ancient), Satish Chandra (Medieval), Bipan Chandra (Modern)\n\nWhat specific period or topic would you like to explore?',
      requiresAI: true
    });

    this.patterns.set(/geography|climate|physical features|population|agriculture/i, {
      type: 'geography',
      quickResponse: '**Geography - Comprehensive Subject**\n\n**Subject Tag:** Geography | **Relevant for:** UPSC Prelims & Mains | **GS Paper:** GS-1\n\n**Key Areas:**\n- **Physical Geography:** Indian physical features, climate, rivers, mountains\n- **Human Geography:** Population, migration, urbanization, agriculture\n- **World Geography:** Important locations, global phenomena\n- **Economic Geography:** Natural resources, industries, trade\n\n**Important Topics:**\n- Indian monsoon, climate zones\n- Major rivers and their tributaries\n- Agriculture and cropping patterns\n- Mineral resources and distribution\n- Map work (important for Prelims)\n\n**Important Books:** G.C. Leong (Physical), Majid Hussain (India & World)\n\nWhich geography topic would you like to study?',
      requiresAI: true
    });

    this.patterns.set(/economics|economy|gdp|inflation|banking|finance/i, {
      type: 'economics',
      quickResponse: '**Economics - Important Subject**\n\n**Subject Tag:** Economics | **Relevant for:** UPSC Prelims & Mains | **GS Paper:** GS-3\n\n**Key Areas:**\n- **Indian Economy:** GDP, growth, sectors (agriculture, industry, services)\n- **Economic Planning:** Five-Year Plans, NITI Aayog\n- **Banking & Finance:** RBI, monetary policy, fiscal policy, banking sector\n- **Government Schemes:** Flagship programs, their objectives and impact\n- **Current Affairs:** Union Budget, Economic Survey, recent economic developments\n\n**Important Sources:**\n- Indian Economy by Ramesh Singh\n- Economic Survey (Annual)\n- Union Budget documents\n- Current affairs (government policies, schemes)\n\n**Focus:** Link static concepts with current economic developments.\n\nWhat economic topic would you like to explore?',
      requiresAI: true
    });

    this.patterns.set(/science|technology|physics|chemistry|biology|space/i, {
      type: 'science',
      quickResponse: 'Science and Technology is important for current affairs. Focus on recent developments in space, nuclear, biotechnology, and IT sectors.',
      requiresAI: true
    });

    this.patterns.set(/environment|ecology|biodiversity|climate change|pollution/i, {
      type: 'environment',
      quickResponse: '**Environment - High Weightage Subject**\n\n**Subject Tag:** Environment | **Relevant for:** UPSC Prelims & Mains | **GS Paper:** GS-3\n\n**Key Topics:**\n- **Biodiversity:** National parks, wildlife sanctuaries, endangered species\n- **Climate Change:** Global warming, mitigation, adaptation, international agreements\n- **Environmental Laws:** Environmental Protection Act, Forest Conservation Act, Wildlife Protection Act\n- **Conservation:** Conservation strategies, sustainable development\n- **Current Affairs:** Recent environmental developments, government initiatives\n\n**Important Sources:**\n- Environment by Shankar IAS Academy\n- NCERT Biology (Class 11-12) - Ecology chapters\n- Current affairs (environmental policies, climate agreements)\n\n**Focus:** Link with current environmental issues and government policies.\n\nWhich environmental topic interests you?',
      requiresAI: true
    });

    this.patterns.set(/150 words|150-word/i, {
      type: 'answer_150',
      quickResponse: '**150-Word Answer Framework**\n\n**Subject Tag:** Answer Writing | **Relevant for:** UPSC Mains\n\n**Structure:**\n- **Introduction (20-30 words):** Define/contextualize the topic, provide brief background\n- **Main Body (100-120 words):** Key points with examples, facts, and data\n- **Conclusion (20-30 words):** Significance, way forward, or summary\n\n**Time Management:** 7-8 minutes per question\n\n**Tips:**\n- Be precise and direct\n- Include relevant facts and examples\n- Maintain word limit strictly\n- Use proper paragraph structure\n- Focus on exam-relevant points\n\nWould you like me to help you practice a 150-word answer on a specific topic?',
      requiresAI: true
    });

    this.patterns.set(/250 words|250-word/i, {
      type: 'answer_250',
      quickResponse: '**250-Word Answer Framework**\n\n**Subject Tag:** Answer Writing | **Relevant for:** UPSC Mains\n\n**Structure:**\n- **Introduction (40-50 words):** Context, thesis statement, brief overview\n- **Main Body (150-180 words):** Detailed analysis with:\n  - Multiple perspectives\n  - Examples and case studies\n  - Facts and data\n  - Current affairs linkage\n- **Conclusion (40-50 words):** Summary, significance, way forward\n\n**Time Management:** 12-15 minutes per question\n\n**Tips:**\n- Provide comprehensive analysis\n- Include multiple dimensions\n- Link with current affairs\n- Use examples and case studies\n- Maintain balanced approach\n- Proper paragraph structure\n\nWould you like me to help you practice a 250-word answer on a specific topic?',
      requiresAI: true
    });

    this.patterns.set(/essay|essay writing/i, {
      type: 'essay',
      quickResponse: 'Essay structure: Introduction → Body (3-4 paragraphs) → Conclusion. Time: 60-90 minutes. Choose balanced approach with examples.',
      requiresAI: true
    });

    this.patterns.set(/optional subject|optional paper/i, {
      type: 'optional',
      quickResponse: 'Popular optional subjects: Public Administration, Sociology, Geography, History, Political Science, Literature subjects. Choose based on interest and background.',
      requiresAI: true
    });

    this.patterns.set(/public administration/i, {
      type: 'optional_pa',
      quickResponse: 'Public Administration is a popular optional. Covers administrative theory, Indian administration, and public policy. Good for both technical and non-technical backgrounds.',
      requiresAI: true
    });

    this.patterns.set(/sociology/i, {
      type: 'optional_sociology',
      quickResponse: 'Sociology optional covers social theory, Indian society, and social issues. Good scoring subject with overlapping content with GS papers.',
      requiresAI: true
    });

    this.patterns.set(/budget|economic survey|union budget/i, {
      type: 'budget',
      quickResponse: 'Union Budget and Economic Survey are crucial for current affairs. Focus on key announcements, fiscal policy, and economic indicators.',
      requiresAI: true
    });

    this.patterns.set(/international|global|world affairs/i, {
      type: 'international',
      quickResponse: 'International relations cover India\'s foreign policy, global organizations, bilateral relations, and international current affairs.',
      requiresAI: true
    });

    this.patterns.set(/government schemes|schemes|yojana/i, {
      type: 'schemes',
      quickResponse: 'Government schemes are important for current affairs. Focus on flagship programs, their objectives, and implementation status.',
      requiresAI: true
    });

    this.patterns.set(/study plan|preparation strategy|how to prepare/i, {
      type: 'strategy',
      quickResponse: 'Effective preparation requires: 1) Strong foundation in NCERTs, 2) Regular current affairs, 3) Answer writing practice, 4) Test series, 5) Optional subject mastery.',
      requiresAI: true
    });

    this.patterns.set(/ncert|ncert books/i, {
      type: 'ncert',
      quickResponse: 'NCERTs are the foundation for UPSC preparation. Focus on Class 6-12 NCERTs for History, Geography, Polity, and Science subjects.',
      requiresAI: true
    });

    this.patterns.set(/test series|mock tests/i, {
      type: 'test_series',
      quickResponse: 'Test series help in self-assessment and time management. Take regular tests for both Prelims and Mains preparation.',
      requiresAI: true
    });

    this.patterns.set(/pcs prelims|pcs mains/i, {
      type: 'pcs',
      quickResponse: 'PCS has state-specific content. Focus on state geography, history, culture, and current affairs along with general studies.',
      requiresAI: true
    });

    this.patterns.set(/state specific|state affairs/i, {
      type: 'state_affairs',
      quickResponse: 'State-specific content includes state geography, history, culture, economy, and current affairs. Important for PCS and state-level exams.',
      requiresAI: true
    });

    this.patterns.set(/ssc cgl|ssc chsl|ssc mts/i, {
      type: 'ssc',
      quickResponse: 'SSC exams are computer-based with multiple tiers. Focus on General Intelligence, General Awareness, Quantitative Aptitude, and English.',
      requiresAI: true
    });

    this.patterns.set(/quantitative aptitude|maths|mathematics/i, {
      type: 'quantitative',
      quickResponse: 'Quantitative Aptitude covers arithmetic, algebra, geometry, and data interpretation. Practice regularly with previous year questions.',
      requiresAI: true
    });

    this.patterns.set(/general intelligence|reasoning/i, {
      type: 'reasoning',
      quickResponse: 'General Intelligence includes verbal and non-verbal reasoning, analogies, series, and logical reasoning. Practice with previous year papers.',
      requiresAI: true
    });

    this.patterns.set(/time management|time limit/i, {
      type: 'time_management',
      quickResponse: 'Effective time management: 1) Allocate time per question, 2) Don\'t spend too much time on difficult questions, 3) Practice with timers, 4) Maintain speed and accuracy balance.',
      requiresAI: true
    });

    this.patterns.set(/negative marking/i, {
      type: 'negative_marking',
      quickResponse: '**Negative Marking in UPSC Prelims**\n\n**Subject Tag:** Exam Strategy | **Relevant for:** UPSC Prelims\n\n**Rules:**\n- **Wrong Answer:** 1/3rd mark deducted (0.33 marks)\n- **Correct Answer:** Full mark (2 marks for GS Paper I, 2.5 marks for CSAT)\n- **Unattempted:** No marks, no deduction\n\n**Strategy:**\n- **Don\'t guess blindly:** Only attempt if you\'re reasonably sure (at least 50% confidence)\n- **Focus on accuracy:** Better to leave uncertain questions than to guess\n- **Time management:** Allocate time wisely, don\'t rush\n- **Practice:** Regular mock tests help improve accuracy\n\n**Remember:** Accuracy over quantity. It\'s better to attempt fewer questions correctly than many incorrectly.',
      requiresAI: false
    });

    this.patterns.set(/motivation|demotivated|frustrated/i, {
      type: 'motivation',
      quickResponse: '**Staying Motivated During UPSC Preparation**\n\n**Subject Tag:** Study Strategy | **Relevant for:** All Stages\n\n**Remember:**\n- UPSC preparation is a **marathon, not a sprint**\n- **Consistency** is more important than intensity\n- **Take regular breaks** - 1 day off weekly helps\n- **Maintain work-life balance** - health and mental well-being matter\n- **Believe in your preparation** - trust the process\n\n**Tips:**\n- Set realistic daily/weekly goals\n- Celebrate small achievements\n- Learn from mistakes, don\'t get discouraged\n- Stay connected with fellow aspirants\n- Focus on progress, not perfection\n- Remember your "why" - why you started this journey\n\n**You\'ve got this!** Every successful candidate faced challenges. Stay positive and keep moving forward.\n\nIs there a specific area where you\'re feeling stuck? I can help!',
      requiresAI: true
    });

    this.patterns.set(/career guidance|career options/i, {
      type: 'career',
      quickResponse: 'Civil services offer diverse career opportunities: IAS, IPS, IFS, and other Group A services. Each has unique responsibilities and challenges.',
      requiresAI: true
    });

    this.patterns.set(/english|language|communication/i, {
      type: 'language',
      quickResponse: 'Good English is essential for Mains and Interview. Practice reading newspapers, writing essays, and improving vocabulary regularly.',
      requiresAI: true
    });

    this.patterns.set(/hindi|regional language/i, {
      type: 'hindi',
      quickResponse: 'Hindi/Regional language paper is qualifying in nature. Focus on basic grammar, comprehension, and translation skills.',
      requiresAI: true
    });

    this.patterns.set(/interview|personality test/i, {
      type: 'interview',
      quickResponse: 'Interview tests personality, mental alertness, and leadership qualities. Be honest, confident, and well-informed about current affairs and your background.',
      requiresAI: true
    });

    this.patterns.set(/daf|detailed application form/i, {
      type: 'daf',
      quickResponse: 'DAF is crucial for interview. Fill it carefully, be prepared to answer questions about every detail mentioned in your form.',
      requiresAI: true
    });

    this.patterns.set(/recent|latest|new|2024|2023/i, {
      type: 'recent',
      quickResponse: 'Stay updated with recent developments in all subjects. Focus on government policies, international events, and scientific achievements.',
      requiresAI: true
    });

    this.patterns.set(/covid|pandemic|health/i, {
      type: 'health',
      quickResponse: 'Health and pandemic-related topics are important. Focus on public health policies, healthcare infrastructure, and global health initiatives.',
      requiresAI: true
    });

    this.patterns.set(/digital india|technology|ai|artificial intelligence/i, {
      type: 'technology',
      quickResponse: 'Technology is crucial for current affairs. Focus on Digital India, AI, cybersecurity, and emerging technologies.',
      requiresAI: true
    });

    this.patterns.set(/space|isro|chandrayaan|gaganyaan/i, {
      type: 'space',
      quickResponse: 'Space technology is important for science and technology. Focus on ISRO missions, space policy, and international space cooperation.',
      requiresAI: true
    });
  }

  analyzeMessage(message) {
    const lowerMessage = message.toLowerCase();
    
    for (const [pattern, response] of this.patterns) {
      if (pattern.test(message)) {
        return {
          ...response,
          confidence: 0.9,
          context: this.extractContext(message)
        };
      }
    }

    const trimmedMsg = message.trim();
    if (/^(hi|hello|hey|good morning|good afternoon|good evening)[\s,;:!.]*$/i.test(trimmedMsg)) {
      return {
        type: 'greeting',
        quickResponse: 'Hello! I\'m **Indicore**, your intelligent exam preparation companion—think of me as ChatGPT, but specialized for UPSC, PCS, and SSC exam preparation.\n\nI can help you with:\n- **Study materials** and notes\n- **Previous Year Questions (PYQ)**\n- **Answer writing** practice\n- **Current affairs** preparation\n- **Essay writing** guidance\n- **Mock tests** and evaluation\n- **Interview preparation**\n- And much more!\n\n**What would you like to start with today?**',
        requiresAI: false,
        confidence: 0.95
      };
    }

    const helpPattern = /^(how can you help|what can you do|help me|assist me|support me)[\s?]*$/i;
    if (helpPattern.test(trimmedMsg)) {
      return {
        type: 'help',
        quickResponse: 'I can help you with **comprehensive exam preparation** for UPSC, PCS, and SSC:\n\n**Study Support:**\n- Detailed notes on any subject (History, Polity, Geography, Economics, etc.)\n- Previous Year Questions (PYQ) search and analysis\n- Study plans and strategies\n\n**Practice & Evaluation:**\n- Answer writing practice (150-word, 250-word, essays)\n- Mock tests (Prelims & Mains)\n- Answer evaluation and feedback\n\n**Current Affairs:**\n- Daily current affairs digests\n- News analysis with exam relevance\n- Government schemes and policies\n\n**Additional Features:**\n- Essay generation and enhancement\n- Interview preparation\n- Vocabulary building\n- Translation support (11 languages)\n\n**What specific area would you like assistance with?**',
        requiresAI: false,
        confidence: 0.9
      };
    }
    
    if (/help|assist|support/i.test(lowerMessage) && lowerMessage.split(/\s+/).length > 5) {
      return {
        type: 'complex',
        requiresAI: true,
        confidence: 0.5
      };
    }

    return {
      type: 'complex',
      requiresAI: true,
      confidence: 0.1
    };
  }

  extractContext(message) {
    const context = {
      examType: null,
      subject: null,
      difficulty: null,
      language: null
    };

    if (/pcs/i.test(message)) context.examType = 'PCS';
    else if (/upsc/i.test(message)) context.examType = 'UPSC';
    else if (/ssc/i.test(message)) context.examType = 'SSC';
    const subjects = ['history', 'geography', 'polity', 'economics', 'science', 'maths', 'english', 'hindi'];
    for (const subject of subjects) {
      if (new RegExp(subject, 'i').test(message)) {
        context.subject = subject;
        break;
      }
    }

    if (/easy|basic|beginner/i.test(message)) context.difficulty = 'easy';
    else if (/medium|intermediate/i.test(message)) context.difficulty = 'medium';
    else if (/hard|difficult|advanced/i.test(message)) context.difficulty = 'hard';

    return context;
  }

  getQuickResponse(message) {
    const analysis = this.analyzeMessage(message);
    
    if (!analysis.requiresAI && analysis.confidence > 0.8) {
      return {
        response: analysis.quickResponse,
        cached: true,
        type: analysis.type,
        context: analysis.context
      };
    }

    return null;
  }

  getContextualEnhancement(message) {
    const analysis = this.analyzeMessage(message);
    if (!analysis) return null;

    let enhancement = '';
    
    if (analysis.type === 'polity') {
      enhancement += '\n\nPOLITY CONTEXT:\n- Focus on Constitutional provisions, Fundamental Rights, and governance structures\n- Include recent constitutional developments and judicial pronouncements\n- Reference important acts and amendments';
    } else if (analysis.type === 'history') {
      enhancement += '\n\nHISTORY CONTEXT:\n- Cover Ancient, Medieval, and Modern periods\n- Include freedom struggle, cultural aspects, and constitutional development\n- Reference important personalities and movements';
    } else if (analysis.type === 'geography') {
      enhancement += '\n\nGEOGRAPHY CONTEXT:\n- Include Physical, Human, and World Geography aspects\n- Focus on Indian physical features, climate, and natural resources\n- Reference recent geographical developments and environmental issues';
    } else if (analysis.type === 'economics') {
      enhancement += '\n\nECONOMICS CONTEXT:\n- Cover both micro and macro economic concepts\n- Include Indian economy, economic planning, and recent developments\n- Reference government policies and economic indicators';
    } else if (analysis.type === 'science') {
      enhancement += '\n\nSCIENCE & TECHNOLOGY CONTEXT:\n- Focus on recent developments in space, nuclear, biotechnology, and IT\n- Include applications in governance and society\n- Reference ISRO missions, AI developments, and digital initiatives';
    } else if (analysis.type === 'environment') {
      enhancement += '\n\nENVIRONMENT CONTEXT:\n- Cover biodiversity, climate change, and conservation strategies\n- Include environmental laws and international agreements\n- Reference recent environmental developments and policies';
    }

    if (analysis.type.includes('upsc')) {
      enhancement += '\n\nUPSC CONTEXT:\n- Structure answer according to UPSC requirements\n- Include multiple perspectives and balanced approach\n- Reference relevant examples and case studies';
    } else if (analysis.type.includes('pcs')) {
      enhancement += '\n\nPCS CONTEXT:\n- Include state-specific examples and developments\n- Focus on regional governance and administration\n- Reference state policies and programs';
    } else if (analysis.type.includes('ssc')) {
      enhancement += '\n\nSSC CONTEXT:\n- Focus on factual accuracy and precision\n- Include relevant examples and data\n- Structure answer for objective-type questions';
    }

    if (analysis.type.includes('answer_150')) {
      enhancement += '\n\n150-WORD ANSWER FRAMEWORK:\n- Introduction (20-30 words): Define/contextualize\n- Main Body (100-120 words): Key points with examples\n- Conclusion (20-30 words): Significance/way forward';
    } else if (analysis.type.includes('answer_250')) {
      enhancement += '\n\n250-WORD ANSWER FRAMEWORK:\n- Introduction (40-50 words): Context and thesis\n- Main Body (150-180 words): Detailed analysis with examples\n- Conclusion (40-50 words): Summary and implications';
    } else if (analysis.type.includes('essay')) {
      enhancement += '\n\nESSAY FRAMEWORK:\n- Introduction: Hook, context, thesis statement\n- Body: 3-4 paragraphs with different perspectives\n- Conclusion: Synthesis and forward-looking approach';
    }

    return enhancement;
  }

  detectSubjectFromQuery(query) {
    const lowerQuery = query.toLowerCase();
    const subjectKeywords = {
      polity: ['constitution', 'parliament', 'fundamental rights', 'governance', 'democracy', 'election', 'judiciary', 'polity'],
      history: ['history', 'ancient', 'medieval', 'modern', 'freedom struggle', 'independence', 'british rule', 'historical'],
      geography: ['geography', 'climate', 'physical features', 'population', 'agriculture', 'natural resources', 'geographical'],
      economics: ['economy', 'economics', 'gdp', 'inflation', 'banking', 'finance', 'trade', 'development', 'economic'],
      science: ['science', 'technology', 'physics', 'chemistry', 'biology', 'space', 'nuclear', 'biotechnology', 'scientific'],
      environment: ['environment', 'ecology', 'biodiversity', 'climate change', 'pollution', 'conservation', 'environmental']
    };

    for (const [subject, keywords] of Object.entries(subjectKeywords)) {
      if (keywords.some(keyword => lowerQuery.includes(keyword))) {
        return subject;
      }
    }
    return null;
  }

  detectExamType(query) {
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('upsc')) return 'upsc';
    if (lowerQuery.includes('pcs')) return 'pcs';
    if (lowerQuery.includes('ssc')) return 'ssc';
    return null;
  }

  generateContextualPrompt(query) {
    const subject = this.detectSubjectFromQuery(query);
    const examType = this.detectExamType(query);
    let prompt = '';
    
    if (subject) prompt += `\nSubject: ${subject}`;
    if (examType) prompt += `\nExam: ${examType}`;
    
    return prompt;
  }

  enhancePrompt(message, context, language) {
    let enhancedPrompt = message;
    
    if (context.examType) {
      enhancedPrompt = `For ${context.examType} exam preparation: ${message}`;
    }
    
    if (context.subject) {
      enhancedPrompt += ` Focus on ${context.subject} subject.`;
    }
    
    if (context.difficulty) {
      enhancedPrompt += ` Provide ${context.difficulty} level explanation.`;
    }

    return enhancedPrompt;
  }
}

export const contextualLayer = new ContextualLayer();
