import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import connectToDatabase from '@/lib/mongodb';
import MockTest from '@/models/MockTest';
import PYQ from '@/models/PYQ';
import { callAIWithFallback } from '@/lib/ai-providers';
import { translateText } from '@/pages/api/ai/translate';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { examType, paperType, subject, duration, totalQuestions, topics, language = 'en', usePYQ = false } = req.body;

    if (!examType || !duration || !totalQuestions) {
      return res.status(400).json({ error: 'Exam type, duration, and total questions are required' });
    }

    await connectToDatabase();

    const isMains = paperType === 'Mains';
    
    // Get exam-specific information
    const getExamSpecificInfo = (examType) => {
      const examInfo = {
        UPSC: {
          prelims: {
            subjects: ['History', 'Geography', 'Polity', 'Economics', 'Science & Technology', 'Environment', 'Current Affairs', 'CSAT'],
            focus: 'National-level topics, constitutional provisions, government schemes, current affairs',
            negativeMarking: '1/3rd mark deducted'
          },
          mains: {
            subjects: ['General Studies I (History, Geography)', 'General Studies II (Polity, Governance)', 'General Studies III (Economy, Science)', 'General Studies IV (Ethics)', 'Essay'],
            focus: 'Analytical questions, current affairs, policy analysis, ethical dilemmas',
            wordLimits: [150, 250]
          }
        },
        PCS: {
          prelims: {
            subjects: ['History', 'Geography', 'Polity', 'Economics', 'General Science', 'Current Affairs', 'State-specific topics'],
            focus: 'State-specific geography, history, culture, current affairs, and general knowledge',
            negativeMarking: '1/3rd mark deducted',
            note: 'Include state-specific content relevant to various PCS exams (MPSC, TNPSC, BPSC, etc.)'
          },
          mains: {
            subjects: ['General Studies I', 'General Studies II', 'General Studies III', 'General Studies IV', 'Optional Subject'],
            focus: 'State-specific issues, regional development, local governance, state policies',
            wordLimits: [150, 250]
          }
        },
        SSC: {
          prelims: {
            subjects: ['General Intelligence & Reasoning', 'General Awareness', 'Quantitative Aptitude', 'English Comprehension'],
            focus: 'Reasoning, mathematics, general knowledge, English language skills',
            negativeMarking: '0.25 marks deducted per wrong answer',
            note: 'SSC exams (CGL, CHSL, MTS, CPO) focus on aptitude and reasoning rather than descriptive content'
          },
          mains: {
            subjects: ['General Studies', 'Quantitative Aptitude', 'English Language'],
            focus: 'Descriptive writing, quantitative problem-solving, English comprehension',
            wordLimits: [200, 300]
          }
        }
      };
      return examInfo[examType] || examInfo.UPSC;
    };

    const examInfo = getExamSpecificInfo(examType);
    const examSpecificSubjects = isMains ? examInfo.mains?.subjects : examInfo.prelims?.subjects;
    const examSpecificFocus = isMains ? examInfo.mains?.focus : examInfo.prelims?.focus;
    
    // Get language name for prompt
    const languageNames = {
      'en': 'English', 'hi': 'Hindi', 'mr': 'Marathi', 'ta': 'Tamil', 'bn': 'Bengali',
      'pa': 'Punjabi', 'gu': 'Gujarati', 'te': 'Telugu', 'ml': 'Malayalam',
      'kn': 'Kannada', 'es': 'Spanish'
    };
    const langName = languageNames[language] || 'English';
    
    const systemPrompt = `You are an expert test creator for ${examType} competitive exams. Your task is to create high-quality mock test questions that:

CRITICAL REQUIREMENTS:
1. **EXAM-RELEVANT**: Every question MUST be directly relevant to ${examType} syllabus and exam pattern. Questions should test knowledge that actually appears in ${examType} exams.
2. **PRECISE & CURRENT**: Questions must be precise, unambiguous, and aligned with the LATEST ${examType} syllabus (as of 2024-2025). Include recent developments, current affairs, and updated policies where relevant.
3. **SYLLABUS ALIGNMENT**: Strictly follow the official ${examType} syllabus. For UPSC: GS-1, GS-2, GS-3, GS-4, Prelims pattern. For PCS: State-specific syllabus. For SSC: General awareness and aptitude.
4. **VERIFIABLE INFORMATION**: ONLY use verifiable facts, dates, and information. NEVER make up facts or statistics.
5. **PROPER SUBJECT TAGGING**: Tag each question with correct subject (Polity, History, Geography, Economics, Science & Technology, Environment, etc.) and relevant GS paper (GS-1, GS-2, GS-3, GS-4) or Prelims/Mains context.

QUALITY STANDARDS:
1. Match ${examType} exam pattern and difficulty level exactly
2. Cover ${examType}-specific topics and syllabus comprehensively
3. Include proper explanations aligned with ${examType} standards
4. Follow ${examType} marking scheme and negative marking rules
5. Test conceptual understanding as per ${examType} requirements
6. Questions should be clear, unambiguous, and free from errors

**${examType} Exam-Specific Requirements:**
${isMains ? `
- For ${examType} Mains exams: Create SUBJECTIVE questions (essay-type answers)
  - Questions should require descriptive answers
  - Specify word limits: ${examInfo.mains?.wordLimits?.join(' or ')} words
  - No multiple choice options needed
  - Questions should test analytical and writing skills
  - Cover topics from: ${examSpecificSubjects?.join(', ')}
  - Focus areas: ${examSpecificFocus}
