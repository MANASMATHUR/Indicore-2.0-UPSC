import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import connectToDatabase from '@/lib/mongodb';
import MockTest from '@/models/MockTest';
import PYQ from '@/models/PYQ';
import { callAIWithFallback } from '@/lib/ai-providers';
import { translateText } from '@/pages/api/ai/translate';
import { getUserPerformanceStats, getAdaptiveDifficultyMix } from '@/lib/personalizationHelpers';

const DEFAULT_DIFFICULTY_MIX = { easy: 0.3, medium: 0.5, hard: 0.2 };

function normalizeDifficultyMix(input = {}) {
  const mix = { ...DEFAULT_DIFFICULTY_MIX };
  ['easy', 'medium', 'hard'].forEach((key) => {
    if (input[key] !== undefined) {
      const value = Number(input[key]);
      if (!Number.isNaN(value) && value >= 0) {
        mix[key] = value;
      }
    }
  });
  const total = Object.values(mix).reduce((sum, value) => sum + value, 0) || 1;
  Object.keys(mix).forEach((key) => {
    mix[key] = mix[key] / total;
  });
  return mix;
}

function buildDifficultyTargets(totalQuestions, mix) {
  const targets = { easy: 0, medium: 0, hard: 0 };
  const order = ['easy', 'medium', 'hard'];
  let assigned = 0;
  order.forEach((key, index) => {
    let count = Math.round(totalQuestions * mix[key]);
    if (index === order.length - 1) {
      count = totalQuestions - assigned;
    }
    count = Math.max(0, Math.min(totalQuestions - assigned, count));
    targets[key] = count;
    assigned += count;
  });
  return targets;
}

function applyDifficultyBlueprint(questions, targets) {
  const queue = [];
  Object.entries(targets).forEach(([difficulty, count]) => {
    queue.push(...Array(count).fill(difficulty));
  });
  questions.forEach((question, idx) => {
    question.difficulty = queue[idx] || question.difficulty || 'medium';
  });
}

