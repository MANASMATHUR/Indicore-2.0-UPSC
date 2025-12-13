import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import connectToDatabase from '@/lib/mongodb';
import MockTestResult from '@/models/MockTestResult';
import MockTest from '@/models/MockTest';
import { callOpenAIAPI, getOpenAIKey } from '@/lib/ai-providers';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { resultId } = req.body;

    if (!resultId) {
      return res.status(400).json({ error: 'Result ID is required' });
    }

    await connectToDatabase();

    const result = await MockTestResult.findById(resultId);
    if (!result) {
      return res.status(404).json({ error: 'Result not found' });
    }

    if (result.userId.toString() !== session.user.id) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    const test = await MockTest.findById(result.testId);
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }

    const openAIKey = getOpenAIKey();
    if (!openAIKey) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    // Build detailed analysis prompt
    const analysisQuestions = result.answers.map((answer, index) => {
      const question = test.questions[index];
      if (!question) return null;

      const isMCQ = question.questionType === 'mcq';
      const userAnswer = isMCQ ? answer.selectedAnswer : answer.textAnswer;
      const correctAnswer = isMCQ ? question.correctAnswer : null;
      const isCorrect = isMCQ ? answer.isCorrect : null;

      return {
        questionNumber: index + 1,
        question: question.question,
        questionType: question.questionType,
        subject: question.subject,
        topic: question.topic,
        userAnswer: userAnswer || 'Not attempted',
        correctAnswer: correctAnswer || question.explanation,
        isCorrect: isCorrect,
        explanation: question.explanation,
        marksObtained: answer.marksObtained,
        timeSpent: answer.timeSpent
      };
    }).filter(Boolean);

    const systemPrompt = `You are an expert exam analyst for ${test.examType} competitive exams. Your task is to provide comprehensive, detailed analysis of mock test performance.

CRITICAL REQUIREMENTS:
1. **DETAILED QUESTION ANALYSIS**: For each question, analyze:
   - Why the answer was correct or incorrect
   - What concepts were tested
   - Common mistakes students make
   - How to improve understanding of this topic
   - Related topics that should be studied

2. **EXAM-RELEVANT INSIGHTS**: Connect each question to ${test.examType} exam requirements:
   - Which GS paper or section it relates to
   - How similar questions appear in actual exams
   - PYQ patterns and trends
   - Answer writing strategies (for Mains)

3. **SUBJECT-WISE ANALYSIS**: Provide insights for each subject:
   - Strengths and weaknesses
   - Topics that need more focus
   - Recommended study approach

4. **IMPROVEMENT RECOMMENDATIONS**: 
   - Specific topics to revise
   - Study strategies
   - Practice recommendations
   - Time management tips

5. **VERIFIABLE INFORMATION**: Only provide factual, verifiable information. Tag subjects properly (Polity, History, Geography, etc.) and mention relevant GS papers.

Provide analysis in JSON format with detailed breakdown for each question and overall performance insights.`;

    const userPrompt = `Analyze the following ${test.examType} ${test.paperType} mock test performance:

**Test Details:**
- Exam Type: ${test.examType}
- Paper Type: ${test.paperType}
- Total Questions: ${test.totalQuestions}
- Correct Answers: ${result.correctAnswers}
- Wrong Answers: ${result.wrongAnswers}
- Unattempted: ${result.unattempted}
- Marks Obtained: ${result.marksObtained}/${result.totalMarks}
- Percentage: ${result.percentage.toFixed(2)}%

**Subject-wise Performance:**
${result.subjectWisePerformance.map(s => `- ${s.subject}: ${s.correct}/${s.total} correct, ${s.marks} marks`).join('\n')}

**Topic-wise Performance:**
${result.topicWisePerformance.map(t => `- ${t.topic}: ${t.correct}/${t.total} correct, ${t.marks} marks`).join('\n')}

**Question-wise Details:**
${analysisQuestions.map(q => `
Question ${q.questionNumber} (${q.subject} - ${q.topic}):
Question: ${q.question}
User Answer: ${q.userAnswer}
${q.correctAnswer ? `Correct Answer: ${q.correctAnswer}` : ''}
${q.isCorrect !== null ? `Result: ${q.isCorrect ? 'Correct' : 'Incorrect'}` : 'Subjective (needs evaluation)'}
Marks: ${q.marksObtained}
Time Spent: ${q.timeSpent}s
Explanation: ${q.explanation}
`).join('\n')}

Provide comprehensive analysis in JSON format:
{
  "overallAnalysis": {
    "summary": "Overall performance summary",
    "strengths": ["Strength 1", "Strength 2"],
    "weaknesses": ["Weakness 1", "Weakness 2"],
    "recommendations": ["Recommendation 1", "Recommendation 2"]
  },
  "subjectWiseAnalysis": [
    {
      "subject": "Subject name",
      "performance": "Good/Average/Needs Improvement",
      "strengths": ["Strength 1"],
      "weaknesses": ["Weakness 1"],
      "topicsToFocus": ["Topic 1", "Topic 2"],
      "studyStrategy": "Recommended study approach"
    }
  ],
  "questionAnalysis": [
    {
      "questionNumber": 1,
      "analysis": "Detailed analysis of why answer was correct/incorrect",
      "conceptsTested": ["Concept 1", "Concept 2"],
      "commonMistakes": ["Mistake 1"],
      "improvementTips": "How to improve understanding",
      "relatedTopics": ["Related topic 1"],
      "examRelevance": "How this relates to ${test.examType} exam",
      "gsPaper": "GS-1/GS-2/GS-3/GS-4 or Prelims"
    }
  ],
  "improvementPlan": {
    "immediateActions": ["Action 1", "Action 2"],
    "studyPlan": "Recommended study plan",
    "practiceRecommendations": ["Recommendation 1"],
    "timeManagement": "Time management tips"
  }
}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const openAIModel = process.env.OPENAI_MODEL || process.env.OPEN_AI_MODEL || 'gpt-4o';
    const analysisContent = await callOpenAIAPI(
      messages,
      openAIModel,
      undefined, // No token limit for OpenAI
      0.5
    );

    let analysis;
    try {
      const jsonMatch = analysisContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in analysis');
      }
    } catch (parseError) {
      console.error('Failed to parse analysis:', parseError);
      return res.status(500).json({
        error: 'Failed to parse analysis',
        details: parseError.message,
        rawContent: analysisContent.substring(0, 500)
      });
    }

    // Update result with analysis
    result.detailedAnalysis = analysis;
    result.analyzedAt = new Date();
    await result.save();

    return res.status(200).json({
      analysis,
      resultId: result._id
    });
  } catch (error) {
    console.error('Error analyzing test result:', error);
    return res.status(500).json({ error: 'Failed to analyze test result', details: error.message });
  }
}