` : `
- For ${examType} Prelims exams: Create MULTIPLE CHOICE questions (MCQ)
  - Clear, unambiguous questions matching ${examType} style
- Four options (A, B, C, D) with one correct answer
  - Negative marking: ${examInfo.prelims?.negativeMarking || '1/3rd mark deducted'}
  - Cover subjects: ${examSpecificSubjects?.join(', ')}
  - Focus areas: ${examSpecificFocus}
  ${examInfo.prelims?.note ? `- IMPORTANT: ${examInfo.prelims.note}` : ''}
`}
- Detailed explanations that match ${examType} answer key style
- Subject and topic classification as per ${examType} syllabus
- Appropriate difficulty level matching ${examType} standards

**IMPORTANT**: Generate all questions, options, explanations, and content in English. The system will handle translation to other languages using professional translation services.`;

    const preferences = session.user?.preferences || {};
    const preferredModel = preferences.model || 'sonar-pro';
    const preferredProvider = preferences.provider || 'openai';
    const preferredOpenAIModel = preferences.openAIModel || process.env.OPENAI_MODEL || process.env.OPEN_AI_MODEL || 'gpt-4o-mini';
    const excludedProviders = preferences.excludedProviders || [];

    const userPrompt = `Create a mock test for ${examType} ${paperType || 'Prelims'}${subject ? ` - ${subject}` : ''} in English.

**${examType} Test Specifications:**
- Total Questions: ${totalQuestions}
- Duration: ${duration} minutes
- Paper Type: ${paperType || 'Prelims'}
- Exam Type: ${examType}
${topics ? `- Topics to cover: ${topics.join(', ')}` : ''}
${examSpecificSubjects ? `- Subjects to cover: ${examSpecificSubjects.join(', ')}` : ''}

${isMains ? `
**IMPORTANT: This is a ${examType} MAINS exam - Generate SUBJECTIVE questions only (no multiple choice).**

Generate questions in JSON format:
{
  "title": "${examType} ${paperType} Mock Test",
  "description": "Mock test for ${examType} ${paperType} covering ${examSpecificSubjects?.join(', ')}",
  "questions": [
    {
      "question": "Question text appropriate for ${examType} Mains (e.g., 'Discuss the impact of globalization on Indian culture. Illustrate with examples.' for UPSC, or state-specific questions for PCS)",
      "questionType": "subjective",
      "wordLimit": ${examInfo.mains?.wordLimits?.[1] || 250},
      "explanation": "Key points that should be covered in the answer as per ${examType} standards",
      "subject": "${examSpecificSubjects?.[0] || 'General Studies'}",
      "topic": "Topic name relevant to ${examType} syllabus",
      "difficulty": "medium",
      "marks": 10
    }
  ]
}

**For ${examType} Mains questions:**
- Use questionType: "subjective" for ALL questions
- Do NOT include "options" or "correctAnswer" fields
- Set appropriate wordLimit: ${examInfo.mains?.wordLimits?.join(' or ')} words
- Marks should be realistic (10 marks for ${examInfo.mains?.wordLimits?.[1] || 250} words, 5 marks for ${examInfo.mains?.wordLimits?.[0] || 150} words)
- Include explanation field with key points that should be covered
- Cover topics from: ${examSpecificSubjects?.join(', ')}
${examType === 'PCS' ? '- Include state-specific content and regional issues where relevant' : ''}
${examType === 'SSC' ? '- Focus on descriptive writing, quantitative problem-solving, and English comprehension' : ''}
` : `
Generate questions in JSON format:
{
  "title": "${examType} ${paperType} Mock Test",
  "description": "Mock test for ${examType} ${paperType} covering ${examSpecificSubjects?.join(', ')}",
  "questions": [
    {
      "question": "Question text appropriate for ${examType} Prelims",
      "questionType": "mcq",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A",
      "explanation": "Detailed explanation matching ${examType} answer key style",
      "subject": "${examSpecificSubjects?.[0] || 'General Studies'}",
      "topic": "Topic name relevant to ${examType} syllabus",
      "difficulty": "medium",
      "marks": 1,
      "negativeMarks": ${examType === 'SSC' ? 0.25 : 0.33}
    }
  ]
}