function buildDistribution(questions, field) {
  return questions.reduce((acc, question) => {
    const key = (question[field] || 'unspecified').toString();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const {
      examType,
      paperType,
      subject,
      duration,
      totalQuestions,
      topics,
      language = 'en',
      usePYQ = false,
      difficultyMix: requestedDifficultyMix,
      useAdaptive = true // NEW: Allow users to opt-in to adaptive difficulty
    } = req.body;

    if (!examType || !duration || !totalQuestions) {
      return res.status(400).json({ error: 'Exam type, duration, and total questions are required' });
    }

    await connectToDatabase();

    // 🎯 PERSONALIZATION: Get adaptive difficulty suggestion
    let difficultyMix;
    let adaptiveSuggestion = null;

    if (useAdaptive && !requestedDifficultyMix) {
      // Get user performance stats
      const userStats = await getUserPerformanceStats(session.user.email);

      // Get AI-suggested difficulty mix based on performance
      const suggestedMix = getAdaptiveDifficultyMix(userStats);
      difficultyMix = normalizeDifficultyMix(suggestedMix);

      adaptiveSuggestion = {
        appliedMix: difficultyMix,
        reason: userStats.averageScore === null
          ? 'No prior tests - using balanced mix'
          : userStats.averageScore >= 80
            ? `High performance (${userStats.averageScore}%) - challenging mix`
            : userStats.averageScore >= 60
              ? `Good performance (${userStats.averageScore}%) - balanced mix`
              : `Building confidence (${userStats.averageScore}%) - easier mix`,
        userStats: {
          averageScore: userStats.averageScore,
          totalTests: userStats.totalTests
        }
      };

      console.log(`✨ Adaptive difficulty: ${adaptiveSuggestion.reason}`);
    } else {
      difficultyMix = normalizeDifficultyMix(requestedDifficultyMix);
    }


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
    const difficultyTargets = buildDifficultyTargets(totalQuestions, difficultyMix);

    // Get language name for prompt
    const languageNames = {
      'en': 'English', 'hi': 'Hindi', 'mr': 'Marathi', 'ta': 'Tamil', 'bn': 'Bengali',
      'pa': 'Punjabi', 'gu': 'Gujarati', 'te': 'Telugu', 'ml': 'Malayalam',
      'kn': 'Kannada', 'es': 'Spanish'
    };
    const langName = languageNames[language] || 'English';

    const systemPrompt = `Expert ${examType} test creator. Generate exam-quality questions:

REQUIREMENTS:
1. ${examType}-relevant, aligned with official syllabus (2024-2025)
2. Verifiable facts only - no fabrication
3. Proper subject tags (${isMains ? examInfo.mains?.subjects?.[0] : examInfo.prelims?.subjects?.[0]}, etc.)
4. ${isMains ? `Subjective format, ${examInfo.mains?.wordLimits?.[1] || 250} words` : `MCQ with 4 options, negative marking: ${examInfo.prelims?.negativeMarking || '1/3'}`}

${isMains
        ? `Mains: Analytical questions, word limits ${examInfo.mains?.wordLimits?.join('/')}, cover: ${examSpecificFocus}`
        : `Prelims: Clear MCQs, cover: ${examSpecificFocus}`}

Generate in English only. Include detailed explanations.`;

    const difficultyInstruction = `Maintain approximately ${difficultyTargets.easy} easy, ${difficultyTargets.medium} medium, and ${difficultyTargets.hard} hard questions. Every question must include a difficulty label that aligns with this distribution.`;

    const preferences = session.user?.preferences || {};
    const preferredModel = preferences.model || 'sonar-pro';
    const preferredProvider = preferences.provider || 'openai';
    const preferredOpenAIModel = preferences.openAIModel || process.env.OPENAI_MODEL || process.env.OPEN_AI_MODEL || 'gpt-4o';
    const excludedProviders = preferences.excludedProviders || [];

    const userPrompt = `Create ${totalQuestions} ${examType} ${paperType || 'Prelims'} questions${subject ? ` on ${subject}` : ''}.

Specs: ${totalQuestions} questions, ${duration} min, ${isMains ? 'Subjective' : 'MCQ'}
${topics ? `Topics: ${topics.join(', ')}` : ''}
Difficulty: ${difficultyTargets.easy} easy, ${difficultyTargets.medium} medium, ${difficultyTargets.hard} hard

JSON format:
{
  "title": "${examType} ${paperType} Mock Test",
  "questions": [{
    "question": "...",
    "questionType": "${isMains ? 'subjective' : 'mcq'}",
    ${isMains
        ? `"wordLimit": ${examInfo.mains?.wordLimits?.[1] || 250}, "marks": 10, "explanation": "key points"`
        : `"options": ["A","B","C","D"], "correctAnswer": "A", "explanation": "...", "marks": 1, "negativeMarks": ${examType === 'SSC' ? 0.25 : 0.33}`},
    "subject": "${examSpecificSubjects?.[0] || 'GS'}", "topic": "...", "difficulty": "medium"
  }]
}`;

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
            source: 'pyq',
            sourceMetadata: {
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
          const { _needsOptions, _pyqAnswer, ...cleanQ } = q;
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
          explanation: q.explanation || '',
          source: 'ai'
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

    const appliedDifficultyTargets = buildDifficultyTargets(processedQuestions.length, difficultyMix);
    applyDifficultyBlueprint(processedQuestions, appliedDifficultyTargets);

    // Validate total questions count
    if (processedQuestions.length !== totalQuestions) {
      console.warn(`Warning: Generated ${processedQuestions.length} questions${usePYQ ? ` (${processedQuestions.length - aiQuestions.length} from PYQ, ${aiQuestions.length} from AI)` : ''}, expected ${totalQuestions}`);
    }

    // Translate questions to target language if not English (using batch translation)
    if (language && language !== 'en' && processedQuestions && Array.isArray(processedQuestions)) {
      const { batchTranslateQuestions } = await import('@/lib/batchTranslate');
      try {
        processedQuestions = await batchTranslateQuestions(processedQuestions, language);
        console.log('Mock test batch translation completed successfully');
      } catch (translationError) {
        console.warn('Batch translation failed, using English content:', translationError.message);
        // Continue with English content if translation fails
      }
    }

    const subjectDistribution = buildDistribution(processedQuestions, 'subject');
    const sourceDistribution = buildDistribution(processedQuestions, 'source');

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
      tags: [examType, paperType, subject].filter(Boolean),
      blueprint: {
        requestedMix: difficultyMix,
        appliedTargets: appliedDifficultyTargets,
        subjectDistribution,
        sourceDistribution
      },
      // NEW: Include adaptive personalization info
      adaptiveSuggestion
    };

    const mockTest = await MockTest.create(testData);

    // Return with personalization message if applicable
    const response = { mockTest };
    if (adaptiveSuggestion) {
      response.personalization = {
        message: adaptiveSuggestion.reason,
        appliedMix: adaptiveSuggestion.appliedMix,
        userStats: adaptiveSuggestion.userStats
      };
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error('Error creating mock test:', error);
    return res.status(500).json({ error: 'Failed to create mock test', details: error.message });
  }
}