**For ${examType} Prelims questions:**
- Use questionType: "mcq" for ALL questions
- Include exactly 4 options (A, B, C, D)
- Set correctAnswer to one of the options
- Negative marking: ${examInfo.prelims?.negativeMarking || '1/3rd mark deducted'}
- Cover subjects: ${examSpecificSubjects?.join(', ')}
${examType === 'PCS' ? '- Include state-specific questions where relevant (geography, history, culture, current affairs)' : ''}
${examType === 'SSC' ? '- Focus on reasoning, quantitative aptitude, general awareness, and English comprehension' : ''}
`}

Generate exactly ${totalQuestions} questions. Ensure questions are:
1. **EXAM-RELEVANT**: Directly aligned with ${examType} syllabus and exam pattern
2. **PRECISE & CURRENT**: Based on latest syllabus (2024-2025), recent developments, and current affairs
3. **VERIFIABLE**: Only use factual, verifiable information - no made-up facts
4. **PROPERLY TAGGED**: Each question must have correct subject and GS paper tags
5. Appropriate for ${examType} exam level and difficulty
6. Covering ${examType}-specific syllabus and topics comprehensively
7. Following ${examType} question pattern and style exactly
8. Valid and well-structured with clear, detailed explanations

**For MCQ Questions (Prelims):**
- Each question must have exactly 4 options (A, B, C, D)
- Options should be plausible and test conceptual understanding
- Correct answer must be unambiguous
- Explanation should be detailed, explaining why the correct answer is right and why others are wrong
- Include relevant facts, dates, and context in explanations

**For Subjective Questions (Mains):**
- Questions should test analytical and writing skills
- Should require structured answers with multiple dimensions
- Explanation should list key points that should be covered in the answer
- Include expected answer framework (Introduction, Main Body, Conclusion)`;

    // Fetch PYQ questions if requested
    let pyqQuestions = [];
    let processedQuestions = [];
    
    if (usePYQ) {
      try {
        const pyqFilter = {
          exam: examType.toUpperCase(),
          level: paperType === 'Mains' ? 'Mains' : 'Prelims',
          lang: language === 'en' ? { $in: ['en', 'multi'] } : language
        };
        
        // Add subject filter if provided
        if (subject && subject.trim()) {
          pyqFilter.$or = [
            { theme: { $regex: subject, $options: 'i' } },
            { topicTags: { $regex: subject, $options: 'i' } },
            { question: { $regex: subject, $options: 'i' } }
          ];
        }

        // Fetch PYQ questions (prioritize verified ones)
        const pyqResults = await PYQ.find(pyqFilter)
          .sort({ verified: -1, year: -1 }) // Verified first, then newest
          .limit(totalQuestions * 2) // Get more to have options
          .lean();

        console.log(`Found ${pyqResults.length} PYQ questions for ${examType} ${paperType}`);

        // Convert PYQ format to MockTest question format
        pyqQuestions = pyqResults.map((pyq) => {
          const isSubjective = paperType === 'Mains';
          const question = {
            question: pyq.question,
            questionType: isSubjective ? 'subjective' : 'mcq',
            subject: pyq.theme || subject || 'General',
            topic: pyq.topicTags?.[0] || pyq.theme || 'General',
            difficulty: 'medium',
            marks: isSubjective ? 10 : 1,
            explanation: pyq.answer || `Source: ${examType} ${paperType} ${pyq.year}${pyq.paper ? ` - ${pyq.paper}` : ''}`,
            _pyqSource: {
              year: pyq.year,
              paper: pyq.paper,
              verified: pyq.verified,
              sourceLink: pyq.sourceLink
            }
          };

          if (isSubjective) {
            question.wordLimit = pyq.question.length > 100 ? 250 : 150;
          } else {
            // For Prelims MCQ: Mark for option generation
            question._needsOptions = true;
            question._pyqAnswer = pyq.answer || '';
          }

          return question;
        });

        // For MCQ PYQs, generate options using AI
        const mcqPYQs = pyqQuestions.filter(q => q.questionType === 'mcq' && q._needsOptions);
        if (mcqPYQs.length > 0) {
          const mcqPrompt = `Convert these ${examType} ${paperType} previous year questions into proper MCQ format with 4 options each.

Questions:
${mcqPYQs.map((q, i) => `${i + 1}. ${q.question}${q._pyqAnswer ? `\n   Answer hint: ${q._pyqAnswer}` : ''}`).join('\n\n')}

For each question, provide:
1. The original question text
2. Four plausible options (A, B, C, D) where one is correct
3. The correct answer (one of the options)
4. Brief explanation

Format as JSON array:
[
  {
    "question": "Original question text",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "Option A",
    "explanation": "Brief explanation"
  }
]`;

          try {
            const mcqResult = await callAIWithFallback(
              [{ role: 'user', content: mcqPrompt }],
              `You are an expert at converting exam questions into MCQ format. Generate exactly ${mcqPYQs.length} MCQs with 4 options each.`,
              2000,
              0.6,
              {
                model: preferredModel,
                preferredProvider,
                excludeProviders: excludedProviders,
                openAIModel: preferredOpenAIModel
              }
            );

            const mcqJsonMatch = mcqResult?.content?.match(/\[[\s\S]*\]/);
            if (mcqJsonMatch) {
              const mcqData = JSON.parse(mcqJsonMatch[0]);
              mcqPYQs.forEach((pyqQ, idx) => {
                const mcqDataItem = mcqData[idx];
                if (mcqDataItem && mcqDataItem.options && mcqDataItem.correctAnswer) {
                  pyqQ.options = mcqDataItem.options;
                  pyqQ.correctAnswer = mcqDataItem.correctAnswer;
                  pyqQ.explanation = mcqDataItem.explanation || pyqQ.explanation;
                  pyqQ.negativeMarks = examType === 'SSC' ? 0.25 : 0.33;
                  delete pyqQ._needsOptions;
                  delete pyqQ._pyqAnswer;
                }
              });
            }
          } catch (mcqError) {
            console.error('Error generating MCQ options:', mcqError);
          }
        }

        // Use valid PYQ questions (up to totalQuestions)
        processedQuestions = pyqQuestions
          .filter(q => {
            if (q.questionType === 'mcq') {
              return q.options && q.correctAnswer && !q._needsOptions;
            }
            return true; // Subjective questions are ready
          })
          .slice(0, totalQuestions);

        // Remove temporary fields
        processedQuestions = processedQuestions.map(q => {
          const { _pyqSource, _needsOptions, _pyqAnswer, ...cleanQ } = q;
          return cleanQ;
        });

        console.log(`Using ${processedQuestions.length} PYQ questions`);
      } catch (pyqError) {
        console.error('Error fetching PYQ questions:', pyqError);
        // Continue with AI generation if PYQ fetch fails
      }
    }

    // Generate remaining questions with AI if needed
    const questionsNeeded = Math.max(0, totalQuestions - processedQuestions.length);
    let aiQuestions = [];
    let parsedData = null;

    if (questionsNeeded > 0 || !usePYQ) {
      const aiPrompt = usePYQ 
        ? `${userPrompt}\n\nGenerate exactly ${questionsNeeded} additional questions to complete the test (${processedQuestions.length} questions already provided from PYQ archive).`
        : userPrompt;

    const aiResult = await callAIWithFallback(
        [{ role: 'user', content: aiPrompt }],
      systemPrompt,
      3500,
      0.6,
      {
        model: preferredModel,
        preferredProvider,
        excludeProviders: excludedProviders,
        openAIModel: preferredOpenAIModel
      }
    );
    const aiResponse = aiResult?.content || '';

    let parsedData;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch (parseError) {
      return res.status(500).json({ error: 'Failed to parse test data', details: parseError.message });
    }

      // Process AI-generated questions
      aiQuestions = parsedData.questions.map((q, index) => {
      const question = {
        question: q.question,
        questionType: q.questionType || (isMains ? 'subjective' : 'mcq'),
        subject: q.subject || subject || 'General',
        topic: q.topic || 'General',
        difficulty: q.difficulty || 'medium',
        marks: q.marks || (isMains ? 10 : 1),
        explanation: q.explanation || ''
      };

      // Validate question text
      if (!question.question || question.question.trim().length < 10) {
        throw new Error(`Question ${index + 1} is invalid or too short`);
      }

      if (question.questionType === 'mcq') {
        // Validate MCQ questions
        question.options = q.options || [];
        question.correctAnswer = q.correctAnswer || '';
        question.negativeMarks = q.negativeMarks || (examType === 'SSC' ? 0.25 : 0.33);
        
        // Validate MCQ structure
        if (!Array.isArray(question.options) || question.options.length !== 4) {
          throw new Error(`Question ${index + 1}: MCQ must have exactly 4 options`);
        }
        if (!question.correctAnswer || !question.options.includes(question.correctAnswer)) {
          throw new Error(`Question ${index + 1}: correctAnswer must be one of the provided options`);
        }
        if (question.options.some(opt => !opt || opt.trim().length === 0)) {
          throw new Error(`Question ${index + 1}: All options must be non-empty`);
        }
      } else {
        // Validate subjective questions
        const defaultWordLimit = examType === 'SSC' ? 300 : 250;
        question.wordLimit = q.wordLimit || defaultWordLimit;
        // Remove options and correctAnswer for subjective questions
        delete question.options;
        delete question.correctAnswer;
        delete question.negativeMarks;
        
        // Validate word limit is reasonable
        if (question.wordLimit < 100 || question.wordLimit > 500) {
          question.wordLimit = defaultWordLimit; // Reset to default
        }
      }

      // Validate marks
      if (question.marks < 0 || question.marks > 50) {
        question.marks = isMains ? 10 : 1; // Reset to default
      }

        return question;
      });

      // Combine PYQ and AI questions
      processedQuestions = [...processedQuestions, ...aiQuestions];
    }

    // Validate total questions count
    if (processedQuestions.length !== totalQuestions) {
      console.warn(`Warning: Generated ${processedQuestions.length} questions${usePYQ ? ` (${processedQuestions.length - aiQuestions.length} from PYQ, ${aiQuestions.length} from AI)` : ''}, expected ${totalQuestions}`);
    }

    // Translate questions to target language if not English (using Azure Translator)
    if (language && language !== 'en' && processedQuestions && Array.isArray(processedQuestions)) {
      try {
        console.log(`Translating ${processedQuestions.length} mock test questions to ${language} using Azure Translator...`);
        processedQuestions = await Promise.all(
          processedQuestions.map(async (q) => {
            const translatedQ = { ...q };
            try {
              if (q.question) {
                translatedQ.question = await translateText(q.question, 'en', language, true);
              }
              if (q.explanation) {
                translatedQ.explanation = await translateText(q.explanation, 'en', language, true);
              }
              if (q.options && Array.isArray(q.options)) {
                translatedQ.options = await Promise.all(
                  q.options.map(async (option) => {
                    try {
                      return await translateText(option, 'en', language, true);
                    } catch (e) {
                      return option;
                    }
                  })
                );
                // Also translate correctAnswer if it exists
                if (q.correctAnswer && q.options.includes(q.correctAnswer)) {
                  // Find the translated version of correctAnswer
                  const originalIndex = q.options.indexOf(q.correctAnswer);
                  if (originalIndex >= 0 && originalIndex < translatedQ.options.length) {
                    translatedQ.correctAnswer = translatedQ.options[originalIndex];
                  }
                }
              }
              if (q.subject) {
                translatedQ.subject = await translateText(q.subject, 'en', language, true);
              }
              if (q.topic) {
                translatedQ.topic = await translateText(q.topic, 'en', language, true);
              }
            } catch (e) {
              console.warn('Failed to translate question:', e.message);
            }
            return translatedQ;
          })
        );
        console.log('Mock test questions translation completed successfully');
      } catch (translationError) {
        console.warn('Translation failed, using English content:', translationError.message);
        // Continue with English content if translation fails
      }
    }

    const totalMarks = processedQuestions.reduce((sum, q) => sum + (q.marks || 1), 0);

    const testData = {
      title: usePYQ 
        ? `${examType} ${paperType || 'Prelims'} Mock Test (PYQ-Based)`
        : (parsedData?.title || `${examType} ${paperType || 'Prelims'} Mock Test`),
      description: usePYQ
        ? `Mock test for ${examType} ${paperType || 'Prelims'} using Previous Year Questions from archive${aiQuestions.length > 0 ? ` with ${aiQuestions.length} AI-generated questions` : ''}`
        : (parsedData?.description || `Mock test for ${examType} ${paperType || 'Prelims'}`),
      examType,
      paperType: paperType || 'Prelims',
      subject: subject || null,
      duration,
      totalQuestions: processedQuestions.length,
      totalMarks,
      questions: processedQuestions,
      createdBy: session.user.id,
      tags: [examType, paperType, subject].filter(Boolean)
    };

    const mockTest = await MockTest.create(testData);

    return res.status(200).json({ mockTest });
  } catch (error) {
    console.error('Error creating mock test:', error);
    return res.status(500).json({ error: 'Failed to create mock test', details: error.message });
  }
}

